<?php

declare(strict_types=1);

/**
 * MediPlus — demo data seeder.
 *
 * Fills a LOCAL DEMO database with fictional patients, appointments, visit
 * history and doctor absences so the dashboard, calendar and history screens
 * show realistic numbers. It never reads or writes the working database, and it
 * refuses to run unless the database name looks like a demo copy.
 *
 * Usage:
 *   php database/seed_demo.php --list
 *   php database/seed_demo.php
 *   php database/seed_demo.php --patients=60 --months=5
 *   php database/seed_demo.php --reset --yes
 *
 * Connection (environment variables, no secrets in the repository):
 *   DEMO_DSN   default mysql:host=127.0.0.1;dbname=mediplus_demo;charset=utf8mb4
 *   DEMO_USER  default root
 *   DEMO_PASS  default empty
 *
 * Every patient below is invented. E-mail addresses use example.com, which is
 * reserved for documentation and cannot receive mail. Doctors, cabinets and
 * services are read from the database and are not modified, so run
 * `database.sql` first.
 */

const DEFAULT_PATIENTS = 50;
const DEFAULT_MONTHS_BACK = 4;
const DEFAULT_DAYS_AHEAD = 14;
const RANDOM_SEED = 20261123;

/** Databases that must never be seeded, even if the name matches the pattern. */
const BLOCKED_DATABASES = [
    'mediplus', 'mediplus_prod', 'limodelia', 'limodelia_crm',
    'mysql', 'information_schema', 'performance_schema', 'sys',
];

/** Tables the seeder writes to, children first (used by --reset). */
const SEED_TABLES = [
    'visit_history',
    'doctor_absences',
    'appointments',
    'patients',
];

const DIAGNOSES = [
    1  => 'Kontrola stanu ogólnego, bez odchyleń w badaniu przedmiotowym.',
    2  => 'Nadciśnienie tętnicze kontrolowane farmakologicznie.',
    3  => 'Łagodne zmiany skórne o charakterze łojotokowym.',
    4  => 'Infekcja górnych dróg oddechowych, zalecane leczenie objawowe.',
    5  => 'Zaburzenia gospodarki lipidowej, zalecana modyfikacja diety.',
    6  => 'Ból kręgosłupa lędźwiowego o charakterze przeciążeniowym.',
    7  => 'Napięciowe bóle głowy, bez objawów alarmowych.',
    8  => 'Przewlekłe zapalenie gardła, zalecana konsultacja laryngologiczna.',
    9  => 'Wada refrakcji, zalecana korekcja okularowa.',
    10 => 'Kontrola ginekologiczna, wynik w granicach normy.',
    11 => 'Subkliniczna niedoczynność tarczycy, kontrola za 3 miesiące.',
    12 => 'Cukrzyca typu 2 wyrównana, HbA1c w normie.',
    13 => 'Zespół jelita drażliwego, zalecana dieta ubogofermentacyjna.',
    14 => 'Astma oskrzelowa w okresie remisji.',
    15 => 'Zaburzenia adaptacyjne, zalecana psychoterapia wspierająca.',
    16 => 'Ograniczenie ruchomości barku, zalecana fizjoterapia.',
];

const RECOMMENDATIONS = [
    'Kontrola za 3 miesiące.',
    'Zalecenia dietetyczne przekazane pacjentowi.',
    'Skierowanie na badania laboratoryjne.',
    'Kontrola po zakończeniu leczenia.',
    'Zalecana aktywność fizyczna 3 razy w tygodniu.',
    'Pacjent zgłosił się na wizytę kontrolną.',
];

const CITIES = [
    ['Bydgoszcz', '85-'], ['Toruń', '87-'], ['Poznań', '61-'], ['Gdańsk', '80-'],
    ['Warszawa', '00-'], ['Łódź', '90-'], ['Wrocław', '50-'], ['Kraków', '30-'],
];

const STREETS = [
    'ul. Kwiatowa', 'ul. Słoneczna', 'ul. Leśna', 'ul. Polna', 'ul. Krótka',
    'ul. Ogrodowa', 'ul. Lipowa', 'ul. Sportowa', 'ul. Wesoła', 'ul. Cicha',
];

$opts = parse_args($argv);
$dsn  = getenv('DEMO_DSN') ?: 'mysql:host=127.0.0.1;dbname=mediplus_demo;charset=utf8mb4';
$user = getenv('DEMO_USER') ?: 'root';
$pass = getenv('DEMO_PASS') ?: '';

$dbName = dsn_database($dsn);
assert_demo_database($dbName);

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    fail("Cannot connect to `{$dbName}`: " . $e->getMessage());
}

if ($opts['list']) {
    foreach (['patients', 'appointments', 'visit_history', 'doctor_absences', 'doctors', 'medical_services', 'cabinets'] as $table) {
        $count = (int) $pdo->query('SELECT COUNT(*) FROM `' . $table . '`')->fetchColumn();
        printf("%-18s %s\n", $table, columns($pdo, $table) === [] ? 'missing' : $count . ' rows');
    }
    exit(0);
}

if ($opts['reset']) {
    if (!$opts['yes']) {
        fail('--reset deletes every row in the demo tables. Confirm with --yes.');
    }
    reset_tables($pdo);
    echo "Demo tables cleared.\n";
}

// The generator is deterministic, so a second run would collide on PESEL and
// e-mail. Stop early with a readable message instead of a raw SQL error.
if (!$opts['reset']) {
    $seeded = (int) $pdo->query("SELECT COUNT(*) FROM patients WHERE email LIKE '%@example.com'")->fetchColumn();
    if ($seeded > 0) {
        fail("Demo data is already present ({$seeded} seeded patients). Use --reset --yes to wipe it and generate a fresh set.");
    }
}

// Reference data comes from database.sql and is never modified here.
$doctors = $pdo->query(
    'SELECT d.id, d.specialization_id, d.cabinet_id
     FROM doctors d
     WHERE d.is_active = 1'
)->fetchAll();

$services = $pdo->query(
    'SELECT id, specialization_id, duration_minutes
     FROM medical_services
     WHERE is_active = 1'
)->fetchAll();

$cabinets = $pdo->query('SELECT id FROM cabinets WHERE is_active = 1')->fetchAll();

if ($doctors === [] || $services === [] || $cabinets === []) {
    fail('No active doctors, services or cabinets found. Import database.sql first.');
}

$hours = [];
foreach ($pdo->query('SELECT weekday, is_closed, open_time, close_time FROM clinic_working_hours')->fetchAll() as $row) {
    $hours[(int) $row['weekday']] = [
        'closed' => (int) $row['is_closed'] === 1,
        'open'   => substr((string) $row['open_time'], 0, 5),
        'close'  => substr((string) $row['close_time'], 0, 5),
    ];
}

$servicesBySpec = [];
foreach ($services as $service) {
    $servicesBySpec[(int) $service['specialization_id']][] = $service;
}

mt_srand(RANDOM_SEED);

// §1 Patients -----------------------------------------------------------------
$patients = [];
$usedPesel = [];
$usedEmail = [];

for ($i = 1; $i <= $opts['patients']; $i++) {
    $person = fake_person();
    $email  = unique_email($person['first'], $person['last'], $usedEmail);
    [$city, $zipPrefix] = CITIES[array_rand(CITIES)];
    $street = STREETS[array_rand(STREETS)] . ' ' . mt_rand(1, 90);

    // Every tenth profile is left incomplete on purpose: the dashboard has a
    // "Niepełne profile" card that would otherwise always show zero. The front
    // end treats a profile as incomplete when PESEL, birth date or gender is
    // missing, so those fields stay empty here.
    $complete = $i % 10 !== 0;
    $pesel    = $complete ? unique_pesel($person['birth_date'], $person['female'], $usedPesel) : null;

    $patients[] = insert_row($pdo, 'patients', [
        'first_name'            => $person['first'],
        'last_name'             => $person['last'],
        'pesel'                 => $pesel,
        'birth_date'            => $complete ? $person['birth_date'] : null,
        'gender'                => $complete ? ($person['female'] ? 'female' : 'male') : null,
        'phone'                 => fake_phone(),
        'email'                 => $complete ? $email : null,
        'address'               => $complete ? $street : null,
        'postal_code'           => $complete ? $zipPrefix . sprintf('%03d', mt_rand(0, 999)) : null,
        'city'                  => $complete ? $city : null,
        'document_number'       => $complete ? sprintf('ABC %06d', mt_rand(100000, 999999)) : null,
        'insurer'               => $complete ? 'NFZ' : null,
        'insurance_number'      => null,
        'blood_group'           => ['unknown', '0 Rh+', 'A Rh+', 'A Rh-', 'B Rh+', 'AB Rh+'][mt_rand(0, 5)],
        'allergies'             => mt_rand(0, 4) === 0 ? 'Penicylina' : null,
        'chronic_diseases'      => mt_rand(0, 5) === 0 ? 'Nadciśnienie tętnicze' : null,
        'notes'                 => null,
        'profile_status'        => $complete ? 'complete' : 'incomplete',
        'personal_data_consent' => 1,
        'is_active'             => 1,
    ]);
}

// §2 Appointments -------------------------------------------------------------
$booked = [];
foreach ($pdo->query('SELECT doctor_id, appointment_date, start_time FROM appointments')->fetchAll() as $row) {
    $booked[$row['doctor_id'] . '|' . $row['appointment_date'] . '|' . substr((string) $row['start_time'], 0, 5)] = true;
}

$today   = new DateTimeImmutable('today');
$start   = $today->modify('-' . $opts['months'] . ' months');
$end     = $today->modify('+' . $opts['days_ahead'] . ' days');
$nowTime = (new DateTimeImmutable('now'))->format('H:i');

$appointments = 0;
$completed    = 0;
$day          = $start;

while ($day <= $end) {
    $weekday = (int) $day->format('N');
    if (!isset($hours[$weekday]) || $hours[$weekday]['closed']) {
        $day = $day->modify('+1 day');
        continue;
    }

    // Six to ten doctors work on any given day.
    $doctorCount = mt_rand(6, 10);
    shuffle($doctors);
    $workingDoctors = array_slice($doctors, 0, min($doctorCount, count($doctors)));

    foreach ($workingDoctors as $doctor) {
        $appointmentsForDoctor = mt_rand(2, 4);
        $specServices = $servicesBySpec[(int) $doctor['specialization_id']] ?? $services;

        for ($n = 0; $n < $appointmentsForDoctor; $n++) {
            $service = $specServices[array_rand($specServices)];
            $duration = (int) $service['duration_minutes'];

            $slot = random_slot($hours[$weekday]['open'], $hours[$weekday]['close'], $duration);
            if ($slot === null) {
                continue;
            }

            [$startTime, $endTime] = $slot;
            $key = $doctor['id'] . '|' . $day->format('Y-m-d') . '|' . $startTime;
            if (isset($booked[$key])) {
                continue;
            }
            $booked[$key] = true;

            $da      = $day->format('Y-m-d');
            $isToday = $da === $today->format('Y-m-d');
            $isPast  = $da < $today->format('Y-m-d') || ($isToday && $startTime < $nowTime);

            if ($isPast) {
                // Past visits are mostly completed, with a few cancellations.
                $roll   = mt_rand(1, 100);
                $status = $roll <= 88 ? 'completed' : ($roll <= 95 ? 'cancelled' : 'no_show');
            } else {
                $status = 'planned';
            }

            $cabinetId = $doctor['cabinet_id'] ?? $cabinets[array_rand($cabinets)]['id'];

            $appointmentId = insert_row($pdo, 'appointments', [
                'patient_id'         => $patients[array_rand($patients)],
                'doctor_id'          => $doctor['id'],
                'service_id'         => $service['id'],
                'cabinet_id'         => $cabinetId,
                'appointment_date'   => $da,
                'start_time'         => $startTime . ':00',
                'end_time'           => $endTime . ':00',
                'status'             => $status,
                'notes'              => null,
                'created_by_user_id' => 2,
            ]);
            $appointments++;

            if ($status === 'completed') {
                $completed++;
                insert_row($pdo, 'visit_history', [
                    'appointment_id'  => $appointmentId,
                    'diagnosis'       => DIAGNOSES[(int) $doctor['specialization_id']] ?? DIAGNOSES[1],
                    'recommendations' => RECOMMENDATIONS[array_rand(RECOMMENDATIONS)],
                ]);
            }
        }
    }

    $day = $day->modify('+1 day');
}

// §3 Doctor absences ----------------------------------------------------------
$absences = 0;
for ($i = 0; $i < 3; $i++) {
    $doctor = $doctors[array_rand($doctors)];
    $from   = $today->modify('+' . mt_rand(3, 20) . ' days');
    $to     = $from->modify('+' . mt_rand(0, 4) . ' days');

    insert_row($pdo, 'doctor_absences', [
        'doctor_id'  => $doctor['id'],
        'type'       => ['Urlop', 'Chorobowe', 'Inne'][mt_rand(0, 2)],
        'date_from'  => $from->format('Y-m-d'),
        'date_to'    => $to->format('Y-m-d'),
        'time_from'  => null,
        'time_to'    => null,
        'note'       => 'Wpis demonstracyjny.',
        'status'     => 'active',
        'created_by' => 2,
    ]);
    $absences++;
}

// §4 Summary ------------------------------------------------------------------
$profileIncomplete = (int) $pdo->query("SELECT COUNT(*) FROM patients WHERE profile_status = 'incomplete'")->fetchColumn();
$todayCount        = (int) $pdo->query("SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE()")->fetchColumn();

echo "\nDemo data created in `{$dbName}`:\n";
printf("  patients          %d (of which %d with an incomplete profile)\n", $opts['patients'], $profileIncomplete);
printf("  appointments      %d (%d completed visits with history)\n", $appointments, $completed);
printf("  doctor absences   %d\n", $absences);
printf("  today             %d appointments\n", $todayCount);
echo "\nRe-running needs --reset --yes: the generator is deterministic, so it would\ncollide on PESEL and e-mail.\n";
echo "Sign in with the demo accounts seeded by database.sql (recepcja / mediplus123).\n";

// Helpers ---------------------------------------------------------------------

/** @return array{list: bool, reset: bool, yes: bool, patients: int, months: int, days_ahead: int} */
function parse_args(array $argv): array
{
    $opts = [
        'list'       => false,
        'reset'      => false,
        'yes'        => false,
        'patients'   => DEFAULT_PATIENTS,
        'months'     => DEFAULT_MONTHS_BACK,
        'days_ahead' => DEFAULT_DAYS_AHEAD,
    ];

    for ($i = 1; $i < count($argv); $i++) {
        $arg = $argv[$i];
        if ($arg === '--list') {
            $opts['list'] = true;
        } elseif ($arg === '--reset') {
            $opts['reset'] = true;
        } elseif ($arg === '--yes') {
            $opts['yes'] = true;
        } elseif (preg_match('/^--(patients|months|days-ahead)=(\d+)$/', $arg, $m)) {
            $value = max(1, (int) $m[2]);
            $opts[$m[1] === 'days-ahead' ? 'days_ahead' : $m[1]] = $value;
        } else {
            fail("Unknown argument: {$arg}\nUse --list, --reset, --yes, --patients=N, --months=N, --days-ahead=N.");
        }
    }

    return $opts;
}

function dsn_database(string $dsn): string
{
    if (preg_match('/dbname=([^;]+)/', $dsn, $m) !== 1) {
        fail('DEMO_DSN must contain dbname=...');
    }

    return $m[1];
}

function assert_demo_database(string $name): void
{
    $lower = strtolower($name);

    if (in_array($lower, BLOCKED_DATABASES, true)) {
        fail("Refusing to seed `{$name}`: it is a working database. Use a copy such as mediplus_demo.");
    }

    foreach (['demo', 'dev', 'test', 'seed', 'sandbox'] as $marker) {
        if (str_contains($lower, $marker)) {
            return;
        }
    }

    fail("Refusing to seed `{$name}`: the database name must contain demo, dev, test, seed or sandbox.");
}

/** @return array<string, list<string>> */
function columns(PDO $pdo, string $table): array
{
    static $cache = [];
    if (!isset($cache[$table])) {
        try {
            $cache[$table] = array_column(
                $pdo->query('SHOW COLUMNS FROM `' . $table . '`')->fetchAll(),
                'Field'
            );
        } catch (PDOException) {
            $cache[$table] = [];
        }
    }

    return $cache[$table];
}

/** Inserts only the columns that exist, so small schema drift does not break the seeder. */
function insert_row(PDO $pdo, string $table, array $data): int
{
    $cols = columns($pdo, $table);
    $data = array_intersect_key($data, array_flip($cols));

    if ($data === []) {
        fail("Table `{$table}` has none of the expected columns. Run --list and adjust the seeder.");
    }

    $names = array_keys($data);
    $sql   = 'INSERT INTO `' . $table . '` (`' . implode('`,`', $names) . '`) VALUES ('
        . rtrim(str_repeat('?,', count($names)), ',') . ')';

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_values($data));
    } catch (PDOException $e) {
        fail("Insert into `{$table}` failed: " . $e->getMessage() . "\nSQL: {$sql}");
    }

    return (int) $pdo->lastInsertId();
}

function reset_tables(PDO $pdo): void
{
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach (SEED_TABLES as $table) {
        $pdo->exec('TRUNCATE TABLE `' . $table . '`');
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
}

function fake_phone(): string
{
    return sprintf('+48 %03d %03d %03d', mt_rand(500, 579), mt_rand(100, 999), mt_rand(100, 999));
}

/** @return array{first: string, last: string, birth_date: string, female: bool} */
function fake_person(): array
{
    $femaleFirst = ['Anna', 'Katarzyna', 'Maria', 'Zofia', 'Julia', 'Oliwia', 'Maja', 'Hanna', 'Iryna', 'Olena', 'Agnieszka', 'Ewa'];
    $maleFirst   = ['Piotr', 'Michał', 'Jakub', 'Szymon', 'Antoni', 'Filip', 'Jan', 'Dmytro', 'Tomasz', 'Adam', 'Marcin', 'Paweł'];
    $lastFemale  = ['Nowak', 'Kowalska', 'Wiśniewska', 'Wójcik', 'Kamińska', 'Lewandowska', 'Zielińska', 'Szymańska', 'Shevchenko', 'Mazur'];
    $lastMale    = ['Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Shevchenko', 'Mazur'];

    $female = mt_rand(0, 1) === 1;
    $first  = $female ? $femaleFirst[array_rand($femaleFirst)] : $maleFirst[array_rand($maleFirst)];
    $last   = $female ? $lastFemale[array_rand($lastFemale)] : $lastMale[array_rand($lastMale)];

    $year  = mt_rand(1945, 2018);
    $month = mt_rand(1, 12);
    $days  = (int) (new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month)))->format('t');
    $date  = sprintf('%04d-%02d-%02d', $year, $month, mt_rand(1, $days));

    return ['first' => $first, 'last' => $last, 'birth_date' => $date, 'female' => $female];
}

/**
 * Builds a PESEL with a correct checksum digit, so the number is structurally
 * valid even though the person does not exist.
 *
 * @param array<string, bool> $used
 */
function unique_pesel(string $birthDate, bool $female, array &$used): string
{
    for ($attempt = 0; $attempt < 500; $attempt++) {
        $dt = new DateTimeImmutable($birthDate);
        $year = (int) $dt->format('Y');
        $month = (int) $dt->format('n');
        $day = (int) $dt->format('j');

        if ($year >= 2000) {
            $month += 20;
        } elseif ($year < 1900) {
            $month += 80;
        }

        $serial = sprintf('%04d', mt_rand(0, 9999));
        // The 10th digit of a PESEL encodes sex: even for women, odd for men.
        $serial[3] = (string) (mt_rand(0, 4) * 2 + ($female ? 0 : 1));

        $base = sprintf('%02d%02d%02d%s', $year % 100, $month, $day, $serial);

        $weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
        $sum = 0;
        for ($i = 0; $i < 10; $i++) {
            $sum += ((int) $base[$i]) * $weights[$i];
        }
        $pesel = $base . ((10 - ($sum % 10)) % 10);

        if (!isset($used[$pesel])) {
            $used[$pesel] = true;

            return $pesel;
        }
    }

    fail('Could not generate a unique PESEL. Reduce --patients.');
}

/** @param array<string, bool> $used */
function unique_email(string $first, string $last, array &$used): string
{
    $slug = transliterator_slug($first . '.' . $last);
    $email = $slug . '@example.com';
    $i = 2;

    while (isset($used[$email])) {
        $email = $slug . $i . '@example.com';
        $i++;
    }

    $used[$email] = true;

    return $email;
}

function transliterator_slug(string $value): string
{
    $map = [
        'ą' => 'a', 'ć' => 'c', 'ę' => 'e', 'ł' => 'l', 'ń' => 'n', 'ó' => 'o',
        'ś' => 's', 'ź' => 'z', 'ż' => 'z', 'Ą' => 'a', 'Ć' => 'c', 'Ę' => 'e',
        'Ł' => 'l', 'Ń' => 'n', 'Ó' => 'o', 'Ś' => 's', 'Ź' => 'z', 'Ż' => 'z',
    ];

    return strtolower(strtr($value, $map));
}

/**
 * Picks a random half-hour slot between the clinic opening and closing time.
 *
 * @return array{0: string, 1: string}|null
 */
function random_slot(string $open, string $close, int $duration): ?array
{
    $openMinutes  = minutes($open);
    $closeMinutes = minutes($close);
    $latestStart  = $closeMinutes - $duration;

    if ($latestStart <= $openMinutes) {
        return null;
    }

    $steps = intdiv($latestStart - $openMinutes, 30);
    if ($steps < 1) {
        return null;
    }

    $start = $openMinutes + 30 * mt_rand(0, $steps);
    $end   = $start + $duration;

    return [hm($start), hm($end)];
}

function minutes(string $hhmm): int
{
    [$h, $m] = array_map('intval', explode(':', $hhmm));

    return $h * 60 + $m;
}

function hm(int $minutes): string
{
    return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
}

function fail(string $message): never
{
    fwrite(STDERR, "Error: {$message}\n");
    exit(1);
}
