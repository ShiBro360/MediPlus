<?php
// MediPlus student prototype backend.
// Medical services API for the internal administrator frontend.
// Examples:
// GET /backend/api/services.php
// POST /backend/api/services.php
// Body: {"name":"Konsultacja dermatologiczna","specialization":"Dermatologia","duration_minutes":30,"price":200,"description":"Opis","is_active":1}
// PUT /backend/api/services.php
// Body: {"id":1,"name":"Konsultacja","specialization":"Dermatologia","duration_minutes":30,"price":200,"description":"Opis","is_active":1}
// PATCH /backend/api/services.php
// Body: {"id":1,"is_active":0}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/validation.php';
require_once __DIR__ . '/notifications.php';

handlePreflightRequest('GET, POST, PUT, PATCH, OPTIONS');
requireMethod(['GET', 'POST', 'PUT', 'PATCH']);

function getSpecializationId(PDO $pdo, string $name): int
{
    $name = trim($name);

    $stmt = $pdo->prepare('SELECT id FROM specializations WHERE name = :name LIMIT 1');
    $stmt->execute(['name' => $name]);
    $id = $stmt->fetchColumn();

    if ($id !== false) {
        return (int) $id;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO specializations (name, description) VALUES (:name, :description)'
    );
    $stmt->execute([
        'name' => $name,
        'description' => 'Specjalizacja dodana z panelu usług.',
    ]);

    return (int) $pdo->lastInsertId();
}

function fetchService(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare(
        'SELECT medical_services.id, medical_services.name, medical_services.description,
                medical_services.price, medical_services.duration_minutes,
                medical_services.is_active,
                specializations.name AS specialization
         FROM medical_services
         INNER JOIN specializations ON specializations.id = medical_services.specialization_id
         WHERE medical_services.id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();

    return is_array($row) ? $row : null;
}

function validateServicePayload(array $data): array
{
    $errors = validateRequiredFields($data, ['name', 'specialization', 'duration_minutes', 'price']);

    if (isset($data['duration_minutes']) && (int) $data['duration_minutes'] <= 0) {
        $errors['duration_minutes'] = 'Duration must be greater than 0.';
    }

    if (isset($data['price']) && (float) $data['price'] < 0) {
        $errors['price'] = 'Price cannot be negative.';
    }

    return $errors;
}

function notifyServiceChanged(PDO $pdo, ?array $service): void
{
    if (!$service) {
        return;
    }

    $name = trim((string) ($service['name'] ?? ''));
    tryCreateNotification(
        $pdo,
        'service_updated',
        'Zaktualizowano usługę',
        "Zmieniono usługę {$name}.",
        notificationAdminRecipients($pdo),
        'service',
        (int) $service['id'],
        'info',
        notificationCurrentUserId()
    );
}

try {
    $pdo = getDatabaseConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare(
            'SELECT medical_services.id, medical_services.name, medical_services.description,
                    medical_services.price, medical_services.duration_minutes,
                    medical_services.is_active,
                    specializations.name AS specialization
             FROM medical_services
             INNER JOIN specializations ON specializations.id = medical_services.specialization_id
             ORDER BY specializations.name, medical_services.name'
        );
        $stmt->execute();

        sendSuccessResponse($stmt->fetchAll(), 'Services loaded.');
    }

    $data = getJsonRequestBody();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $errors = validateServicePayload($data);

        if ($errors !== []) {
            sendErrorResponse('Validation error.', 422, $errors);
        }

        $specializationId = getSpecializationId($pdo, (string) $data['specialization']);
        $stmt = $pdo->prepare(
            'INSERT INTO medical_services
                (specialization_id, name, description, price, duration_minutes, is_active)
             VALUES
                (:specialization_id, :name, :description, :price, :duration_minutes, :is_active)'
        );
        $stmt->execute([
            'specialization_id' => $specializationId,
            'name' => trim((string) $data['name']),
            'description' => $data['description'] ?? null,
            'price' => (float) $data['price'],
            'duration_minutes' => (int) $data['duration_minutes'],
            'is_active' => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
        ]);

        $id = (int) $pdo->lastInsertId();
        $service = fetchService($pdo, $id);
        notifyServiceChanged($pdo, $service);
        sendSuccessResponse($service, 'Service created.', 201);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $errors = validateServicePayload($data);

        if (!isset($data['id']) || (int) $data['id'] <= 0) {
            $errors['id'] = 'Service id is required.';
        }

        if ($errors !== []) {
            sendErrorResponse('Validation error.', 422, $errors);
        }

        $id = (int) $data['id'];
        $specializationId = getSpecializationId($pdo, (string) $data['specialization']);
        $stmt = $pdo->prepare(
            'UPDATE medical_services
             SET specialization_id = :specialization_id,
                 name = :name,
                 description = :description,
                 price = :price,
                 duration_minutes = :duration_minutes,
                 is_active = :is_active
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'specialization_id' => $specializationId,
            'name' => trim((string) $data['name']),
            'description' => $data['description'] ?? null,
            'price' => (float) $data['price'],
            'duration_minutes' => (int) $data['duration_minutes'],
            'is_active' => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
        ]);

        $service = fetchService($pdo, $id);
        notifyServiceChanged($pdo, $service);
        sendSuccessResponse($service, 'Service updated.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
        if (!isset($data['id']) || (int) $data['id'] <= 0) {
            sendErrorResponse('Service id is required.', 422, ['id' => 'Service id is required.']);
        }

        $isActive = isset($data['is_active']) ? (int) (bool) $data['is_active'] : 0;
        $stmt = $pdo->prepare(
            'UPDATE medical_services SET is_active = :is_active WHERE id = :id'
        );
        $stmt->execute([
            'id' => (int) $data['id'],
            'is_active' => $isActive,
        ]);

        $service = fetchService($pdo, (int) $data['id']);
        notifyServiceChanged($pdo, $service);
        sendSuccessResponse($service, 'Service status updated.');
    }
} catch (PDOException $exception) {
    sendDatabaseErrorResponse();
}
