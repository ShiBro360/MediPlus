<?php
// MediPlus student prototype backend.
// Basic appointment API: list appointments, create an appointment and update appointment status.
// Examples:
// GET /backend/api/appointments.php
// POST /backend/api/appointments.php
// PATCH /backend/api/appointments.php {"id":123,"status":"cancelled"}
// PUT /backend/api/appointments.php {"appointment_id":123,"status":"Anulowana"}
// Existing patient body: {"patient_id":1,"doctor_id":1,"service_id":1,"cabinet_id":1,"appointment_date":"2026-06-01","start_time":"08:00:00","end_time":"08:30:00"}
// Minimal new patient body: {"first_name":"Anna","last_name":"Kowalska","phone":"+48 600 000 000","doctor_id":1,"service_id":1,"cabinet_id":1,"appointment_date":"2026-06-01","start_time":"08:00:00","end_time":"08:30:00","notes":"Pierwsza wizyta"}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/validation.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/email.php';

handlePreflightRequest('GET, POST, PUT, PATCH, OPTIONS');
requireMethod(['GET', 'POST', 'PUT', 'PATCH']);

function normalizeAppointmentStatusValue($status)
{
    $value = strtolower(trim((string) $status));
    $map = [
        'planned' => 'planned',
        'zaplanowana' => 'planned',
        'completed' => 'completed',
        'done' => 'completed',
        'zrealizowana' => 'completed',
        'cancelled' => 'cancelled',
        'canceled' => 'cancelled',
        'anulowana' => 'cancelled',
        'no_show' => 'no_show',
        'no-show' => 'no_show',
        'nieobecny' => 'no_show',
        'nieobecny pacjent' => 'no_show',
    ];

    return $map[$value] ?? null;
}

function appointmentHasColumn(PDO $pdo, $column)
{
    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'appointments'
           AND COLUMN_NAME = :column"
    );
    $stmt->execute(['column' => $column]);
    return (int) $stmt->fetchColumn() > 0;
}

function appointmentTableExists(PDO $pdo, $table)
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name'
    );
    $stmt->execute(['table_name' => $table]);
    return (int) $stmt->fetchColumn() > 0;
}

function sendAppointmentConflictResponse($conflictType)
{
    $messages = [
        'patient' => 'Pacjent ma już wizytę w wybranym terminie.',
        'cabinet' => 'Gabinet jest zajęty w wybranym terminie.',
        'doctor' => 'Lekarz ma już wizytę w wybranym terminie.',
        'absence' => 'Lekarz jest nieobecny w wybranym terminie.',
        'specialization' => 'Lekarz nie wykonuje wybranej usługi.',
        'cabinet_type' => 'Gabinet nie pasuje do specjalizacji wizyty.',
    ];
    $message = $messages[$conflictType] ?? 'Ten termin jest już zajęty. Wybierz inny termin.';

    sendJsonResponse([
        'success' => false,
        'error' => $message,
        'message' => $message,
        'conflictType' => $conflictType,
    ], 409);
}

function normalizeAppointmentPatientPhone($value): string
{
    $digits = preg_replace('/\D+/', '', (string) $value) ?? '';
    if (strlen($digits) === 11 && substr($digits, 0, 2) === '48') {
        $digits = substr($digits, 2);
    }
    return $digits;
}

function assertPatientHasNoAppointmentConflict(PDO $pdo, array $data): void
{
    $patientId = !empty($data['patient_id']) ? (int) $data['patient_id'] : 0;
    $patientPhone = normalizeAppointmentPatientPhone($data['phone'] ?? '');
    $patientPesel = trim((string) ($data['pesel'] ?? ''));

    if ($patientId > 0) {
        $patientStmt = $pdo->prepare('SELECT phone, pesel FROM patients WHERE id = :id LIMIT 1');
        $patientStmt->execute(['id' => $patientId]);
        $patient = $patientStmt->fetch();
        if ($patient) {
            $patientPhone = normalizeAppointmentPatientPhone($patient['phone'] ?? $patientPhone);
            $patientPesel = trim((string) ($patient['pesel'] ?? $patientPesel));
        }
    }

    $stmt = $pdo->prepare(
        'SELECT appointments.patient_id, patients.phone, patients.pesel
         FROM appointments
         INNER JOIN patients ON patients.id = appointments.patient_id
         WHERE appointments.appointment_date = :appointment_date
           AND appointments.status NOT IN (:cancelled_status, :no_show_status)
           AND appointments.start_time < :new_end_time
           AND appointments.end_time > :new_start_time'
    );
    $stmt->execute([
        'appointment_date' => $data['appointment_date'],
        'cancelled_status' => 'cancelled',
        'no_show_status' => 'no_show',
        'new_start_time' => $data['start_time'],
        'new_end_time' => $data['end_time'],
    ]);

    foreach ($stmt->fetchAll() as $existing) {
        $samePatientId = $patientId > 0 && (int) $existing['patient_id'] === $patientId;
        $existingPhone = normalizeAppointmentPatientPhone($existing['phone'] ?? '');
        $samePhone = $patientPhone !== '' && $existingPhone !== '' && $existingPhone === $patientPhone;
        $existingPesel = trim((string) ($existing['pesel'] ?? ''));
        $samePesel = $patientPesel !== '' && $existingPesel !== '' && $existingPesel === $patientPesel;
        if ($samePatientId || $samePhone || $samePesel) {
            sendAppointmentConflictResponse('patient');
        }
    }
}

function normalizeSpecializationKey($value)
{
    $value = trim((string) $value);
    if (function_exists('mb_strtolower')) {
        $value = mb_strtolower($value, 'UTF-8');
    } else {
        $value = strtolower($value);
    }
    $value = strtr($value, [
        'ą' => 'a', 'ć' => 'c', 'ę' => 'e', 'ł' => 'l', 'ń' => 'n',
        'ó' => 'o', 'ś' => 's', 'ź' => 'z', 'ż' => 'z',
    ]);
    $value = preg_replace('/\s+/', ' ', $value);

    if (strpos($value, 'fizjo') !== false) return 'fizjoterapeuta';
    if (strpos($value, 'ortop') !== false) return 'ortopeda';
    if (strpos($value, 'kardio') !== false) return 'kardiolog';
    if (strpos($value, 'dermat') !== false) return 'dermatolog';
    if (strpos($value, 'ginek') !== false) return 'ginekolog';
    if (strpos($value, 'psycholog') !== false) return 'psycholog';
    if (strpos($value, 'pediatr') !== false) return 'pediatra';
    if (strpos($value, 'neurolog') !== false) return 'neurolog';
    if (strpos($value, 'endokryn') !== false) return 'endokrynolog';
    if (strpos($value, 'gastro') !== false) return 'gastroenterolog';
    if (strpos($value, 'diabet') !== false) return 'diabetolog';
    if (strpos($value, 'pulmon') !== false) return 'pulmonolog';
    if (strpos($value, 'laryng') !== false) return 'laryngolog';
    if ($value === 'ogolny') return 'ogolna';

    return $value;
}

function allowedCabinetTypesForSpecialization($specialization)
{
    $map = [
        'internista' => ['Uniwersalny', 'Zabiegowy'],
        'kardiolog' => ['Uniwersalny', 'Zabiegowy'],
        'dermatolog' => ['Uniwersalny', 'Zabiegowy'],
        'ogolna' => ['Uniwersalny'],
        'ginekolog' => ['Ginekologiczny', 'Zabiegowy'],
        'psycholog' => ['Psychologiczny'],
        'fizjoterapeuta' => ['Fizjoterapia'],
        'ortopeda' => ['Uniwersalny', 'Zabiegowy'],
        'ortopedia' => ['Uniwersalny', 'Zabiegowy'],
        'pediatra' => ['Uniwersalny'],
        'neurolog' => ['Uniwersalny'],
        'endokrynolog' => ['Uniwersalny'],
        'gastroenterolog' => ['Uniwersalny'],
        'diabetolog' => ['Uniwersalny'],
        'pulmonolog' => ['Uniwersalny'],
        'laryngolog' => ['Uniwersalny'],
    ];

    return $map[normalizeSpecializationKey($specialization)] ?? ['Uniwersalny'];
}

function normalizeCabinetTypeValue($value)
{
    $value = trim((string) $value);
    $map = [
        'administracyjny' => 'Administracyjny',
        'uniwersalny' => 'Uniwersalny',
        'ginekologiczny' => 'Ginekologiczny',
        'psychologiczny' => 'Psychologiczny',
        'fizjoterapia' => 'Fizjoterapia',
        'zabiegowy' => 'Zabiegowy',
        'punkt pobrań' => 'Punkt Pobrań',
        'punkt pobran' => 'Punkt Pobrań',
        'internista' => 'Uniwersalny',
        'pediatra' => 'Uniwersalny',
        'dermatolog' => 'Uniwersalny',
        'kardiolog' => 'Uniwersalny',
        'neurolog' => 'Uniwersalny',
        'endokrynolog' => 'Uniwersalny',
        'gastroenterolog' => 'Uniwersalny',
        'diabetolog' => 'Uniwersalny',
        'pulmonolog' => 'Uniwersalny',
        'laryngolog' => 'Uniwersalny',
        'ginekolog' => 'Ginekologiczny',
        'psycholog' => 'Psychologiczny',
        'fizjoterapeuta' => 'Fizjoterapia',
    ];

    return $map[normalizeSpecializationKey($value)] ?? $value;
}

function assertAppointmentMatchesSpecializationAndCabinet(PDO $pdo, array $data): void
{
    $stmt = $pdo->prepare(
        'SELECT doctor_specs.name AS doctor_specialization,
                service_specs.name AS service_specialization,
                cabinets.cabinet_type
         FROM doctors
         INNER JOIN specializations doctor_specs ON doctor_specs.id = doctors.specialization_id
         INNER JOIN medical_services ON medical_services.id = :service_id
         INNER JOIN specializations service_specs ON service_specs.id = medical_services.specialization_id
         INNER JOIN cabinets ON cabinets.id = :cabinet_id
         WHERE doctors.id = :doctor_id
         LIMIT 1'
    );
    $stmt->execute([
        'doctor_id' => (int) $data['doctor_id'],
        'service_id' => (int) $data['service_id'],
        'cabinet_id' => (int) $data['cabinet_id'],
    ]);
    $row = $stmt->fetch();

    if (!$row) {
        sendErrorResponse('Invalid doctor, service or cabinet.', 422);
    }

    $serviceSpecialization = normalizeSpecializationKey($row['service_specialization']);
    if (!in_array($serviceSpecialization, ['ogólna', 'ogolna'], true)
        && normalizeSpecializationKey($row['doctor_specialization']) !== $serviceSpecialization) {
        sendAppointmentConflictResponse('specialization');
    }

    $allowedTypes = allowedCabinetTypesForSpecialization($row['service_specialization']);
    if (!in_array(normalizeCabinetTypeValue($row['cabinet_type']), $allowedTypes, true)) {
        sendAppointmentConflictResponse('cabinet_type');
    }
}

function assertAppointmentHasNoConflicts(PDO $pdo, array $data): void
{
    $commonParams = [
        'appointment_date' => $data['appointment_date'],
        'new_start_time' => $data['start_time'],
        'new_end_time' => $data['end_time'],
        'cancelled_status' => 'cancelled',
        'no_show_status' => 'no_show',
    ];

    assertPatientHasNoAppointmentConflict($pdo, $data);

    $doctorConflictStmt = $pdo->prepare(
        'SELECT id
         FROM appointments
         WHERE doctor_id = :doctor_id
           AND appointment_date = :appointment_date
           AND status NOT IN (:cancelled_status, :no_show_status)
           AND start_time < :new_end_time
           AND end_time > :new_start_time
         LIMIT 1'
    );
    $doctorConflictStmt->execute($commonParams + [
        'doctor_id' => (int) $data['doctor_id'],
    ]);

    if ($doctorConflictStmt->fetch()) {
        sendAppointmentConflictResponse('doctor');
    }

    if (!empty($data['cabinet_id'])) {
        $cabinetConflictStmt = $pdo->prepare(
            'SELECT id
             FROM appointments
             WHERE cabinet_id = :cabinet_id
               AND appointment_date = :appointment_date
               AND status NOT IN (:cancelled_status, :no_show_status)
               AND start_time < :new_end_time
               AND end_time > :new_start_time
             LIMIT 1'
        );
        $cabinetConflictStmt->execute($commonParams + [
            'cabinet_id' => (int) $data['cabinet_id'],
        ]);

        if ($cabinetConflictStmt->fetch()) {
            sendAppointmentConflictResponse('cabinet');
        }
    }

    if (appointmentTableExists($pdo, 'doctor_absences')) {
        $absenceConflictStmt = $pdo->prepare(
            'SELECT id
             FROM doctor_absences
             WHERE doctor_id = :doctor_id
               AND status = :active_status
               AND date_from <= :date_from_check
               AND date_to >= :date_to_check
               AND (
                   time_from IS NULL
                   OR time_to IS NULL
                   OR (time_from < :new_end_time AND time_to > :new_start_time)
               )
             LIMIT 1'
        );
        $absenceConflictStmt->execute([
            'doctor_id' => (int) $data['doctor_id'],
            'active_status' => 'active',
            'date_from_check' => $data['appointment_date'],
            'date_to_check' => $data['appointment_date'],
            'new_start_time' => $data['start_time'],
            'new_end_time' => $data['end_time'],
        ]);

        if ($absenceConflictStmt->fetch()) {
            sendAppointmentConflictResponse('absence');
        }
    }
}

function fetchAppointmentById(PDO $pdo, $appointmentId)
{
    $stmt = $pdo->prepare(
        'SELECT appointments.id, appointments.id AS appointment_id,
                appointments.patient_id, appointments.doctor_id,
                appointments.service_id, appointments.cabinet_id,
                appointments.appointment_date, appointments.start_time,
                appointments.end_time, appointments.status, appointments.notes,
                patients.first_name AS patient_first_name,
                patients.last_name AS patient_last_name,
                patients.email AS patient_email,
                patients.phone AS patient_phone,
                doctors.first_name AS doctor_first_name,
                doctors.last_name AS doctor_last_name,
                medical_services.name AS service_name,
                specializations.name AS specialization_name,
                cabinets.name AS cabinet_name,
                cabinets.room_number AS cabinet_room_number
         FROM appointments
         INNER JOIN patients ON patients.id = appointments.patient_id
         INNER JOIN doctors ON doctors.id = appointments.doctor_id
         INNER JOIN medical_services ON medical_services.id = appointments.service_id
         INNER JOIN specializations ON specializations.id = medical_services.specialization_id
         INNER JOIN cabinets ON cabinets.id = appointments.cabinet_id
         WHERE appointments.id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $appointmentId]);
    return $stmt->fetch();
}

function appointmentNotificationDate(array $appointment): string
{
    return (string) ($appointment['appointment_date'] ?? '');
}

function appointmentNotificationTime(array $appointment): string
{
    return substr((string) ($appointment['start_time'] ?? ''), 0, 5);
}

function appointmentNotificationPatient(array $appointment): string
{
    return notificationPersonName($appointment, 'patient') ?: 'Pacjent';
}

function appointmentNotificationDoctor(array $appointment): string
{
    $name = notificationPersonName($appointment, 'doctor');
    return $name ? 'dr ' . $name : 'lekarza';
}

function notifyAppointmentCreated(PDO $pdo, array $appointment): void
{
    $patient = appointmentNotificationPatient($appointment);
    $doctor = appointmentNotificationDoctor($appointment);
    $date = appointmentNotificationDate($appointment);
    $time = appointmentNotificationTime($appointment);
    $cabinet = (string) ($appointment['cabinet_name'] ?? 'brak gabinetu');
    $createdBy = notificationCurrentUserId();
    $appointmentId = (int) ($appointment['id'] ?? $appointment['appointment_id'] ?? 0);

    tryCreateNotification(
        $pdo,
        'appointment_created',
        'Nowa wizyta',
        "Zapisano wizytę pacjenta {$patient} do {$doctor} na {$date} o {$time}, gabinet: {$cabinet}.",
        notificationAdminRecipients($pdo),
        'appointment',
        $appointmentId,
        'success',
        $createdBy
    );

    tryCreateNotification(
        $pdo,
        'appointment_created',
        'Nowa wizyta w grafiku',
        "Dodano wizytę pacjenta {$patient} na {$date} o {$time}.",
        notificationDoctorRecipients($pdo, (int) ($appointment['doctor_id'] ?? 0)),
        'appointment',
        $appointmentId,
        'info',
        $createdBy
    );
}

function notifyAppointmentCancelled(PDO $pdo, array $appointment): void
{
    $patient = appointmentNotificationPatient($appointment);
    $doctor = appointmentNotificationDoctor($appointment);
    $date = appointmentNotificationDate($appointment);
    $time = appointmentNotificationTime($appointment);
    $createdBy = notificationCurrentUserId();
    $appointmentId = (int) ($appointment['id'] ?? $appointment['appointment_id'] ?? 0);

    tryCreateNotification(
        $pdo,
        'appointment_cancelled',
        'Wizyta anulowana',
        "Anulowano wizytę pacjenta {$patient} u {$doctor} na {$date} o {$time}.",
        notificationAdminRecipients($pdo),
        'appointment',
        $appointmentId,
        'danger',
        $createdBy
    );

    tryCreateNotification(
        $pdo,
        'appointment_cancelled',
        'Wizyta anulowana',
        "Anulowano wizytę pacjenta {$patient} na {$date} o {$time}.",
        notificationDoctorRecipients($pdo, (int) ($appointment['doctor_id'] ?? 0)),
        'appointment',
        $appointmentId,
        'danger',
        $createdBy
    );
}

try {
    $pdo = getDatabaseConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare(
            'SELECT appointments.id, appointments.patient_id, appointments.doctor_id,
                    appointments.service_id, appointments.cabinet_id,
                    appointments.appointment_date, appointments.start_time,
                    appointments.end_time, appointments.status, appointments.notes,
                    patients.first_name AS patient_first_name,
                    patients.last_name AS patient_last_name,
                    patients.phone AS patient_phone,
                    doctors.first_name AS doctor_first_name,
                    doctors.last_name AS doctor_last_name,
                    medical_services.name AS service_name,
                    specializations.name AS specialization_name,
                    cabinets.name AS cabinet_name
             FROM appointments
             INNER JOIN patients ON patients.id = appointments.patient_id
             INNER JOIN doctors ON doctors.id = appointments.doctor_id
             INNER JOIN medical_services ON medical_services.id = appointments.service_id
             INNER JOIN specializations ON specializations.id = medical_services.specialization_id
             INNER JOIN cabinets ON cabinets.id = appointments.cabinet_id
             ORDER BY appointments.appointment_date, appointments.start_time'
        );
        $stmt->execute();
        sendSuccessResponse($stmt->fetchAll(), 'Appointments loaded.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'PATCH') {
        $data = getJsonRequestBody();
        $appointmentId = (int) ($data['id'] ?? $data['appointment_id'] ?? 0);
        $status = normalizeAppointmentStatusValue($data['status'] ?? null);

        if ($appointmentId <= 0) {
            sendErrorResponse('Appointment id is required.', 422, ['id' => 'Required appointment id.']);
        }

        if ($status === null) {
            sendErrorResponse('Invalid appointment status.', 422, [
                'status' => 'Allowed statuses: planned, completed, cancelled, no_show.',
            ]);
        }

        $currentAppointment = fetchAppointmentById($pdo, $appointmentId);
        if (!$currentAppointment) {
            sendErrorResponse('Appointment not found.', 404);
        }

        $hasUpdatedAt = appointmentHasColumn($pdo, 'updated_at');
        $sql = 'UPDATE appointments SET status = :status';
        if ($hasUpdatedAt) {
            $sql .= ', updated_at = CURRENT_TIMESTAMP';
        }
        $sql .= ' WHERE id = :id';

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'status' => $status,
            'id' => $appointmentId,
        ]);

        $updatedAppointment = fetchAppointmentById($pdo, $appointmentId);
        if (($currentAppointment['status'] ?? '') !== 'cancelled' && $status === 'cancelled' && is_array($updatedAppointment)) {
            notifyAppointmentCancelled($pdo, $updatedAppointment);
            trySendAppointmentCancelledEmail($pdo, $updatedAppointment);
        }

        sendSuccessResponse($updatedAppointment, 'Appointment updated.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = getJsonRequestBody();
        $errors = validateRequiredFields($data, [
            'doctor_id',
            'service_id',
            'cabinet_id',
            'appointment_date',
            'start_time',
            'end_time',
        ]);

        if (empty($data['patient_id'])) {
            $errors = array_merge($errors, validateRequiredFields($data, [
                'first_name',
                'last_name',
                'phone',
            ]));
        }

        if (!empty($data['email']) && !isEmailValid((string) $data['email'])) {
            $errors['email'] = 'Invalid e-mail format.';
        }

        if (!empty($errors)) {
            sendErrorResponse('Validation failed.', 422, $errors);
        }

        assertAppointmentMatchesSpecializationAndCabinet($pdo, $data);
        assertAppointmentHasNoConflicts($pdo, $data);

        $pdo->beginTransaction();

        if (!empty($data['patient_id'])) {
            $patientId = (int) $data['patient_id'];
        } else {
            // Real clinic workflow: create a minimal incomplete patient profile first,
            // then attach the new appointment to that patient in the same transaction.
            $patientStmt = $pdo->prepare(
                'INSERT INTO patients (
                    first_name, last_name, phone, email, notes, profile_status, personal_data_consent
                 ) VALUES (
                    :first_name, :last_name, :phone, :email, :notes, :profile_status, :personal_data_consent
                 )'
            );
            $patientStmt->execute([
                'first_name' => trim((string) $data['first_name']),
                'last_name' => trim((string) $data['last_name']),
                'phone' => trim((string) $data['phone']),
                'email' => !empty($data['email']) ? trim((string) $data['email']) : null,
                'notes' => $data['patient_notes'] ?? 'Minimal profile created during appointment registration.',
                'profile_status' => 'incomplete',
                'personal_data_consent' => !empty($data['personal_data_consent']) ? 1 : 0,
            ]);
            $patientId = (int) $pdo->lastInsertId();
        }

        $appointmentStmt = $pdo->prepare(
            'INSERT INTO appointments (
                patient_id, doctor_id, service_id, cabinet_id,
                appointment_date, start_time, end_time, status, notes, created_by_user_id
             ) VALUES (
                :patient_id, :doctor_id, :service_id, :cabinet_id,
                :appointment_date, :start_time, :end_time, :status, :notes, :created_by_user_id
             )'
        );

        $appointmentStmt->execute([
            'patient_id' => $patientId,
            'doctor_id' => (int) $data['doctor_id'],
            'service_id' => (int) $data['service_id'],
            'cabinet_id' => (int) $data['cabinet_id'],
            'appointment_date' => $data['appointment_date'],
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'status' => $data['status'] ?? 'planned',
            'notes' => $data['notes'] ?? null,
            'created_by_user_id' => $data['created_by_user_id'] ?? null,
        ]);

        $appointmentId = (int) $pdo->lastInsertId();
        $pdo->commit();
        $createdAppointment = fetchAppointmentById($pdo, $appointmentId);
        if (is_array($createdAppointment)) {
            notifyAppointmentCreated($pdo, $createdAppointment);
            trySendAppointmentCreatedEmail($pdo, $createdAppointment);
        }

        sendSuccessResponse($createdAppointment ?: [
            'id' => $appointmentId,
            'patient_id' => $patientId,
        ], 'Appointment created.');
    }

} catch (PDOException $exception) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    sendDatabaseErrorResponse();
}



