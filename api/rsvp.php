<?php
/**
 * RSVP API – MySQL-Backend
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://haukeschultz.com');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToRsvp(array $row): array {
    return [
        'guestId'         => $row['guest_id'],
        'name'            => $row['name'],
        'status'          => $row['status'],
        'numberOfGuests'  => (int)$row['number_of_guests'],
        'comingByCar'     => (bool)$row['coming_by_car'],
        'needsParking'    => (bool)$row['needs_parking'],
        'needsHotelRoom'  => (bool)$row['needs_hotel_room'],
        'numberOfRooms'   => (int)$row['number_of_rooms'],
        'foodPreferences' => json_decode($row['food_preferences'], true) ?? [],
        'remarks'         => $row['remarks'],
        'lastUpdated'     => $row['last_updated'],
    ];
}

function validateRSVPData(array $data): array {
    $errors = [];
    if (!isset($data['guestId']) || empty(trim($data['guestId'])))
        $errors[] = 'guestId is required';
    if (!isset($data['name']) || empty(trim($data['name'])))
        $errors[] = 'name is required';
    if (isset($data['name']) && mb_strlen($data['name']) > 50)
        $errors[] = 'name too long (max 50 characters)';
    if (!isset($data['status']) || !in_array($data['status'], ['pending','accepted','declined']))
        $errors[] = 'status must be one of: pending, accepted, declined';
    if (isset($data['numberOfGuests']) && (!is_numeric($data['numberOfGuests']) || $data['numberOfGuests'] < 1 || $data['numberOfGuests'] > 10))
        $errors[] = 'numberOfGuests must be between 1 and 10';
    return $errors;
}

// ── Routing ───────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'GET':
        try {
            $db = getDB();
            if (empty(trim($_GET['guestId'] ?? ''))) {
                $rows = $db->query('SELECT * FROM rsvps ORDER BY last_updated DESC')->fetchAll();
                echo json_encode(array_map('rowToRsvp', $rows));
            } else {
                $stmt = $db->prepare('SELECT * FROM rsvps WHERE guest_id = ?');
                $stmt->execute([trim($_GET['guestId'])]);
                $row = $stmt->fetch();
                echo json_encode($row ? rowToRsvp($row) : []);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to load RSVP']);
            error_log('RSVP GET error: ' . $e->getMessage());
        }
        break;

    case 'POST':
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if ($data === null) {
                http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); exit();
            }

            $errors = validateRSVPData($data);
            if (!empty($errors)) {
                http_response_code(400); echo json_encode(['error' => 'Validation failed', 'details' => $errors]); exit();
            }

            $guestId        = trim($data['guestId']);
            $name           = trim($data['name']);
            $status         = $data['status'];
            $numberOfGuests = (int)($data['numberOfGuests'] ?? 1);
            $comingByCar    = (int)(bool)($data['comingByCar'] ?? false);
            $needsParking   = (int)(bool)($data['needsParking'] ?? false);
            $needsHotelRoom = (int)(bool)($data['needsHotelRoom'] ?? false);
            $numberOfRooms  = (int)($data['numberOfRooms'] ?? 1);
            $remarks        = trim($data['remarks'] ?? '');
            $lastUpdated    = date('Y-m-d H:i:s', strtotime($data['lastUpdated'] ?? 'now'));

            $foodPreferences = [];
            if (isset($data['foodPreferences']) && is_array($data['foodPreferences'])) {
                $foodPreferences = $data['foodPreferences'];
            } elseif (!empty($data['foodPreference'])) {
                $foodPreferences = [trim($data['foodPreference'])];
            }
            $foodJson = json_encode($foodPreferences, JSON_UNESCAPED_UNICODE);

            $db = getDB();
            $db->prepare("
                INSERT INTO rsvps
                    (guest_id, name, status, number_of_guests, coming_by_car, needs_parking,
                     needs_hotel_room, number_of_rooms, food_preferences, remarks, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    name             = VALUES(name),
                    status           = VALUES(status),
                    number_of_guests = VALUES(number_of_guests),
                    coming_by_car    = VALUES(coming_by_car),
                    needs_parking    = VALUES(needs_parking),
                    needs_hotel_room = VALUES(needs_hotel_room),
                    number_of_rooms  = VALUES(number_of_rooms),
                    food_preferences = VALUES(food_preferences),
                    remarks          = VALUES(remarks),
                    last_updated     = VALUES(last_updated)
            ")->execute([$guestId, $name, $status, $numberOfGuests, $comingByCar, $needsParking,
                         $needsHotelRoom, $numberOfRooms, $foodJson, $remarks, $lastUpdated]);

            http_response_code(200);
            echo json_encode([
                'message' => 'RSVP saved successfully',
                'data'    => [
                    'guestId'         => $guestId,
                    'name'            => $name,
                    'status'          => $status,
                    'numberOfGuests'  => $numberOfGuests,
                    'comingByCar'     => (bool)$comingByCar,
                    'needsParking'    => (bool)$needsParking,
                    'needsHotelRoom'  => (bool)$needsHotelRoom,
                    'numberOfRooms'   => $numberOfRooms,
                    'foodPreferences' => $foodPreferences,
                    'remarks'         => $remarks,
                    'lastUpdated'     => $data['lastUpdated'] ?? date('c'),
                ],
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save RSVP']);
            error_log('RSVP POST error: ' . $e->getMessage());
        }
        break;

    case 'DELETE':
        try {
            if (empty(trim($_GET['guestId'] ?? ''))) {
                http_response_code(400); echo json_encode(['error' => 'guestId parameter is required']); exit();
            }
            $guestId = trim($_GET['guestId']);
            $db   = getDB();
            $stmt = $db->prepare('DELETE FROM rsvps WHERE guest_id = ?');
            $stmt->execute([$guestId]);
            if ($stmt->rowCount() === 0) {
                http_response_code(404); echo json_encode(['error' => 'RSVP not found']); exit();
            }
            echo json_encode(['message' => 'RSVP deleted successfully', 'guestId' => $guestId]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete RSVP']);
            error_log('RSVP DELETE error: ' . $e->getMessage());
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
