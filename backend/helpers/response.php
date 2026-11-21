<?php
// MediPlus student prototype backend.
// Small JSON response helpers shared by API endpoints.

function setApiHeaders(?string $allowedMethods = null): void
{
    $methods = $allowedMethods ?? ($GLOBALS['apiAllowedMethods'] ?? 'GET, POST, OPTIONS');

    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: ' . $methods);
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

function handlePreflightRequest(string $allowedMethods = 'GET, POST, OPTIONS'): void
{
    $GLOBALS['apiAllowedMethods'] = $allowedMethods;
    setApiHeaders($allowedMethods);

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function requireMethod(array $allowedMethods): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'], $allowedMethods, true)) {
        sendErrorResponse('Method not allowed.', 405);
    }
}

function sendJsonResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    setApiHeaders();
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function sendSuccessResponse($data = null, string $message = 'OK', int $statusCode = 200): void
{
    sendJsonResponse([
        'success' => true,
        'message' => $message,
        'data' => $data,
    ], $statusCode);
}

function sendErrorResponse(string $message, int $statusCode = 400, array $errors = []): void
{
    sendJsonResponse([
        'success' => false,
        'message' => $message,
        'errors' => $errors,
    ], $statusCode);
}

function sendDatabaseErrorResponse(): void
{
    sendErrorResponse('Database error. Please try again later.', 500);
}

function getJsonRequestBody(): array
{
    $rawBody = file_get_contents('php://input');

    if ($rawBody === false || trim($rawBody) === '') {
        return $_POST;
    }

    $decoded = json_decode($rawBody, true);

    return is_array($decoded) ? $decoded : [];
}
