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

// ── Rate limiting ─────────────────────────────────────────────────────────────

function check_rate_limit(PDO $db, string $endpoint, int $maxHits = 10, int $windowSec = 900): void {
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR']
       ?? $_SERVER['REMOTE_ADDR']
       ?? '0.0.0.0';
    $ip = trim(explode(',', $ip)[0]); // take first IP if behind proxy

    // Prune expired windows
    $db->prepare(
        'DELETE FROM hs_rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL ? SECOND)'
    )->execute([$windowSec]);

    $row = $db->prepare(
        'SELECT id, hits FROM hs_rate_limits
         WHERE ip=? AND endpoint=? AND window_start >= DATE_SUB(NOW(), INTERVAL ? SECOND)'
    );
    $row->execute([$ip, $endpoint, $windowSec]);
    $existing = $row->fetch();

    if ($existing) {
        if ((int)$existing['hits'] >= $maxHits) fail('Too many requests — please wait before trying again', 429);
        $db->prepare('UPDATE hs_rate_limits SET hits = hits + 1 WHERE id=?')->execute([$existing['id']]);
    } else {
        $db->prepare(
            'INSERT INTO hs_rate_limits (ip, endpoint, hits, window_start) VALUES (?,?,1,NOW())'
        )->execute([$ip, $endpoint]);
    }
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

}

function init_global_research(PDO $db, int $playerId): void {
    $stmt = $db->prepare(
        'INSERT IGNORE INTO hs_global_research (player_id, building_key, level) VALUES (?,?,0)'
    );
    foreach (['star_map', 'interstellar_comm'] as $key) {
        $stmt->execute([$playerId, $key]);
    }
}

// ── System contacts & comm delivery ──────────────────────────────────────────

function init_system_contacts(PDO $db, int $playerId, int $homeSystemId): void {
    $db->prepare(
        "INSERT IGNORE INTO hs_system_contacts (player_id, system_id, scan_state) VALUES (?,?,'scanned')"
    )->execute([$playerId, $homeSystemId]);
}

function resolve_system_contacts(PDO $db, int $playerId): void {
    $db->prepare(
        "UPDATE hs_system_contacts
         SET scan_state='scanned', scan_ends_at=NULL
         WHERE player_id=? AND scan_state='scanning' AND scan_ends_at IS NOT NULL AND scan_ends_at <= NOW()"
    )->execute([$playerId]);
}

function resolve_comm_deliveries(PDO $db, int $playerId): void {
    // Find in-transit messages from other players targeting systems where this player owns planets
    $pending = $db->prepare(
        "SELECT cl.id, cl.player_id AS sender_id, cl.message_key, cl.travel_ends_at
         FROM hs_comm_log cl
         WHERE cl.direction = 'sent'
           AND cl.travel_ends_at IS NOT NULL
           AND cl.travel_ends_at <= NOW()
           AND cl.player_id != ?
           AND cl.system_id IN (
               SELECT p.system_id FROM hs_planets p
               JOIN hs_planet_ownership po ON po.planet_id = p.id
               WHERE po.player_id = ?
           )
           AND NOT EXISTS (
               SELECT 1 FROM hs_comm_log r
               WHERE r.sent_msg_id = cl.id AND r.player_id = ?
           )"
    );
    $pending->execute([$playerId, $playerId, $playerId]);

    // Always use the sender's home system as the conversation bucket
    $senderHomeStmt = $db->prepare(
        'SELECT p.system_id
         FROM hs_planet_ownership po
         JOIN hs_planets p ON p.id = po.planet_id
         WHERE po.player_id = ? AND po.is_home = 1
         LIMIT 1'
    );
    $insertStmt = $db->prepare(
        "INSERT INTO hs_comm_log (player_id, system_id, direction, message_key, from_player_id, sent_msg_id)
         VALUES (?,?,'received',?,?,?)"
    );
    $cleanupStmt = $db->prepare(
        "DELETE FROM hs_comm_log
         WHERE player_id = ? AND system_id = ?
         AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM hs_comm_log
             WHERE player_id = ? AND system_id = ?
             ORDER BY created_at DESC
             LIMIT 10
           ) AS recent
         )"
    );

    foreach ($pending->fetchAll() as $msg) {
        $senderHomeStmt->execute([(int)$msg['sender_id']]);
        $senderSystemId = $senderHomeStmt->fetchColumn();
        if (!$senderSystemId) continue;
        $insertStmt->execute([
            $playerId, (int)$senderSystemId,
            $msg['message_key'], (int)$msg['sender_id'], (int)$msg['id'],
        ]);
        // Keep only the last 10 messages per player+system conversation
        $cleanupStmt->execute([$playerId, (int)$senderSystemId, $playerId, (int)$senderSystemId]);
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

// ── Power battery (grid uptime) ───────────────────────────────────────────────

function ensure_power_battery(PDO $db, int $planetId, int $playerId): void {
    static $tableReady = false;
    if (!$tableReady) {
        try {
            $db->exec(
                'CREATE TABLE IF NOT EXISTS hs_power_battery (
                   planet_id INT NOT NULL,
                   player_id INT NOT NULL,
                   charge FLOAT NOT NULL DEFAULT 100,
                   charge_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   PRIMARY KEY (planet_id, player_id)
                 )'
            );
        } catch (\Throwable $e) {}
        $tableReady = true;
    }
    // Create the row full on first sight (anchored now) so building a power_plant
    // does not immediately black out the colony.
    $db->prepare(
        'INSERT IGNORE INTO hs_power_battery (planet_id, player_id, charge, charge_updated_at)
         VALUES (?,?,?, NOW())'
    )->execute([$planetId, $playerId, POWER_BATTERY_MAX]);
}

// Current *completed* power_plant level. Deliberately ignores build_ends_at so an
// in-progress upgrade (e.g. Lv2 → Lv3) keeps the battery on the current level (Lv2)
// until the upgrade actually finishes — charging stays independent of the upgrade.
function power_plant_level(PDO $db, int $planetId, int $playerId): int {
    $s = $db->prepare(
        'SELECT level FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND building_key=?'
    );
    $s->execute([$planetId, $playerId, 'power_plant']);
    return (int)($s->fetchColumn() ?: 0);
}

// Live battery state for the API. Returns null when there is no power_plant
// (battery mechanic inactive). Charge is derived from the stored value + elapsed
// time since the last write, so it is always current without needing a resolve.
function battery_state(PDO $db, int $planetId, int $playerId): ?array {
    $ppLevel = power_plant_level($db, $planetId, $playerId);
    if ($ppLevel <= 0) return null;

    ensure_power_battery($db, $planetId, $playerId);

    $row = $db->prepare(
        'SELECT charge, TIMESTAMPDIFF(SECOND, charge_updated_at, NOW()) AS elapsed
         FROM hs_power_battery WHERE planet_id=? AND player_id=?'
    );
    $row->execute([$planetId, $playerId]);
    $b = $row->fetch();

    $drainPerHour = battery_drain_per_hour($ppLevel);
    $stored  = $b ? (float)$b['charge'] : POWER_BATTERY_MAX;
    $elapsed = $b ? max(0, (int)$b['elapsed']) : 0;
    $charge  = max(0.0, $stored - $drainPerHour * ($elapsed / 3600.0));

    return [
        'charge'          => round($charge, 2),
        'drainPerHour'    => $drainPerHour,
        'powerPlantLevel' => $ppLevel,
        'gridDown'        => $charge <= 0,
        'hoursToEmpty'    => $drainPerHour > 0 ? round($charge / $drainPerHour, 2) : null,
    ];
}

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

    // ── Grid uptime: production only accrues while the battery had charge ─────────
    // Use the completed power_plant level (ignores in-progress upgrades) so the
    // battery keeps gating even while the plant is being upgraded.
    $ppLevel     = power_plant_level($db, $planetId, $playerId);
    $gridElapsed = $elapsed;
    if ($ppLevel > 0) {
        ensure_power_battery($db, $planetId, $playerId);
        $brow = $db->prepare(
            'SELECT charge, UNIX_TIMESTAMP(charge_updated_at) AS t0
             FROM hs_power_battery WHERE planet_id=? AND player_id=?'
        );
        $brow->execute([$planetId, $playerId]);
        $bb = $brow->fetch();
        if ($bb) {
            $drainPerHour = battery_drain_per_hour($ppLevel);
            $secToDead    = $drainPerHour > 0 ? ((float)$bb['charge'] / $drainPerHour) * 3600.0 : PHP_INT_MAX;
            $deadAt       = (int)$bb['t0'] + (int)$secToDead;   // epoch when battery hits 0
            $nowTs        = time();
            $startTs      = $nowTs - $elapsed;                  // = resources_computed_at (capped)
            $gridElapsed  = max(0, min($nowTs, $deadAt) - $startTs);
            $gridElapsed  = min($gridElapsed, $elapsed);
        }
    }

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
        $newVal        = $current + ($production[$res] ?? 0) * $gridElapsed / 60.0;
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
