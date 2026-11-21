<?php
// MediPlus student prototype backend.
// Basic PDO connection settings for a local MySQL database.

$dbHost = '127.0.0.1';
$dbName = 'mediplus';
$dbUser = 'root';
$dbPassword = '';
$dbCharset = 'utf8mb4';

function getDatabaseConnection(): PDO
{
    global $dbHost, $dbName, $dbUser, $dbPassword, $dbCharset;

    $dsn = "mysql:host={$dbHost};dbname={$dbName};charset={$dbCharset}";

    return new PDO($dsn, $dbUser, $dbPassword, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}
