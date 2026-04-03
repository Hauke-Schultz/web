<?php
/**
 * RSVP API – JSON file backend
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://haukeschultz.com');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

define('RSVP_FILE', __DIR__ . '/rsvp.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function readRsvps(): array {
    if (!file_exists(RSVP_FILE)) return [];
    $data = json_decode(file_get_contents(RSVP_FILE), true);
    return is_array($data) ? $data : [];
}

function writeRsvps(array $rsvps): void {
    file_put_contents(RSVP_FILE, json_encode($rsvps, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function findIndex(array $rsvps, string $guestId): int|false {
    foreach ($rsvps as $i => $entry) {
        if ($entry['guestId'] === $guestId) return $i;
    }
    return false;
}

function validateRSVPData(array $data): array {
    $errors = [];
    if (empty(trim($data['guestId'] ?? '')))  $errors[] = 'guestId is required';
    if (empty(trim($data['name']     ?? '')))  $errors[] = 'name is required';
    if (isset($data['name']) && mb_strlen($data['name']) > 50) $errors[] = 'name too long (max 50 characters)';
    if (!isset($data['status']) || !in_array($data['status'], ['pending', 'accepted', 'declined']))
        $errors[] = 'status must be one of: pending, accepted, declined';
    if (isset($data['numberOfGuests']) && (!is_numeric($data['numberOfGuests']) || $data['numberOfGuests'] < 1 || $data['numberOfGuests'] > 10))
        $errors[] = 'numberOfGuests must be between 1 and 10';
    return $errors;
}

// ── Routing ───────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'GET':
        $rsvps = readRsvps();
        if (!empty(trim($_GET['guestId'] ?? ''))) {
            $idx = findIndex($rsvps, trim($_GET['guestId']));
            echo json_encode($idx !== false ? $rsvps[$idx] : []);
        } else {
            usort($rsvps, fn($a, $b) => strcmp($b['lastUpdated'], $a['lastUpdated']));
            echo json_encode($rsvps);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if ($data === null) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); exit(); }

        $errors = validateRSVPData($data);
        if (!empty($errors)) { http_response_code(400); echo json_encode(['error' => 'Validation failed', 'details' => $errors]); exit(); }

        $guestId        = trim($data['guestId']);
        $name           = trim($data['name']);
        $status         = $data['status'];
        $numberOfGuests = (int)($data['numberOfGuests'] ?? 1);
        $comingByCar    = (bool)($data['comingByCar']    ?? false);
        $needsParking   = (bool)($data['needsParking']   ?? false);
        $needsHotelRoom = (bool)($data['needsHotelRoom'] ?? false);
        $numberOfRooms  = (int)($data['numberOfRooms']   ?? 1);
        $remarks        = trim($data['remarks']          ?? '');
        $lastUpdated    = $data['lastUpdated']            ?? date('c');

        $foodPreferences = [];
        if (isset($data['foodPreferences']) && is_array($data['foodPreferences'])) {
            $foodPreferences = $data['foodPreferences'];
        } elseif (!empty($data['foodPreference'])) {
            $foodPreferences = [trim($data['foodPreference'])];
        }

        $entry = compact('guestId', 'name', 'status', 'numberOfGuests', 'comingByCar',
                         'needsParking', 'needsHotelRoom', 'numberOfRooms', 'foodPreferences',
                         'remarks', 'lastUpdated');

        $rsvps = readRsvps();
        $idx   = findIndex($rsvps, $guestId);
        if ($idx !== false) {
            $rsvps[$idx] = $entry;
        } else {
            $rsvps[] = $entry;
        }
        writeRsvps($rsvps);

        echo json_encode(['message' => 'RSVP saved successfully', 'data' => $entry]);
        break;

    case 'DELETE':
        if (empty(trim($_GET['guestId'] ?? ''))) { http_response_code(400); echo json_encode(['error' => 'guestId parameter is required']); exit(); }

        $guestId = trim($_GET['guestId']);
        $rsvps   = readRsvps();
        $idx     = findIndex($rsvps, $guestId);

        if ($idx === false) { http_response_code(404); echo json_encode(['error' => 'RSVP not found']); exit(); }

        array_splice($rsvps, $idx, 1);
        writeRsvps($rsvps);

        echo json_encode(['message' => 'RSVP deleted successfully', 'guestId' => $guestId]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
