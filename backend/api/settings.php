<?php
// MediPlus student prototype backend.
// Settings API. Supports clinic working hours, appointment registration settings and shared system settings.
//
// GET  /backend/api/settings.php?action=clinic_working_hours
// PUT  /backend/api/settings.php?action=clinic_working_hours
// POST /backend/api/settings.php?action=clinic_working_hours
// GET  /backend/api/settings.php?action=appointment_settings
// PUT  /backend/api/settings.php?action=appointment_settings
// POST /backend/api/settings.php?action=appointment_settings
// GET  /backend/api/settings.php?action=system_settings
// GET  /backend/api/settings.php?action=system_settings&key=clinic
// PUT  /backend/api/settings.php?action=system_settings
// POST /backend/api/settings.php?action=system_settings

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

handlePreflightRequest('GET, POST, PUT, OPTIONS');
requireMethod(['GET', 'POST', 'PUT']);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

const CLINIC_DAY_KEYS = [
    1 => 'monday',
    2 => 'tuesday',
    3 => 'wednesday',
    4 => 'thursday',
    5 => 'friday',
    6 => 'saturday',
    7 => 'sunday',
];

const SYSTEM_SETTING_DEFAULTS = [
    'clinic' => [
        'name' => 'MediPlus Klinika Zdrowia',
        'nip' => '',
        'regon' => '',
        'phone' => '+48 ',
        'email' => '',
        'website' => '',
        'address' => '',
        'city' => '',
        'postalCode' => '',
    ],
    'appointment' => [
        'allowOverlaps' => false,
        'autoCompletePast' => true,
        'hideInactiveServices' => true,
        'minIntervalMinutes' => 0,
    ],
    'security' => [
        'minPasswordLength' => 8,
        'forcePasswordChangeAfterReset' => true,
        'autoLogoutEnabled' => false,
        'inactivityTimeoutMinutes' => 30,
    ],
];

function currentSettingsUserId(): ?int
{
    $value = $_SESSION['user_id'] ?? $_SESSION['id'] ?? null;
    return $value ? (int) $value : null;
}

function ensureClinicWorkingHoursTable(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS clinic_working_hours (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            weekday TINYINT UNSIGNED NOT NULL,
            is_closed TINYINT(1) NOT NULL DEFAULT 0,
            open_time TIME NULL,
            close_time TIME NULL,
            updated_by INT UNSIGNED NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_clinic_working_hours_updated_by
              FOREIGN KEY (updated_by) REFERENCES users(id)
              ON UPDATE CASCADE
              ON DELETE SET NULL,
            UNIQUE KEY uniq_clinic_working_hours_weekday (weekday)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $defaults = [
        [1, 0, '08:00:00', '18:00:00'],
        [2, 0, '08:00:00', '18:00:00'],
        [3, 0, '08:00:00', '18:00:00'],
        [4, 0, '08:00:00', '18:00:00'],
        [5, 0, '08:00:00', '18:00:00'],
        [6, 0, '09:00:00', '14:00:00'],
        [7, 1, null, null],
    ];
    $stmt = $pdo->prepare(
        'INSERT INTO clinic_working_hours (weekday, is_closed, open_time, close_time)
         VALUES (:weekday, :is_closed, :open_time, :close_time)
         ON DUPLICATE KEY UPDATE weekday = weekday'
    );

    foreach ($defaults as [$weekday, $isClosed, $openTime, $closeTime]) {
        $stmt->execute([
            'weekday' => $weekday,
            'is_closed' => $isClosed,
            'open_time' => $openTime,
            'close_time' => $closeTime,
        ]);
    }
}

function ensureAppointmentSettingsTable(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS appointment_settings (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            allow_overlaps TINYINT(1) NOT NULL DEFAULT 0,
            auto_complete_past TINYINT(1) NOT NULL DEFAULT 1,
            hide_inactive_services TINYINT(1) NOT NULL DEFAULT 1,
            min_interval_minutes INT UNSIGNED NOT NULL DEFAULT 15,
            updated_by INT UNSIGNED NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_appointment_settings_updated_by
              FOREIGN KEY (updated_by) REFERENCES users(id)
              ON UPDATE CASCADE
              ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "INSERT INTO appointment_settings (
            id, allow_overlaps, auto_complete_past, hide_inactive_services, min_interval_minutes
         ) VALUES (1, 0, 1, 1, 15)
         ON DUPLICATE KEY UPDATE id = id"
    );
}

function ensureSystemSettingsTable(PDO $pdo): void
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

    foreach (SYSTEM_SETTING_DEFAULTS as $key => $value) {
        $stmt->execute([
            'setting_key' => $key,
            'setting_value' => json_encode($value, JSON_UNESCAPED_UNICODE),
        ]);
    }
}

function normalizeTimeSetting($value): ?string
{
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }

    $value = substr($value, 0, 5);
    return preg_match('/^\d{2}:\d{2}$/', $value) ? $value . ':00' : null;
}

function clinicWorkingHoursRow(array $row): array
{
    $weekday = (int) $row['weekday'];
    $open = $row['open_time'] ? substr((string) $row['open_time'], 0, 5) : '';
    $close = $row['close_time'] ? substr((string) $row['close_time'], 0, 5) : '';
    $isClosed = (int) $row['is_closed'] === 1;

    return [
        'weekday' => $weekday,
        'dayKey' => CLINIC_DAY_KEYS[$weekday] ?? '',
        'isClosed' => $isClosed,
        'is_closed' => $isClosed ? 1 : 0,
        'open' => $open,
        'open_time' => $open,
        'close' => $close,
        'close_time' => $close,
    ];
}

function fetchClinicWorkingHours(PDO $pdo): array
{
    $stmt = $pdo->prepare('SELECT * FROM clinic_working_hours ORDER BY weekday');
    $stmt->execute();
    $rows = [];

    foreach ($stmt->fetchAll() as $row) {
        $item = clinicWorkingHoursRow($row);
        $rows[(string) $item['weekday']] = $item;
        if ($item['dayKey'] !== '') {
            $rows[$item['dayKey']] = [
                'active' => !$item['isClosed'],
                'start' => $item['open'],
                'end' => $item['close'],
            ];
        }
    }

    return $rows;
}

function appointmentSettingsRow(array $row): array
{
    $allowOverlaps = (int) $row['allow_overlaps'] === 1;
    $autoCompletePast = (int) $row['auto_complete_past'] === 1;
    $hideInactiveServices = (int) $row['hide_inactive_services'] === 1;
    $minIntervalMinutes = (int) $row['min_interval_minutes'];

    return [
        'allowOverlaps' => $allowOverlaps,
        'allow_overlaps' => $allowOverlaps ? 1 : 0,
        'autoCompletePast' => $autoCompletePast,
        'auto_complete_past' => $autoCompletePast ? 1 : 0,
        'hideInactiveServices' => $hideInactiveServices,
        'hide_inactive_services' => $hideInactiveServices ? 1 : 0,
        'minIntervalMinutes' => $minIntervalMinutes,
        'min_interval_minutes' => $minIntervalMinutes,
    ];
}

function fetchAppointmentSettings(PDO $pdo): array
{
    $stmt = $pdo->prepare('SELECT * FROM appointment_settings WHERE id = 1 LIMIT 1');
    $stmt->execute();
    $row = $stmt->fetch();

    if (!$row) {
        ensureAppointmentSettingsTable($pdo);
        $stmt->execute();
        $row = $stmt->fetch();
    }

    return appointmentSettingsRow($row);
}

function decodeSystemSettingValue($value): array
{
    $decoded = json_decode((string) $value, true);
    return is_array($decoded) ? $decoded : [];
}

function fetchSystemSettings(PDO $pdo, ?string $key = null): array
{
    if ($key !== null && !array_key_exists($key, SYSTEM_SETTING_DEFAULTS)) {
        sendErrorResponse('Unknown settings key.', 404);
    }

    if ($key !== null) {
        $stmt = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key = :setting_key LIMIT 1');
        $stmt->execute(['setting_key' => $key]);
        $row = $stmt->fetch();
        $stored = $row ? decodeSystemSettingValue($row['setting_value']) : [];
        return array_replace_recursive(SYSTEM_SETTING_DEFAULTS[$key], $stored);
    }

    $stmt = $pdo->prepare('SELECT setting_key, setting_value FROM system_settings');
    $stmt->execute();
    $settings = SYSTEM_SETTING_DEFAULTS;

    foreach ($stmt->fetchAll() as $row) {
        $settingKey = (string) $row['setting_key'];
        if (array_key_exists($settingKey, SYSTEM_SETTING_DEFAULTS)) {
            $settings[$settingKey] = array_replace_recursive(
                SYSTEM_SETTING_DEFAULTS[$settingKey],
                decodeSystemSettingValue($row['setting_value'])
            );
        }
    }

    return $settings;
}

function parseClinicWorkingHoursPayload(array $data): array
{
    $source = $data['hours'] ?? $data;
    if (!is_array($source)) {
        sendErrorResponse('Hours payload is required.', 422, ['hours' => 'Hours payload is required.']);
    }

    $normalized = [];
    $errors = [];

    for ($weekday = 1; $weekday <= 7; $weekday += 1) {
        $dayKey = CLINIC_DAY_KEYS[$weekday];
        $entry = $source[(string) $weekday] ?? $source[$weekday] ?? $source[$dayKey] ?? null;

        if (!is_array($entry)) {
            $errors[(string) $weekday] = 'Day settings are required.';
            continue;
        }

        $isClosed = filter_var($entry['isClosed'] ?? $entry['is_closed'] ?? $entry['closed'] ?? false, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $isClosed = $isClosed ?? (bool) ($entry['is_closed'] ?? false);
        $open = normalizeTimeSetting($entry['open'] ?? $entry['open_time'] ?? $entry['start'] ?? '');
        $close = normalizeTimeSetting($entry['close'] ?? $entry['close_time'] ?? $entry['end'] ?? '');

        if ($isClosed) {
            $normalized[$weekday] = [
                'weekday' => $weekday,
                'is_closed' => 1,
                'open_time' => null,
                'close_time' => null,
            ];
            continue;
        }

        if (!$open || !$close) {
            $errors[(string) $weekday] = 'Open and close time are required.';
            continue;
        }
        if ($close <= $open) {
            $errors[(string) $weekday] = 'Close time must be greater than open time.';
            continue;
        }

        $normalized[$weekday] = [
            'weekday' => $weekday,
            'is_closed' => 0,
            'open_time' => $open,
            'close_time' => $close,
        ];
    }

    if ($errors) {
        sendErrorResponse('Invalid clinic working hours.', 422, $errors);
    }

    return $normalized;
}

function parseBooleanSetting(array $data, array $keys, bool $fallback): bool
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $data)) {
            $value = filter_var($data[$key], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            return $value ?? (bool) $data[$key];
        }
    }

    return $fallback;
}

function parseAppointmentSettingsPayload(array $data): array
{
    $allowedIntervals = [5, 10, 15, 20, 30, 45, 60];
    $minInterval = (int) ($data['minIntervalMinutes'] ?? $data['min_interval_minutes'] ?? $data['visitInterval'] ?? 15);
    if ($minInterval <= 0 || !in_array($minInterval, $allowedIntervals, true)) {
        sendErrorResponse('Invalid appointment settings.', 422, [
            'minIntervalMinutes' => 'Allowed values: 5, 10, 15, 20, 30, 45, 60.',
        ]);
    }

    return [
        'allow_overlaps' => parseBooleanSetting($data, ['allowOverlaps', 'allow_overlaps'], false) ? 1 : 0,
        'auto_complete_past' => parseBooleanSetting($data, ['autoCompletePast', 'auto_complete_past'], true) ? 1 : 0,
        'hide_inactive_services' => parseBooleanSetting($data, ['hideInactiveServices', 'hide_inactive_services'], true) ? 1 : 0,
        'min_interval_minutes' => $minInterval,
    ];
}

function validateSystemSettingValue(string $key, array $value): array
{
    if (!array_key_exists($key, SYSTEM_SETTING_DEFAULTS)) {
        sendErrorResponse('Unknown settings key.', 422, ['key' => 'Allowed keys: clinic, appointment, security.']);
    }

    $merged = array_replace_recursive(SYSTEM_SETTING_DEFAULTS[$key], $value);

    if ($key === 'security') {
        $minPasswordLength = (int) ($merged['minPasswordLength'] ?? 8);
        $inactivityTimeout = (int) ($merged['inactivityTimeoutMinutes'] ?? 30);
        if ($minPasswordLength < 6) {
            sendErrorResponse('Invalid security settings.', 422, ['minPasswordLength' => 'Minimum password length must be at least 6.']);
        }
        if ($inactivityTimeout < 1) {
            sendErrorResponse('Invalid security settings.', 422, ['inactivityTimeoutMinutes' => 'Inactivity timeout must be at least 1.']);
        }
        $merged['minPasswordLength'] = $minPasswordLength;
        $merged['inactivityTimeoutMinutes'] = $inactivityTimeout;
        $merged['forcePasswordChangeAfterReset'] = parseBooleanSetting($merged, ['forcePasswordChangeAfterReset'], true);
        $merged['autoLogoutEnabled'] = parseBooleanSetting($merged, ['autoLogoutEnabled'], false);
    }

    if ($key === 'appointment') {
        $minInterval = (int) ($merged['minIntervalMinutes'] ?? $merged['visitInterval'] ?? 0);
        if ($minInterval < 0) {
            sendErrorResponse('Invalid appointment settings.', 422, ['minIntervalMinutes' => 'Minimum interval must be 0 or greater.']);
        }
        $merged['allowOverlaps'] = parseBooleanSetting($merged, ['allowOverlaps'], false);
        $merged['autoCompletePast'] = parseBooleanSetting($merged, ['autoCompletePast'], true);
        $merged['hideInactiveServices'] = parseBooleanSetting($merged, ['hideInactiveServices'], true);
        $merged['minIntervalMinutes'] = $minInterval;
    }

    if ($key === 'clinic') {
        foreach (['name', 'clinicName', 'nip', 'regon', 'phone', 'email', 'website', 'address', 'city', 'postalCode'] as $field) {
            if (array_key_exists($field, $merged)) {
                $merged[$field] = trim((string) $merged[$field]);
            }
        }
        if (isset($merged['clinicName']) && ($merged['name'] ?? '') === '') {
            $merged['name'] = $merged['clinicName'];
        }
        if (($merged['phone'] ?? '') === '+48') {
            $merged['phone'] = '+48 ';
        }
    }

    return $merged;
}

function parseSystemSettingsPayload(array $data): array
{
    $key = trim((string) ($data['key'] ?? ''));
    $value = $data['value'] ?? null;

    if (!array_key_exists($key, SYSTEM_SETTING_DEFAULTS)) {
        sendErrorResponse('Unknown settings key.', 422, ['key' => 'Allowed keys: clinic, appointment, security.']);
    }
    if (!is_array($value)) {
        sendErrorResponse('Invalid settings payload.', 422, ['value' => 'Value must be an object.']);
    }

    return [
        'key' => $key,
        'value' => validateSystemSettingValue($key, $value),
    ];
}

try {
    $pdo = getDatabaseConnection();
    ensureClinicWorkingHoursTable($pdo);
    ensureAppointmentSettingsTable($pdo);
    ensureSystemSettingsTable($pdo);

    $action = $_GET['action'] ?? '';
    if (!in_array($action, ['clinic_working_hours', 'appointment_settings', 'system_settings'], true)) {
        sendErrorResponse('Unknown settings action.', 404);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'system_settings') {
        $key = isset($_GET['key']) ? trim((string) $_GET['key']) : null;
        sendSuccessResponse(fetchSystemSettings($pdo, $key), 'System settings loaded.');
    }

    if ($action === 'system_settings') {
        $settings = parseSystemSettingsPayload(getJsonRequestBody());
        $stmt = $pdo->prepare(
            'INSERT INTO system_settings (setting_key, setting_value, updated_by)
             VALUES (:setting_key, :setting_value, :updated_by)
             ON DUPLICATE KEY UPDATE
               setting_value = VALUES(setting_value),
               updated_by = VALUES(updated_by)'
        );
        $stmt->execute([
            'setting_key' => $settings['key'],
            'setting_value' => json_encode($settings['value'], JSON_UNESCAPED_UNICODE),
            'updated_by' => currentSettingsUserId(),
        ]);

        sendSuccessResponse(fetchSystemSettings($pdo, $settings['key']), 'System settings saved.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'clinic_working_hours') {
        sendSuccessResponse(fetchClinicWorkingHours($pdo), 'Clinic working hours loaded.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'appointment_settings') {
        sendSuccessResponse(fetchAppointmentSettings($pdo), 'Appointment settings loaded.');
    }

    if ($action === 'appointment_settings') {
        $settings = parseAppointmentSettingsPayload(getJsonRequestBody());
        $stmt = $pdo->prepare(
            'INSERT INTO appointment_settings (
                id, allow_overlaps, auto_complete_past, hide_inactive_services, min_interval_minutes, updated_by
             ) VALUES (
                1, :allow_overlaps, :auto_complete_past, :hide_inactive_services, :min_interval_minutes, :updated_by
             )
             ON DUPLICATE KEY UPDATE
               allow_overlaps = VALUES(allow_overlaps),
               auto_complete_past = VALUES(auto_complete_past),
               hide_inactive_services = VALUES(hide_inactive_services),
               min_interval_minutes = VALUES(min_interval_minutes),
               updated_by = VALUES(updated_by)'
        );
        $stmt->execute([
            'allow_overlaps' => $settings['allow_overlaps'],
            'auto_complete_past' => $settings['auto_complete_past'],
            'hide_inactive_services' => $settings['hide_inactive_services'],
            'min_interval_minutes' => $settings['min_interval_minutes'],
            'updated_by' => currentSettingsUserId(),
        ]);

        sendSuccessResponse(fetchAppointmentSettings($pdo), 'Appointment settings saved.');
    }

    $hours = parseClinicWorkingHoursPayload(getJsonRequestBody());
    $stmt = $pdo->prepare(
        'INSERT INTO clinic_working_hours (weekday, is_closed, open_time, close_time, updated_by)
         VALUES (:weekday, :is_closed, :open_time, :close_time, :updated_by)
         ON DUPLICATE KEY UPDATE
           is_closed = VALUES(is_closed),
           open_time = VALUES(open_time),
           close_time = VALUES(close_time),
           updated_by = VALUES(updated_by)'
    );

    foreach ($hours as $entry) {
        $stmt->execute([
            'weekday' => $entry['weekday'],
            'is_closed' => $entry['is_closed'],
            'open_time' => $entry['open_time'],
            'close_time' => $entry['close_time'],
            'updated_by' => currentSettingsUserId(),
        ]);
    }

    sendSuccessResponse(fetchClinicWorkingHours($pdo), 'Clinic working hours saved.');
} catch (PDOException $exception) {
    sendDatabaseErrorResponse();
}
