<?php
// MediPlus student prototype backend.
// Doctor absences API: list, create and cancel absences used by availability.
//
// GET   /backend/api/doctor_absences.php
// POST  /backend/api/doctor_absences.php
// PATCH /backend/api/doctor_absences.php
// PUT   /backend/api/doctor_absences.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/notifications.php';

handlePreflightRequest('GET, POST, PATCH, PUT, OPTIONS');
requireMethod(['GET', 'POST', 'PATCH', 'PUT']);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function ensureDoctorAbsencesTable(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS doctor_absences (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            doctor_id INT UNSIGNED NOT NULL,
            type ENUM('Urlop', 'Chorobowe', 'Dzień wolny', 'Inne') NOT NULL,
            date_from DATE NOT NULL,
            date_to DATE NOT NULL,
            time_from TIME NULL,
            time_to TIME NULL,
            note TEXT NULL,
            status ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
            created_by INT UNSIGNED NULL,
            cancelled_by INT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            cancelled_at DATETIME NULL,
            CONSTRAINT fk_doctor_absences_doctor
              FOREIGN KEY (doctor_id) REFERENCES doctors(id)
              ON UPDATE CASCADE
              ON DELETE CASCADE,
            CONSTRAINT fk_doctor_absences_created_by
              FOREIGN KEY (created_by) REFERENCES users(id)
              ON UPDATE CASCADE
              ON DELETE SET NULL,
            CONSTRAINT fk_doctor_absences_cancelled_by
              FOREIGN KEY (cancelled_by) REFERENCES users(id)
              ON UPDATE CASCADE
              ON DELETE SET NULL,
            INDEX idx_doctor_absences_doctor_id (doctor_id),
            INDEX idx_doctor_absences_dates (date_from, date_to),
            INDEX idx_doctor_absences_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function currentSessionUserId(): ?int
{
    $value = $_SESSION['user_id'] ?? $_SESSION['id'] ?? null;
    return $value ? (int) $value : null;
}

function normalizeAbsenceType(?string $type): string
{
    $value = trim((string) $type);
    return in_array($value, ['Urlop', 'Chorobowe', 'Dzień wolny', 'Inne'], true) ? $value : '';
}

function normalizeDateValue($value): string
{
    $value = substr(trim((string) $value), 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return '';
    }

    [$year, $month, $day] = array_map('intval', explode('-', $value));
    return checkdate($month, $day, $year) ? $value : '';
}

function normalizeTimeValue($value): ?string
{
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }

    $value = substr($value, 0, 5);
    return preg_match('/^\d{2}:\d{2}$/', $value) ? $value . ':00' : null;
}

function absenceRow(array $row): array
{
    $timeFrom = $row['time_from'] ? substr((string) $row['time_from'], 0, 5) : '';
    $timeTo = $row['time_to'] ? substr((string) $row['time_to'], 0, 5) : '';

    return [
        'id' => (int) $row['id'],
        'doctorId' => (int) $row['doctor_id'],
        'doctor_id' => (int) $row['doctor_id'],
        'type' => $row['type'],
        'dateFrom' => $row['date_from'],
        'date_from' => $row['date_from'],
        'dateTo' => $row['date_to'],
        'date_to' => $row['date_to'],
        'timeFrom' => $timeFrom,
        'time_from' => $timeFrom,
        'timeTo' => $timeTo,
        'time_to' => $timeTo,
        'note' => $row['note'] ?? '',
        'status' => $row['status'],
        'createdAt' => $row['created_at'] ?? null,
        'created_at' => $row['created_at'] ?? null,
        'cancelledAt' => $row['cancelled_at'] ?? null,
        'cancelled_at' => $row['cancelled_at'] ?? null,
    ];
}

function fetchAbsence(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM doctor_absences WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();

    return is_array($row) ? absenceRow($row) : null;
}

function absenceDoctorName(PDO $pdo, int $doctorId): string
{
    $stmt = $pdo->prepare('SELECT first_name, last_name FROM doctors WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $doctorId]);
    $row = $stmt->fetch();
    if (!$row) {
        return 'Lekarz';
    }

    return 'dr ' . trim((string) $row['first_name'] . ' ' . (string) $row['last_name']);
}

function absenceDateRange(array $absence): string
{
    $from = (string) ($absence['date_from'] ?? $absence['dateFrom'] ?? '');
    $to = (string) ($absence['date_to'] ?? $absence['dateTo'] ?? $from);
    return $from === $to ? $from : "{$from}–{$to}";
}

function notifyDoctorAbsenceAdded(PDO $pdo, array $absence): void
{
    $doctorId = (int) ($absence['doctor_id'] ?? $absence['doctorId'] ?? 0);
    $doctor = absenceDoctorName($pdo, $doctorId);
    $type = (string) ($absence['type'] ?? 'Nieobecność');
    $range = absenceDateRange($absence);
    $absenceId = (int) ($absence['id'] ?? 0);
    $createdBy = notificationCurrentUserId();

    tryCreateNotification(
        $pdo,
        'doctor_absence_added',
        'Dodano nieobecność lekarza',
        "{$doctor}: {$type}, {$range}.",
        notificationAdminRecipients($pdo),
        'doctor_absence',
        $absenceId,
        'warning',
        $createdBy
    );

    tryCreateNotification(
        $pdo,
        'doctor_absence_added',
        'Dodano Twoją nieobecność',
        "{$type}, {$range}.",
        notificationDoctorRecipients($pdo, $doctorId),
        'doctor_absence',
        $absenceId,
        'info',
        $createdBy
    );
}

function notifyDoctorAbsenceCancelled(PDO $pdo, array $absence): void
{
    $doctorId = (int) ($absence['doctor_id'] ?? $absence['doctorId'] ?? 0);
    $doctor = absenceDoctorName($pdo, $doctorId);
    $type = (string) ($absence['type'] ?? 'Nieobecność');
    $range = absenceDateRange($absence);
    $absenceId = (int) ($absence['id'] ?? 0);
    $createdBy = notificationCurrentUserId();

    tryCreateNotification(
        $pdo,
        'doctor_absence_cancelled',
        'Anulowano nieobecność lekarza',
        "{$doctor}: {$type}, {$range}.",
        notificationAdminRecipients($pdo),
        'doctor_absence',
        $absenceId,
        'info',
        $createdBy
    );

    tryCreateNotification(
        $pdo,
        'doctor_absence_cancelled',
        'Anulowano Twoją nieobecność',
        "{$type}, {$range}.",
        notificationDoctorRecipients($pdo, $doctorId),
        'doctor_absence',
        $absenceId,
        'info',
        $createdBy
    );
}

try {
    $pdo = getDatabaseConnection();
    ensureDoctorAbsencesTable($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $where = [];
        $params = [];

        if (isset($_GET['doctor_id']) && (int) $_GET['doctor_id'] > 0) {
            $where[] = 'doctor_id = :doctor_id';
            $params['doctor_id'] = (int) $_GET['doctor_id'];
        }

        if (isset($_GET['status']) && in_array($_GET['status'], ['active', 'cancelled'], true)) {
            $where[] = 'status = :status';
            $params['status'] = $_GET['status'];
        }

        $dateFrom = normalizeDateValue($_GET['date_from'] ?? '');
        if ($dateFrom !== '') {
            $where[] = 'date_to >= :date_from';
            $params['date_from'] = $dateFrom;
        }

        $dateTo = normalizeDateValue($_GET['date_to'] ?? '');
        if ($dateTo !== '') {
            $where[] = 'date_from <= :date_to';
            $params['date_to'] = $dateTo;
        }

        $sql = 'SELECT * FROM doctor_absences';
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY date_from DESC, date_to DESC, id DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = array_map('absenceRow', $stmt->fetchAll());

        sendSuccessResponse($rows, 'Doctor absences loaded.');
    }

    $data = getJsonRequestBody();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $doctorId = (int) ($data['doctorId'] ?? $data['doctor_id'] ?? 0);
        $type = normalizeAbsenceType($data['type'] ?? '');
        $dateFrom = normalizeDateValue($data['dateFrom'] ?? $data['date_from'] ?? '');
        $dateTo = normalizeDateValue($data['dateTo'] ?? $data['date_to'] ?? $dateFrom);
        $timeFrom = normalizeTimeValue($data['timeFrom'] ?? $data['time_from'] ?? '');
        $timeTo = normalizeTimeValue($data['timeTo'] ?? $data['time_to'] ?? '');
        $errors = [];

        if ($doctorId <= 0) {
            $errors['doctor_id'] = 'Doctor is required.';
        }
        if ($type === '') {
            $errors['type'] = 'Type is required.';
        }
        if ($dateFrom === '') {
            $errors['date_from'] = 'Date from is required.';
        }
        if ($dateTo === '') {
            $errors['date_to'] = 'Date to is required.';
        }
        if ($dateFrom !== '' && $dateTo !== '' && $dateTo < $dateFrom) {
            $errors['date_to'] = 'Date to must be greater than or equal to date from.';
        }

        $rawTimeFrom = trim((string) ($data['timeFrom'] ?? $data['time_from'] ?? ''));
        $rawTimeTo = trim((string) ($data['timeTo'] ?? $data['time_to'] ?? ''));
        if (($rawTimeFrom !== '' || $rawTimeTo !== '') && (!$timeFrom || !$timeTo)) {
            $errors['time'] = 'Both time fields are required.';
        }
        if ($timeFrom && $timeTo && $timeTo <= $timeFrom) {
            $errors['time_to'] = 'Time to must be greater than time from.';
        }

        if ($errors) {
            sendErrorResponse('Invalid doctor absence data.', 422, $errors);
        }

        $doctorStmt = $pdo->prepare('SELECT id FROM doctors WHERE id = :id LIMIT 1');
        $doctorStmt->execute(['id' => $doctorId]);
        if (!$doctorStmt->fetchColumn()) {
            sendErrorResponse('Doctor not found.', 404);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO doctor_absences
                (doctor_id, type, date_from, date_to, time_from, time_to, note, status, created_by)
             VALUES
                (:doctor_id, :type, :date_from, :date_to, :time_from, :time_to, :note, "active", :created_by)'
        );
        $stmt->execute([
            'doctor_id' => $doctorId,
            'type' => $type,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'time_from' => $timeFrom,
            'time_to' => $timeTo,
            'note' => trim((string) ($data['note'] ?? '')),
            'created_by' => currentSessionUserId(),
        ]);

        $createdAbsence = fetchAbsence($pdo, (int) $pdo->lastInsertId());
        if ($createdAbsence) {
            notifyDoctorAbsenceAdded($pdo, $createdAbsence);
        }

        sendSuccessResponse($createdAbsence, 'Doctor absence created.', 201);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH' || $_SERVER['REQUEST_METHOD'] === 'PUT') {
        $id = (int) ($data['id'] ?? $_GET['id'] ?? 0);
        $status = strtolower(trim((string) ($data['status'] ?? 'cancelled')));

        if ($id <= 0) {
            sendErrorResponse('Absence id is required.', 422, ['id' => 'Absence id is required.']);
        }
        if ($status !== 'cancelled') {
            sendErrorResponse('Only cancellation is supported.', 422, ['status' => 'Only cancelled status is supported.']);
        }

        $currentAbsence = fetchAbsence($pdo, $id);
        if (!$currentAbsence) {
            sendErrorResponse('Absence not found.', 404);
        }

        $stmt = $pdo->prepare(
            'UPDATE doctor_absences
             SET status = "cancelled",
                 cancelled_by = :cancelled_by,
                 cancelled_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'cancelled_by' => currentSessionUserId(),
        ]);

        $cancelledAbsence = fetchAbsence($pdo, $id);
        if (($currentAbsence['status'] ?? '') !== 'cancelled' && $cancelledAbsence) {
            notifyDoctorAbsenceCancelled($pdo, $cancelledAbsence);
        }

        sendSuccessResponse($cancelledAbsence, 'Doctor absence cancelled.');
    }
} catch (PDOException $exception) {
    sendDatabaseErrorResponse();
}
