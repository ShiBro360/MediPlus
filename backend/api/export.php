<?php
// MediPlus export API.
// Read-only downloads for reception/admin users. Import is intentionally not implemented here.

require_once __DIR__ . '/../config/database.php';

session_start();

function exportError(string $message, int $status = 400): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function currentExportUser(PDO $pdo): array
{
    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        exportError('Unauthorized.', 401);
    }

    $stmt = $pdo->prepare(
        'SELECT id, login, email, role, status
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();

    if (!$user) {
        exportError('Unauthorized.', 401);
    }

    if (($user['status'] ?? '') !== 'active') {
        exportError('Account is not active.', 403);
    }

    $role = strtolower((string) ($user['role'] ?? $_SESSION['role'] ?? ''));
    if (!in_array($role, ['recepcja', 'administrator'], true)) {
        exportError('Forbidden.', 403);
    }

    return $user;
}

function fetchAllRows(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table'
    );
    $stmt->execute([':table' => $table]);
    return (int) $stmt->fetchColumn() > 0;
}

function csvValue($value): string
{
    if ($value === null) {
        return '';
    }

    if (is_bool($value)) {
        return $value ? '1' : '0';
    }

    return (string) $value;
}

function sendCsvDownload(string $filename, array $headers, array $rows): void
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');

    echo "\xEF\xBB\xBF";
    $output = fopen('php://output', 'w');
    fputcsv($output, $headers, ';');

    foreach ($rows as $row) {
        fputcsv($output, array_map('csvValue', $row), ';');
    }

    fclose($output);
    exit;
}

function sendJsonDownload(string $filename, array $payload): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function patientRows(PDO $pdo): array
{
    return fetchAllRows(
        $pdo,
        'SELECT id, first_name, last_name, pesel, birth_date, gender, phone, email,
                blood_group, allergies, notes, created_at
         FROM patients
         ORDER BY id'
    );
}

function doctorRows(PDO $pdo): array
{
    return fetchAllRows(
        $pdo,
        'SELECT d.id,
                TRIM(CONCAT(d.first_name, " ", d.last_name)) AS full_name,
                s.name AS specialization,
                c.name AS cabinet_name,
                c.room_number AS cabinet_room_number,
                d.email,
                d.phone,
                d.status
         FROM doctors d
         LEFT JOIN specializations s ON s.id = d.specialization_id
         LEFT JOIN cabinets c ON c.id = d.cabinet_id
         ORDER BY d.id'
    );
}

function appointmentRows(PDO $pdo): array
{
    return fetchAllRows(
        $pdo,
        'SELECT a.id,
                TRIM(CONCAT(p.first_name, " ", p.last_name)) AS patient,
                TRIM(CONCAT("dr ", d.first_name, " ", d.last_name)) AS doctor,
                ms.name AS service,
                a.appointment_date AS date,
                a.start_time,
                a.end_time,
                c.name AS cabinet,
                a.status
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN doctors d ON d.id = a.doctor_id
         LEFT JOIN medical_services ms ON ms.id = a.service_id
         LEFT JOIN cabinets c ON c.id = a.cabinet_id
         ORDER BY a.appointment_date DESC, a.start_time DESC, a.id DESC'
    );
}

function cabinetRows(PDO $pdo): array
{
    return fetchAllRows(
        $pdo,
        'SELECT id,
                room_number,
                name,
                cabinet_type,
                floor,
                CASE WHEN is_active = 1 THEN "active" ELSE "inactive" END AS status
         FROM cabinets
         ORDER BY room_number, name'
    );
}

function serviceRows(PDO $pdo): array
{
    return fetchAllRows(
        $pdo,
        'SELECT ms.id,
                ms.name,
                s.name AS specialization,
                ms.duration_minutes AS duration,
                ms.price,
                CASE WHEN ms.is_active = 1 THEN "active" ELSE "inactive" END AS status
         FROM medical_services ms
         LEFT JOIN specializations s ON s.id = ms.specialization_id
         ORDER BY s.name, ms.name'
    );
}

function systemSetting(PDO $pdo, string $key): array
{
    if (!tableExists($pdo, 'system_settings')) {
        return [];
    }

    $stmt = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key = :key LIMIT 1');
    $stmt->execute([':key' => $key]);
    $raw = $stmt->fetchColumn();
    if (!$raw) {
        return [];
    }

    $decoded = json_decode((string) $raw, true);
    return is_array($decoded) ? $decoded : [];
}

function fullBackupPayload(PDO $pdo): array
{
    $clinicSettings = systemSetting($pdo, 'clinic');
    if (tableExists($pdo, 'clinic_working_hours')) {
        $clinicSettings['working_hours'] = fetchAllRows(
            $pdo,
            'SELECT weekday, is_closed, open_time, close_time, updated_at
             FROM clinic_working_hours
             ORDER BY weekday'
        );
    }

    $appointmentSettings = systemSetting($pdo, 'appointment');
    if (tableExists($pdo, 'appointment_settings')) {
        $appointmentSettings['registration_rules'] = fetchAllRows(
            $pdo,
            'SELECT allow_overlaps, auto_complete_past, hide_inactive_services,
                    min_interval_minutes, updated_at
             FROM appointment_settings
             ORDER BY id
             LIMIT 1'
        );
    }

    $doctorAbsences = tableExists($pdo, 'doctor_absences')
        ? fetchAllRows(
            $pdo,
            'SELECT id, doctor_id, type, date_from, date_to, time_from, time_to,
                    note, status, created_at, updated_at, cancelled_at
             FROM doctor_absences
             ORDER BY id'
        )
        : [];

    $users = fetchAllRows(
        $pdo,
        'SELECT login, email, role, status, doctor_id AS linked_doctor_id
         FROM users
         ORDER BY id'
    );

    return [
        'exported_at' => gmdate('c'),
        'version' => '1.0.0',
        'patients' => patientRows($pdo),
        'doctors' => fetchAllRows(
            $pdo,
            'SELECT d.id, d.first_name, d.last_name, s.name AS specialization,
                    d.cabinet_id, c.name AS cabinet_name, c.room_number AS cabinet_room_number,
                    d.email, d.phone, d.status, d.is_active, d.schedule_json,
                    d.avatar_data_url, d.created_at, d.updated_at
             FROM doctors d
             LEFT JOIN specializations s ON s.id = d.specialization_id
             LEFT JOIN cabinets c ON c.id = d.cabinet_id
             ORDER BY d.id'
        ),
        'appointments' => appointmentRows($pdo),
        'cabinets' => fetchAllRows(
            $pdo,
            'SELECT id, room_number, name, cabinet_type, floor, description,
                    equipment, is_active, created_at
             FROM cabinets
             ORDER BY id'
        ),
        'services' => serviceRows($pdo),
        'doctor_absences' => $doctorAbsences,
        'clinic_settings' => $clinicSettings,
        'appointment_settings' => $appointmentSettings,
        'security_settings' => systemSetting($pdo, 'security'),
        'users' => $users,
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    exportError('Method not allowed.', 405);
}

try {
    $pdo = getDatabaseConnection();
    currentExportUser($pdo);

    $action = $_GET['action'] ?? '';
    $date = date('Ymd_His');

    switch ($action) {
        case 'patients_csv':
            sendCsvDownload(
                "mediplus_patients_{$date}.csv",
                ['id', 'first_name', 'last_name', 'pesel', 'birth_date', 'gender', 'phone', 'email', 'blood_group', 'allergies', 'notes', 'created_at'],
                patientRows($pdo)
            );
            break;

        case 'doctors_csv':
            sendCsvDownload(
                "mediplus_doctors_{$date}.csv",
                ['id', 'full_name', 'specialization', 'cabinet_name', 'cabinet_room_number', 'email', 'phone', 'status'],
                doctorRows($pdo)
            );
            break;

        case 'appointments_csv':
            sendCsvDownload(
                "mediplus_appointments_{$date}.csv",
                ['id', 'patient', 'doctor', 'service', 'date', 'start_time', 'end_time', 'cabinet', 'status'],
                appointmentRows($pdo)
            );
            break;

        case 'cabinets_csv':
            sendCsvDownload(
                "mediplus_cabinets_{$date}.csv",
                ['id', 'room_number', 'name', 'cabinet_type', 'floor', 'status'],
                cabinetRows($pdo)
            );
            break;

        case 'services_csv':
            sendCsvDownload(
                "mediplus_services_{$date}.csv",
                ['id', 'name', 'specialization', 'duration', 'price', 'status'],
                serviceRows($pdo)
            );
            break;

        case 'full_backup_json':
            sendJsonDownload("mediplus_full_backup_{$date}.json", fullBackupPayload($pdo));
            break;

        default:
            exportError('Unknown export action.', 400);
    }
} catch (Throwable $exception) {
    exportError('Export failed.', 500);
}
