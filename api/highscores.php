<?php
/**
 * Highscore API – MySQL-Backend
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://haukeschultz.com');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

define('MAX_HIGHSCORES', 100);

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToHighscore(array $row, int $rank): array {
    return [
        'playerId' => $row['player_id'],
        'name'     => $row['name'],
        'level'    => (int)$row['level'],
        'date'     => $row['game_date'],
        'emoji'    => $row['emoji'],
        'status'   => $row['status'],
        'rank'     => $rank,
    ];
}

/** Lädt alle Scores sortiert nach Level, berechnet Ränge on-the-fly */
function loadHighscores(): array {
    $rows = getDB()->query('SELECT * FROM highscores ORDER BY level DESC LIMIT ' . MAX_HIGHSCORES)->fetchAll();
    return array_map(fn($row, $i) => rowToHighscore($row, $i + 1), $rows, array_keys($rows));
}

/** Aktualisiert den gespeicherten Rang aller Einträge (nach einem Schreibvorgang) */
function rerank(): void {
    $db   = getDB();
    $rows = $db->query('SELECT player_id FROM highscores ORDER BY level DESC')->fetchAll();
    $stmt = $db->prepare('UPDATE highscores SET `rank` = ? WHERE player_id = ?');
    foreach ($rows as $i => $row) {
        $stmt->execute([$i + 1, $row['player_id']]);
    }
}

function validateHighscoreData(array $data): array {
    $errors = [];
    if (!isset($data['playerId']) || empty(trim($data['playerId'])))  $errors[] = 'playerId is required';
    if (!isset($data['name'])     || empty(trim($data['name'])))      $errors[] = 'name is required';
    if (isset($data['name'])      && mb_strlen($data['name']) > 20)   $errors[] = 'name too long (max 20 characters)';
    if (!isset($data['level'])    || !is_numeric($data['level']))      $errors[] = 'level must be a number';
    if (isset($data['level'])     && $data['level'] < 0)              $errors[] = 'level must be positive';
    return $errors;
}

// ── Routing ───────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'GET':
        try {
            echo json_encode(loadHighscores());
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to load highscores']);
            error_log('HS GET error: ' . $e->getMessage());
        }
        break;

    case 'POST':
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if ($data === null) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); exit(); }

            $errors = validateHighscoreData($data);
            if (!empty($errors)) { http_response_code(400); echo json_encode(['error' => 'Validation failed', 'details' => $errors]); exit(); }

            $playerId = trim($data['playerId']);
            $name     = trim($data['name']);
            $level    = (int)$data['level'];
            $date     = $data['date'] ?? date('Y-m-d');

            $db   = getDB();
            $stmt = $db->prepare('SELECT level FROM highscores WHERE player_id = ?');
            $stmt->execute([$playerId]);
            $existing = $stmt->fetch();

            if ($existing && (int)$existing['level'] >= $level) {
                // Bestehender Score ist besser oder gleich
                $highscores = loadHighscores();
                $rank = 0;
                foreach ($highscores as $hs) {
                    if ($hs['playerId'] === $playerId) { $rank = $hs['rank']; break; }
                }
                echo json_encode(['message' => 'Existing score is better', 'rank' => $rank, 'highscores' => $highscores]);
                exit();
            }

            $db->prepare("
                INSERT INTO highscores (player_id, name, level, game_date, emoji, status, `rank`)
                VALUES (?, ?, ?, ?, '', 'normal', 0)
                ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), game_date = VALUES(game_date)
            ")->execute([$playerId, $name, $level, $date]);

            rerank();
            $highscores = loadHighscores();
            $rank = 0;
            foreach ($highscores as $hs) {
                if ($hs['playerId'] === $playerId) { $rank = $hs['rank']; break; }
            }

            echo json_encode(['message' => 'Highscore saved successfully', 'rank' => $rank, 'highscores' => $highscores]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save highscore']);
            error_log('HS POST error: ' . $e->getMessage());
        }
        break;

    case 'PUT':
        try {
            $data = json_decode(file_get_contents('php://input'), true);
            if ($data === null) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); exit(); }

            if (empty(trim($data['playerId'] ?? ''))) { http_response_code(400); echo json_encode(['error' => 'playerId is required']); exit(); }
            if (empty(trim($data['name'] ?? '')))     { http_response_code(400); echo json_encode(['error' => 'name is required']); exit(); }
            if (!is_numeric($data['level'] ?? null) || $data['level'] < 0) { http_response_code(400); echo json_encode(['error' => 'level must be a non-negative number']); exit(); }
            if (mb_strlen($data['name']) > 20) { http_response_code(400); echo json_encode(['error' => 'name too long (max 20 characters)']); exit(); }

            $playerId = trim($data['playerId']);
            $name     = trim($data['name']);
            $level    = (int)$data['level'];
            $emoji    = mb_substr(trim($data['emoji'] ?? ''), 0, 10);
            $status   = $data['status'] ?? '';

            $allowed = ['normal', 'underReview', 'disqualified'];
            if (!empty($status) && !in_array($status, $allowed)) {
                http_response_code(400); echo json_encode(['error' => 'Invalid status']); exit();
            }

            $db   = getDB();
            $stmt = $db->prepare('SELECT player_id, status FROM highscores WHERE player_id = ?');
            $stmt->execute([$playerId]);
            if (!$stmt->fetch()) { http_response_code(404); echo json_encode(['error' => 'Highscore not found']); exit(); }

            $db->prepare("
                UPDATE highscores SET name = ?, level = ?, emoji = ?, status = COALESCE(NULLIF(?, ''), status)
                WHERE player_id = ?
            ")->execute([$name, $level, $emoji, $status ?: null, $playerId]);

            rerank();
            echo json_encode(['message' => 'Highscore updated successfully', 'highscores' => loadHighscores()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update highscore']);
            error_log('HS PUT error: ' . $e->getMessage());
        }
        break;

    case 'DELETE':
        try {
            if (empty(trim($_GET['playerId'] ?? ''))) {
                http_response_code(400); echo json_encode(['error' => 'playerId parameter is required']); exit();
            }
            $playerId = trim($_GET['playerId']);
            $db   = getDB();
            $stmt = $db->prepare('DELETE FROM highscores WHERE player_id = ?');
            $stmt->execute([$playerId]);
            if ($stmt->rowCount() === 0) { http_response_code(404); echo json_encode(['error' => 'Highscore not found']); exit(); }
            rerank();
            echo json_encode(['message' => 'Highscore deleted successfully', 'playerId' => $playerId]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete highscore']);
            error_log('HS DELETE error: ' . $e->getMessage());
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
