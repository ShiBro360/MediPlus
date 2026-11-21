<?php
// MediPlus student prototype backend.
// Doctors API with backend-synchronized avatar and working schedule.
//
// GET /backend/api/doctors.php
// POST /backend/api/doctors.php
// {
//   "first_name": "Anna",
//   "last_name": "Nowak",
//   "specialization": "Internista",
//   "phone": "+48 700 100 100",
//   "email": "anna.nowak@mediplus.local",
//   "cabinet": "Gabinet 101",
//   "status": "Aktywny",
//   "avatarDataUrl": "data:image/jpeg;base64,...",
//   "schedule": {"monday":{"active":true,"start_time":"08:00","end_time":"16:00"}}
// }
// PUT/PATCH /backend/api/doctors.php?id=1

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/notifications.php';

handlePreflightRequest('GET, POST, PUT, PATCH, OPTIONS');
requireMethod(['GET', 'POST', 'PUT', 'PATCH']);

function ensureDoctorSyncColumns(PDO $pdo): void
{
    // XAMPP/MariaDB supports ADD COLUMN IF NOT EXISTS. Keeping this here makes the
    // prototype safe after copying the project without re-importing the whole DB.
    $pdo->exec("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS avatar_data_url LONGTEXT NULL AFTER email");
    $pdo->exec("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS schedule_json LONGTEXT NULL AFTER avatar_data_url");
    $pdo->exec("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'Aktywny' AFTER is_active");
    $pdo->exec("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS cabinet_id INT UNSIGNED NULL AFTER specialization_id");
    $pdo->exec("ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS room_number VARCHAR(50) NULL AFTER name");
    $pdo->exec("ALTER TABLE cabinets ADD COLUMN IF NOT EXISTS cabinet_type VARCHAR(50) NOT NULL DEFAULT 'Uniwersalny' AFTER floor");
}

function normalizeDoctorStatus(?string $status, $isActive = null): string
{
    $value = trim((string) $status);
    if ($value !== '') {
        $lower = mb_strtolower($value, 'UTF-8');
        if (str_contains($lower, 'urlop')) {
            return 'Urlop';
        }
        if (str_contains($lower, 'nieakt') || str_contains($lower, 'inactive')) {
            return 'Nieaktywny';
        }
        return 'Aktywny';
    }

    return ((string) $isActive === '0' || $isActive === false) ? 'Nieaktywny' : 'Aktywny';
}

function isDoctorActive(string $status): int
{
    return $status === 'Nieaktywny' ? 0 : 1;
}

function defaultDoctorSchedule(): array
{
    $work = ['active' => true, 'start_time' => '08:00', 'end_time' => '16:00'];
    $closed = ['active' => false, 'start_time' => '08:00', 'end_time' => '16:00'];

    return [
        'monday' => $work,
        'tuesday' => $work,
        'wednesday' => $work,
        'thursday' => $work,
        'friday' => $work,
        'saturday' => $closed,
        'sunday' => $closed,
    ];
}

function normalizeSchedule($schedule): array
{
    if (is_string($schedule)) {
        $decoded = json_decode($schedule, true);
        $schedule = is_array($decoded) ? $decoded : [];
    }

    if (!is_array($schedule)) {
        $schedule = [];
    }

    $normalized = defaultDoctorSchedule();

    foreach ($normalized as $day => $default) {
        $source = $schedule[$day] ?? [];
        if (!is_array($source)) {
            continue;
        }

        $active = $source['active'] ?? $source['is_active'] ?? $default['active'];
        $start = substr((string) ($source['start_time'] ?? $source['start'] ?? $default['start_time']), 0, 5);
        $end = substr((string) ($source['end_time'] ?? $source['end'] ?? $default['end_time']), 0, 5);

        $normalized[$day] = [
            'active' => filter_var($active, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $active,
            'start_time' => preg_match('/^\d{2}:\d{2}$/', $start) ? $start : $default['start_time'],
            'end_time' => preg_match('/^\d{2}:\d{2}$/', $end) ? $end : $default['end_time'],
        ];
    }

    return $normalized;
}

function findOrCreateSpecialization(PDO $pdo, string $name): int
{
    $name = trim($name);
    if ($name === '') {
        $name = 'Ogólna';
    }

    $stmt = $pdo->prepare('SELECT id FROM specializations WHERE name = ? LIMIT 1');
    $stmt->execute([$name]);
    $id = $stmt->fetchColumn();

    if ($id) {
        return (int) $id;
    }

    $stmt = $pdo->prepare('INSERT INTO specializations (name) VALUES (?)');
    $stmt->execute([$name]);

    return (int) $pdo->lastInsertId();
}

function findCabinetId(PDO $pdo, $value): ?int
{
    $raw = trim((string) $value);
    if ($raw === '') {
        return null;
    }

    if (ctype_digit($raw)) {
        $stmt = $pdo->prepare('SELECT id FROM cabinets WHERE id = ? LIMIT 1');
        $stmt->execute([(int) $raw]);
        $id = $stmt->fetchColumn();
        if ($id) {
            return (int) $id;
        }
    }

    $number = preg_replace('/\D+/', '', $raw);
    $stmt = $pdo->prepare(
        'SELECT id
         FROM cabinets
         WHERE room_number = ?
            OR name = ?
            OR CONCAT(name, " ", room_number) = ?
            OR name LIKE ?
         LIMIT 1'
    );
    $stmt->execute([
        $raw,
        $raw,
        $raw,
        $number !== '' ? '%' . $number . '%' : $raw,
    ]);
    $id = $stmt->fetchColumn();

    return $id ? (int) $id : null;
}

function doctorRow(PDO $pdo, int $doctorId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT doctors.id, doctors.first_name, doctors.last_name, doctors.phone, doctors.email,
                doctors.avatar_data_url, doctors.schedule_json, doctors.is_active, doctors.status,
                doctors.cabinet_id,
                specializations.name AS specialization,
                cabinets.name AS cabinet,
                cabinets.room_number AS cabinet_room_number,
                cabinets.cabinet_type AS cabinet_type
         FROM doctors
         INNER JOIN specializations ON specializations.id = doctors.specialization_id
         LEFT JOIN cabinets ON cabinets.id = doctors.cabinet_id
         WHERE doctors.id = ?'
    );
    $stmt->execute([$doctorId]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    $status = normalizeDoctorStatus($row['status'] ?? '', $row['is_active'] ?? 1);

    return [
        'id' => (int) $row['id'],
        'first_name' => $row['first_name'],
        'last_name' => $row['last_name'],
        'full_name' => trim($row['first_name'] . ' ' . $row['last_name']),
        'phone' => $row['phone'],
        'email' => $row['email'],
        'specialization' => $row['specialization'],
        'cabinet' => $row['cabinet'],
        'cabinet_name' => $row['cabinet'],
        'cabinet_id' => $row['cabinet_id'] !== null ? (int) $row['cabinet_id'] : null,
        'cabinetId' => $row['cabinet_id'] !== null ? (int) $row['cabinet_id'] : null,
        'cabinet_room_number' => $row['cabinet_room_number'] ?? null,
        'cabinet_type' => $row['cabinet_type'] ?? null,
        'is_active' => isDoctorActive($status),
        'status' => $status,
        'avatarDataUrl' => $row['avatar_data_url'],
        'avatar_data_url' => $row['avatar_data_url'],
        'schedule' => normalizeSchedule($row['schedule_json'] ?? null),
    ];
}

function allDoctorRows(PDO $pdo): array
{
    $stmt = $pdo->prepare(
        'SELECT doctors.id
         FROM doctors
         INNER JOIN specializations ON specializations.id = doctors.specialization_id
         LEFT JOIN cabinets ON cabinets.id = doctors.cabinet_id
         ORDER BY doctors.last_name, doctors.first_name'
    );
    $stmt->execute();

    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $doctor = doctorRow($pdo, (int) $row['id']);
        if ($doctor) {
            $rows[] = $doctor;
        }
    }

    return $rows;
}

function doctorNotificationName(array $doctor): string
{
    return 'dr ' . trim((string) ($doctor['first_name'] ?? '') . ' ' . (string) ($doctor['last_name'] ?? ''));
}

function notifyDoctorProfileChanged(PDO $pdo, ?array $doctor): void
{
    if (!$doctor) {
        return;
    }

    $doctorId = (int) $doctor['id'];
    $doctorName = doctorNotificationName($doctor);
    $createdBy = notificationCurrentUserId();

    tryCreateNotification(
        $pdo,
        'doctor_updated',
        'Zaktualizowano lekarza',
        "Zmieniono dane lekarza {$doctorName}.",
        notificationAdminRecipients($pdo),
        'doctor',
        $doctorId,
        'info',
        $createdBy
    );

    tryCreateNotification(
        $pdo,
        'doctor_profile_updated',
        'Zmieniono Twoje dane',
        'Zaktualizowano dane Twojego profilu.',
        notificationDoctorRecipients($pdo, $doctorId),
        'doctor',
        $doctorId,
        'info',
        $createdBy
    );
}

try {
    $pdo = getDatabaseConnection();
    ensureDoctorSyncColumns($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        sendSuccessResponse(allDoctorRows($pdo), 'Doctors loaded.');
    }

    $body = getJsonRequestBody();
    $doctorId = isset($_GET['id']) ? (int) $_GET['id'] : (int) ($body['id'] ?? 0);
    $firstName = trim((string) ($body['first_name'] ?? $body['firstName'] ?? ''));
    $lastName = trim((string) ($body['last_name'] ?? $body['lastName'] ?? ''));
    $specialization = trim((string) ($body['specialization'] ?? $body['specialization_name'] ?? ''));

    if ($firstName === '' || $lastName === '' || $specialization === '') {
        sendErrorResponse('Required fields: first_name, last_name, specialization.', 422);
    }

    $status = normalizeDoctorStatus($body['status'] ?? null, $body['is_active'] ?? 1);
    $specializationId = findOrCreateSpecialization($pdo, $specialization);
    $cabinetId = findCabinetId($pdo, $body['cabinet_id'] ?? $body['cabinetId'] ?? $body['cabinet'] ?? $body['cabinet_name'] ?? null);
    $avatarDataUrl = $body['avatarDataUrl'] ?? $body['avatar_data_url'] ?? null;
    $scheduleJson = json_encode(normalizeSchedule($body['schedule'] ?? []), JSON_UNESCAPED_UNICODE);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $stmt = $pdo->prepare(
            'INSERT INTO doctors
                (specialization_id, cabinet_id, first_name, last_name, phone, email,
                 avatar_data_url, schedule_json, is_active, status)
             VALUES
                (:specialization_id, :cabinet_id, :first_name, :last_name, :phone, :email,
                 :avatar_data_url, :schedule_json, :is_active, :status)'
        );
        $stmt->execute([
            ':specialization_id' => $specializationId,
            ':cabinet_id' => $cabinetId,
            ':first_name' => $firstName,
            ':last_name' => $lastName,
            ':phone' => trim((string) ($body['phone'] ?? '')),
            ':email' => trim((string) ($body['email'] ?? '')),
            ':avatar_data_url' => $avatarDataUrl,
            ':schedule_json' => $scheduleJson,
            ':is_active' => isDoctorActive($status),
            ':status' => $status,
        ]);

        $doctor = doctorRow($pdo, (int) $pdo->lastInsertId());
        notifyDoctorProfileChanged($pdo, $doctor);
        sendSuccessResponse($doctor, 'Doctor created.', 201);
    }

    if ($doctorId <= 0 || !doctorRow($pdo, $doctorId)) {
        sendErrorResponse('Doctor not found.', 404);
    }

    $stmt = $pdo->prepare(
        'UPDATE doctors
         SET specialization_id = :specialization_id,
             cabinet_id = :cabinet_id,
             first_name = :first_name,
             last_name = :last_name,
             phone = :phone,
             email = :email,
             avatar_data_url = :avatar_data_url,
             schedule_json = :schedule_json,
             is_active = :is_active,
             status = :status
         WHERE id = :id'
    );
    $stmt->execute([
        ':specialization_id' => $specializationId,
        ':cabinet_id' => $cabinetId,
        ':first_name' => $firstName,
        ':last_name' => $lastName,
        ':phone' => trim((string) ($body['phone'] ?? '')),
        ':email' => trim((string) ($body['email'] ?? '')),
        ':avatar_data_url' => $avatarDataUrl,
        ':schedule_json' => $scheduleJson,
        ':is_active' => isDoctorActive($status),
        ':status' => $status,
        ':id' => $doctorId,
    ]);

    $doctor = doctorRow($pdo, $doctorId);
    notifyDoctorProfileChanged($pdo, $doctor);
    sendSuccessResponse($doctor, 'Doctor updated.');
} catch (PDOException $exception) {
    sendDatabaseErrorResponse();
}
