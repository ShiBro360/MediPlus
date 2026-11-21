<?php
// MediPlus student prototype backend.
// Basic cabinets API: list, create, update and delete clinic rooms in the student prototype.
// Example:
// GET /backend/api/cabinets.php
// POST /backend/api/cabinets.php
// PUT  /backend/api/cabinets.php
// Body: {"id":1,"name":"Sala dermatologiczna","room_number":"204A","cabinet_type":"Uniwersalny","floor":"1","description":"Opis","is_active":1}
// DELETE /backend/api/cabinets.php
// Body: {"id":1}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/notifications.php';

handlePreflightRequest('GET, POST, PUT, DELETE, OPTIONS');
requireMethod(['GET', 'POST', 'PUT', 'DELETE']);

function cabinetColumnExists(PDO $pdo, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name
         LIMIT 1'
    );
    $stmt->execute([
        'table_name' => 'cabinets',
        'column_name' => $column,
    ]);

    return (bool) $stmt->fetch();
}

function ensureCabinetRoomNumberColumn(PDO $pdo): void
{
    if (!cabinetColumnExists($pdo, 'room_number')) {
        $pdo->exec('ALTER TABLE cabinets ADD COLUMN room_number VARCHAR(50) NULL AFTER name');
    }
}

function allowedCabinetTypes(): array
{
    return [
        'Administracyjny',
        'Uniwersalny',
        'Ginekologiczny',
        'Psychologiczny',
        'Fizjoterapia',
        'Zabiegowy',
        'Punkt Pobrań',
    ];
}

function normalizeCabinetTypeValue($value): string
{
    $value = trim((string) ($value ?? ''));
    if (in_array($value, allowedCabinetTypes(), true)) {
        return $value;
    }

    $map = [
        'Internista' => 'Uniwersalny',
        'Pediatra' => 'Uniwersalny',
        'Dermatolog' => 'Uniwersalny',
        'Kardiolog' => 'Uniwersalny',
        'Neurolog' => 'Uniwersalny',
        'Endokrynolog' => 'Uniwersalny',
        'Gastroenterolog' => 'Uniwersalny',
        'Diabetolog' => 'Uniwersalny',
        'Pulmonolog' => 'Uniwersalny',
        'Laryngolog' => 'Uniwersalny',
        'Ginekolog' => 'Ginekologiczny',
        'Psycholog' => 'Psychologiczny',
        'Fizjoterapeuta' => 'Fizjoterapia',
    ];

    if (isset($map[$value])) {
        return $map[$value];
    }

    foreach (explode(',', $value) as $part) {
        $part = trim($part);
        if (isset($map[$part])) {
            return $map[$part];
        }
    }

    return 'Uniwersalny';
}

function ensureCabinetTypeColumn(PDO $pdo): void
{
    if (!cabinetColumnExists($pdo, 'cabinet_type')) {
        $pdo->exec("ALTER TABLE cabinets ADD COLUMN cabinet_type VARCHAR(50) NOT NULL DEFAULT 'Uniwersalny' AFTER room_number");
    }

    if (cabinetColumnExists($pdo, 'type')) {
        $pdo->exec(
            "UPDATE cabinets
             SET cabinet_type = CASE `type`
                 WHEN 'Internista' THEN 'Uniwersalny'
                 WHEN 'Pediatra' THEN 'Uniwersalny'
                 WHEN 'Dermatolog' THEN 'Uniwersalny'
                 WHEN 'Kardiolog' THEN 'Uniwersalny'
                 WHEN 'Neurolog' THEN 'Uniwersalny'
                 WHEN 'Endokrynolog' THEN 'Uniwersalny'
                 WHEN 'Gastroenterolog' THEN 'Uniwersalny'
                 WHEN 'Diabetolog' THEN 'Uniwersalny'
                 WHEN 'Pulmonolog' THEN 'Uniwersalny'
                 WHEN 'Laryngolog' THEN 'Uniwersalny'
                 WHEN 'Ginekolog' THEN 'Ginekologiczny'
                 WHEN 'Psycholog' THEN 'Psychologiczny'
                 WHEN 'Fizjoterapeuta' THEN 'Fizjoterapia'
                 WHEN 'Administracyjny' THEN 'Administracyjny'
                 WHEN 'Uniwersalny' THEN 'Uniwersalny'
                 WHEN 'Ginekologiczny' THEN 'Ginekologiczny'
                 WHEN 'Psychologiczny' THEN 'Psychologiczny'
                 WHEN 'Fizjoterapia' THEN 'Fizjoterapia'
                 WHEN 'Zabiegowy' THEN 'Zabiegowy'
                 WHEN 'Punkt Pobrań' THEN 'Punkt Pobrań'
                 ELSE cabinet_type
             END
             WHERE (`type` IS NOT NULL AND `type` <> '')"
        );
    }

    $pdo->exec(
        "UPDATE cabinets
         SET cabinet_type = CASE cabinet_type
             WHEN 'Internista' THEN 'Uniwersalny'
             WHEN 'Pediatra' THEN 'Uniwersalny'
             WHEN 'Dermatolog' THEN 'Uniwersalny'
             WHEN 'Kardiolog' THEN 'Uniwersalny'
             WHEN 'Neurolog' THEN 'Uniwersalny'
             WHEN 'Endokrynolog' THEN 'Uniwersalny'
             WHEN 'Gastroenterolog' THEN 'Uniwersalny'
             WHEN 'Diabetolog' THEN 'Uniwersalny'
             WHEN 'Pulmonolog' THEN 'Uniwersalny'
             WHEN 'Laryngolog' THEN 'Uniwersalny'
             WHEN 'Ginekolog' THEN 'Ginekologiczny'
             WHEN 'Psycholog' THEN 'Psychologiczny'
             WHEN 'Fizjoterapeuta' THEN 'Fizjoterapia'
             WHEN 'Administracyjny' THEN 'Administracyjny'
             WHEN 'Uniwersalny' THEN 'Uniwersalny'
             WHEN 'Ginekologiczny' THEN 'Ginekologiczny'
             WHEN 'Psychologiczny' THEN 'Psychologiczny'
             WHEN 'Fizjoterapia' THEN 'Fizjoterapia'
             WHEN 'Zabiegowy' THEN 'Zabiegowy'
             WHEN 'Punkt Pobrań' THEN 'Punkt Pobrań'
             ELSE 'Uniwersalny'
         END"
    );
}

function ensureCabinetEquipmentColumn(PDO $pdo): void
{
    if (!cabinetColumnExists($pdo, 'equipment')) {
        $pdo->exec('ALTER TABLE cabinets ADD COLUMN equipment TEXT NULL AFTER description');
    }
}

function cabinetRoomNumberFromPayload(array $data): ?string
{
    $value = $data['room_number'] ?? $data['number'] ?? $data['cabinet_number'] ?? null;
    if ($value === null) {
        return null;
    }

    $value = trim((string) $value);
    return $value === '' ? null : $value;
}

function fetchCabinet(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare(
        'SELECT cabinets.id, cabinets.name, cabinets.room_number, cabinets.cabinet_type, cabinets.cabinet_type AS type,
                cabinets.floor, cabinets.description, cabinets.equipment, cabinets.is_active,
                GROUP_CONCAT(
                    DISTINCT CONCAT("dr ", doctors.first_name, " ", doctors.last_name)
                    ORDER BY doctors.last_name, doctors.first_name
                    SEPARATOR ", "
                ) AS assigned_doctors
         FROM cabinets
         LEFT JOIN doctors ON doctors.cabinet_id = cabinets.id
         WHERE cabinets.id = :id
         GROUP BY cabinets.id, cabinets.name, cabinets.room_number, cabinets.cabinet_type, cabinets.floor, cabinets.description, cabinets.equipment, cabinets.is_active
         LIMIT 1'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();

    return is_array($row) ? $row : null;
}

function notifyCabinetChanged(PDO $pdo, ?array $cabinet): void
{
    if (!$cabinet) {
        return;
    }

    $name = trim((string) ($cabinet['name'] ?? ''));
    tryCreateNotification(
        $pdo,
        'cabinet_updated',
        'Zaktualizowano gabinet',
        "Zmieniono dane gabinetu {$name}.",
        notificationAdminRecipients($pdo),
        'cabinet',
        (int) $cabinet['id'],
        'info',
        notificationCurrentUserId()
    );
}

try {
    $pdo = getDatabaseConnection();
    ensureCabinetRoomNumberColumn($pdo);
    ensureCabinetTypeColumn($pdo);
    ensureCabinetEquipmentColumn($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare(
            'SELECT cabinets.id, cabinets.name, cabinets.room_number, cabinets.cabinet_type, cabinets.cabinet_type AS type,
                    cabinets.floor, cabinets.description, cabinets.equipment, cabinets.is_active,
                    GROUP_CONCAT(
                        DISTINCT CONCAT("dr ", doctors.first_name, " ", doctors.last_name)
                        ORDER BY doctors.last_name, doctors.first_name
                        SEPARATOR ", "
                    ) AS assigned_doctors
             FROM cabinets
             LEFT JOIN doctors ON doctors.cabinet_id = cabinets.id
             GROUP BY cabinets.id, cabinets.name, cabinets.room_number, cabinets.cabinet_type, cabinets.floor, cabinets.description, cabinets.equipment, cabinets.is_active
             ORDER BY cabinets.name'
        );
        $stmt->execute();

        sendSuccessResponse($stmt->fetchAll(), 'Cabinets loaded.');
    }

    $data = getJsonRequestBody();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!isset($data['name']) || trim((string) $data['name']) === '') {
            sendErrorResponse('Cabinet name is required.', 422, ['name' => 'Cabinet name is required.']);
        }

        $roomNumber = cabinetRoomNumberFromPayload($data);
        if ($roomNumber === null) {
            sendErrorResponse('Cabinet room number is required.', 422, ['room_number' => 'Cabinet room number is required.']);
        }
        $cabinetType = normalizeCabinetTypeValue($data['cabinet_type'] ?? $data['type'] ?? $data['specialization'] ?? null);

        $stmt = $pdo->prepare(
            'INSERT INTO cabinets
                (name, room_number, cabinet_type, floor, description, equipment, is_active)
             VALUES
                (:name, :room_number, :cabinet_type, :floor, :description, :equipment, :is_active)'
        );
        $stmt->execute([
            'name' => trim((string) $data['name']),
            'room_number' => $roomNumber,
            'cabinet_type' => $cabinetType,
            'floor' => $data['floor'] ?? null,
            'description' => $data['description'] ?? null,
            'equipment' => $data['equipment'] ?? null,
            'is_active' => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
        ]);

        $id = (int) $pdo->lastInsertId();
        $cabinet = fetchCabinet($pdo, $id);
        notifyCabinetChanged($pdo, $cabinet);
        sendSuccessResponse($cabinet, 'Cabinet created.', 201);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        if (!isset($data['id']) || (int) $data['id'] <= 0) {
            sendErrorResponse('Cabinet id is required.', 422, ['id' => 'Cabinet id is required.']);
        }

        if (!isset($data['name']) || trim((string) $data['name']) === '') {
            sendErrorResponse('Cabinet name is required.', 422, ['name' => 'Cabinet name is required.']);
        }

        $roomNumber = cabinetRoomNumberFromPayload($data);
        if ($roomNumber === null) {
            sendErrorResponse('Cabinet room number is required.', 422, ['room_number' => 'Cabinet room number is required.']);
        }
        $cabinetType = normalizeCabinetTypeValue($data['cabinet_type'] ?? $data['type'] ?? $data['specialization'] ?? null);

        $id = (int) $data['id'];
        $stmt = $pdo->prepare(
            'UPDATE cabinets
             SET name = :name,
                 room_number = :room_number,
                 cabinet_type = :cabinet_type,
                 floor = :floor,
                 description = :description,
                 equipment = :equipment,
                 is_active = :is_active
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'name' => trim((string) $data['name']),
            'room_number' => $roomNumber,
            'cabinet_type' => $cabinetType,
            'floor' => $data['floor'] ?? null,
            'description' => $data['description'] ?? null,
            'equipment' => $data['equipment'] ?? null,
            'is_active' => isset($data['is_active']) ? (int) (bool) $data['is_active'] : 1,
        ]);

        $cabinet = fetchCabinet($pdo, $id);
        notifyCabinetChanged($pdo, $cabinet);
        sendSuccessResponse($cabinet, 'Cabinet updated.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        if (!isset($data['id']) || (int) $data['id'] <= 0) {
            sendErrorResponse('Cabinet id is required.', 422, ['id' => 'Cabinet id is required.']);
        }

        $id = (int) $data['id'];
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM appointments
             WHERE cabinet_id = :id AND status = "planned"'
        );
        $stmt->execute(['id' => $id]);

        if ((int) $stmt->fetchColumn() > 0) {
            sendErrorResponse('Nie można usunąć gabinetu, ponieważ ma zaplanowane wizyty.', 409);
        }

        $stmt = $pdo->prepare('DELETE FROM cabinets WHERE id = :id');
        $stmt->execute(['id' => $id]);

        sendSuccessResponse(['id' => $id], 'Cabinet deleted.');
    }
} catch (PDOException $exception) {
    sendDatabaseErrorResponse();
}
