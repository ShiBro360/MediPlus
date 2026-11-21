<?php
// MediPlus student prototype backend.
// Basic validation helpers for simple API endpoints.

function isRequired(array $data, string $field): bool
{
    return isset($data[$field]) && trim((string) $data[$field]) !== '';
}

function isPeselValid(string $pesel): bool
{
    return preg_match('/^\d{11}$/', $pesel) === 1;
}

function isEmailValid(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validateRequiredFields(array $data, array $fields): array
{
    $errors = [];

    foreach ($fields as $field) {
        if (!isRequired($data, $field)) {
            $errors[$field] = 'This field is required.';
        }
    }

    return $errors;
}
