<?php
// MediPlus student prototype backend.
// Basic patient API: list patients and create a patient.
// Examples:
// GET /backend/api/patients.php
// POST /backend/api/patients.php
// PUT /backend/api/patients.php
// Minimal body: {"first_name":"Anna","last_name":"Kowalska","phone":"+48 600 000 000"}
// Full body: {"first_name":"Anna","last_name":"Kowalska","phone":"+48 600 000 000","email":"anna@example.com","pesel":"90010112345","birth_date":"1990-01-01","gender":"female"}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/validation.php';

handlePreflightRequest('GET, POST, PUT, OPTIONS');
requireMethod(['GET', 'POST', 'PUT']);

function ensurePatientArchiveColumn(PDO $pdo): void
{
    $stmt = $pdo->query("SHOW COLUMNS FROM patients LIKE 'is_active'");
    if ($stmt && $stmt->fetch()) {
        return;
    }

    $pdo->exec('ALTER TABLE patients ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER personal_data_consent');
}

try {
    $pdo = getDatabaseConnection();
    ensurePatientArchiveColumn($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare(
            'SELECT id, first_name, last_name, pesel, birth_date, gender, phone, email,
                    address, postal_code, city, document_number, insurer, insurance_number,
                    blood_group, allergies, chronic_diseases, notes, profile_status, personal_data_consent,
                    is_active, created_at, updated_at
             FROM patients
             ORDER BY last_name, first_name'
        );
        $stmt->execute();
        sendSuccessResponse($stmt->fetchAll(), 'Patients loaded.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = getJsonRequestBody();
        $errors = validateRequiredFields($data, [
            'first_name',
            'last_name',
            'phone',
        ]);

        if (!empty($data['pesel']) && !isPeselValid((string) $data['pesel'])) {
            $errors['pesel'] = 'PESEL must contain exactly 11 digits.';
        }

        if (!empty($data['email']) && !isEmailValid((string) $data['email'])) {
            $errors['email'] = 'Invalid e-mail format.';
        }

        if (!empty($errors)) {
            sendErrorResponse('Validation failed.', 422, $errors);
        }

        // A patient created during quick appointment registration remains incomplete.
        // The full patient profile is completed later from the full registration form.
        $hasFullProfileData = !empty($data['pesel'])
            && !empty($data['birth_date'])
            && !empty($data['gender']);
        $profileStatus = $hasFullProfileData ? 'complete' : 'incomplete';

        $stmt = $pdo->prepare(
            'INSERT INTO patients (
                first_name, last_name, pesel, birth_date, gender, phone, email,
                address, postal_code, city, document_number, insurer, insurance_number,
                blood_group, allergies, chronic_diseases, notes, profile_status, personal_data_consent, is_active
             ) VALUES (
                :first_name, :last_name, :pesel, :birth_date, :gender, :phone, :email,
                :address, :postal_code, :city, :document_number, :insurer, :insurance_number,
                :blood_group, :allergies, :chronic_diseases, :notes, :profile_status, :personal_data_consent, :is_active
             )'
        );

        $stmt->execute([
            'first_name' => trim((string) $data['first_name']),
            'last_name' => trim((string) $data['last_name']),
            'pesel' => !empty($data['pesel']) ? trim((string) $data['pesel']) : null,
            'birth_date' => $data['birth_date'] ?? null,
            'gender' => $data['gender'] ?? null,
            'phone' => trim((string) $data['phone']),
            'email' => !empty($data['email']) ? trim((string) $data['email']) : null,
            'address' => $data['address'] ?? null,
            'postal_code' => $data['postal_code'] ?? null,
            'city' => $data['city'] ?? null,
            'document_number' => $data['document_number'] ?? null,
            'insurer' => $data['insurer'] ?? null,
            'insurance_number' => $data['insurance_number'] ?? null,
            'blood_group' => $data['blood_group'] ?? 'unknown',
            'allergies' => $data['allergies'] ?? null,
            'chronic_diseases' => $data['chronic_diseases'] ?? null,
            'notes' => $data['notes'] ?? null,
            'profile_status' => $profileStatus,
            'personal_data_consent' => !empty($data['personal_data_consent']) ? 1 : 0,
            'is_active' => array_key_exists('is_active', $data) ? (int) (bool) $data['is_active'] : 1,
        ]);

        sendSuccessResponse(['id' => (int) $pdo->lastInsertId()], 'Patient created.', 201);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $data = getJsonRequestBody();
        $errors = validateRequiredFields($data, [
            'id',
            'first_name',
            'last_name',
            'phone',
        ]);

        if (!empty($data['pesel']) && !isPeselValid((string) $data['pesel'])) {
            $errors['pesel'] = 'PESEL must contain exactly 11 digits.';
        }

        if (!empty($data['email']) && !isEmailValid((string) $data['email'])) {
            $errors['email'] = 'Invalid e-mail format.';
        }

        if (!empty($errors)) {
            sendErrorResponse('Validation failed.', 422, $errors);
        }

        // Profile is complete only when core identity fields are available.
        $hasFullProfileData = !empty($data['pesel'])
            && !empty($data['birth_date'])
            && !empty($data['gender'])
            && !empty($data['phone']);
        $profileStatus = $hasFullProfileData ? 'complete' : 'incomplete';

        $stmt = $pdo->prepare(
            'UPDATE patients
             SET first_name = :first_name,
                 last_name = :last_name,
                 pesel = :pesel,
                 birth_date = :birth_date,
                 gender = :gender,
                 phone = :phone,
                 email = :email,
                 address = :address,
                 postal_code = :postal_code,
                 city = :city,
                 document_number = :document_number,
                 insurer = :insurer,
                 insurance_number = :insurance_number,
                 blood_group = :blood_group,
                 allergies = :allergies,
                 chronic_diseases = :chronic_diseases,
                 notes = :notes,
                 profile_status = :profile_status,
                 personal_data_consent = :personal_data_consent,
                 is_active = :is_active
             WHERE id = :id'
        );

        $stmt->execute([
            'id' => (int) $data['id'],
            'first_name' => trim((string) $data['first_name']),
            'last_name' => trim((string) $data['last_name']),
            'pesel' => !empty($data['pesel']) ? trim((string) $data['pesel']) : null,
            'birth_date' => $data['birth_date'] ?? null,
            'gender' => $data['gender'] ?? null,
            'phone' => trim((string) $data['phone']),
            'email' => !empty($data['email']) ? trim((string) $data['email']) : null,
            'address' => $data['address'] ?? null,
            'postal_code' => $data['postal_code'] ?? null,
            'city' => $data['city'] ?? null,
            'document_number' => $data['document_number'] ?? null,
            'insurer' => $data['insurer'] ?? null,
            'insurance_number' => $data['insurance_number'] ?? null,
            'blood_group' => $data['blood_group'] ?? 'unknown',
            'allergies' => $data['allergies'] ?? null,
            'chronic_diseases' => $data['chronic_diseases'] ?? null,
            'notes' => $data['notes'] ?? null,
            'profile_status' => $profileStatus,
            'personal_data_consent' => !empty($data['personal_data_consent']) ? 1 : 0,
            'is_active' => array_key_exists('is_active', $data) ? (int) (bool) $data['is_active'] : 1,
        ]);

        sendSuccessResponse(['id' => (int) $data['id']], 'Patient updated.');
    }

} catch (PDOException $exception) {
    sendDatabaseErrorResponse();
}
