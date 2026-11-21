<?php
// MediPlus student prototype backend.
// Real session-based authentication for the internal clinic system.
//
// POST /backend/api/auth.php?action=login
// Body: {"login":"recepcja","password":"mediplus123"}
//
// GET  /backend/api/auth.php?action=me
// POST /backend/api/auth.php?action=logout
// POST /backend/api/auth.php?action=change_password
// Body: {"new_password":"new-safe-password"}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

session_start();
handlePreflightRequest('GET, POST, OPTIONS');

$action = $_GET['action'] ?? 'me';

function authColumnExists(PDO $pdo, string $column): bool
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

function authUsersHasNewSchema(PDO $pdo): bool
{
    return authColumnExists($pdo, 'login')
        && authColumnExists($pdo, 'role')
        && authColumnExists($pdo, 'status');
}

function authNormalizeRole(?string $role): string
{
    $value = strtolower(trim((string) $role));
    if (in_array($value, ['lekarz', 'doctor'], true)) {
        return 'Lekarz';
    }

    return 'Recepcja';
}

function authNormalizeStatus(array $row, bool $newSchema): string
{
    if ($newSchema) {
        return strtolower((string) ($row['status'] ?? 'active'));
    }

    return ((int) ($row['is_active'] ?? 0)) === 1 ? 'active' : 'inactive';
}

function authSafeUser(array $row, bool $newSchema): array
{
    $role = $newSchema ? ($row['role'] ?? 'Recepcja') : ($row['role_name'] ?? 'Recepcja');
    $login = $newSchema ? ($row['login'] ?? '') : ($row['username'] ?? '');
    $mustChange = $newSchema ? (bool) ($row['must_change_password'] ?? false) : false;

    return [
        'id' => (int) $row['id'],
        'first_name' => $row['first_name'] ?? '',
        'last_name' => $row['last_name'] ?? '',
        'name' => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')),
        'login' => $login,
        'email' => $row['email'] ?? '',
        'role' => authNormalizeRole($role),
        'doctor_id' => isset($row['doctor_id']) ? $row['doctor_id'] : null,
        'must_change_password' => $mustChange,
        'last_login_at' => $row['last_login_at'] ?? null,
    ];
}

function authFindUserByLogin(PDO $pdo, string $login, bool $newSchema): ?array
{
    if ($newSchema) {
        $stmt = $pdo->prepare(
            'SELECT id, first_name, last_name, login, email, password_hash, role, status,
                    doctor_id, must_change_password, last_login_at
             FROM users
             WHERE login = :login OR email = :email
             LIMIT 1'
        );
    } else {
        $stmt = $pdo->prepare(
            'SELECT users.id, users.first_name, users.last_name, users.username, users.email,
                    users.password_hash, users.is_active, roles.name AS role_name,
                    NULL AS doctor_id, NULL AS must_change_password, NULL AS last_login_at
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.username = :login OR users.email = :email
             LIMIT 1'
        );
    }

    $stmt->execute([
        'login' => $login,
        'email' => $login,
    ]);
    $row = $stmt->fetch();

    return $row ?: null;
}

function authFindUserById(PDO $pdo, int $id, bool $newSchema): ?array
{
    if ($newSchema) {
        $stmt = $pdo->prepare(
            'SELECT id, first_name, last_name, login, email, password_hash, role, status,
                    doctor_id, must_change_password, last_login_at
             FROM users
             WHERE id = :id
             LIMIT 1'
        );
    } else {
        $stmt = $pdo->prepare(
            'SELECT users.id, users.first_name, users.last_name, users.username, users.email,
                    users.password_hash, users.is_active, roles.name AS role_name,
                    NULL AS doctor_id, NULL AS must_change_password, NULL AS last_login_at
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.id = :id
             LIMIT 1'
        );
    }

    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();

    return $row ?: null;
}

try {
    $pdo = getDatabaseConnection();
    $newSchema = authUsersHasNewSchema($pdo);

    if ($action === 'login') {
        requireMethod(['POST']);

        $data = getJsonRequestBody();
        $login = trim((string) ($data['login'] ?? $data['email'] ?? $data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');

        if ($login === '' || $password === '') {
            sendErrorResponse('Nieprawidłowy login lub hasło.', 401);
        }

        $row = authFindUserByLogin($pdo, $login, $newSchema);

        if (!$row || !password_verify($password, (string) ($row['password_hash'] ?? ''))) {
            sendErrorResponse('Nieprawidłowy login lub hasło.', 401);
        }

        if (authNormalizeStatus($row, $newSchema) !== 'active') {
            sendErrorResponse('Konto jest nieaktywne lub zablokowane.', 403);
        }

        if ($newSchema) {
            $stmt = $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id');
            $stmt->execute(['id' => $row['id']]);
            $row['last_login_at'] = date('Y-m-d H:i:s');
        }

        $user = authSafeUser($row, $newSchema);

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['doctor_id'] = $user['doctor_id'];

        sendJsonResponse([
            'success' => true,
            'user' => $user,
        ]);
    }

    if ($action === 'me') {
        requireMethod(['GET']);

        if (empty($_SESSION['user_id'])) {
            sendErrorResponse('Brak aktywnej sesji.', 401);
        }

        $row = authFindUserById($pdo, (int) $_SESSION['user_id'], $newSchema);

        if (!$row || authNormalizeStatus($row, $newSchema) !== 'active') {
            session_destroy();
            sendErrorResponse('Brak aktywnej sesji.', 401);
        }

        sendJsonResponse([
            'success' => true,
            'user' => authSafeUser($row, $newSchema),
        ]);
    }

    if ($action === 'logout') {
        requireMethod(['POST']);

        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();

        sendJsonResponse([
            'success' => true,
            'message' => 'Wylogowano.',
        ]);
    }

    if ($action === 'change_password') {
        requireMethod(['POST']);

        if (empty($_SESSION['user_id'])) {
            sendErrorResponse('Brak aktywnej sesji.', 401);
        }

        $data = getJsonRequestBody();
        $newPassword = (string) ($data['new_password'] ?? '');

        if (strlen($newPassword) < 8) {
            sendErrorResponse('Hasło musi mieć co najmniej 8 znaków.', 422);
        }

        $hash = password_hash($newPassword, PASSWORD_DEFAULT);

        if ($newSchema && authColumnExists($pdo, 'must_change_password')) {
            $stmt = $pdo->prepare('UPDATE users SET password_hash = :hash, must_change_password = 0 WHERE id = :id');
        } else {
            $stmt = $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
        }
        $stmt->execute([
            'hash' => $hash,
            'id' => (int) $_SESSION['user_id'],
        ]);

        sendJsonResponse([
            'success' => true,
            'message' => 'Hasło zostało zmienione.',
        ]);
    }

    sendErrorResponse('Unknown action.', 404);
} catch (PDOException $exception) {
    sendDatabaseErrorResponse();
}
