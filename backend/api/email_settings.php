<?php
// MediPlus SMTP settings API. Stores settings in system_settings under key "email".

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/email.php';

handlePreflightRequest('GET, POST, PUT, OPTIONS');
requireMethod(['GET', 'POST', 'PUT']);

try {
    $pdo = getDatabaseConnection();

    if (!emailCurrentUserCanManage($pdo)) {
        sendErrorResponse('Forbidden.', 403);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        sendSuccessResponse(publicEmailSettings(fetchEmailSettings($pdo)), 'Email settings loaded.');
    }

    $existing = fetchEmailSettings($pdo);
    $payload = getJsonRequestBody();
    $settings = normalizeEmailSettings($payload, $existing);

    if ($settings['smtpHost'] !== '' && $settings['senderEmail'] === '') {
        sendErrorResponse('Adres nadawcy jest wymagany przy konfiguracji SMTP.', 422, [
            'senderEmail' => 'Required sender email.',
        ]);
    }
    if ($settings['senderEmail'] !== '' && !filter_var($settings['senderEmail'], FILTER_VALIDATE_EMAIL)) {
        sendErrorResponse('Nieprawidłowy adres e-mail nadawcy.', 422, [
            'senderEmail' => 'Invalid sender email.',
        ]);
    }

    saveEmailSettings($pdo, $settings);
    sendSuccessResponse(publicEmailSettings($settings), 'Email settings saved.');
} catch (Throwable $exception) {
    sendErrorResponse($exception->getMessage(), 500);
}
