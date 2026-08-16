<?php
/**
 * Game Data Sync API für Strato Shared Hosting
 * Verwendet JSON-Datei als Speicher
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://haukeschultz.com');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS Request für CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Konfiguration
define('USERS_FILE', __DIR__ . '/users.json');
define('GAMEDATA_FILE', __DIR__ . '/gamedata.json');

/**
 * Passwort hashen mit SHA-256
 */
function hashPassword($password) {
    return hash('sha256', $password);
}

/**
 * Benutzer aus JSON-Datei laden
 */
function loadUsers() {
    if (!file_exists(USERS_FILE)) {
        return [];
    }

    $json = file_get_contents(USERS_FILE);
    $data = json_decode($json, true);

    if ($data === null) {
        error_log('Failed to decode users.json');
        return [];
    }

    return $data;
}

/**
 * Game Data aus JSON-Datei laden
 */
function loadGameData() {
    if (!file_exists(GAMEDATA_FILE)) {
        file_put_contents(GAMEDATA_FILE, json_encode([], JSON_PRETTY_PRINT));
        return [];
    }

    $json = file_get_contents(GAMEDATA_FILE);
    $data = json_decode($json, true);

    if ($data === null) {
        error_log('Failed to decode gamedata.json');
        return [];
    }

    return $data;
}

/**
 * Game Data in JSON-Datei speichern
 */
function saveGameData($gameData) {
    $json = json_encode($gameData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if (file_put_contents(GAMEDATA_FILE, $json) === false) {
        error_log('Failed to write gamedata.json');
        return false;
    }
    return true;
}

/**
 * Benutzer authentifizieren
 */
function authenticateUser($username, $password) {
    if (empty($username) || empty($password)) {
        return ['error' => 'Username and password are required', 'code' => 400];
    }

    $users = loadUsers();
    $usernameLower = strtolower($username);

    if (!isset($users[$usernameLower])) {
        return ['error' => 'Invalid credentials', 'code' => 401];
    }

    $user = $users[$usernameLower];

    if ($user['password'] !== hashPassword($password)) {
        return ['error' => 'Invalid credentials', 'code' => 401];
    }

    return ['user' => $user, 'usernameLower' => $usernameLower];
}

/**
 * JSON Response senden
 */
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * Fehler Response senden
 */
function sendError($message, $statusCode = 400) {
    sendResponse(['error' => $message], $statusCode);
}

// Request Body parsen
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if ($data === null && !empty($input)) {
    sendError('Invalid JSON', 400);
}

// Route basierend auf action parameter
$action = isset($_GET['action']) ? $_GET['action'] : (isset($data['action']) ? $data['action'] : '');

switch ($action) {
    case 'save':
        // Game Data speichern
        $username = isset($data['username']) ? trim($data['username']) : '';
        $password = isset($data['password']) ? $data['password'] : '';
        $userGameData = isset($data['gameData']) ? $data['gameData'] : null;

        if (!$userGameData) {
            sendError('gameData is required', 400);
        }

        // Authentifizierung
        $auth = authenticateUser($username, $password);
        if (isset($auth['error'])) {
            sendError($auth['error'], $auth['code']);
        }

        $user = $auth['user'];
        $usernameLower = $auth['usernameLower'];

        // Game Data laden
        $allGameData = loadGameData();

        // Game Data für diesen Benutzer speichern
        $allGameData[$usernameLower] = [
            'username' => $user['username'],
            'data' => $userGameData,
            'lastSaved' => date('c')
        ];

        // Speichern
        if (!saveGameData($allGameData)) {
            sendError('Failed to save game data', 500);
        }

        sendResponse([
            'success' => true,
            'message' => 'Game data saved successfully',
            'lastSaved' => $allGameData[$usernameLower]['lastSaved']
        ]);
        break;

    case 'load':
        // Game Data laden
        $username = isset($data['username']) ? trim($data['username']) : '';
        $password = isset($data['password']) ? $data['password'] : '';

        // Authentifizierung
        $auth = authenticateUser($username, $password);
        if (isset($auth['error'])) {
            sendError($auth['error'], $auth['code']);
        }

        $user = $auth['user'];
        $usernameLower = $auth['usernameLower'];

        // Game Data laden
        $allGameData = loadGameData();

        if (!isset($allGameData[$usernameLower])) {
            sendResponse([
                'success' => true,
                'message' => 'No game data found',
                'gameData' => null,
                'lastSaved' => null
            ]);
        }

        $userGameData = $allGameData[$usernameLower];

        sendResponse([
            'success' => true,
            'message' => 'Game data loaded successfully',
            'gameData' => $userGameData['data'],
            'lastSaved' => $userGameData['lastSaved']
        ]);
        break;

    case 'users':
        // Get all users with statistics (public endpoint, no auth required)
        $users = loadUsers();
        $allGameData = loadGameData();

        $userStats = [];

        foreach ($allGameData as $usernameLower => $userData) {
            if (!isset($users[$usernameLower])) continue;

            $user = $users[$usernameLower];
            $gameData = $userData['data'];

            // Calculate statistics
            $stats = [
                'username' => $user['username'],
                'level' => isset($gameData['player']['level']) ? $gameData['player']['level'] : 1,
                'coins' => isset($gameData['player']['coins']) ? $gameData['player']['coins'] : 0,
                'diamonds' => isset($gameData['player']['diamonds']) ? $gameData['player']['diamonds'] : 0,
                'totalScore' => isset($gameData['player']['totalScore']) ? $gameData['player']['totalScore'] : 0,
                'gamesPlayed' => isset($gameData['player']['gamesPlayed']) ? $gameData['player']['gamesPlayed'] : 0,
                'achievements' => 0,
                'createdAt' => $user['createdAt'],
                'lastLogin' => $user['lastLogin'],
                'lastSaved' => $userData['lastSaved']
            ];

            // Count achievements
            if (isset($gameData['achievements']) && is_array($gameData['achievements'])) {
                $stats['achievements'] = count(array_filter($gameData['achievements'], function($a) {
                    return isset($a['earned']) && $a['earned'];
                }));
            }

            $userStats[] = $stats;
        }

        // Sort by level descending, then by coins
        usort($userStats, function($a, $b) {
            if ($b['level'] !== $a['level']) {
                return $b['level'] - $a['level'];
            }
            return $b['coins'] - $a['coins'];
        });

        sendResponse([
            'success' => true,
            'users' => $userStats,
            'total' => count($userStats)
        ]);
        break;

    default:
        sendError('Invalid action. Use action=save, action=load, or action=users', 400);
}
