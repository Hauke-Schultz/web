<?php
/**
 * Highscore API – JSON file backend
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://haukeschultz.com');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

define('HS_FILE',        __DIR__ . '/highscores.json');
define('MAX_HIGHSCORES', 100);

// ── Helpers ───────────────────────────────────────────────────────────────────

function readScores(): array {
    if (!file_exists(HS_FILE)) return [];
    $raw = file_get_contents(HS_FILE);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function writeScores(array $scores): void {
    file_put_contents(HS_FILE, json_encode($scores, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function rerank(array $scores): array {
    usort($scores, fn($a, $b) => $b['level'] <=> $a['level']);
    $scores = array_slice($scores, 0, MAX_HIGHSCORES);
    foreach ($scores as $i => &$entry) {
        $entry['rank'] = $i + 1;
    }
    return $scores;
}

function validateData(array $data): array {
    $errors = [];
    if (empty(trim($data['playerId'] ?? ''))) $errors[] = 'playerId is required';
    if (empty(trim($data['name']     ?? ''))) $errors[] = 'name is required';
    if (isset($data['name']) && mb_strlen($data['name']) > 20) $errors[] = 'name too long (max 20 characters)';
    if (!isset($data['level']) || !is_numeric($data['level'])) $errors[] = 'level must be a number';
    if (isset($data['level']) && $data['level'] < 0)           $errors[] = 'level must be positive';
    return $errors;
}

// ── Routing ───────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'GET':
        echo json_encode(readScores());
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if ($data === null) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); exit(); }

        $errors = validateData($data);
        if (!empty($errors)) { http_response_code(400); echo json_encode(['error' => 'Validation failed', 'details' => $errors]); exit(); }

        $playerId = trim($data['playerId']);
        $name     = trim($data['name']);
        $level    = (int)$data['level'];
        $date     = $data['date'] ?? date('Y-m-d');

        $scores   = readScores();
        $idx      = array_search($playerId, array_column($scores, 'playerId'));

        if ($idx !== false && (int)$scores[$idx]['level'] >= $level) {
            echo json_encode(['message' => 'Existing score is better', 'rank' => $scores[$idx]['rank'], 'highscores' => $scores]);
            exit();
        }

        if ($idx !== false) {
            $scores[$idx]['name']  = $name;
            $scores[$idx]['level'] = $level;
            $scores[$idx]['date']  = $date;
        } else {
            $scores[] = ['playerId' => $playerId, 'name' => $name, 'level' => $level, 'date' => $date, 'emoji' => '', 'status' => 'normal', 'rank' => 0];
        }

        $scores = rerank($scores);
        writeScores($scores);

        $rank = 0;
        foreach ($scores as $hs) { if ($hs['playerId'] === $playerId) { $rank = $hs['rank']; break; } }

        echo json_encode(['message' => 'Highscore saved successfully', 'rank' => $rank, 'highscores' => $scores]);
        break;

    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        if ($data === null) { http_response_code(400); echo json_encode(['error' => 'Invalid JSON']); exit(); }

        $errors = validateData($data);
        if (!empty($errors)) { http_response_code(400); echo json_encode(['error' => 'Validation failed', 'details' => $errors]); exit(); }

        $allowed = ['normal', 'underReview', 'disqualified'];
        $status  = $data['status'] ?? '';
        if (!empty($status) && !in_array($status, $allowed)) { http_response_code(400); echo json_encode(['error' => 'Invalid status']); exit(); }

        $playerId = trim($data['playerId']);
        $scores   = readScores();
        $idx      = array_search($playerId, array_column($scores, 'playerId'));

        if ($idx === false) { http_response_code(404); echo json_encode(['error' => 'Highscore not found']); exit(); }

        $scores[$idx]['name']  = trim($data['name']);
        $scores[$idx]['level'] = (int)$data['level'];
        $scores[$idx]['emoji'] = mb_substr(trim($data['emoji'] ?? ''), 0, 10);
        if (!empty($status)) $scores[$idx]['status'] = $status;

        $scores = rerank($scores);
        writeScores($scores);

        echo json_encode(['message' => 'Highscore updated successfully', 'highscores' => $scores]);
        break;

    case 'DELETE':
        if (empty(trim($_GET['playerId'] ?? ''))) { http_response_code(400); echo json_encode(['error' => 'playerId parameter is required']); exit(); }

        $playerId = trim($_GET['playerId']);
        $scores   = readScores();
        $idx      = array_search($playerId, array_column($scores, 'playerId'));

        if ($idx === false) { http_response_code(404); echo json_encode(['error' => 'Highscore not found']); exit(); }

        array_splice($scores, $idx, 1);
        $scores = rerank($scores);
        writeScores($scores);

        echo json_encode(['message' => 'Highscore deleted successfully', 'playerId' => $playerId]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
