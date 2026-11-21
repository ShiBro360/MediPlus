<?php
// MediPlus transactional email helpers and test endpoint.
// Appointment emails are best-effort: sending failures never block appointment operations.

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function emailSettingsDefaults(): array
{
    return [
        'smtpHost' => '',
        'smtpPort' => 587,
        'smtpUsername' => '',
        'smtpPassword' => '',
        'encryption' => 'tls',
        'senderName' => 'MediPlus',
        'senderEmail' => '',
    ];
}

function ensureEmailSettingsStorage(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS system_settings (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(100) NOT NULL,
            setting_value JSON NOT NULL,
            updated_by INT UNSIGNED NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_system_settings_updated_by
              FOREIGN KEY (updated_by) REFERENCES users(id)
              ON UPDATE CASCADE
              ON DELETE SET NULL,
            UNIQUE KEY uniq_system_settings_key (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $stmt = $pdo->prepare(
        'INSERT INTO system_settings (setting_key, setting_value)
         VALUES (:setting_key, :setting_value)
         ON DUPLICATE KEY UPDATE setting_key = setting_key'
    );
    $stmt->execute([
        'setting_key' => 'email',
        'setting_value' => json_encode(emailSettingsDefaults(), JSON_UNESCAPED_UNICODE),
    ]);
}

function emailCurrentUserId(): ?int
{
    $value = $_SESSION['user_id'] ?? $_SESSION['id'] ?? null;
    return $value ? (int) $value : null;
}

function emailCurrentUserCanManage(PDO $pdo): bool
{
    $userId = emailCurrentUserId();
    if (!$userId) {
        return false;
    }

    $stmt = $pdo->prepare('SELECT role, status FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();
    if (!$user) {
        return false;
    }

    $role = strtolower(trim((string) ($user['role'] ?? '')));
    $status = strtolower(trim((string) ($user['status'] ?? 'active')));
    return in_array($role, ['recepcja', 'administrator'], true)
        && !in_array($status, ['blocked', 'inactive'], true);
}

function sanitizeEmailHeader(string $value): string
{
    return trim(str_replace(["\r", "\n"], ' ', $value));
}

function normalizeEmailSettings(array $raw, ?array $existing = null): array
{
    $fallback = $existing ? array_merge(emailSettingsDefaults(), $existing) : emailSettingsDefaults();
    $encryption = strtolower(trim((string) ($raw['encryption'] ?? $fallback['encryption'])));
    if (!in_array($encryption, ['none', 'ssl', 'tls'], true)) {
        $encryption = $fallback['encryption'];
    }

    $password = array_key_exists('smtpPassword', $raw)
        ? (string) $raw['smtpPassword']
        : (string) $fallback['smtpPassword'];
    if ($password === '' && $existing) {
        $password = (string) ($existing['smtpPassword'] ?? '');
    }

    return [
        'smtpHost' => sanitizeEmailHeader((string) ($raw['smtpHost'] ?? $fallback['smtpHost'])),
        'smtpPort' => max(1, min(65535, (int) ($raw['smtpPort'] ?? $fallback['smtpPort']))),
        'smtpUsername' => sanitizeEmailHeader((string) ($raw['smtpUsername'] ?? $fallback['smtpUsername'])),
        'smtpPassword' => $password,
        'encryption' => $encryption,
        'senderName' => sanitizeEmailHeader((string) ($raw['senderName'] ?? $fallback['senderName'])),
        'senderEmail' => sanitizeEmailHeader((string) ($raw['senderEmail'] ?? $fallback['senderEmail'])),
    ];
}

function fetchEmailSettings(PDO $pdo): array
{
    ensureEmailSettingsStorage($pdo);
    $stmt = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key = :key LIMIT 1');
    $stmt->execute(['key' => 'email']);
    $raw = $stmt->fetchColumn();
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    return normalizeEmailSettings(is_array($decoded) ? $decoded : []);
}

function publicEmailSettings(array $settings): array
{
    $public = $settings;
    $public['smtpPassword'] = '';
    $public['passwordConfigured'] = trim((string) ($settings['smtpPassword'] ?? '')) !== '';
    return $public;
}

function saveEmailSettings(PDO $pdo, array $settings): array
{
    ensureEmailSettingsStorage($pdo);
    $stmt = $pdo->prepare(
        'UPDATE system_settings
         SET setting_value = :value, updated_by = :updated_by
         WHERE setting_key = :key'
    );
    $stmt->execute([
        'value' => json_encode($settings, JSON_UNESCAPED_UNICODE),
        'updated_by' => emailCurrentUserId(),
        'key' => 'email',
    ]);
    return $settings;
}

function fetchClinicNameForEmail(PDO $pdo): string
{
    try {
        $stmt = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key = :key LIMIT 1');
        $stmt->execute(['key' => 'clinic']);
        $raw = $stmt->fetchColumn();
        $clinic = is_string($raw) ? json_decode($raw, true) : null;
        if (is_array($clinic)) {
            $name = trim((string) ($clinic['clinicName'] ?? $clinic['name'] ?? ''));
            if ($name !== '') {
                return $name;
            }
        }
    } catch (Throwable $exception) {
        error_log('MediPlus clinic name lookup failed: ' . $exception->getMessage());
    }

    return 'MediPlus';
}

function emailAppointmentPerson(array $appointment, string $prefix): string
{
    $first = trim((string) ($appointment[$prefix . '_first_name'] ?? ''));
    $last = trim((string) ($appointment[$prefix . '_last_name'] ?? ''));
    return trim($first . ' ' . $last);
}

function emailAppointmentContext(PDO $pdo, array $appointment): array
{
    $patient = emailAppointmentPerson($appointment, 'patient') ?: 'Pacjent';
    $doctorName = emailAppointmentPerson($appointment, 'doctor');
    $doctor = $doctorName ? 'dr ' . $doctorName : 'Lekarz';
    $date = (string) ($appointment['appointment_date'] ?? '');
    $start = substr((string) ($appointment['start_time'] ?? ''), 0, 5);
    $end = substr((string) ($appointment['end_time'] ?? ''), 0, 5);
    $cabinet = trim((string) ($appointment['cabinet_name'] ?? ''));
    $roomNumber = trim((string) ($appointment['cabinet_room_number'] ?? ''));
    if ($roomNumber !== '' && strpos($cabinet, $roomNumber) === false) {
        $cabinet = trim($cabinet . ' ' . $roomNumber);
    }

    return [
        'patientEmail' => trim((string) ($appointment['patient_email'] ?? '')),
        'patient' => $patient,
        'doctor' => $doctor,
        'service' => trim((string) ($appointment['service_name'] ?? 'Wizyta')),
        'date' => $date,
        'time' => $end !== '' ? "{$start}–{$end}" : $start,
        'cabinet' => $cabinet !== '' ? $cabinet : 'brak gabinetu',
        'clinic' => fetchClinicNameForEmail($pdo),
    ];
}

function htmlEscapeEmail(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function buildAppointmentEmail(array $context, string $type): array
{
    $isCancelled = $type === 'cancelled';
    $subject = $isCancelled ? 'Anulowanie wizyty' : 'Potwierdzenie wizyty';
    $lead = $isCancelled
        ? 'Informujemy, że poniższa wizyta została anulowana.'
        : 'Potwierdzamy zapisanie wizyty w naszej klinice.';
    $accent = $isCancelled ? '#dc2626' : '#16a34a';

    $rows = [
        'Pacjent' => $context['patient'],
        'Lekarz' => $context['doctor'],
        'Usługa' => $context['service'],
        'Data' => $context['date'],
        'Godzina' => $context['time'],
        'Gabinet' => $context['cabinet'],
        'Klinika' => $context['clinic'],
    ];

    $htmlRows = '';
    $textRows = '';
    foreach ($rows as $label => $value) {
        $htmlRows .= '<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">' . htmlEscapeEmail($label) . '</td><td style="padding:8px 12px;font-weight:700;color:#0f172a;">' . htmlEscapeEmail((string) $value) . '</td></tr>';
        $textRows .= "{$label}: {$value}\n";
    }

    $html = '<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">'
        . '<div style="max-width:620px;margin:0 auto;padding:28px 16px;">'
        . '<div style="background:#fff;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden;box-shadow:0 14px 35px rgba(15,23,42,.08);">'
        . '<div style="border-top:6px solid ' . $accent . ';padding:22px 24px 14px;">'
        . '<h1 style="margin:0 0 8px;font-size:24px;line-height:1.2;">' . htmlEscapeEmail($subject) . '</h1>'
        . '<p style="margin:0;color:#475569;font-size:15px;">' . htmlEscapeEmail($lead) . '</p></div>'
        . '<table style="width:100%;border-collapse:collapse;margin:4px 0 18px;">' . $htmlRows . '</table>'
        . '<div style="padding:0 24px 24px;color:#475569;font-size:14px;line-height:1.6;">Pozdrawiamy,<br><strong>MediPlus</strong></div>'
        . '</div></div></body></html>';

    $text = "{$subject}\n\n{$lead}\n\n{$textRows}\nPozdrawiamy,\nMediPlus";
    return ['subject' => $subject, 'html' => $html, 'text' => $text];
}

function encodeMimeHeaderUtf8(string $value): string
{
    $value = sanitizeEmailHeader($value);
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($value, 'UTF-8', 'B', "\r\n");
    }
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function smtpRead($socket): string
{
    $response = '';
    while (!feof($socket)) {
        $line = fgets($socket, 515);
        if ($line === false) {
            break;
        }
        $response .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }
    return $response;
}

function smtpCommand($socket, string $command, array $expectedCodes): string
{
    fwrite($socket, $command . "\r\n");
    $response = smtpRead($socket);
    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('SMTP command failed: ' . trim($response));
    }
    return $response;
}

function smtpSendEmail(array $settings, string $to, string $subject, string $html, string $text): void
{
    $host = trim((string) ($settings['smtpHost'] ?? ''));
    $port = (int) ($settings['smtpPort'] ?? 0);
    $senderEmail = trim((string) ($settings['senderEmail'] ?? ''));
    if ($host === '' || $port <= 0 || $senderEmail === '' || !filter_var($senderEmail, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('SMTP settings are incomplete.');
    }
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('Invalid recipient email.');
    }

    $encryption = strtolower((string) ($settings['encryption'] ?? 'tls'));
    $remote = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $socket = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if (!$socket) {
        throw new RuntimeException("SMTP connection failed: {$errstr}");
    }
    stream_set_timeout($socket, 20);

    try {
        $hello = smtpRead($socket);
        if ((int) substr($hello, 0, 3) !== 220) {
            throw new RuntimeException('SMTP greeting failed: ' . trim($hello));
        }
        smtpCommand($socket, 'EHLO mediplus.local', [250]);
        if ($encryption === 'tls') {
            smtpCommand($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('SMTP TLS negotiation failed.');
            }
            smtpCommand($socket, 'EHLO mediplus.local', [250]);
        }

        $username = (string) ($settings['smtpUsername'] ?? '');
        $password = (string) ($settings['smtpPassword'] ?? '');
        if ($username !== '') {
            smtpCommand($socket, 'AUTH LOGIN', [334]);
            smtpCommand($socket, base64_encode($username), [334]);
            smtpCommand($socket, base64_encode($password), [235]);
        }

        smtpCommand($socket, 'MAIL FROM:<' . $senderEmail . '>', [250]);
        smtpCommand($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        smtpCommand($socket, 'DATA', [354]);

        $boundary = 'mediplus-' . bin2hex(random_bytes(8));
        $fromName = trim((string) ($settings['senderName'] ?? 'MediPlus')) ?: 'MediPlus';
        $headers = [
            'From: ' . encodeMimeHeaderUtf8($fromName) . ' <' . $senderEmail . '>',
            'To: <' . $to . '>',
            'Subject: ' . encodeMimeHeaderUtf8($subject),
            'Date: ' . date(DATE_RFC2822),
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $body = implode("\r\n", $headers) . "\r\n\r\n"
            . "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
            . $text . "\r\n\r\n"
            . "--{$boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n"
            . $html . "\r\n\r\n--{$boundary}--\r\n";
        $body = preg_replace('/^\./m', '..', $body);
        fwrite($socket, $body . "\r\n.\r\n");
        $response = smtpRead($socket);
        if ((int) substr($response, 0, 3) !== 250) {
            throw new RuntimeException('SMTP message rejected: ' . trim($response));
        }
        @smtpCommand($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

function trySendAppointmentEmail(PDO $pdo, array $appointment, string $type): void
{
    try {
        $context = emailAppointmentContext($pdo, $appointment);
        if ($context['patientEmail'] === '') {
            return;
        }
        $settings = fetchEmailSettings($pdo);
        $template = buildAppointmentEmail($context, $type);
        smtpSendEmail($settings, $context['patientEmail'], $template['subject'], $template['html'], $template['text']);
    } catch (Throwable $exception) {
        error_log('MediPlus appointment email failed: ' . $exception->getMessage());
    }
}

function trySendAppointmentCreatedEmail(PDO $pdo, array $appointment): void
{
    trySendAppointmentEmail($pdo, $appointment, 'created');
}

function trySendAppointmentCancelledEmail(PDO $pdo, array $appointment): void
{
    trySendAppointmentEmail($pdo, $appointment, 'cancelled');
}

$isDirectEmailRequest = isset($_SERVER['SCRIPT_FILENAME']) && realpath((string) $_SERVER['SCRIPT_FILENAME']) === __FILE__;
if (!$isDirectEmailRequest) {
    return;
}

handlePreflightRequest('POST, OPTIONS');
requireMethod(['POST']);

try {
    $pdo = getDatabaseConnection();
    if (!emailCurrentUserCanManage($pdo)) {
        sendErrorResponse('Forbidden.', 403);
    }

    $action = $_GET['action'] ?? 'test';
    if ($action !== 'test') {
        sendErrorResponse('Unknown email action.', 404);
    }

    $settings = fetchEmailSettings($pdo);
    $recipient = trim((string) ($settings['senderEmail'] ?? ''));
    if ($recipient === '') {
        sendErrorResponse('Uzupełnij adres nadawcy przed wysłaniem testu.', 422);
    }

    $clinic = fetchClinicNameForEmail($pdo);
    $subject = 'Test konfiguracji e-mail MediPlus';
    $html = '<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f4f7fb;margin:0;padding:24px;">'
        . '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dbe4f0;border-radius:14px;padding:22px;">'
        . '<h1 style="margin:0 0 10px;">Test konfiguracji e-mail</h1>'
        . '<p>Ta wiadomość potwierdza poprawną konfigurację SMTP dla kliniki <strong>' . htmlEscapeEmail($clinic) . '</strong>.</p>'
        . '<p>Pozdrawiamy,<br><strong>MediPlus</strong></p></div></body></html>';
    $text = "Test konfiguracji e-mail\n\nTa wiadomość potwierdza poprawną konfigurację SMTP dla kliniki {$clinic}.\n\nPozdrawiamy,\nMediPlus";
    smtpSendEmail($settings, $recipient, $subject, $html, $text);

    sendSuccessResponse(null, 'Wiadomość testowa została wysłana.');
} catch (Throwable $exception) {
    sendErrorResponse($exception->getMessage(), 500);
}
