<?php
// MediPlus student prototype backend.
// Simple API entry page. Frontend is not connected to this backend yet.

require_once __DIR__ . '/helpers/response.php';

sendSuccessResponse([
    'project' => 'MediPlus',
    'type' => 'student prototype backend',
    'endpoints' => [
        'POST /backend/api/auth.php',
        'GET  /backend/api/patients.php',
        'POST /backend/api/patients.php',
        'GET  /backend/api/doctors.php',
        'GET  /backend/api/appointments.php',
        'POST /backend/api/appointments.php',
        'GET  /backend/api/services.php',
    ],
    'note' => 'No frontend integration and no full authentication sessions yet.',
], 'MediPlus backend skeleton is available.');
