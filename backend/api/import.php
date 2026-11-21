<?php
// MediPlus safe CSV import API.
// Phase 2 imports only patients, services and cabinets. Preview never writes to the database.

require_once __DIR__ . '/../config/database.php';

session_start();

const IMPORT_MAX_FILE_SIZE = 2097152; // 2 MB

function importError(string $message, int $status = 400, array $details = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => $message,
        'details' => $details,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function importSuccess(array $data, string $message = 'OK'): void
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function currentImportUser(PDO $pdo): array
{
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        importError('Unauthorized.', 401);
    }

    $stmt = $pdo->prepare(
        'SELECT id, login, role, status
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();

    if (!$user) {
        importError('Unauthorized.', 401);
    }

    if (($user['status'] ?? '') !== 'active') {
        importError('Account is not active.', 403);
    }

    $role = strtolower((string) ($user['role'] ?? $_SESSION['role'] ?? ''));
    if (!in_array($role, ['recepcja', 'administrator'], true)) {
        importError('Forbidden.', 403);
    }

    return $user;
}

function normalizeHeader(string $header): string
{
    $header = preg_replace('/^\xEF\xBB\xBF/', '', $header);
    $header = trim($header);
    $header = strtolower($header);
    $header = str_replace([' ', '-'], '_', $header);
    return preg_replace('/[^a-z0-9_]/', '', $header) ?: '';
}

function cleanImportText($value): string
{
    $value = trim((string) ($value ?? ''));
    $value = strip_tags($value);
    return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value) ?? '';
}

function parseBoolStatus($value, string $activePolish = 'Aktywny', string $inactivePolish = 'Nieaktywny'): ?int
{
    $normalized = strtolower(trim((string) ($value ?? '')));
    if ($normalized === '') {
        return 1;
    }

    $activeValues = ['active', 'aktywny', 'aktywna', strtolower($activePolish), '1', 'true', 'tak'];
    $inactiveValues = ['inactive', 'nieaktywny', 'nieaktywna', strtolower($inactivePolish), '0', 'false', 'nie'];

    if (in_array($normalized, $activeValues, true)) {
        return 1;
    }
    if (in_array($normalized, $inactiveValues, true)) {
        return 0;
    }
    return null;
}

function normalizeBloodGroup($value): string
{
    $value = trim((string) ($value ?? ''));
    $value = str_replace(['−', '–', '—'], '-', $value);
    return $value;
}

function normalizeGender($value): string
{
    $value = strtolower(trim((string) ($value ?? '')));
    return match ($value) {
        '', 'brak' => '',
        'male', 'm', 'mezczyzna', 'mężczyzna' => 'male',
        'female', 'f', 'kobieta' => 'female',
        'other', 'inne' => 'other',
        default => $value,
    };
}

function isValidImportDate(string $value): bool
{
    if ($value === '') {
        return true;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return false;
    }
    [$year, $month, $day] = array_map('intval', explode('-', $value));
    return checkdate($month, $day, $year);
}

function importCsvRows(): array
{
    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
        importError('CSV file is required.', 422);
    }

    $file = $_FILES['file'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        importError('File upload failed.', 422);
    }

    if ((int) ($file['size'] ?? 0) > IMPORT_MAX_FILE_SIZE) {
        importError('CSV file is too large. Maximum size is 2 MB.', 422);
    }

    $name = (string) ($file['name'] ?? '');
    if (!preg_match('/\.csv$/i', $name)) {
        importError('Only CSV files are accepted.', 422);
    }

    $handle = fopen((string) $file['tmp_name'], 'r');
    if (!$handle) {
        importError('Cannot read uploaded CSV file.', 422);
    }

    $rawHeaders = fgetcsv($handle, 0, ';');
    if (!is_array($rawHeaders) || $rawHeaders === []) {
        fclose($handle);
        importError('CSV header row is missing.', 422);
    }

    $headers = array_map('normalizeHeader', $rawHeaders);
    $rows = [];
    $line = 1;

    while (($data = fgetcsv($handle, 0, ';')) !== false) {
        $line++;
        if (count(array_filter($data, static fn($value) => trim((string) $value) !== '')) === 0) {
            continue;
        }

        $row = ['_line' => $line];
        foreach ($headers as $index => $header) {
            if ($header === '') {
                continue;
            }
            $row[$header] = cleanImportText($data[$index] ?? '');
        }
        $rows[] = $row;
    }

    fclose($handle);
    return $rows;
}

function validateRequiredColumns(array $row, array $columns, array &$errors): void
{
    foreach ($columns as $column) {
        if (!array_key_exists($column, $row)) {
            $errors[] = "Brak kolumny: {$column}.";
        }
    }
}

function patientDuplicateKey(array $row): string
{
    $pesel = trim((string) ($row['pesel'] ?? ''));
    if ($pesel !== '') {
        return 'pesel:' . $pesel;
    }
    return 'phone-last:' . strtolower(trim((string) ($row['phone'] ?? '')) . '|' . trim((string) ($row['last_name'] ?? '')));
}

function serviceDuplicateKey(array $row): string
{
    return strtolower(trim((string) ($row['name'] ?? '')) . '|' . trim((string) ($row['specialization'] ?? '')));
}

function cabinetDuplicateKey(array $row): string
{
    return strtolower(trim((string) ($row['room_number'] ?? '')));
}

function patientExists(PDO $pdo, array $row): bool
{
    $pesel = trim((string) ($row['pesel'] ?? ''));
    if ($pesel !== '') {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM patients WHERE pesel = :pesel');
        $stmt->execute([':pesel' => $pesel]);
        return (int) $stmt->fetchColumn() > 0;
    }

    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM patients
         WHERE phone = :phone AND LOWER(last_name) = LOWER(:last_name)'
    );
    $stmt->execute([
        ':phone' => trim((string) ($row['phone'] ?? '')),
        ':last_name' => trim((string) ($row['last_name'] ?? '')),
    ]);
    return (int) $stmt->fetchColumn() > 0;
}

function serviceExists(PDO $pdo, array $row): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM medical_services ms
         INNER JOIN specializations s ON s.id = ms.specialization_id
         WHERE LOWER(ms.name) = LOWER(:name)
           AND LOWER(s.name) = LOWER(:specialization)'
    );
    $stmt->execute([
        ':name' => trim((string) ($row['name'] ?? '')),
        ':specialization' => trim((string) ($row['specialization'] ?? '')),
    ]);
    return (int) $stmt->fetchColumn() > 0;
}

function cabinetExists(PDO $pdo, array $row): bool
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM cabinets WHERE LOWER(room_number) = LOWER(:room_number)');
    $stmt->execute([':room_number' => trim((string) ($row['room_number'] ?? ''))]);
    return (int) $stmt->fetchColumn() > 0;
}

function getSpecializationId(PDO $pdo, string $name): int
{
    $name = trim($name);
    $stmt = $pdo->prepare('SELECT id FROM specializations WHERE name = :name LIMIT 1');
    $stmt->execute([':name' => $name]);
    $id = $stmt->fetchColumn();
    if ($id !== false) {
        return (int) $id;
    }

    $stmt = $pdo->prepare('INSERT INTO specializations (name, description) VALUES (:name, :description)');
    $stmt->execute([
        ':name' => $name,
        ':description' => 'Specjalizacja dodana podczas importu usług.',
    ]);
    return (int) $pdo->lastInsertId();
}

function validatePatients(PDO $pdo, array $rows): array
{
    $valid = [];
    $preview = [];
    $errors = [];
    $warnings = [];
    $duplicates = 0;
    $seen = [];
    $allowedBloodGroups = ['', 'unknown', 'A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-', '0 Rh+', '0 Rh-'];

    foreach ($rows as $row) {
        $rowErrors = [];
        validateRequiredColumns($row, ['first_name', 'last_name', 'phone', 'pesel'], $rowErrors);

        $row['first_name'] = trim((string) ($row['first_name'] ?? ''));
        $row['last_name'] = trim((string) ($row['last_name'] ?? ''));
        $row['phone'] = trim((string) ($row['phone'] ?? ''));
        $row['pesel'] = preg_replace('/\D+/', '', (string) ($row['pesel'] ?? '')) ?? '';
        $row['blood_group'] = normalizeBloodGroup($row['blood_group'] ?? '');
        $row['gender'] = normalizeGender($row['gender'] ?? '');
        $row['birth_date'] = trim((string) ($row['birth_date'] ?? ''));

        if ($row['first_name'] === '') $rowErrors[] = 'Imię jest wymagane.';
        if ($row['last_name'] === '') $rowErrors[] = 'Nazwisko jest wymagane.';
        if ($row['phone'] === '' && $row['pesel'] === '') $rowErrors[] = 'Wymagany telefon albo PESEL.';
        if ($row['pesel'] !== '' && !preg_match('/^\d{11}$/', $row['pesel'])) $rowErrors[] = 'PESEL musi mieć 11 cyfr.';
        if (($row['email'] ?? '') !== '' && !filter_var($row['email'], FILTER_VALIDATE_EMAIL)) $rowErrors[] = 'Nieprawidłowy e-mail.';
        if (!in_array($row['blood_group'], $allowedBloodGroups, true)) $rowErrors[] = 'Nieprawidłowa grupa krwi.';

        if (!isValidImportDate($row['birth_date'])) $rowErrors[] = 'Data urodzenia musi miec format RRRR-MM-DD.';
        if ($row['gender'] !== '' && !in_array($row['gender'], ['male', 'female', 'other'], true)) $rowErrors[] = 'Nieprawidlowa plec.';

        $key = patientDuplicateKey($row);
        $duplicate = $key !== 'phone-last:|' && (isset($seen[$key]) || patientExists($pdo, $row));
        if ($duplicate) {
            $duplicates++;
            $warnings[] = 'Duplikat pacjenta w linii ' . (int) $row['_line'] . '.';
        }
        $seen[$key] = true;

        $previewRow = $row;
        unset($previewRow['_line']);
        $preview[] = [
            'line' => (int) $row['_line'],
            'status' => $rowErrors === [] && !$duplicate ? 'valid' : ($duplicate ? 'duplicate' : 'invalid'),
            'errors' => $rowErrors,
            'row' => $previewRow,
        ];

        if ($rowErrors !== []) {
            $errors[] = ['line' => (int) $row['_line'], 'errors' => $rowErrors];
            continue;
        }
        if ($duplicate) {
            continue;
        }

        $valid[] = $row;
    }

    return compact('valid', 'preview', 'errors', 'warnings', 'duplicates');
}

function validateServices(PDO $pdo, array $rows): array
{
    $valid = [];
    $preview = [];
    $errors = [];
    $warnings = [];
    $duplicates = 0;
    $seen = [];
    $allowedDurations = [15, 20, 30, 45, 60, 90, 120];

    foreach ($rows as $row) {
        $rowErrors = [];
        validateRequiredColumns($row, ['name', 'specialization', 'duration', 'price'], $rowErrors);

        $row['name'] = trim((string) ($row['name'] ?? ''));
        $row['specialization'] = trim((string) ($row['specialization'] ?? ''));
        $row['duration'] = (int) preg_replace('/[^\d]/', '', (string) ($row['duration'] ?? ''));
        $row['price'] = str_replace(',', '.', (string) ($row['price'] ?? ''));
        $row['is_active'] = parseBoolStatus($row['status'] ?? '', 'Aktywna', 'Nieaktywna');

        if ($row['name'] === '') $rowErrors[] = 'Nazwa usługi jest wymagana.';
        if ($row['specialization'] === '') $rowErrors[] = 'Specjalizacja jest wymagana.';
        if (!in_array($row['duration'], $allowedDurations, true)) $rowErrors[] = 'Czas trwania musi być jednym z: 15, 20, 30, 45, 60, 90, 120.';
        if (!is_numeric($row['price']) || (float) $row['price'] < 0 || (float) $row['price'] > 10000) $rowErrors[] = 'Cena musi być w zakresie 0-10000.';
        if ($row['is_active'] === null) $rowErrors[] = 'Nieprawidłowy status usługi.';

        $key = serviceDuplicateKey($row);
        $duplicate = $key !== '|' && (isset($seen[$key]) || serviceExists($pdo, $row));
        if ($duplicate) {
            $duplicates++;
            $warnings[] = 'Duplikat usługi w linii ' . (int) $row['_line'] . '.';
        }
        $seen[$key] = true;

        $previewRow = $row;
        unset($previewRow['_line']);
        $preview[] = [
            'line' => (int) $row['_line'],
            'status' => $rowErrors === [] && !$duplicate ? 'valid' : ($duplicate ? 'duplicate' : 'invalid'),
            'errors' => $rowErrors,
            'row' => $previewRow,
        ];

        if ($rowErrors !== []) {
            $errors[] = ['line' => (int) $row['_line'], 'errors' => $rowErrors];
            continue;
        }
        if ($duplicate) {
            continue;
        }

        $valid[] = $row;
    }

    return compact('valid', 'preview', 'errors', 'warnings', 'duplicates');
}

function normalizeCabinetType($value): string
{
    $value = trim((string) ($value ?? ''));
    $value = str_replace('Punkt PobraЕ„', 'Punkt Pobrań', $value);
    return $value;
}

function validateCabinets(PDO $pdo, array $rows): array
{
    $valid = [];
    $preview = [];
    $errors = [];
    $warnings = [];
    $duplicates = 0;
    $seen = [];
    $allowedTypes = ['Administracyjny', 'Uniwersalny', 'Ginekologiczny', 'Psychologiczny', 'Fizjoterapia', 'Zabiegowy', 'Punkt Pobrań'];

    foreach ($rows as $row) {
        $rowErrors = [];
        validateRequiredColumns($row, ['room_number', 'name', 'cabinet_type', 'floor'], $rowErrors);

        $row['room_number'] = trim((string) ($row['room_number'] ?? ''));
        $row['name'] = trim((string) ($row['name'] ?? ''));
        $row['cabinet_type'] = normalizeCabinetType($row['cabinet_type'] ?? '');
        $row['floor'] = trim((string) ($row['floor'] ?? ''));
        $row['is_active'] = parseBoolStatus($row['status'] ?? '', 'Aktywny', 'Nieaktywny');

        if ($row['room_number'] === '') $rowErrors[] = 'Numer gabinetu jest wymagany.';
        if ($row['name'] === '') $rowErrors[] = 'Nazwa gabinetu jest wymagana.';
        if (!in_array($row['cabinet_type'], $allowedTypes, true)) $rowErrors[] = 'Nieprawidłowy typ gabinetu.';
        if (!in_array($row['floor'], ['0', '1'], true)) $rowErrors[] = 'Piętro może mieć wartość 0 albo 1.';
        if ($row['is_active'] === null) $rowErrors[] = 'Nieprawidłowy status gabinetu.';

        $key = cabinetDuplicateKey($row);
        $duplicate = $key !== '' && (isset($seen[$key]) || cabinetExists($pdo, $row));
        if ($duplicate) {
            $duplicates++;
            $warnings[] = 'Duplikat gabinetu w linii ' . (int) $row['_line'] . '.';
        }
        $seen[$key] = true;

        $previewRow = $row;
        unset($previewRow['_line']);
        $preview[] = [
            'line' => (int) $row['_line'],
            'status' => $rowErrors === [] && !$duplicate ? 'valid' : ($duplicate ? 'duplicate' : 'invalid'),
            'errors' => $rowErrors,
            'row' => $previewRow,
        ];

        if ($rowErrors !== []) {
            $errors[] = ['line' => (int) $row['_line'], 'errors' => $rowErrors];
            continue;
        }
        if ($duplicate) {
            continue;
        }

        $valid[] = $row;
    }

    return compact('valid', 'preview', 'errors', 'warnings', 'duplicates');
}

function buildPreview(PDO $pdo, string $type, array $rows): array
{
    return match ($type) {
        'patients' => validatePatients($pdo, $rows),
        'services' => validateServices($pdo, $rows),
        'cabinets' => validateCabinets($pdo, $rows),
        default => importError('Unsupported import type.', 400),
    };
}

function storeImportSession(string $type, array $rows, int $invalidRows = 0, int $duplicates = 0): string
{
    $token = bin2hex(random_bytes(16));
    $_SESSION['mediplus_imports'][$token] = [
        'type' => $type,
        'rows' => $rows,
        'invalid_rows' => $invalidRows,
        'duplicates' => $duplicates,
        'created_at' => time(),
    ];
    return $token;
}

function insertPatients(PDO $pdo, array $rows): array
{
    $summary = ['inserted' => 0, 'updated' => 0, 'skipped' => 0, 'invalidSkipped' => 0, 'duplicatesSkipped' => 0];
    $stmt = $pdo->prepare(
        'INSERT INTO patients (
            first_name, last_name, pesel, birth_date, gender, phone, email,
            blood_group, allergies, notes, profile_status, personal_data_consent
         ) VALUES (
            :first_name, :last_name, :pesel, :birth_date, :gender, :phone, :email,
            :blood_group, :allergies, :notes, :profile_status, 0
         )'
    );

    foreach ($rows as $row) {
        if (patientExists($pdo, $row)) {
            $summary['duplicatesSkipped']++;
            $summary['skipped']++;
            continue;
        }

        $profileStatus = ($row['pesel'] ?? '') !== '' && ($row['birth_date'] ?? '') !== '' && ($row['gender'] ?? '') !== ''
            ? 'complete'
            : 'incomplete';
        $stmt->execute([
            ':first_name' => $row['first_name'],
            ':last_name' => $row['last_name'],
            ':pesel' => ($row['pesel'] ?? '') !== '' ? $row['pesel'] : null,
            ':birth_date' => ($row['birth_date'] ?? '') !== '' ? $row['birth_date'] : null,
            ':gender' => ($row['gender'] ?? '') !== '' ? $row['gender'] : null,
            ':phone' => $row['phone'] ?? '',
            ':email' => ($row['email'] ?? '') !== '' ? $row['email'] : null,
            ':blood_group' => ($row['blood_group'] ?? '') !== '' ? $row['blood_group'] : 'unknown',
            ':allergies' => ($row['allergies'] ?? '') !== '' ? $row['allergies'] : null,
            ':notes' => ($row['notes'] ?? '') !== '' ? $row['notes'] : null,
            ':profile_status' => $profileStatus,
        ]);
        $summary['inserted']++;
    }

    return $summary;
}

function insertServices(PDO $pdo, array $rows): array
{
    $summary = ['inserted' => 0, 'updated' => 0, 'skipped' => 0, 'invalidSkipped' => 0, 'duplicatesSkipped' => 0];
    $stmt = $pdo->prepare(
        'INSERT INTO medical_services
            (specialization_id, name, description, price, duration_minutes, is_active)
         VALUES
            (:specialization_id, :name, :description, :price, :duration_minutes, :is_active)'
    );

    foreach ($rows as $row) {
        if (serviceExists($pdo, $row)) {
            $summary['duplicatesSkipped']++;
            $summary['skipped']++;
            continue;
        }

        $stmt->execute([
            ':specialization_id' => getSpecializationId($pdo, $row['specialization']),
            ':name' => $row['name'],
            ':description' => ($row['description'] ?? '') !== '' ? $row['description'] : null,
            ':price' => (float) $row['price'],
            ':duration_minutes' => (int) $row['duration'],
            ':is_active' => (int) $row['is_active'],
        ]);
        $summary['inserted']++;
    }

    return $summary;
}

function insertCabinets(PDO $pdo, array $rows): array
{
    $summary = ['inserted' => 0, 'updated' => 0, 'skipped' => 0, 'invalidSkipped' => 0, 'duplicatesSkipped' => 0];
    $stmt = $pdo->prepare(
        'INSERT INTO cabinets
            (name, room_number, cabinet_type, floor, description, equipment, is_active)
         VALUES
            (:name, :room_number, :cabinet_type, :floor, :description, :equipment, :is_active)'
    );

    foreach ($rows as $row) {
        if (cabinetExists($pdo, $row)) {
            $summary['duplicatesSkipped']++;
            $summary['skipped']++;
            continue;
        }

        $stmt->execute([
            ':name' => $row['name'],
            ':room_number' => $row['room_number'],
            ':cabinet_type' => $row['cabinet_type'],
            ':floor' => $row['floor'],
            ':description' => ($row['description'] ?? '') !== '' ? $row['description'] : null,
            ':equipment' => ($row['equipment'] ?? '') !== '' ? $row['equipment'] : null,
            ':is_active' => (int) $row['is_active'],
        ]);
        $summary['inserted']++;
    }

    return $summary;
}

function confirmImport(PDO $pdo, string $type, string $token): array
{
    $session = $_SESSION['mediplus_imports'][$token] ?? null;
    if (!$session || ($session['type'] ?? '') !== $type) {
        importError('Import preview expired. Check the file again.', 422);
    }

    if ((time() - (int) ($session['created_at'] ?? 0)) > 1800) {
        unset($_SESSION['mediplus_imports'][$token]);
        importError('Import preview expired. Check the file again.', 422);
    }

    $rows = is_array($session['rows'] ?? null) ? $session['rows'] : [];
    $pdo->beginTransaction();
    try {
        $summary = match ($type) {
            'patients' => insertPatients($pdo, $rows),
            'services' => insertServices($pdo, $rows),
            'cabinets' => insertCabinets($pdo, $rows),
            default => importError('Unsupported import type.', 400),
        };
        $previewInvalid = (int) ($session['invalid_rows'] ?? 0);
        $previewDuplicates = (int) ($session['duplicates'] ?? 0);
        $summary['invalidSkipped'] += $previewInvalid;
        $summary['duplicatesSkipped'] += $previewDuplicates;
        $summary['skipped'] += $previewInvalid + $previewDuplicates;
        $pdo->commit();
        unset($_SESSION['mediplus_imports'][$token]);
        return $summary;
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    importError('Method not allowed.', 405);
}

try {
    $pdo = getDatabaseConnection();
    currentImportUser($pdo);

    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    $type = $_GET['type'] ?? $_POST['type'] ?? '';
    if (!in_array($type, ['patients', 'services', 'cabinets'], true)) {
        importError('Unsupported import type.', 400);
    }

    if ($action === 'preview') {
        $rows = importCsvRows();
        $result = buildPreview($pdo, $type, $rows);
        $validRows = $result['valid'];
        $token = storeImportSession($type, $validRows, count($result['errors']), (int) $result['duplicates']);

        importSuccess([
            'token' => $token,
            'type' => $type,
            'totalRows' => count($rows),
            'validRows' => count($validRows),
            'invalidRows' => count($result['errors']),
            'duplicates' => (int) $result['duplicates'],
            'warnings' => array_slice($result['warnings'], 0, 20),
            'errors' => array_slice($result['errors'], 0, 20),
            'preview' => array_slice($result['preview'], 0, 10),
        ], 'Import preview prepared.');
    }

    if ($action === 'confirm') {
        $token = cleanImportText($_POST['token'] ?? '');
        if ($token === '') {
            importError('Import token is required.', 422);
        }
        $summary = confirmImport($pdo, $type, $token);
        importSuccess($summary, 'Import completed.');
    }

    importError('Unknown import action.', 400);
} catch (Throwable $exception) {
    importError('Import failed.', 500);
}
