<?php
// MediPlus student prototype backend.
// Users management endpoint. Password hashes are never exposed to the frontend.
//
// GET   /backend/api/users.php
// POST  /backend/api/users.php
// Body: {"first_name":"Anna","last_name":"Nowak","login":"anna.nowak","email":"anna@...","password":"...","role":"Recepcja","status":"active"}
//
// PUT   /backend/api/users.php
// Body: {"id":1,"first_name":"Anna","last_name":"Nowak","login":"anna.nowak","email":"anna@...","role":"Lekarz","status":"active","doctor_id":3}
//
// PATCH /backend/api/users.php?action=reset_password
// Body: {"id":1}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/notifications.php';

handlePreflightRequest('GET, POST, PUT, PATCH, OPTIONS');
requireMethod(['GET', 'POST', 'PUT', 'PATCH']);

function usersColumnExists(PDO $pdo, string $column): bool
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
        'table_name' => 'users',
        'column_name' => $column,
    ]);

    return (bool) $stmt->fetch();
}

function usersHasNewSchema(PDO $pdo): bool
{
    return usersColumnExists($pdo, 'login')
        && usersColumnExists($pdo, 'role')
        && usersColumnExists($pdo, 'status');
}

function usersNormalizeRole(?string $role): string
{
    $value = strtolower(trim((string) $role));
    return in_array($value, ['lekarz', 'doctor'], true) ? 'Lekarz' : 'Recepcja';
}

function usersNormalizeStatus(?string $status): string
{
    $value = strtolower(trim((string) $status));

    if (in_array($value, ['blocked', 'zablokowany'], true)) {
        return 'blocked';
    }
    if (in_array($value, ['inactive', 'nieaktywny'], true)) {
        return 'inactive';
    }

    return 'active';
}

function usersStatusForFrontend(?string $status): string
{
    $value = usersNormalizeStatus($status);
    return [
        'active' => 'Aktywny',
        'blocked' => 'Zablokowany',
        'inactive' => 'Nieaktywny',
    ][$value];
}

function usersSafeRow(array $row, bool $newSchema): array
{
    $role = $newSchema ? ($row['role'] ?? 'Recepcja') : ($row['role_name'] ?? 'Recepcja');
    $status = $newSchema ? ($row['status'] ?? 'active') : (((int) ($row['is_active'] ?? 0)) === 1 ? 'active' : 'inactive');
    $login = $newSchema ? ($row['login'] ?? '') : ($row['username'] ?? '');

    return [
        'id' => (int) $row['id'],
        'first_name' => $row['first_name'] ?? '',
        'last_name' => $row['last_name'] ?? '',
        'login' => $login,
        'email' => $row['email'] ?? '',
        'role' => usersNormalizeRole($role),
        'status' => usersStatusForFrontend($status),
        'doctor_id' => $row['doctor_id'] ?? null,
        'must_change_password' => (bool) ($row['must_change_password'] ?? false),
        'last_login' => $row['last_login_at'] ?? null,
        'last_login_at' => $row['last_login_at'] ?? null,
        'created_at' => $row['created_at'] ?? null,
    ];
}

function usersTemporaryPassword(): string
{
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $code = '';

    for ($i = 0; $i < 6; $i++) {
        $code .= $chars[random_int(0, strlen($chars) - 1)];
    }

    return 'MP-' . $code;
}

function usersFetchById(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare(
        'SELECT id, first_name, last_name, login, email, role, status, doctor_id,
                must_change_password, last_login_at, created_at
         FROM users
         WHERE id = :id'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();

    return is_array($row) ? $row : null;
}

function notifyUserCreated(PDO $pdo, ?array $user): void
{
    if (!$user) {
        return;
    }

    $login = (string) ($user['login'] ?? '');
    $role = usersNormalizeRole($user['role'] ?? 'Recepcja');

    tryCreateNotification(
        $pdo,
        'user_created',
        'Utworzono użytkownika',
        "Utworzono konto użytkownika {$login} z rolą {$role}.",
        notificationAdminRecipients($pdo),
        'user',
        (int) $user['id'],
        'info',
        notificationCurrentUserId()
    );
}

function notifyUserPasswordReset(PDO $pdo, ?array $user): void
{
    if (!$user) {
        return;
    }

    $login = (string) ($user['login'] ?? '');
    tryCreateNotification(
        $pdo,
        'user_password_reset',
        'Zresetowano hasło',
        "Zresetowano hasło użytkownika {$login}.",
        notificationAdminRecipients($pdo),
        'user',
        (int) $user['id'],
        'warning',
        notificationCurrentUserId()
    );
}

function notifyUserStatusChanged(PDO $pdo, ?array $previousUser, ?array $user): void
{
    if (!$previousUser || !$user || usersNormalizeStatus($previousUser['status'] ?? '') === usersNormalizeStatus($user['status'] ?? '')) {
        return;
    }

    $status = usersNormalizeStatus($user['status'] ?? 'active');
    $title = [
        'active' => 'Aktywowano użytkownika',
        'blocked' => 'Zablokowano użytkownika',
        'inactive' => 'Dezaktywowano użytkownika',
    ][$status] ?? 'Zmieniono status użytkownika';

    $label = usersStatusForFrontend($status);
    $login = (string) ($user['login'] ?? '');

    tryCreateNotification(
        $pdo,
        'user_status_changed',
        $title,
        "Zmieniono status użytkownika {$login} na {$label}.",
        notificationAdminRecipients($pdo),
        'user',
        (int) $user['id'],
        $status === 'active' ? 'info' : 'warning',
        notificationCurrentUserId()
    );
}

try {
    $pdo = getDatabaseConnection();
    $newSchema = usersHasNewSchema($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($newSchema) {
            $stmt = $pdo->query(
                'SELECT id, first_name, last_name, login, email, role, status, doctor_id,
                        must_change_password, last_login_at, created_at
                 FROM users
                 ORDER BY last_name, first_name'
            );
        } else {
            $stmt = $pdo->query(
                'SELECT users.id, users.first_name, users.last_name, users.username, users.email,
                        roles.name AS role_name, users.is_active, NULL AS doctor_id,
                        NULL AS must_change_password, NULL AS last_login_at, users.created_at
                 FROM users
                 INNER JOIN roles ON roles.id = users.role_id
                 ORDER BY users.last_name, users.first_name'
            );
        }

        $users = array_map(fn($row) => usersSafeRow($row, $newSchema), $stmt->fetchAll());
        sendSuccessResponse($users, 'Users loaded.');
    }

    $data = getJsonRequestBody();

    if (!$newSchema) {
        if ($_SERVER['REQUEST_METHOD'] === 'PATCH' && ($_GET['action'] ?? '') === 'reset_password') {
            $id = (int) ($data['id'] ?? 0);
            if ($id <= 0) {
                sendErrorResponse('Missing user id.', 422);
            }

            $temporaryPassword = usersTemporaryPassword();
            $stmt = $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
            $stmt->execute([
                'hash' => password_hash($temporaryPassword, PASSWORD_DEFAULT),
                'id' => $id,
            ]);

            if ($stmt->rowCount() === 0) {
                sendErrorResponse('User not found.', 404);
            }

            sendJsonResponse([
                'success' => true,
                'temporary_password' => $temporaryPassword,
                'message' => 'Haslo tymczasowe zostalo wygenerowane.',
            ]);
        }

        sendErrorResponse('Current database users table does not support this operation yet. Import updated database.sql.', 400);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        foreach (['login', 'email'] as $field) {
            if (trim((string) ($data[$field] ?? '')) === '') {
                sendErrorResponse('Validation failed.', 422, [$field => 'Required.']);
            }
        }

        $password = trim((string) ($data['password'] ?? ''));
        $mustChangePassword = !empty($data['must_change_password']);
        if ($password === '') {
            $password = usersTemporaryPassword();
            $mustChangePassword = true;
        }

        $role = usersNormalizeRole($data['role'] ?? 'Recepcja');
        $doctorId = $role === 'Lekarz' ? ($data['doctor_id'] ?? null) : null;

        if ($role === 'Lekarz' && empty($doctorId)) {
            sendErrorResponse('Dla roli Lekarz wymagane jest powiazanie z lekarzem.', 422);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO users
                (first_name, last_name, login, email, password_hash, role, status, doctor_id, must_change_password)
             VALUES
                (:first_name, :last_name, :login, :email, :password_hash, :role, :status, :doctor_id, :must_change_password)'
        );
        $stmt->execute([
            'first_name' => trim((string) ($data['first_name'] ?? '')),
            'last_name' => trim((string) ($data['last_name'] ?? '')),
            'login' => trim((string) $data['login']),
            'email' => trim((string) $data['email']),
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => $role,
            'status' => usersNormalizeStatus($data['status'] ?? 'active'),
            'doctor_id' => $doctorId,
            'must_change_password' => $mustChangePassword ? 1 : 0,
        ]);

        $id = (int) $pdo->lastInsertId();
        $user = usersFetchById($pdo, $id);
        notifyUserCreated($pdo, $user);
        sendSuccessResponse(usersSafeRow($user, true), 'User created.', 201);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) {
            sendErrorResponse('Missing user id.', 422);
        }

        $previousUser = usersFetchById($pdo, $id);

        $role = usersNormalizeRole($data['role'] ?? 'Recepcja');
        $doctorId = $role === 'Lekarz' ? ($data['doctor_id'] ?? null) : null;

        if ($role === 'Lekarz' && empty($doctorId)) {
            sendErrorResponse('Dla roli Lekarz wymagane jest powiazanie z lekarzem.', 422);
        }

        $stmt = $pdo->prepare(
            'UPDATE users
             SET first_name = :first_name,
                 last_name = :last_name,
                 login = :login,
                 email = :email,
                 role = :role,
                 status = :status,
                 doctor_id = :doctor_id
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'first_name' => trim((string) ($data['first_name'] ?? '')),
            'last_name' => trim((string) ($data['last_name'] ?? '')),
            'login' => trim((string) ($data['login'] ?? '')),
            'email' => trim((string) ($data['email'] ?? '')),
            'role' => $role,
            'status' => usersNormalizeStatus($data['status'] ?? 'active'),
            'doctor_id' => $doctorId,
        ]);

        $user = usersFetchById($pdo, $id);
        if (!$user) {
            sendErrorResponse('User not found.', 404);
        }

        notifyUserStatusChanged($pdo, $previousUser, $user);
        sendSuccessResponse(usersSafeRow($user, true), 'User updated.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH' && ($_GET['action'] ?? '') === 'reset_password') {
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) {
            sendErrorResponse('Missing user id.', 422);
        }

        $temporaryPassword = usersTemporaryPassword();
        $stmt = $pdo->prepare(
            'UPDATE users
             SET password_hash = :hash, must_change_password = 1
             WHERE id = :id'
        );
        $stmt->execute([
            'hash' => password_hash($temporaryPassword, PASSWORD_DEFAULT),
            'id' => $id,
        ]);

        if ($stmt->rowCount() === 0) {
            sendErrorResponse('User not found.', 404);
        }

        $user = usersFetchById($pdo, $id);
        notifyUserPasswordReset($pdo, $user);
        sendJsonResponse([
            'success' => true,
            'temporary_password' => $temporaryPassword,
            'user' => usersSafeRow($user, true),
            'message' => 'Haslo tymczasowe zostalo wygenerowane.',
        ]);
    }

    sendErrorResponse('Unsupported operation.', 405);
} catch (PDOException $exception) {
    sendDatabaseErrorResponse();
}
