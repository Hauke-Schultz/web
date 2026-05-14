<?php
/**
 * Shared bootstrap for all /api/star/* endpoints.
 * Include this at the top of every endpoint file.
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/../db.php';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(mixed $data = null, int $status = 200): never {
    http_response_code($status);
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400): never {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array {
    static $parsed = null;
    if ($parsed === null) {
        $raw    = file_get_contents('php://input');
        $parsed = json_decode($raw, true) ?? [];
    }
    return $parsed;
}

function method(string ...$allowed): void {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
    if (!in_array($_SERVER['REQUEST_METHOD'], $allowed, true)) fail('Method not allowed', 405);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function jwt_secret(): string {
    $configFile = __DIR__ . '/../db.config.php';
    if (file_exists($configFile) && !getenv('DB_HOST')) require_once $configFile;
    return defined('JWT_SECRET') ? JWT_SECRET : (getenv('JWT_SECRET') ?: 'dev-secret');
}

function auth(): array {
    // HTTP_AUTHORIZATION may be in REDIRECT_ namespace after mod_rewrite,
    // or available via getallheaders() — check all three locations.
    $header = $_SERVER['HTTP_AUTHORIZATION']
           ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
           ?? (function_exists('getallheaders') ? (getallheaders()['Authorization'] ?? '') : '');
    if (!str_starts_with($header, 'Bearer ')) fail('Unauthorized', 401);
    $token   = substr($header, 7);
    $payload = jwt_verify($token, jwt_secret());
    if (!$payload) fail('Unauthorized', 401);
    return $payload;
}

// ── Planet initialization (called on first colonization) ──────────────────────

function init_planet(PDO $db, int $planetId, int $playerId, bool $isHome): void {
    // Planet grid slots (from hawkStarConfig PLANET_GRID)
    $grid = [
        ['slot' => 1,  'startsUnlocked' => false],
        ['slot' => 2,  'startsUnlocked' => false],
        ['slot' => 3,  'startsUnlocked' => false],
        ['slot' => 4,  'startsUnlocked' => false],
        ['slot' => 5,  'startsUnlocked' => true ],  // base — always unlocked
        ['slot' => 6,  'startsUnlocked' => false],
        ['slot' => 7,  'startsUnlocked' => false],
        ['slot' => 8,  'startsUnlocked' => false],
        ['slot' => 9,  'startsUnlocked' => false],
        ['slot' => 10, 'startsUnlocked' => false],
        ['slot' => 11, 'startsUnlocked' => false],
        ['slot' => 12, 'startsUnlocked' => false],
    ];
    $slotStmt = $db->prepare(
        'INSERT IGNORE INTO hs_planet_slots (planet_id, player_id, slot_index, unlocked) VALUES (?,?,?,?)'
    );
    foreach ($grid as $s) {
        $slotStmt->execute([$planetId, $playerId, $s['slot'], $s['startsUnlocked'] ? 1 : 0]);
    }

    // Starting resources
    $metal      = $isHome ? 400 : 200;
    $crystal    = $isHome ? 180 : 80;
    $population = $isHome ? 20  : 15;
    $db->prepare(
        'INSERT IGNORE INTO hs_planet_resources
         (planet_id, player_id, metal, crystal, population, resources_computed_at)
         VALUES (?,?,?,?,?, NOW())'
    )->execute([$planetId, $playerId, $metal, $crystal, $population]);

    // Command center starts at level 1 (free, instant on home planet)
    if ($isHome) {
        $db->prepare(
            'INSERT IGNORE INTO hs_buildings (planet_id, player_id, building_key, level)
             VALUES (?,?,?,?)'
        )->execute([$planetId, $playerId, 'command_center', 1]);
        // Unlock slots 2 and 4 (command_center lv1 unlocks)
        $db->prepare(
            'UPDATE hs_planet_slots SET unlocked=1
             WHERE planet_id=? AND player_id=? AND slot_index IN (2,4)'
        )->execute([$planetId, $playerId]);
    }
}

function init_global_research(PDO $db, int $playerId): void {
    $stmt = $db->prepare(
        'INSERT IGNORE INTO hs_global_research (player_id, building_key, level) VALUES (?,?,0)'
    );
    foreach (['star_map', 'interstellar_comm'] as $key) {
        $stmt->execute([$playerId, $key]);
    }
}

// ── Timer resolution ──────────────────────────────────────────────────────────

function resolve_timers(PDO $db, int $planetId, int $playerId): void {
    resolve_buildings($db, $planetId, $playerId);
    resolve_global_research($db, $playerId);
    resolve_missions($db, $playerId);
    resolve_conversions($db, $planetId, $playerId);
}

function resolve_buildings(PDO $db, int $planetId, int $playerId): void {
    $done = $db->prepare(
        'SELECT building_key, level FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND build_ends_at IS NOT NULL AND build_ends_at <= NOW()'
    );
    $done->execute([$planetId, $playerId]);

    foreach ($done->fetchAll() as $b) {
        $key      = $b['building_key'];
        $newLevel = (int)$b['level'] + 1;

        $db->prepare(
            'UPDATE hs_buildings SET level=?, build_ends_at=NULL
             WHERE planet_id=? AND player_id=? AND building_key=?'
        )->execute([$newLevel, $planetId, $playerId, $key]);

        $levelDef = level_def($key, $newLevel);
        if (!empty($levelDef['unlocks'])) {
            $unlockStmt = $db->prepare(
                'UPDATE hs_planet_slots SET unlocked=1
                 WHERE planet_id=? AND player_id=? AND slot_index=?'
            );
            foreach ($levelDef['unlocks'] as $u) {
                $unlockStmt->execute([$planetId, $playerId, $u['slot']]);
            }
        }

        $popBonus = $levelDef['popBonus'] ?? 0;
        if ($popBonus > 0) {
            $db->prepare(
                'UPDATE hs_planet_resources SET population = population + ?
                 WHERE planet_id=? AND player_id=?'
            )->execute([$popBonus, $planetId, $playerId]);
        }
    }
}

function resolve_global_research(PDO $db, int $playerId): void {
    $done = $db->prepare(
        'SELECT building_key, level FROM hs_global_research
         WHERE player_id=? AND build_ends_at IS NOT NULL AND build_ends_at <= NOW()'
    );
    $done->execute([$playerId]);

    foreach ($done->fetchAll() as $r) {
        $db->prepare(
            'UPDATE hs_global_research SET level=?, build_ends_at=NULL
             WHERE player_id=? AND building_key=?'
        )->execute([(int)$r['level'] + 1, $playerId, $r['building_key']]);
    }
}

function resolve_missions(PDO $db, int $playerId): void {
    $done = $db->prepare(
        "SELECT id, type, from_planet_id, to_planet_id
         FROM hs_missions WHERE player_id=? AND status='in_flight' AND ends_at <= NOW()"
    );
    $done->execute([$playerId]);

    foreach ($done->fetchAll() as $m) {
        $missionId = (int)$m['id'];
        $toId      = (int)$m['to_planet_id'];

        if ($m['type'] === 'colony_ship') {
            $alreadyOwned = $db->prepare('SELECT id FROM hs_planet_ownership WHERE planet_id=?');
            $alreadyOwned->execute([$toId]);
            if (!$alreadyOwned->fetch()) {
                $db->prepare(
                    'INSERT INTO hs_planet_ownership (planet_id, player_id, is_home, colonized_at)
                     VALUES (?,?,0,NOW())'
                )->execute([$toId, $playerId]);
                init_planet($db, $toId, $playerId, false);
            }
        }

        $db->prepare("UPDATE hs_missions SET status='done' WHERE id=?")->execute([$missionId]);
    }
}

function resolve_conversions(PDO $db, int $planetId, int $playerId): void {
    $done = $db->prepare(
        'SELECT id, building_key, recipe_index, remaining
         FROM hs_conversion_queues
         WHERE planet_id=? AND player_id=? AND ends_at <= NOW()'
    );
    $done->execute([$planetId, $playerId]);

    foreach ($done->fetchAll() as $q) {
        $def    = building_def($q['building_key']);
        $recipe = $def['conversions'][$q['recipe_index']] ?? null;
        if (!$recipe) {
            $db->prepare('DELETE FROM hs_conversion_queues WHERE id=?')->execute([$q['id']]);
            continue;
        }

        foreach ($recipe['output'] as $res => $amt) {
            $db->prepare(
                "UPDATE hs_planet_resources SET $res = $res + ? WHERE planet_id=? AND player_id=?"
            )->execute([$amt, $planetId, $playerId]);
        }

        if ((int)$q['remaining'] > 0) {
            $lvlRow = $db->prepare('SELECT level FROM hs_buildings WHERE planet_id=? AND player_id=? AND building_key=?');
            $lvlRow->execute([$planetId, $playerId, $q['building_key']]);
            $bLevel   = max(1, (int)$lvlRow->fetchColumn());
            $duration = max(1, (int)ceil($recipe['durationBase'] / $bLevel));

            $db->prepare(
                'UPDATE hs_conversion_queues SET remaining = remaining - 1,
                 ends_at = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id=?'
            )->execute([$duration, $q['id']]);
        } else {
            $db->prepare('DELETE FROM hs_conversion_queues WHERE id=?')->execute([$q['id']]);
        }
    }
}

// ── Lazy resource computation ─────────────────────────────────────────────────

function compute_resources(PDO $db, int $planetId, int $playerId, string $planetType): void {
    $row = $db->prepare(
        'SELECT *, TIMESTAMPDIFF(SECOND, resources_computed_at, NOW()) AS elapsed
         FROM hs_planet_resources WHERE planet_id=? AND player_id=?'
    );
    $row->execute([$planetId, $playerId]);
    $r = $row->fetch();
    if (!$r || $r['elapsed'] < 1) return;

    $elapsed = min((int)$r['elapsed'], 86400);

    $bRows = $db->prepare(
        'SELECT building_key, level FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND level>0 AND build_ends_at IS NULL'
    );
    $bRows->execute([$planetId, $playerId]);
    $levels = [];
    foreach ($bRows->fetchAll() as $b) $levels[$b['building_key']] = (int)$b['level'];

    $energyProd  = 0;
    $energyDrain = 0;
    foreach ($levels as $key => $lvl) {
        $def = level_def($key, $lvl);
        if (!$def) continue;
        $energyProd  += $def['production']['energy'] ?? 0;
        $energyDrain += $def['energyDrain'] ?? 0;
    }
    $energyOk = ($energyProd - $energyDrain) >= 0;

    $production = [];
    foreach ($levels as $key => $lvl) {
        $def = level_def($key, $lvl);
        if (!$def) continue;
        foreach (($def['production'] ?? []) as $res => $rate) {
            if ($res === 'energy') continue;
            if (!$energyOk) continue;
            $production[$res] = ($production[$res] ?? 0) + $rate;
        }
    }

    $caps = [];
    foreach ($levels as $key => $lvl) {
        $def = level_def($key, $lvl);
        if (!$def) continue;
        foreach (($def['storageCapacity'] ?? []) as $res => $cap) {
            $caps[$res] = ($caps[$res] ?? 0) + $cap;
        }
    }

    $updates = [];
    foreach (RESOURCE_KEYS as $res) {
        if ($res === 'population') continue;
        $current       = (float)($r[$res] ?? 0);
        $newVal        = $current + ($production[$res] ?? 0) * $elapsed;
        if (isset($caps[$res])) $newVal = min($newVal, $caps[$res]);
        $updates[$res] = max(0, $newVal);
    }
    $updates['population'] = (float)$r['population'];

    $sets   = array_map(fn($k) => "$k = ?", array_keys($updates));
    $sets[] = 'resources_computed_at = NOW()';
    $vals   = [...array_values($updates), $planetId, $playerId];

    $db->prepare(
        'UPDATE hs_planet_resources SET ' . implode(', ', $sets) . ' WHERE planet_id=? AND player_id=?'
    )->execute($vals);
}
