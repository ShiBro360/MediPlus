-- MediPlus clinic appointment management database
-- MySQL 8+, InnoDB, utf8mb4

CREATE DATABASE IF NOT EXISTS mediplus
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mediplus;

-- Optional reset for development only.
-- Uncomment this block if you want to rebuild all tables from scratch.
-- SET FOREIGN_KEY_CHECKS = 0;
-- DROP TABLE IF EXISTS notification_recipients;
-- DROP TABLE IF EXISTS notifications;
-- DROP TABLE IF EXISTS visit_history;
-- DROP TABLE IF EXISTS appointments;
-- DROP TABLE IF EXISTS medical_services;
-- DROP TABLE IF EXISTS doctors;
-- DROP TABLE IF EXISTS patients;
-- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS cabinets;
-- DROP TABLE IF EXISTS specializations;
-- DROP TABLE IF EXISTS roles;
-- SET FOREIGN_KEY_CHECKS = 1;

-- Legacy role dictionary kept only for old imports / teaching comparison.
-- The current application uses users.role directly with only: Recepcja, Lekarz.
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Application users for session-based login.
-- Recepcja acts as the administrator role. There is no separate Administrator role.
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  login VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Recepcja', 'Lekarz') NOT NULL DEFAULT 'Recepcja',
  status ENUM('active', 'blocked', 'inactive') NOT NULL DEFAULT 'active',
  doctor_id INT UNSIGNED NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_login (login),
  INDEX idx_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_status (status),
  INDEX idx_users_doctor_id (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Medical specializations used by doctors and services.
CREATE TABLE IF NOT EXISTS specializations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clinic cabinets / rooms.
CREATE TABLE IF NOT EXISTS cabinets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  room_number VARCHAR(50) NULL,
  cabinet_type VARCHAR(50) NOT NULL DEFAULT 'Uniwersalny',
  floor VARCHAR(30) NULL,
  description TEXT NULL,
  equipment TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE cabinets
  ADD COLUMN IF NOT EXISTS room_number VARCHAR(50) NULL AFTER name;

ALTER TABLE cabinets
  ADD COLUMN IF NOT EXISTS cabinet_type VARCHAR(50) NOT NULL DEFAULT 'Uniwersalny' AFTER room_number;

ALTER TABLE cabinets
  ADD COLUMN IF NOT EXISTS equipment TEXT NULL AFTER description;

UPDATE cabinets
SET cabinet_type = CASE cabinet_type
  WHEN 'Internista' THEN 'Uniwersalny'
  WHEN 'Pediatra' THEN 'Uniwersalny'
  WHEN 'Dermatolog' THEN 'Uniwersalny'
  WHEN 'Kardiolog' THEN 'Uniwersalny'
  WHEN 'Neurolog' THEN 'Uniwersalny'
  WHEN 'Endokrynolog' THEN 'Uniwersalny'
  WHEN 'Gastroenterolog' THEN 'Uniwersalny'
  WHEN 'Diabetolog' THEN 'Uniwersalny'
  WHEN 'Pulmonolog' THEN 'Uniwersalny'
  WHEN 'Laryngolog' THEN 'Uniwersalny'
  WHEN 'Ginekolog' THEN 'Ginekologiczny'
  WHEN 'Psycholog' THEN 'Psychologiczny'
  WHEN 'Fizjoterapeuta' THEN 'Fizjoterapia'
  WHEN 'Administracyjny' THEN 'Administracyjny'
  WHEN 'Uniwersalny' THEN 'Uniwersalny'
  WHEN 'Ginekologiczny' THEN 'Ginekologiczny'
  WHEN 'Psychologiczny' THEN 'Psychologiczny'
  WHEN 'Fizjoterapia' THEN 'Fizjoterapia'
  WHEN 'Zabiegowy' THEN 'Zabiegowy'
  WHEN 'Punkt Pobrań' THEN 'Punkt Pobrań'
  ELSE 'Uniwersalny'
END;

-- Patient medical and contact data.
-- Quick appointment registration creates an incomplete patient first.
-- Reception can complete PESEL, birth date, address and medical details later.
CREATE TABLE IF NOT EXISTS patients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  pesel CHAR(11) NULL UNIQUE,
  birth_date DATE NULL,
  gender ENUM('female', 'male', 'other') NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(160) NULL,
  address VARCHAR(255) NULL,
  postal_code VARCHAR(20) NULL,
  city VARCHAR(100) NULL,
  document_number VARCHAR(80) NULL,
  insurer VARCHAR(120) NULL,
  insurance_number VARCHAR(120) NULL,
  blood_group ENUM('unknown', '0 Rh+', '0 Rh-', 'A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-') NOT NULL DEFAULT 'unknown',
  allergies TEXT NULL,
  chronic_diseases TEXT NULL,
  notes TEXT NULL,
  profile_status ENUM('incomplete', 'complete') NOT NULL DEFAULT 'incomplete',
  personal_data_consent TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patients_pesel (pesel),
  INDEX idx_patients_last_name (last_name),
  INDEX idx_patients_phone (phone),
  INDEX idx_patients_profile_status (profile_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Development migration for an already imported older patients table.
-- XAMPP usually uses MariaDB, which supports ADD COLUMN/INDEX IF NOT EXISTS.
ALTER TABLE patients
  MODIFY pesel CHAR(11) NULL,
  MODIFY birth_date DATE NULL,
  MODIFY gender ENUM('female', 'male', 'other') NULL,
  MODIFY email VARCHAR(160) NULL,
  ADD COLUMN IF NOT EXISTS profile_status ENUM('incomplete', 'complete') NOT NULL DEFAULT 'incomplete' AFTER notes,
  ADD INDEX IF NOT EXISTS idx_patients_phone (phone),
  ADD INDEX IF NOT EXISTS idx_patients_profile_status (profile_status);

-- Doctors can optionally be connected to a user account for later login.
CREATE TABLE IF NOT EXISTS doctors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  specialization_id INT UNSIGNED NOT NULL,
  cabinet_id INT UNSIGNED NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(160) NULL,
  avatar_data_url LONGTEXT NULL,
  schedule_json LONGTEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'Aktywny',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doctors_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_doctors_specialization
    FOREIGN KEY (specialization_id) REFERENCES specializations(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_doctors_cabinet
    FOREIGN KEY (cabinet_id) REFERENCES cabinets(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  INDEX idx_doctors_last_name (last_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safe migration for existing MediPlus databases copied from an older version.
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS avatar_data_url LONGTEXT NULL AFTER email,
  ADD COLUMN IF NOT EXISTS schedule_json LONGTEXT NULL AFTER avatar_data_url,
  ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'Aktywny' AFTER is_active;

-- Doctor absences used by appointment availability and reception calendar.
CREATE TABLE IF NOT EXISTS doctor_absences (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT UNSIGNED NOT NULL,
  type ENUM('Urlop', 'Chorobowe', 'Dzień wolny', 'Inne') NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  time_from TIME NULL,
  time_to TIME NULL,
  note TEXT NULL,
  status ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED NULL,
  cancelled_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  CONSTRAINT fk_doctor_absences_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_doctor_absences_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_doctor_absences_cancelled_by
    FOREIGN KEY (cancelled_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  INDEX idx_doctor_absences_doctor_id (doctor_id),
  INDEX idx_doctor_absences_dates (date_from, date_to),
  INDEX idx_doctor_absences_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clinic opening hours used together with doctor schedules for availability.
CREATE TABLE IF NOT EXISTS clinic_working_hours (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO clinic_working_hours (weekday, is_closed, open_time, close_time) VALUES
  (1, 0, '08:00:00', '18:00:00'),
  (2, 0, '08:00:00', '18:00:00'),
  (3, 0, '08:00:00', '18:00:00'),
  (4, 0, '08:00:00', '18:00:00'),
  (5, 0, '08:00:00', '18:00:00'),
  (6, 0, '09:00:00', '14:00:00'),
  (7, 1, NULL, NULL)
ON DUPLICATE KEY UPDATE weekday = VALUES(weekday);

-- Appointment registration settings used by reception and availability checks.
CREATE TABLE IF NOT EXISTS appointment_settings (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO appointment_settings (
  id, allow_overlaps, auto_complete_past, hide_inactive_services, min_interval_minutes
) VALUES (1, 0, 1, 1, 15)
ON DUPLICATE KEY UPDATE id = VALUES(id);

-- Shared system settings stored as JSON for multi-user consistency.
CREATE TABLE IF NOT EXISTS system_settings (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('clinic', '{"name":"MediPlus Klinika Zdrowia","nip":"","regon":"","phone":"+48 ","email":"","website":"","address":"","city":"","postalCode":""}'),
  ('appointment', '{"allowOverlaps":false,"autoCompletePast":true,"hideInactiveServices":true,"minIntervalMinutes":0}'),
  ('security', '{"minPasswordLength":8,"forcePasswordChangeAfterReset":true,"autoLogoutEnabled":false,"inactivityTimeoutMinutes":30}')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

-- Internal per-user notification center.
CREATE TABLE IF NOT EXISTS notifications (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_recipients (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Services offered by the clinic.
CREATE TABLE IF NOT EXISTS medical_services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  specialization_id INT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_services_specialization
    FOREIGN KEY (specialization_id) REFERENCES specializations(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_services_specialization (specialization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appointment schedule.
CREATE TABLE IF NOT EXISTS appointments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  cabinet_id INT UNSIGNED NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('planned', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'planned',
  notes TEXT NULL,
  created_by_user_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_patient
    FOREIGN KEY (patient_id) REFERENCES patients(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_doctor
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_service
    FOREIGN KEY (service_id) REFERENCES medical_services(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_cabinet
    FOREIGN KEY (cabinet_id) REFERENCES cabinets(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  INDEX idx_appointments_date (appointment_date),
  INDEX idx_appointments_doctor_date (doctor_id, appointment_date),
  INDEX idx_appointments_patient_date (patient_id, appointment_date),
  INDEX idx_appointments_status (status),
  CONSTRAINT chk_appointments_time_order CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safe migration for existing databases: allow persistent no-show appointment status.
ALTER TABLE appointments
  MODIFY status ENUM('planned', 'completed', 'cancelled', 'no_show') NOT NULL DEFAULT 'planned';

-- Medical history recorded after a completed visit.
CREATE TABLE IF NOT EXISTS visit_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT UNSIGNED NOT NULL UNIQUE,
  diagnosis TEXT NOT NULL,
  recommendations TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_visit_history_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data for local testing.
-- INSERT IGNORE allows importing this file more than once during development.
INSERT IGNORE INTO roles (id, name) VALUES
  (1, 'Recepcja'),
  (2, 'Lekarz');

-- Test password for all sample accounts: mediplus123
INSERT INTO users (
  id, first_name, last_name, login, email, password_hash, role, status,
  doctor_id, must_change_password
) VALUES
  (1, 'Recepcja', 'MediPlus', 'recepcja', 'recepcja@mediplus.local', '$2y$10$QPZMUdlEcOiNBUS7iWXdTOt480BWNuwcGlYC/zxUu.6c2gUcRNMTq', 'Recepcja', 'active', NULL, 0),
  (2, 'Janina', 'Nowak', 'janina.nowak', 'janina.nowak@mediplus.local', '$2y$10$QPZMUdlEcOiNBUS7iWXdTOt480BWNuwcGlYC/zxUu.6c2gUcRNMTq', 'Recepcja', 'active', NULL, 0),
  (3, 'Anna', 'Nowak', 'anna.nowak', 'anna.nowak@mediplus.local', '$2y$10$QPZMUdlEcOiNBUS7iWXdTOt480BWNuwcGlYC/zxUu.6c2gUcRNMTq', 'Lekarz', 'active', 1, 0),
  (4, 'Piotr', 'Zielinski', 'piotr.zielinski', 'piotr.zielinski@mediplus.local', '$2y$10$QPZMUdlEcOiNBUS7iWXdTOt480BWNuwcGlYC/zxUu.6c2gUcRNMTq', 'Lekarz', 'blocked', 2, 0),
  (5, 'Marta', 'Wisniewska', 'marta.wisniewska', 'marta.wisniewska@mediplus.local', '$2y$10$QPZMUdlEcOiNBUS7iWXdTOt480BWNuwcGlYC/zxUu.6c2gUcRNMTq', 'Lekarz', 'active', 3, 0)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  status = VALUES(status),
  doctor_id = VALUES(doctor_id),
  must_change_password = VALUES(must_change_password);
INSERT IGNORE INTO specializations (id, name, description) VALUES
  (1, 'Internista', 'Konsultacje internistyczne i podstawowa opieka zdrowotna.'),
  (2, 'Kardiolog', 'Diagnostyka i leczenie chorób serca.'),
  (3, 'Dermatolog', 'Diagnostyka i leczenie chorób skóry.'),
  (4, 'Pediatra', 'Opieka medyczna nad dziećmi.');

INSERT IGNORE INTO cabinets (id, name, room_number, cabinet_type, floor, description, equipment) VALUES
  (1, 'Gabinet 101', '101', 'Uniwersalny', '1', 'Gabinet internistyczny.', 'EKG, Ciśnieniomierz, Stetoskop'),
  (2, 'Gabinet 204', '204', 'Uniwersalny', '2', 'Gabinet konsultacyjny.', 'Ciśnieniomierz, Stetoskop'),
  (3, 'Gabinet 306', '306', 'Uniwersalny', '3', 'Gabinet dermatologiczny.', 'Lampa zabiegowa, Dermatoskop');

INSERT IGNORE INTO patients (
  id, first_name, last_name, pesel, birth_date, gender, phone, email,
  address, postal_code, city, document_number, insurer, insurance_number,
  blood_group, allergies, chronic_diseases, notes, profile_status, personal_data_consent
) VALUES
  (
    1, 'Jan', 'Malinowski', '80010112345', '1980-01-01', 'male',
    '+48 600 100 200', 'jan.malinowski@example.com',
    'ul. Zdrowa 12/4', '00-001', 'Warszawa', 'ABC123456',
    'NFZ', 'NFZ-001-2026', 'A Rh+', 'Brak znanych alergii',
    'Nadciśnienie', 'Pacjent preferuje wizyty poranne.', 'complete', 1
  ),
  (
    2, 'Maria', 'Lewandowska', '90020254321', '1990-02-02', 'female',
    '+48 601 200 300', 'maria.lewandowska@example.com',
    'ul. Medyczna 5', '30-002', 'Kraków', 'DEF654321',
    'Prywatnie', 'PRV-2026-778', '0 Rh-', 'Penicylina',
    NULL, NULL, 'complete', 1
  ),
  (
    3, 'Oliwia', 'Król', '12030398765', '2012-03-03', 'female',
    '+48 602 300 400', 'opiekun.krol@example.com',
    'ul. Rodzinna 9', '50-003', 'Wrocław', 'GHI987654',
    'NFZ', 'NFZ-003-2026', 'unknown', NULL,
    'Astma', 'Pacjentka niepełnoletnia.', 'complete', 1
  );

INSERT IGNORE INTO doctors (
  id, user_id, specialization_id, cabinet_id, first_name, last_name, phone, email
) VALUES
  (1, 3, 1, 1, 'Anna', 'Nowak', '+48 700 100 100', 'anna.nowak@mediplus.local'),
  (2, 4, 2, 2, 'Piotr', 'Zieliński', '+48 700 200 200', 'piotr.zielinski@mediplus.local'),
  (3, 5, 3, 3, 'Marta', 'Wiśniewska', '+48 700 300 300', 'marta.wisniewska@mediplus.local'),
  (4, NULL, 4, 2, 'Karol', 'Maj', '+48 700 400 400', 'karol.maj@mediplus.local');

INSERT IGNORE INTO medical_services (
  id, specialization_id, name, description, price, duration_minutes
) VALUES
  (1, 1, 'Konsultacja internistyczna', 'Podstawowa konsultacja lekarska.', 180.00, 30),
  (2, 2, 'Konsultacja kardiologiczna', 'Konsultacja z oceną wyników badań.', 250.00, 45),
  (3, 3, 'Konsultacja dermatologiczna', 'Diagnostyka zmian skórnych.', 220.00, 30),
  (4, 4, 'Konsultacja pediatryczna', 'Konsultacja lekarska dla dzieci.', 200.00, 30);

INSERT IGNORE INTO appointments (
  id, patient_id, doctor_id, service_id, cabinet_id,
  appointment_date, start_time, end_time, status, notes, created_by_user_id
) VALUES
  (1, 1, 1, 1, 1, '2026-06-01', '08:00:00', '08:30:00', 'planned', 'Pierwsza konsultacja.', 2),
  (2, 2, 2, 2, 2, '2026-06-01', '11:00:00', '11:45:00', 'completed', 'Kontrola po badaniu EKG.', 2),
  (3, 3, 4, 4, 2, '2026-06-04', '09:00:00', '09:30:00', 'planned', 'Konsultacja pediatryczna.', 2);

INSERT IGNORE INTO visit_history (
  appointment_id, diagnosis, recommendations
) VALUES
  (
    2,
    'Nadciśnienie tętnicze w obserwacji.',
    'Kontrola ciśnienia dwa razy dziennie przez 14 dni. Kolejna wizyta kontrolna za miesiąc.'
  );
