<?php
// MediPlus internal notification center.
// This file is both an endpoint and a small helper library used by other APIs.

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function notificationCurrentUserId(): ?int
{
    $value = $_SESSION['user_id'] ?? $_SESSION['id'] ?? null;
    return $value ? (int) $value : null;
}

function ensureNotificationsTables(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS notifications (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(80) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            entity_type VARCHAR(80) NULL,
            entity_id INT UNSIGNED NULL,
            severity ENUM('info','success','warning','danger') NOT NULL DEFAULT 'info',
            created_by INT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notifications_created_at (created_at),
            INDEX idx_notifications_entity (entity_type, entity_id),
            CONSTRAINT fk_notifications_created_by
              FOREIGN KEY (created_by) REFERENCES users(id)
              ON UPDATE CASCADE
              ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS notification_recipients (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            notification_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            read_at DATETIME NULL,
            deleted_at DATETIME NULL,
            INDEX idx_notification_recipients_user_read (user_id, is_read),
            INDEX idx_notification_recipients_notification (notification_id),
            CONSTRAINT fk_notification_recipients_notification
              FOREIGN KEY (notification_id) REFERENCES notifications(id)
              ON DELETE CASCADE,
            CONSTRAINT fk_notification_recipients_user
              FOREIGN KEY (user_id) REFERENCES users(id)
              ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function notificationUniqueIds(array $ids): array
{
    $normalized = [];
    foreach ($ids as $id) {
        $id = (int) $id;
        if ($id > 0) {
            $normalized[$id] = $id;
        }
    }
    return array_values($normalized);
}

function notificationAdminRecipients(PDO $pdo): array
{
    ensureNotificationsTables($pdo);
    $stmt = $pdo->query(
        "SELECT id
         FROM users
         WHERE status = 'active'
           AND role IN ('Recepcja', 'Administrator')"
    );

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function notificationDoctorRecipients(PDO $pdo, ?int $doctorId): array
{
    if (!$doctorId) {
        return [];
    }

    ensureNotificationsTables($pdo);
    $stmt = $pdo->prepare(
        "SELECT id
         FROM users
         WHERE status = 'active'
           AND role = 'Lekarz'
           AND doctor_id = :doctor_id"
    );
    $stmt->execute(['doctor_id' => $doctorId]);

    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function createNotification(
    PDO $pdo,
    string $type,
    string $title,
    string $message,
    array $recipients,
    ?string $entityType = null,
    ?int $entityId = null,
    string $severity = 'info',
    ?int $createdBy = null
): ?int {
    $recipients = notificationUniqueIds($recipients);
    if (!$recipients) {
        return null;
    }

    $severity = in_array($severity, ['info', 'success', 'warning', 'danger'], true) ? $severity : 'info';
    ensureNotificationsTables($pdo);

    $stmt = $pdo->prepare(
        'INSERT INTO notifications
            (type, title, message, entity_type, entity_id, severity, created_by)
         VALUES
            (:type, :title, :message, :entity_type, :entity_id, :severity, :created_by)'
    );
    $stmt->execute([
        'type' => $type,
        'title' => $title,
        'message' => $message,
        'entity_type' => $entityType,
        'entity_id' => $entityId,
        'severity' => $severity,
        'created_by' => $createdBy,
    ]);

    $notificationId = (int) $pdo->lastInsertId();
    $recipientStmt = $pdo->prepare(
        'INSERT INTO notification_recipients (notification_id, user_id)
         VALUES (:notification_id, :user_id)'
    );

    foreach ($recipients as $userId) {
        $recipientStmt->execute([
            'notification_id' => $notificationId,
            'user_id' => $userId,
        ]);
    }

    return $notificationId;
}

function tryCreateNotification(
    PDO $pdo,
    string $type,
    string $title,
    string $message,
    array $recipients,
    ?string $entityType = null,
    ?int $entityId = null,
    string $severity = 'info',
    ?int $createdBy = null
): ?int {
    try {
        return createNotification($pdo, $type, $title, $message, $recipients, $entityType, $entityId, $severity, $createdBy);
    } catch (Throwable $exception) {
        error_log('[MediPlus notifications] ' . $exception->getMessage());
        return null;
    }
}

function notificationPersonName(array $row, string $prefix): string
{
    return trim((string) ($row[$prefix . '_first_name'] ?? '') . ' ' . (string) ($row[$prefix . '_last_name'] ?? ''));
}

$isDirectNotificationRequest = isset($_SERVER['SCRIPT_FILENAME']) && realpath((string) $_SERVER['SCRIPT_FILENAME']) === __FILE__;
if (!$isDirectNotificationRequest) {
    return;
}

handlePreflightRequest('GET, PATCH, OPTIONS');
requireMethod(['GET', 'PATCH']);

try {
    $pdo = getDatabaseConnection();
    ensureNotificationsTables($pdo);

    $userId = notificationCurrentUserId();
    if (!$userId) {
        sendErrorResponse('Unauthorized.', 401);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $limit = max(1, min(100, (int) ($_GET['limit'] ?? 50)));
        $stmt = $pdo->prepare(
            "SELECT notifications.id, notifications.type, notifications.title, notifications.message,
                    notifications.entity_type, notifications.entity_id, notifications.severity,
                    notifications.created_at, notification_recipients.is_read,
                    notification_recipients.read_at
             FROM notification_recipients
             INNER JOIN notifications ON notifications.id = notification_recipients.notification_id
             WHERE notification_recipients.user_id = :user_id
               AND notification_recipients.deleted_at IS NULL
             ORDER BY notifications.created_at DESC, notifications.id DESC
             LIMIT {$limit}"
        );
        $stmt->execute(['user_id' => $userId]);
        $notifications = array_map(static function ($row) {
            $row['id'] = (int) $row['id'];
            $row['entity_id'] = $row['entity_id'] !== null ? (int) $row['entity_id'] : null;
            $row['is_read'] = (bool) $row['is_read'];
            return $row;
        }, $stmt->fetchAll());

        $countStmt = $pdo->prepare(
            'SELECT COUNT(*)
             FROM notification_recipients
             WHERE user_id = :user_id
               AND is_read = 0
               AND deleted_at IS NULL'
        );
        $countStmt->execute(['user_id' => $userId]);
        $unreadCount = (int) $countStmt->fetchColumn();

        sendJsonResponse([
            'success' => true,
            'data' => $notifications,
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    $data = getJsonRequestBody();
    $action = (string) ($data['action'] ?? '');

    if ($action === 'mark_read') {
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) {
            sendErrorResponse('Notification id is required.', 422);
        }

        $stmt = $pdo->prepare(
            'UPDATE notification_recipients
             SET is_read = 1,
                 read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
             WHERE user_id = :user_id
               AND notification_id = :notification_id
               AND deleted_at IS NULL'
        );
        $stmt->execute(['user_id' => $userId, 'notification_id' => $id]);
    } elseif ($action === 'mark_all_read') {
        $stmt = $pdo->prepare(
            'UPDATE notification_recipients
             SET is_read = 1,
                 read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
             WHERE user_id = :user_id
               AND deleted_at IS NULL'
        );
        $stmt->execute(['user_id' => $userId]);
    } elseif ($action === 'delete') {
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) {
            sendErrorResponse('Notification id is required.', 422);
        }

        $stmt = $pdo->prepare(
            'UPDATE notification_recipients
             SET deleted_at = CURRENT_TIMESTAMP
             WHERE user_id = :user_id
               AND notification_id = :notification_id'
        );
        $stmt->execute(['user_id' => $userId, 'notification_id' => $id]);
    } elseif ($action === 'clear_all') {
        $stmt = $pdo->prepare(
            'UPDATE notification_recipients
             SET deleted_at = CURRENT_TIMESTAMP
             WHERE user_id = :user_id
               AND deleted_at IS NULL'
        );
        $stmt->execute(['user_id' => $userId]);
    } else {
        sendErrorResponse('Unsupported notification action.', 422);
    }

    $countStmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM notification_recipients
         WHERE user_id = :user_id
           AND is_read = 0
           AND deleted_at IS NULL'
    );
    $countStmt->execute(['user_id' => $userId]);

    sendJsonResponse([
        'success' => true,
        'unread_count' => (int) $countStmt->fetchColumn(),
    ]);
} catch (PDOException $exception) {
    sendDatabaseErrorResponse();
}
