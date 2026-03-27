<?php
/**
 * Highscore API für Strato Shared Hosting
 * Verwendet JSON-Datei als Speicher
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://haukeschultz.com');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONS Request für CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Konfiguration
define('HIGHSCORES_FILE', __DIR__ . '/highscores.json');
define('MAX_HIGHSCORES', 100); // Speichere Top 100, zeige Top 10

/**
 * Highscores aus JSON-Datei laden
 */
function loadHighscores() {
    if (!file_exists(HIGHSCORES_FILE)) {
        // Erstelle Datei mit Dummy-Daten wenn nicht vorhanden
        $dummyData = [
            ['rank' => 1, 'playerId' => 'dummy-1', 'name' => 'MaxPower', 'level' => 300, 'date' => '2025-10-20'],
            ['rank' => 2, 'playerId' => 'dummy-2', 'name' => 'LevelKing', 'level' => 200, 'date' => '2025-10-18'],
            ['rank' => 3, 'playerId' => 'dummy-3', 'name' => 'ClickMaster', 'level' => 100, 'date' => '2025-10-15'],
            ['rank' => 4, 'playerId' => 'dummy-4', 'name' => 'PartyHero', 'level' => 90, 'date' => '2025-10-12'],
            ['rank' => 5, 'playerId' => 'dummy-5', 'name' => 'ButtonSmasher', 'level' => 80, 'date' => '2025-10-10'],
            ['rank' => 6, 'playerId' => 'dummy-6', 'name' => 'ProGamer', 'level' => 70, 'date' => '2025-10-08'],
            ['rank' => 7, 'playerId' => 'dummy-7', 'name' => 'SpeedClicker', 'level' => 60, 'date' => '2025-10-05'],
            ['rank' => 8, 'playerId' => 'dummy-8', 'name' => 'ChampionX', 'level' => 50, 'date' => '2025-10-02'],
            ['rank' => 9, 'playerId' => 'dummy-9', 'name' => 'NinjaFinger', 'level' => 40, 'date' => '2025-09-28'],
            ['rank' => 10, 'playerId' => 'dummy-10', 'name' => 'ClickNinja', 'level' => 30, 'date' => '2025-09-25']
        ];
        saveHighscores($dummyData);
        return $dummyData;
    }

    $json = file_get_contents(HIGHSCORES_FILE);
    $data = json_decode($json, true);

    if ($data === null) {
        error_log('Failed to decode highscores.json');
        return [];
    }

    return $data;
}

/**
 * Highscores in JSON-Datei speichern
 */
function saveHighscores($highscores) {
    $json = json_encode($highscores, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    if ($json === false) {
        error_log('Failed to encode highscores');
        return false;
    }

    $result = file_put_contents(HIGHSCORES_FILE, $json, LOCK_EX);

    if ($result === false) {
        error_log('Failed to write highscores.json');
        return false;
    }

    return true;
}

/**
 * Validierung der Eingabedaten
 */
function validateHighscoreData($data) {
    $errors = [];

    if (!isset($data['playerId']) || empty(trim($data['playerId']))) {
        $errors[] = 'playerId is required';
    }

    if (!isset($data['name']) || empty(trim($data['name']))) {
        $errors[] = 'name is required';
    }

    if (isset($data['name']) && mb_strlen($data['name']) > 20) {
        $errors[] = 'name too long (max 20 characters)';
    }

    if (!isset($data['level']) || !is_numeric($data['level'])) {
        $errors[] = 'level must be a number';
    }

    if (isset($data['level']) && $data['level'] < 0) {
        $errors[] = 'level must be positive';
    }

    return $errors;
}

// Routing basierend auf REQUEST_METHOD
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // GET /api/highscores - Lade alle Highscores
        try {
            $highscores = loadHighscores();

            // Gib alle Highscores zurück
            echo json_encode($highscores);
            http_response_code(200);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to load highscores']);
            error_log('Error loading highscores: ' . $e->getMessage());
        }
        break;

    case 'POST':
        // POST /api/highscores - Speichere neuen Highscore
        try {
            // Lese POST-Daten
            $input = file_get_contents('php://input');
            $data = json_decode($input, true);

            if ($data === null) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid JSON']);
                exit();
            }

            // Validierung
            $errors = validateHighscoreData($data);
            if (!empty($errors)) {
                http_response_code(400);
                echo json_encode(['error' => 'Validation failed', 'details' => $errors]);
                exit();
            }

            // Daten bereinigen
            $playerId = trim($data['playerId']);
            $name = trim($data['name']);
            $level = (int)$data['level'];
            $date = isset($data['date']) ? $data['date'] : date('Y-m-d');

            // Lade aktuelle Highscores
            $highscores = loadHighscores();

            // Prüfe ob Spieler bereits existiert
            $existingIndex = -1;
            foreach ($highscores as $index => $score) {
                if ($score['playerId'] === $playerId) {
                    $existingIndex = $index;
                    break;
                }
            }

            if ($existingIndex !== -1) {
                // Spieler existiert - nur updaten wenn neuer Score besser ist
                if ($level > $highscores[$existingIndex]['level']) {
                    $highscores[$existingIndex] = [
                        'playerId' => $playerId,
                        'name' => $name,
                        'level' => $level,
                        'date' => $date,
                        'emoji' => isset($highscores[$existingIndex]['emoji']) ? $highscores[$existingIndex]['emoji'] : '', // Keep existing emoji
                        'status' => isset($highscores[$existingIndex]['status']) ? $highscores[$existingIndex]['status'] : 'normal' // Keep existing status
                    ];
                } else {
                    // Bestehender Score ist besser
                    $rank = $existingIndex + 1;

                    http_response_code(200);
                    echo json_encode([
                        'message' => 'Existing score is better',
                        'rank' => $rank,
                        'highscores' => $highscores
                    ]);
                    exit();
                }
            } else {
                // Neuer Spieler - hinzufügen
                $highscores[] = [
                    'playerId' => $playerId,
                    'name' => $name,
                    'level' => $level,
                    'date' => $date,
                    'emoji' => '', // No emoji by default
                    'status' => 'normal' // Default status
                ];
            }

            // Sortieren nach Level (höchste zuerst)
            usort($highscores, function($a, $b) {
                return $b['level'] - $a['level'];
            });

            // Nur Top 100 behalten
            $highscores = array_slice($highscores, 0, MAX_HIGHSCORES);

            // Ranks neu zuweisen
            foreach ($highscores as $index => &$score) {
                $score['rank'] = $index + 1;
            }
            unset($score); // Referenz freigeben

            // Speichern
            if (!saveHighscores($highscores)) {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to save highscore']);
                exit();
            }

            // Finde Rang des Spielers
            $playerRank = 0;
            foreach ($highscores as $index => $score) {
                if ($score['playerId'] === $playerId) {
                    $playerRank = $index + 1;
                    break;
                }
            }

            // Gib alle Highscores zurück
            http_response_code(200);
            echo json_encode([
                'message' => 'Highscore saved successfully',
                'rank' => $playerRank,
                'highscores' => $highscores
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save highscore']);
            error_log('Error saving highscore: ' . $e->getMessage());
        }
        break;

    case 'PUT':
        // PUT /api/highscores - Update highscore
        try {
            // Lese POST-Daten
            $input = file_get_contents('php://input');
            $data = json_decode($input, true);

            if ($data === null) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid JSON']);
                exit();
            }

            // Validierung
            if (!isset($data['playerId']) || empty(trim($data['playerId']))) {
                http_response_code(400);
                echo json_encode(['error' => 'playerId is required']);
                exit();
            }

            if (!isset($data['name']) || empty(trim($data['name']))) {
                http_response_code(400);
                echo json_encode(['error' => 'name is required']);
                exit();
            }

            if (!isset($data['level']) || !is_numeric($data['level'])) {
                http_response_code(400);
                echo json_encode(['error' => 'level must be a number']);
                exit();
            }

            if ($data['level'] < 0) {
                http_response_code(400);
                echo json_encode(['error' => 'level must be positive']);
                exit();
            }

            if (mb_strlen($data['name']) > 20) {
                http_response_code(400);
                echo json_encode(['error' => 'name too long (max 20 characters)']);
                exit();
            }

            $playerId = trim($data['playerId']);
            $name = trim($data['name']);
            $level = (int)$data['level'];
            $emoji = isset($data['emoji']) ? trim($data['emoji']) : '';
            $status = isset($data['status']) ? trim($data['status']) : '';

            // Validate emoji (optional, max 10 characters for emoji)
            if (mb_strlen($emoji) > 10) {
                http_response_code(400);
                echo json_encode(['error' => 'emoji too long (max 10 characters)']);
                exit();
            }

            // Validate status (optional, must be one of the allowed values)
            $allowedStatuses = ['normal', 'underReview', 'disqualified'];
            if (!empty($status) && !in_array($status, $allowedStatuses)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid status value. Must be one of: ' . implode(', ', $allowedStatuses)]);
                exit();
            }

            // Lade aktuelle Highscores
            $highscores = loadHighscores();

            // Finde den zu aktualisierenden Highscore
            $existingIndex = -1;
            foreach ($highscores as $index => $score) {
                if ($score['playerId'] === $playerId) {
                    $existingIndex = $index;
                    break;
                }
            }

            if ($existingIndex === -1) {
                http_response_code(404);
                echo json_encode(['error' => 'Highscore not found']);
                exit();
            }

            // Update highscore (behalte das originale Datum)
            $highscores[$existingIndex] = [
                'playerId' => $playerId,
                'name' => $name,
                'level' => $level,
                'date' => $highscores[$existingIndex]['date'],
                'emoji' => $emoji,
                'status' => !empty($status) ? $status : (isset($highscores[$existingIndex]['status']) ? $highscores[$existingIndex]['status'] : 'normal')
            ];

            // Sortieren nach Level (höchste zuerst)
            usort($highscores, function($a, $b) {
                return $b['level'] - $a['level'];
            });

            // Nur Top 100 behalten
            $highscores = array_slice($highscores, 0, MAX_HIGHSCORES);

            // Ranks neu zuweisen
            foreach ($highscores as $index => &$score) {
                $score['rank'] = $index + 1;
            }
            unset($score);

            // Speichern
            if (!saveHighscores($highscores)) {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to update highscore']);
                exit();
            }

            http_response_code(200);
            echo json_encode([
                'message' => 'Highscore updated successfully',
                'highscores' => $highscores
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update highscore']);
            error_log('Error updating highscore: ' . $e->getMessage());
        }
        break;

    case 'DELETE':
        // DELETE /api/highscores - Delete highscore
        try {
            // Lese playerId aus Query-Parameter
            if (!isset($_GET['playerId']) || empty(trim($_GET['playerId']))) {
                http_response_code(400);
                echo json_encode(['error' => 'playerId parameter is required']);
                exit();
            }

            $playerId = trim($_GET['playerId']);

            // Lade aktuelle Highscores
            $highscores = loadHighscores();

            // Finde den zu löschenden Highscore
            $existingIndex = -1;
            foreach ($highscores as $index => $score) {
                if ($score['playerId'] === $playerId) {
                    $existingIndex = $index;
                    break;
                }
            }

            if ($existingIndex === -1) {
                http_response_code(404);
                echo json_encode(['error' => 'Highscore not found']);
                exit();
            }

            // Entferne den Highscore
            array_splice($highscores, $existingIndex, 1);

            // Ranks neu zuweisen
            foreach ($highscores as $index => &$score) {
                $score['rank'] = $index + 1;
            }
            unset($score);

            // Speichern
            if (!saveHighscores($highscores)) {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to delete highscore']);
                exit();
            }

            http_response_code(200);
            echo json_encode([
                'message' => 'Highscore deleted successfully',
                'playerId' => $playerId
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete highscore']);
            error_log('Error deleting highscore: ' . $e->getMessage());
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        break;
}
?>