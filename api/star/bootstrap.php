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

    // Starting resources — population stays tiny so the player must recruit
    // workers on the base tile. A colony starts with the awake part of the
    // colony ship's crew (COLONY_START_POP).
    $metal      = $isHome ? 400 : 200;
    $crystal    = $isHome ? 180 : 80;
    $population = $isHome ? 1 : COLONY_START_POP;
    $db->prepare(
        'INSERT IGNORE INTO hs_planet_resources
         (planet_id, player_id, metal, crystal, population, resources_computed_at)
         VALUES (?,?,?,?,?, NOW())'
    )->execute([$planetId, $playerId, $metal, $crystal, $population]);

    // Recruit pool: full on the home planet (instant first recruits), empty on a
    // fresh colony — its population has to grow at the normal rate from zero.
    ensure_recruit_pool($db, $planetId, $playerId);
    if (!$isHome) {
        $db->prepare(
            'UPDATE hs_recruit_pool SET pool=0, pool_updated_at=NOW()
             WHERE planet_id=? AND player_id=?'
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
    resolve_units($db, $planetId, $playerId);
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

// Population not tied up by a finished building — mirrors `freeWorkers` in
// useHawkStar.js. Used for crewed units (colony ship).
function free_workers(PDO $db, int $planetId, int $playerId): float {
    $popRow = $db->prepare('SELECT population FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
    $popRow->execute([$planetId, $playerId]);
    $population = (float)($popRow->fetchColumn() ?: 0);

    $bRows = $db->prepare(
        'SELECT building_key, level FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND level>0 AND build_ends_at IS NULL'
    );
    $bRows->execute([$planetId, $playerId]);

    $drain = 0.0;
    foreach ($bRows->fetchAll() as $b) {
        $def = level_def($b['building_key'], (int)$b['level']);
        $drain += (float)($def['staffDrain'] ?? 0);
    }
    return $population - $drain;
}

// ── Dock units (recon drone / colony ship inventory) ─────────────────────────

function ensure_units_table(PDO $db): void {
    static $tableReady = false;
    if ($tableReady) return;
    try {
        $db->exec(
            'CREATE TABLE IF NOT EXISTS hs_units (
               planet_id        INT NOT NULL,
               player_id        INT NOT NULL,
               unit_key         VARCHAR(64) NOT NULL,
               quantity         INT NOT NULL DEFAULT 0,
               build_ends_at    DATETIME NULL,
               build_started_at DATETIME NULL,
               PRIMARY KEY (planet_id, player_id, unit_key)
             )'
        );
    } catch (\Throwable $e) {}
    $tableReady = true;
}

// A finished unit build lands in the planet's inventory. Missions consume from
// there — a built dock alone is never enough to launch anything.
function resolve_units(PDO $db, int $planetId, int $playerId): void {
    ensure_units_table($db);
    $db->prepare(
        'UPDATE hs_units
         SET quantity = quantity + 1, build_ends_at = NULL, build_started_at = NULL
         WHERE planet_id=? AND player_id=? AND build_ends_at IS NOT NULL AND build_ends_at <= NOW()'
    )->execute([$planetId, $playerId]);
}

function units_state(PDO $db, int $planetId, int $playerId): array {
    ensure_units_table($db);
    $rows = $db->prepare(
        'SELECT unit_key, quantity, build_ends_at, build_started_at
         FROM hs_units WHERE planet_id=? AND player_id=?'
    );
    $rows->execute([$planetId, $playerId]);

    $units = [];
    foreach (array_keys(UNIT_COSTS) as $key) {
        $units[$key] = ['quantity' => 0, 'buildEndsAt' => null, 'buildStartedAt' => null];
    }
    foreach ($rows->fetchAll() as $u) {
        $units[$u['unit_key']] = [
            'quantity'       => (int)$u['quantity'],
            'buildEndsAt'    => $u['build_ends_at']    ? strtotime($u['build_ends_at'])    * 1000 : null,
            'buildStartedAt' => $u['build_started_at'] ? strtotime($u['build_started_at']) * 1000 : null,
        ];
    }
    return $units;
}

// Takes one unit out of the planet's inventory. Returns false when none is
// available (nothing built yet, or the last one is already in flight).
function consume_unit(PDO $db, int $planetId, int $playerId, string $unitKey): bool {
    ensure_units_table($db);
    $stmt = $db->prepare(
        'UPDATE hs_units SET quantity = quantity - 1
         WHERE planet_id=? AND player_id=? AND unit_key=? AND quantity > 0'
    );
    $stmt->execute([$planetId, $playerId, $unitKey]);
    return $stmt->rowCount() > 0;
}

// ── Cargo drone ───────────────────────────────────────────────────────────────

// One row per cargo drone in existence, keyed by its HOME planet. Created when
// the drone is built and never deleted — that is what enforces "one drone per
// planet" across production, dock and flight. `cargo` holds the JSON manifest,
// `mission_id` the flight the drone is currently on (NULL while docked).
function ensure_cargo_table(PDO $db): void {
    static $tableReady = false;
    if ($tableReady) return;
    try {
        $db->exec(
            'CREATE TABLE IF NOT EXISTS hs_cargo (
               planet_id  INT NOT NULL,
               player_id  INT NOT NULL,
               cargo      TEXT NULL,
               mission_id INT NULL,
               PRIMARY KEY (planet_id, player_id)
             )'
        );
    } catch (\Throwable $e) {}
    $tableReady = true;
}

// hs_missions predates the cargo drone: `type` is an ENUM that has to learn the
// new value, and the return leg needs a marker. Fresh installs get both from the
// schema; existing databases are migrated here on first access.
function migrate_cargo_missions(PDO $db): void {
    static $done = false;
    if ($done) return;
    $done = true;

    // One cheap probe — `leg` is added last, so its presence means both ran
    try {
        if ($db->query("SHOW COLUMNS FROM hs_missions LIKE 'leg'")->fetch()) return;
    } catch (\Throwable $e) { return; }

    try {
        $db->exec("ALTER TABLE hs_missions MODIFY type ENUM('recon_drone','colony_ship','cargo_drone') NOT NULL");
    } catch (\Throwable $e) {}
    try { $db->exec('ALTER TABLE hs_missions ADD COLUMN leg VARCHAR(8) NULL'); } catch (\Throwable $e) {}
}

// Espionage adds two mission types. This cannot ride along with the cargo
// migration above: that one bails out as soon as `leg` exists, which is true for
// every database migrated before espionage landed. So it probes the ENUM itself.
function migrate_spy_missions(PDO $db): void {
    static $done = false;
    if ($done) return;
    $done = true;

    try {
        $col = $db->query("SHOW COLUMNS FROM hs_missions LIKE 'type'")->fetch();
        if (!$col || str_contains((string)$col['Type'], 'spy_satellite')) return;
    } catch (\Throwable $e) { return; }

    try {
        $db->exec(
            "ALTER TABLE hs_missions
             MODIFY type ENUM('recon_drone','colony_ship','cargo_drone','spy_drone','spy_satellite') NOT NULL"
        );
    } catch (\Throwable $e) {}
}

// ── Espionage intel ───────────────────────────────────────────────────────────
// One row per (player, planet) the player has ever looked at. It stores WHAT was
// seen and WHEN — not a permission to read the live value. That distinction is
// the whole mechanic: a drone reports once and the report ages, while a
// satellite keeps the same row live until `satellite_until` passes.
function ensure_spy_intel_table(PDO $db): void {
    static $tableReady = false;
    if ($tableReady) return;
    $tableReady = true;

    try {
        $fresh = !$db->query("SHOW TABLES LIKE 'hs_spy_intel'")->fetch();
        $db->exec(
            'CREATE TABLE IF NOT EXISTS hs_spy_intel (
               player_id        INT NOT NULL,
               planet_id        INT NOT NULL,
               owner_player_id  INT NULL,
               owner_faction_id INT NULL,
               observed_at      DATETIME NOT NULL,
               satellite_until  DATETIME NULL,
               satellite_active TINYINT(1) NOT NULL DEFAULT 0,
               satellite_lost_at DATETIME NULL,
               shield_seen_at   DATETIME NULL,
               shield_charge    FLOAT NULL,
               PRIMARY KEY (player_id, planet_id)
             )'
        );

        // Every added column is probed and added ON ITS OWN. Grouping several
        // into one ALTER behind a single probe is what broke this table once:
        // a database that had picked up the first column of a pair skipped the
        // ALTER forever and never got the second, so the next query died on a
        // missing field. Column by column, a half-migrated table heals itself.
        //
        //   shield_seen_at / shield_charge — the shield reading carries its own
        //     timestamp, because a later drone flight refreshes `observed_at`
        //     without ever looking at the emitter.
        //   satellite_active — a satellite no longer expires, so "is it still up
        //     there" became a flag instead of a date comparison.
        //   satellite_lost_at — the outbox for "your satellite was destroyed".
        if (!$fresh) {
            $columns = [
                'shield_seen_at'    => 'DATETIME NULL',
                'shield_charge'     => 'FLOAT NULL',
                'satellite_active'  => 'TINYINT(1) NOT NULL DEFAULT 0',
                'satellite_lost_at' => 'DATETIME NULL',
            ];
            $added = [];
            foreach ($columns as $col => $ddl) {
                if ($db->query("SHOW COLUMNS FROM hs_spy_intel LIKE '$col'")->fetch()) continue;
                $db->exec("ALTER TABLE hs_spy_intel ADD COLUMN $col $ddl");
                $added[] = $col;
            }

            // Satellites that were still transmitting under the old 168 h rule
            // keep orbiting; ones that had already run out stay dead. Only on
            // the run that introduced the flag — afterwards it is the truth.
            if (in_array('satellite_active', $added, true)) {
                $db->exec(
                    'UPDATE hs_spy_intel SET satellite_active=1
                     WHERE satellite_until IS NOT NULL AND satellite_until > NOW()'
                );
            }
        }

        // Carry over anything spied before intel existed: those missions granted
        // a permanent live view, so the honest translation is "seen on arrival".
        if ($fresh) {
            $db->exec(
                "INSERT IGNORE INTO hs_spy_intel
                   (player_id, planet_id, owner_player_id, observed_at)
                 SELECT m.player_id, m.to_planet_id, po.player_id, m.ends_at
                 FROM hs_missions m
                 LEFT JOIN hs_planet_ownership po ON po.planet_id = m.to_planet_id
                 WHERE m.type='spy_drone' AND m.status='done'"
            );
        }
    } catch (\Throwable $e) {}
}

// The planetary shield as an outsider would measure it: null means there is
// nothing to measure — no owner, or an owner without a finished generator.
// Reading it needs the OWNER's id, since a shield belongs to a (planet, player)
// pair; the spying player never appears in this lookup.
function planet_shield_charge(PDO $db, int $planetId): ?float {
    $ownerRow = $db->prepare('SELECT player_id FROM hs_planet_ownership WHERE planet_id=?');
    $ownerRow->execute([$planetId]);
    $ownerId = $ownerRow->fetchColumn();
    if ($ownerId === false) return null;

    $shield = shield_state($db, $planetId, (int)$ownerId);
    return $shield ? (float)$shield['charge'] : null;
}

// The shield half of a report, as the galaxy endpoint serves it. Null means no
// satellite has ever looked — the drone does not carry that sensor. A live
// satellite reads the emitter right now; once it stops transmitting the last
// reading stays, dated to the moment it was taken.
function spy_shield_report(PDO $db, int $planetId, array $seen): ?array {
    if ($seen['live']) {
        return [
            'charge'     => planet_shield_charge($db, $planetId),
            'observedAt' => null,      // nothing to age while it is still watching
            'live'       => true,
        ];
    }
    if ($seen['shieldSeenAt'] === null) return null;

    return [
        'charge'     => $seen['shieldCharge'],
        'observedAt' => $seen['shieldSeenAt'],
        'live'       => false,
    ];
}

// Writes down what the planet looks like right now. Called when a spy mission
// lands — never anywhere else, or the report would silently follow the truth.
// `$satellite` marks the row as transmitting: it stays that way until an
// orbital defense shoots the thing down.
function record_spy_intel(PDO $db, int $playerId, int $planetId, bool $satellite = false): void {
    ensure_spy_intel_table($db);

    $ownerRow = $db->prepare('SELECT player_id FROM hs_planet_ownership WHERE planet_id=?');
    $ownerRow->execute([$planetId]);
    $ownerId = $ownerRow->fetchColumn();
    $ownerId = $ownerId === false ? null : (int)$ownerId;

    $factionRow = $db->prepare('SELECT faction_id FROM hs_npc_planet_ownership WHERE planet_id=?');
    $factionRow->execute([$planetId]);
    $factionId = $factionRow->fetchColumn();
    $factionId = $factionId === false ? null : (int)$factionId;

    // Only the satellite carries a sensor suite big enough for the shield: it
    // sits in the orbit and watches the emitter, where the drone makes one pass
    // and reads off who lives there. A null charge is a finding too — "no
    // generator on this rock" — which is why `shield_seen_at` is what marks the
    // reading as taken, never the value.
    if ($satellite) {
        $shieldCharge = planet_shield_charge($db, $planetId);

        // `satellite_until` is no longer an expiry — it records when this one was
        // placed, which is what the defender's target list shows.
        $db->prepare(
            'INSERT INTO hs_spy_intel
               (player_id, planet_id, owner_player_id, owner_faction_id, observed_at,
                satellite_until, satellite_active, shield_seen_at, shield_charge)
             VALUES (?,?,?,?, NOW(), NOW(), 1, NOW(), ?)
             ON DUPLICATE KEY UPDATE
               owner_player_id=VALUES(owner_player_id),
               owner_faction_id=VALUES(owner_faction_id),
               observed_at=NOW(),
               satellite_until=NOW(),
               satellite_active=1,
               shield_seen_at=NOW(),
               shield_charge=VALUES(shield_charge)'
        )->execute([$playerId, $planetId, $ownerId, $factionId, $shieldCharge]);
        return;
    }

    // A drone does not touch a running satellite's lifetime — it only refreshes
    // the observation, which a live satellite would be doing anyway.
    $db->prepare(
        'INSERT INTO hs_spy_intel
           (player_id, planet_id, owner_player_id, owner_faction_id, observed_at)
         VALUES (?,?,?,?, NOW())
         ON DUPLICATE KEY UPDATE
           owner_player_id=VALUES(owner_player_id),
           owner_faction_id=VALUES(owner_faction_id),
           observed_at=NOW()'
    )->execute([$playerId, $planetId, $ownerId, $factionId]);
}

// Everything this player knows about foreign planets, keyed by planet id.
// `live` means a satellite is still transmitting, in which case the caller
// should serve the CURRENT owner instead of the stored observation.
function spy_intel_map(PDO $db, int $playerId): array {
    ensure_spy_intel_table($db);

    $rows = $db->prepare(
        'SELECT planet_id, owner_player_id, owner_faction_id, shield_charge,
                UNIX_TIMESTAMP(observed_at) AS observed_ts,
                UNIX_TIMESTAMP(satellite_until) AS satellite_ts,
                UNIX_TIMESTAMP(shield_seen_at) AS shield_ts,
                satellite_active AS live
         FROM hs_spy_intel WHERE player_id=?'
    );
    $rows->execute([$playerId]);

    $map = [];
    foreach ($rows->fetchAll() as $r) {
        $map[(int)$r['planet_id']] = [
            'ownerPlayerId'  => $r['owner_player_id']  === null ? null : (int)$r['owner_player_id'],
            'ownerFactionId' => $r['owner_faction_id'] === null ? null : (int)$r['owner_faction_id'],
            'observedAt'     => (int)$r['observed_ts'] * 1000,
            // When this satellite was placed, not when it runs out — it does not.
            'satelliteSince' => $r['satellite_ts'] ? (int)$r['satellite_ts'] * 1000 : null,
            'live'           => (bool)$r['live'],
            // Satellite-only, and dated separately: null means no satellite has
            // ever looked, a set date with a null charge means it looked and
            // found no generator.
            'shieldSeenAt'   => $r['shield_ts'] ? (int)$r['shield_ts'] * 1000 : null,
            'shieldCharge'   => $r['shield_charge'] === null ? null : (float)$r['shield_charge'],
        ];
    }
    return $map;
}

// ── Orbital defense: finding and killing foreign satellites ───────────────────
// A satellite has no lifetime any more, so the thing that ends it is the planet
// it is watching. Detection is a building: without an `orbital_defense` the
// owner cannot see what is up there at all, which is what keeps a satellite
// worth placing on an undefended colony.

function orbital_defense_level(PDO $db, int $planetId, int $playerId): int {
    $s = $db->prepare(
        'SELECT level FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND building_key=? AND build_ends_at IS NULL'
    );
    $s->execute([$planetId, $playerId, 'orbital_defense']);
    return (int)($s->fetchColumn() ?: 0);
}

// Every foreign satellite currently transmitting from this planet's orbit, with
// the identity of whoever placed it: the wreck is identified, which is what
// turns being spied on into something a player can answer. Empty without the
// building — an undetected satellite is invisible, not merely unshootable.
function foreign_satellites(PDO $db, int $planetId, int $playerId): array {
    if (orbital_defense_level($db, $planetId, $playerId) <= 0) return [];
    ensure_spy_intel_table($db);

    // A read this small must never take down state.php, and it once did: a column
    // the migration had skipped turned every game load into a fatal error and the
    // whole game was unreachable over a satellite list. An empty orbit is a
    // survivable wrong answer; a white page is not.
    try {
        $rows = $db->prepare(
            'SELECT si.player_id, pl.username, pl.portrait,
                    UNIX_TIMESTAMP(si.satellite_until) AS placed_ts
             FROM hs_spy_intel si
             JOIN hs_players pl ON pl.id = si.player_id
             WHERE si.planet_id=? AND si.satellite_active=1 AND si.player_id<>?
             ORDER BY si.satellite_until ASC'
        );
        $rows->execute([$planetId, $playerId]);

        return array_map(fn($r) => [
            'playerId' => (int)$r['player_id'],
            'username' => $r['username'],
            'portrait' => $r['portrait'],
            'placedAt' => $r['placed_ts'] ? (int)$r['placed_ts'] * 1000 : null,
        ], $rows->fetchAll());
    } catch (\Throwable $e) {
        return [];
    }
}

// Shoots one down. The satellite transmitted right up to the moment it died, so
// its last frame is written into the report before the flag drops: the spy keeps
// what it saw, dated to the destruction, and it ages from there like any drone
// finding. Returns false when there was nothing to hit — a second click on a
// stale list must not burn the ammunition.
function destroy_spy_satellite(PDO $db, int $spyPlayerId, int $planetId): bool {
    ensure_spy_intel_table($db);

    $claim = $db->prepare(
        'UPDATE hs_spy_intel SET satellite_active=0
         WHERE player_id=? AND planet_id=? AND satellite_active=1'
    );
    $claim->execute([$spyPlayerId, $planetId]);
    if ($claim->rowCount() < 1) return false;

    $ownerRow = $db->prepare('SELECT player_id FROM hs_planet_ownership WHERE planet_id=?');
    $ownerRow->execute([$planetId]);
    $ownerId = $ownerRow->fetchColumn();

    $db->prepare(
        'UPDATE hs_spy_intel
         SET owner_player_id=?, observed_at=NOW(), shield_seen_at=NOW(), shield_charge=?,
             satellite_lost_at=NOW()
         WHERE player_id=? AND planet_id=?'
    )->execute([
        $ownerId === false ? null : (int)$ownerId,
        planet_shield_charge($db, $planetId),
        $spyPlayerId, $planetId,
    ]);

    return true;
}

// Losses this player has not been told about yet. `satellite_lost_at` doubles as
// the outbox: it is set when the satellite dies and cleared the moment the owner
// is handed the news, so the message is delivered exactly once without a
// notification table. Losing one has to be an event — the alternative is
// noticing weeks later that a chip quietly went missing from a list.
function lost_satellites(PDO $db, int $playerId): array {
    ensure_spy_intel_table($db);

    // Same guard as foreign_satellites(): state.php is the endpoint the entire
    // game hangs off, and a notification is not worth a fatal error.
    try {
        $rows = $db->prepare(
            'SELECT si.planet_id, p.name AS planet_name, s.name AS system_name,
                    UNIX_TIMESTAMP(si.satellite_lost_at) AS lost_ts
             FROM hs_spy_intel si
             JOIN hs_planets p      ON p.id = si.planet_id
             JOIN hs_star_systems s ON s.id = p.system_id
             WHERE si.player_id=? AND si.satellite_lost_at IS NOT NULL'
        );
        $rows->execute([$playerId]);
        $lost = $rows->fetchAll();
        if (!$lost) return [];

        $db->prepare(
            'UPDATE hs_spy_intel SET satellite_lost_at=NULL
             WHERE player_id=? AND satellite_lost_at IS NOT NULL'
        )->execute([$playerId]);

        return array_map(fn($r) => [
            'planetId'   => (int)$r['planet_id'],
            'planetName' => $r['planet_name'],
            'systemName' => $r['system_name'],
            'lostAt'     => (int)$r['lost_ts'] * 1000,
        ], $lost);
    } catch (\Throwable $e) {
        return [];
    }
}

// Distance between two star systems, in the same units the galaxy map uses.
function system_distance(PDO $db, int $aId, int $bId): float {
    $row = $db->prepare('SELECT id, x, y FROM hs_star_systems WHERE id IN (?,?)');
    $row->execute([$aId, $bId]);
    $pos = [];
    foreach ($row->fetchAll() as $s) $pos[(int)$s['id']] = [(float)$s['x'], (float)$s['y']];
    if (!isset($pos[$aId], $pos[$bId])) return 0.0;
    return sqrt(pow($pos[$aId][0] - $pos[$bId][0], 2) + pow($pos[$aId][1] - $pos[$bId][1], 2));
}

// One-way flight of a spy drone between two systems — signal speed, same curve
// as a deep-space scan, so the map's geometry means the same thing everywhere.
function spy_flight_seconds(PDO $db, int $fromSystemId, int $toSystemId): int {
    $dist = system_distance($db, $fromSystemId, $toSystemId);
    return max(SPY_FLIGHT_MIN, (int)round($dist * SPY_FLIGHT_PER_DIST));
}

// Every planet this player has ever looked at — whether the report is still
// current or long stale. Not a permission list: what is actually shown comes out
// of spy_intel_map().
function spied_planets(PDO $db, int $playerId): array {
    return array_keys(spy_intel_map($db, $playerId));
}

// Distance between two planets = how many orbits apart they are, minimum 1.
// Mirrors the inline calculation in mission/drone.php and mission/colony.php.
function planet_distance(PDO $db, int $systemId, int $fromId, int $toId): int {
    $order = $db->prepare('SELECT id FROM hs_planets WHERE system_id=? ORDER BY id ASC');
    $order->execute([$systemId]);
    $ids = array_column($order->fetchAll(), 'id');
    return max(1, abs((int)array_search($fromId, $ids) - (int)array_search($toId, $ids)));
}

// Live cargo state for the API. Returns null when this planet has no cargo drone
// at all — the frontend uses that to decide between "build" and "load".
function cargo_state(PDO $db, int $planetId, int $playerId): ?array {
    ensure_cargo_table($db);
    $row = $db->prepare('SELECT cargo, mission_id FROM hs_cargo WHERE planet_id=? AND player_id=?');
    $row->execute([$planetId, $playerId]);
    $c = $row->fetch();
    if (!$c) return null;

    $cargo = json_decode($c['cargo'] ?? '{}', true);
    if (!is_array($cargo)) $cargo = [];

    return [
        'cargo'     => (object)$cargo,   // cast so an empty hold serialises as {} not []
        'total'     => array_sum($cargo),
        'capacity'  => CARGO_CAPACITY,
        'missionId' => $c['mission_id'] !== null ? (int)$c['mission_id'] : null,
    ];
}

// Hands the manifest to whoever owns the target planet. An uncolonized target has
// no resource row to unload into, so the drone keeps its cargo and flies home with
// it rather than dropping the goods on an empty rock.
function deliver_cargo(PDO $db, int $targetPlanetId, array $cargo): bool {
    if (!$cargo) return true;

    $ownerRow = $db->prepare('SELECT player_id FROM hs_planet_ownership WHERE planet_id=?');
    $ownerRow->execute([$targetPlanetId]);
    $ownerId = $ownerRow->fetchColumn();
    if (!$ownerId) return false;

    foreach ($cargo as $res => $amt) {
        // Whitelisted at load time — re-checked here because the value reaches SQL
        if (!in_array($res, CARGO_LOADABLE, true) || $amt <= 0) continue;
        $db->prepare(
            "UPDATE hs_planet_resources SET $res = $res + ? WHERE planet_id=? AND player_id=?"
        )->execute([(int)$amt, $targetPlanetId, (int)$ownerId]);
    }
    return true;
}

function resolve_missions(PDO $db, int $playerId): void {
    migrate_cargo_missions($db);
    migrate_spy_missions($db);

    $done = $db->prepare(
        "SELECT id, type, from_planet_id, to_planet_id, leg
         FROM hs_missions WHERE player_id=? AND status='in_flight' AND ends_at <= NOW()"
    );
    $done->execute([$playerId]);

    foreach ($done->fetchAll() as $m) {
        $missionId = (int)$m['id'];
        $toId      = (int)$m['to_planet_id'];
        $fromId    = (int)$m['from_planet_id'];

        if ($m['type'] === 'cargo_drone') {
            ensure_cargo_table($db);

            if ($m['leg'] === 'back') {
                // Landed at home: the drone re-enters the dock, ready to load again
                ensure_units_table($db);
                $db->prepare(
                    "INSERT INTO hs_units (planet_id, player_id, unit_key, quantity)
                     VALUES (?,?,'cargo_drone',1)
                     ON DUPLICATE KEY UPDATE quantity = quantity + 1"
                )->execute([$toId, $playerId]);
                // Only the flight ends here. The hold was already emptied on
                // delivery — clearing it again would destroy the cargo of a drone
                // that came home still loaded (refused delivery, see below).
                $db->prepare(
                    'UPDATE hs_cargo SET mission_id=NULL WHERE planet_id=? AND player_id=?'
                )->execute([$toId, $playerId]);
            } else {
                // Arrived at the target: unload, then start the empty return leg.
                // The cargo row is keyed by the drone's home planet ($fromId).
                $cargoRow = $db->prepare('SELECT cargo FROM hs_cargo WHERE planet_id=? AND player_id=?');
                $cargoRow->execute([$fromId, $playerId]);
                $cargo = json_decode($cargoRow->fetchColumn() ?: '{}', true);
                if (!is_array($cargo)) $cargo = [];

                $delivered = deliver_cargo($db, $toId, $cargo);

                $sysRow = $db->prepare('SELECT system_id FROM hs_planets WHERE id=?');
                $sysRow->execute([$fromId]);
                $systemId   = (int)$sysRow->fetchColumn();
                $flightTime = UNIT_COSTS['cargo_drone']['flightTimeBase']
                            * planet_distance($db, $systemId, $fromId, $toId);

                $db->prepare(
                    "INSERT INTO hs_missions (player_id, type, from_planet_id, to_planet_id, ends_at, leg)
                     VALUES (?,'cargo_drone',?,?, DATE_ADD(NOW(), INTERVAL ? SECOND), 'back')"
                )->execute([$playerId, $toId, $fromId, $flightTime]);
                $returnId = (int)$db->lastInsertId();

                // A refused delivery (uncolonized target) flies home still loaded
                $db->prepare(
                    'UPDATE hs_cargo SET cargo=?, mission_id=? WHERE planet_id=? AND player_id=?'
                )->execute([
                    $delivered ? '{}' : json_encode($cargo),
                    $returnId, $fromId, $playerId,
                ]);
            }
        }

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

        // A spy mission writes down what it finds at the moment it arrives. The
        // satellite additionally starts transmitting, which keeps that row live
        // until its lifetime runs out.
        if ($m['type'] === 'spy_drone') {
            record_spy_intel($db, $playerId, $toId);
        }
        if ($m['type'] === 'spy_satellite') {
            record_spy_intel($db, $playerId, $toId, true);
        }

        // recon_drone needs no branch of its own: the completed row IS what it
        // revealed (see droneScannedPlanets in state.php), so marking it done is
        // the whole effect.
        $db->prepare("UPDATE hs_missions SET status='done' WHERE id=?")->execute([$missionId]);
    }
}

// An order is ONE batch: `runs` units, delivered together when the batch ends.
// The column replaces the old `remaining` counter, which meant "runs still to
// come" back when a queue paid out one unit every durationBase and re-armed
// itself. The batch never re-arms, so nothing counts down any more.
function ensure_conversion_queue_table(PDO $db): void {
    static $tableReady = false;
    if ($tableReady) return;
    $tableReady = true;

    try {
        $fresh = !$db->query("SHOW TABLES LIKE 'hs_conversion_queues'")->fetch();
        $db->exec(
            'CREATE TABLE IF NOT EXISTS hs_conversion_queues (
               id           INT AUTO_INCREMENT PRIMARY KEY,
               planet_id    INT NOT NULL,
               player_id    INT NOT NULL,
               building_key VARCHAR(64) NOT NULL,
               recipe_index INT NOT NULL,
               ends_at      DATETIME NOT NULL,
               runs         INT NOT NULL DEFAULT 1
             )'
        );

        if ($fresh) return;

        // Column by column, so a half-migrated database heals itself.
        if (!$db->query("SHOW COLUMNS FROM hs_conversion_queues LIKE 'runs'")->fetch()) {
            $db->exec('ALTER TABLE hs_conversion_queues ADD COLUMN runs INT NOT NULL DEFAULT 1');
            // An in-flight old queue was "one running + `remaining` to come", so
            // its batch size is remaining + 1. It now finishes as one delivery.
            if ($db->query("SHOW COLUMNS FROM hs_conversion_queues LIKE 'remaining'")->fetch()) {
                $db->exec('UPDATE hs_conversion_queues SET runs = remaining + 1');
            }
        }
        if ($db->query("SHOW COLUMNS FROM hs_conversion_queues LIKE 'remaining'")->fetch()) {
            $db->exec('ALTER TABLE hs_conversion_queues DROP COLUMN remaining');
        }
    } catch (Throwable $e) { /* table stays as it is */ }
}

function resolve_conversions(PDO $db, int $planetId, int $playerId): void {
    ensure_conversion_queue_table($db);

    $done = $db->prepare(
        'SELECT id, building_key, recipe_index, runs
         FROM hs_conversion_queues
         WHERE planet_id=? AND player_id=? AND ends_at <= NOW()'
    );
    $done->execute([$planetId, $playerId]);
    $rows = $done->fetchAll();
    if (!$rows) return;

    // Looked up once for the whole batch, not per finished job.
    $caps = planet_storage_caps($db, $planetId, $playerId);

    foreach ($rows as $q) {
        $def    = building_def($q['building_key']);
        $recipe = $def['conversions'][$q['recipe_index']] ?? null;
        if (!$recipe) {
            $db->prepare('DELETE FROM hs_conversion_queues WHERE id=?')->execute([$q['id']]);
            continue;
        }

        // The whole batch lands at once — a ×4 order pays four times the output
        // after four times the duration, not one unit every durationBase.
        $batch = [];
        $runs  = max(1, (int)$q['runs']);
        foreach ($recipe['output'] as $res => $amt) {
            $batch[$res] = $amt * $runs;
        }

        // Paid out through the cap-aware credit. A raw-resource output (the deep
        // shaft ships 1200 metal at a time) landing on a nearly full silo fills
        // it and stops; a plain `res = res + amt` would show an over-cap number
        // that the next compute_resources() tick quietly shaves back down.
        // Population has no cap and passes straight through.
        credit_resources($db, $planetId, $playerId, $batch, $caps);

        $db->prepare('DELETE FROM hs_conversion_queues WHERE id=?')->execute([$q['id']]);
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
    // Create the row EMPTY on first sight — a freshly built power_plant starts at
    // 0 % so the player learns they have to charge the battery to get power.
    $db->prepare(
        'INSERT IGNORE INTO hs_power_battery (planet_id, player_id, charge, charge_updated_at)
         VALUES (?,?,?, NOW())'
    )->execute([$planetId, $playerId, 0]);
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

// ── Planetary shield (charge mechanic) ────────────────────────────────────────
// Mirrors the reactor battery: one row per planet, charge resolved live from the
// elapsed time since the last write, so no cron and no resolve step is needed.
// The one difference is that charging costs crystal — see defense/charge.php.

function ensure_shield(PDO $db, int $planetId, int $playerId): void {
    static $tableReady = false;
    if (!$tableReady) {
        try {
            $db->exec(
                'CREATE TABLE IF NOT EXISTS hs_shield (
                   planet_id INT NOT NULL,
                   player_id INT NOT NULL,
                   charge FLOAT NOT NULL DEFAULT 0,
                   charge_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   PRIMARY KEY (planet_id, player_id)
                 )'
            );
        } catch (\Throwable $e) {}
        $tableReady = true;
    }
    // Starts empty, like a freshly built power plant: a new shield generator is
    // installed but not yet charged.
    $db->prepare(
        'INSERT IGNORE INTO hs_shield (planet_id, player_id, charge, charge_updated_at)
         VALUES (?,?,?, NOW())'
    )->execute([$planetId, $playerId, 0]);
}

// Completed shield_generator level. Ignores build_ends_at for the same reason
// power_plant_level does — an in-progress build must not switch the shield on.
function shield_generator_level(PDO $db, int $planetId, int $playerId): int {
    $s = $db->prepare(
        'SELECT level FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND building_key=? AND build_ends_at IS NULL'
    );
    $s->execute([$planetId, $playerId, 'shield_generator']);
    return (int)($s->fetchColumn() ?: 0);
}

// Live shield state for the API. Null means there is no shield generator on this
// planet, i.e. the mechanic is inactive and the UI shows nothing.
function shield_state(PDO $db, int $planetId, int $playerId): ?array {
    if (shield_generator_level($db, $planetId, $playerId) <= 0) return null;

    ensure_shield($db, $planetId, $playerId);

    $row = $db->prepare(
        'SELECT charge, TIMESTAMPDIFF(SECOND, charge_updated_at, NOW()) AS elapsed
         FROM hs_shield WHERE planet_id=? AND player_id=?'
    );
    $row->execute([$planetId, $playerId]);
    $s = $row->fetch();

    $stored  = $s ? (float)$s['charge'] : 0.0;
    $elapsed = $s ? max(0, (int)$s['elapsed']) : 0;
    $charge  = max(0.0, $stored - SHIELD_DRAIN_PER_HOUR * ($elapsed / 3600.0));

    return [
        'charge'       => round($charge, 2),
        'drainPerHour' => SHIELD_DRAIN_PER_HOUR,
        'clickPercent' => SHIELD_CLICK,
        'clickCost'    => SHIELD_CLICK_COST,
        'down'         => $charge <= 0,
        'hoursToEmpty' => round($charge / SHIELD_DRAIN_PER_HOUR, 2),
    ];
}

// ── Population recruitment pool ───────────────────────────────────────────────

function ensure_recruit_pool(PDO $db, int $planetId, int $playerId): void {
    static $tableReady = false;
    if (!$tableReady) {
        try {
            $db->exec(
                'CREATE TABLE IF NOT EXISTS hs_recruit_pool (
                   planet_id INT NOT NULL,
                   player_id INT NOT NULL,
                   pool FLOAT NOT NULL DEFAULT 0,
                   pool_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   PRIMARY KEY (planet_id, player_id)
                 )'
            );
        } catch (\Throwable $e) {}
        $tableReady = true;
    }
    // Start full so a fresh colony can recruit right away.
    $db->prepare(
        'INSERT IGNORE INTO hs_recruit_pool (planet_id, player_id, pool, pool_updated_at)
         VALUES (?,?,?, NOW())'
    )->execute([$planetId, $playerId, RECRUIT_POOL_MAX]);
}

// Live recruit-pool state. The pool grows over time, capped at RECRUIT_POOL_MAX,
// derived from the stored value + elapsed time (no separate resolve needed).
function recruit_state(PDO $db, int $planetId, int $playerId): array {
    ensure_recruit_pool($db, $planetId, $playerId);
    $row = $db->prepare(
        'SELECT pool, TIMESTAMPDIFF(SECOND, pool_updated_at, NOW()) AS elapsed
         FROM hs_recruit_pool WHERE planet_id=? AND player_id=?'
    );
    $row->execute([$planetId, $playerId]);
    $r = $row->fetch();

    $growthPerHour = recruit_growth_per_hour();
    $stored  = $r ? (float)$r['pool'] : RECRUIT_POOL_MAX;
    $elapsed = $r ? max(0, (int)$r['elapsed']) : 0;
    $pool    = min(RECRUIT_POOL_MAX, $stored + $growthPerHour * ($elapsed / 3600.0));

    return [
        'pool'          => round($pool, 3),
        'poolMax'       => RECRUIT_POOL_MAX,
        'growthPerHour' => $growthPerHour,
    ];
}

// ── Storage caps ──────────────────────────────────────────────────────────────
// Summed storageCapacity of every completed building. compute_resources (for the
// clamp), the max_resources cheat and the anomaly payouts all need this exact
// number, so it lives in one place. The pure variant takes the levels a caller
// already has in hand; the DB variant looks them up first.

function storage_caps_from_levels(array $levels): array {
    $caps = [];
    foreach ($levels as $key => $lvl) {
        $def = level_def($key, (int)$lvl);
        if (!$def) continue;
        foreach (($def['storageCapacity'] ?? []) as $res => $cap) {
            $caps[$res] = ($caps[$res] ?? 0) + $cap;
        }
    }
    return $caps;
}

function planet_storage_caps(PDO $db, int $planetId, int $playerId): array {
    return storage_caps_from_levels(completed_building_levels($db, $planetId, $playerId));
}

// Adds resources without ever pushing a stock past its storage cap. Doing the
// clamp at the moment of the payout instead of leaving it to the next
// compute_resources() tick is what keeps a full store honest: the player sees
// the number they actually keep, not one that quietly shrinks a second later.
// A stock that already sits above its cap is left alone rather than trimmed —
// this credits, it never takes anything away.
function credit_resources(PDO $db, int $planetId, int $playerId, array $gain, array $caps): void {
    foreach ($gain as $res => $amt) {
        if (!in_array($res, RESOURCE_KEYS, true) || $amt <= 0) continue;

        if (isset($caps[$res])) {
            $db->prepare(
                "UPDATE hs_planet_resources SET $res = LEAST($res + ?, GREATEST($res, ?))
                 WHERE planet_id=? AND player_id=?"
            )->execute([$amt, (float)$caps[$res], $planetId, $playerId]);
        } else {
            $db->prepare(
                "UPDATE hs_planet_resources SET $res = $res + ?
                 WHERE planet_id=? AND player_id=?"
            )->execute([$amt, $planetId, $playerId]);
        }
    }
}

// building_key => level for everything standing (build finished) on the planet.
function completed_building_levels(PDO $db, int $planetId, int $playerId): array {
    $rows = $db->prepare(
        'SELECT building_key, level FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND level>0 AND build_ends_at IS NULL'
    );
    $rows->execute([$planetId, $playerId]);
    $levels = [];
    foreach ($rows->fetchAll() as $b) $levels[$b['building_key']] = (int)$b['level'];
    return $levels;
}

// ── Anomalies (planet events) ─────────────────────────────────────────────────
// One open anomaly per planet at a time, rolled on read once the interval since
// the last roll has passed — same no-cron trick as the recruit pool. An anomaly
// that is never answered simply expires; every outcome is a gift, so missing one
// costs nothing but the opportunity.

function ensure_anomaly_table(PDO $db): void {
    static $ready = false;
    if ($ready) return;
    try {
        $db->exec(
            'CREATE TABLE IF NOT EXISTS hs_anomalies (
               id INT AUTO_INCREMENT PRIMARY KEY,
               planet_id INT NOT NULL,
               player_id INT NOT NULL,
               type VARCHAR(32) NOT NULL,
               choices TEXT NOT NULL,
               created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
               expires_at DATETIME NOT NULL,
               resolved_at DATETIME NULL,
               resolved_choice VARCHAR(32) NULL,
               INDEX idx_planet_open (planet_id, player_id, resolved_at)
             )'
        );
    } catch (\Throwable $e) {}
    $ready = true;
}

// '@planetRaw' resolves to the planet's exclusive raw resource. The amount is a
// share of that resource's storage cap, with a baseline for the stage where no
// storage building exists yet and the cap would still be 0.
function anomaly_share_amount(string $res, float $share, array $caps, string $planetType): array {
    if ($res === '@planetRaw') {
        $res = ANOMALY_PLANET_RAW[$planetType] ?? '';
        if ($res === '') return ['', 0];
    }
    $cap = max((float)($caps[$res] ?? 0), (float)(ANOMALY_CAP_BASELINE[$res] ?? 0));
    return [$res, (int)round($cap * $share)];
}

// Turns one choice template into the concrete deltas the player is promised.
// Everything variable (cap shares, salvage contents) is decided here, once, at
// creation time — never again when the choice is actually taken.
function materialize_anomaly_choice(string $key, array $tpl, array $caps, string $planetType): array {
    $out = ['key' => $key, 'gain' => [], 'cost' => [], 'battery' => 0];

    foreach (($tpl['gain'] ?? []) as $res => $amt) $out['gain'][$res] = $amt;
    foreach (($tpl['cost'] ?? []) as $res => $amt) $out['cost'][$res] = $amt;

    foreach (($tpl['gainShareOfCap'] ?? []) as $res => $share) {
        [$r, $amt] = anomaly_share_amount($res, $share, $caps, $planetType);
        if ($r !== '') $out['gain'][$r] = ($out['gain'][$r] ?? 0) + $amt;
    }
    foreach (($tpl['costShareOfCap'] ?? []) as $res => $share) {
        [$r, $amt] = anomaly_share_amount($res, $share, $caps, $planetType);
        if ($r !== '') $out['cost'][$r] = ($out['cost'][$r] ?? 0) + $amt;
    }

    for ($i = 0; $i < (int)($tpl['salvage'] ?? 0); $i++) {
        $res = ANOMALY_SALVAGE_POOL[array_rand(ANOMALY_SALVAGE_POOL)];
        $out['gain'][$res] = ($out['gain'][$res] ?? 0) + 1;
    }

    $out['battery'] = (float)($tpl['battery'] ?? 0);
    return $out;
}

// Rolls a new anomaly and stores its materialised choices. Returns the DB row.
// $forceType skips the weighted roll — dev-only, so a specific event can be
// tested without waiting for it to come up on its own.
function create_anomaly(PDO $db, int $planetId, int $playerId, string $planetType, ?string $forceType = null): array|null {
    $levels = completed_building_levels($db, $planetId, $playerId);
    $type   = ($forceType && anomaly_def($forceType)) ? $forceType : pick_anomaly_type($planetType, $levels);
    if (!$type) return null;

    $def  = anomaly_def($type);
    $caps = storage_caps_from_levels($levels);

    $choices = [];
    foreach ($def['choices'] as $key => $tpl) {
        $choices[] = materialize_anomaly_choice($key, $tpl, $caps, $planetType);
    }

    $db->prepare(
        'INSERT INTO hs_anomalies (planet_id, player_id, type, choices, created_at, expires_at)
         VALUES (?,?,?,?, NOW(), DATE_ADD(NOW(), INTERVAL ' . ANOMALY_TTL_HOURS . ' HOUR))'
    )->execute([$planetId, $playerId, $type, json_encode($choices)]);

    // Answered and expired rows are only kept so the roll interval has something
    // to measure against — anything older than a week is dead weight.
    $db->prepare(
        'DELETE FROM hs_anomalies
         WHERE planet_id=? AND player_id=? AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
    )->execute([$planetId, $playerId]);

    return open_anomaly_row($db, $planetId, $playerId);
}

// The one open, unexpired anomaly on this planet, or null.
function open_anomaly_row(PDO $db, int $planetId, int $playerId): array|null {
    $row = $db->prepare(
        'SELECT id, type, choices, UNIX_TIMESTAMP(expires_at) AS expires
         FROM hs_anomalies
         WHERE planet_id=? AND player_id=? AND resolved_at IS NULL AND expires_at > NOW()
         ORDER BY id DESC LIMIT 1'
    );
    $row->execute([$planetId, $playerId]);
    return $row->fetch() ?: null;
}

// Live anomaly state for the API. Null means "nothing to show": either the tile
// is still locked or the next roll is not due yet.
function anomaly_state(PDO $db, int $planetId, int $playerId, string $planetType): ?array {
    ensure_anomaly_table($db);

    // The tile has to exist before anomalies start landing on it, otherwise the
    // first ones would tick away behind a lock.
    $slot = $db->prepare(
        'SELECT unlocked FROM hs_planet_slots WHERE planet_id=? AND player_id=? AND slot_index=?'
    );
    $slot->execute([$planetId, $playerId, ANOMALY_SLOT]);
    if (!$slot->fetchColumn()) return null;

    $row = open_anomaly_row($db, $planetId, $playerId);

    if (!$row) {
        // Measure the interval from the moment the tile last became free — the
        // answer for a resolved anomaly, the expiry for an ignored one. Measuring
        // from created_at instead would let an anomaly that sat around for longer
        // than the interval spawn its successor the instant it is answered.
        $last = $db->prepare(
            'SELECT TIMESTAMPDIFF(SECOND, MAX(COALESCE(resolved_at, expires_at)), NOW())
             FROM hs_anomalies WHERE planet_id=? AND player_id=?'
        );
        $last->execute([$planetId, $playerId]);
        $sinceFree = $last->fetchColumn();

        if ($sinceFree === null || (int)$sinceFree >= ANOMALY_INTERVAL_HOURS * 3600) {
            $row = create_anomaly($db, $planetId, $playerId, $planetType);
        }
    }
    if (!$row) return null;

    return [
        'id'        => (int)$row['id'],
        'type'      => $row['type'],
        'icon'      => anomaly_def($row['type'])['icon'] ?? '❔',
        'choices'   => json_decode($row['choices'], true) ?: [],
        'expiresAt' => (int)$row['expires'] * 1000,
    ];
}

// Applies one materialised choice. The deltas are already concrete, so this is
// the only place an anomaly effect is ever executed, no matter how many types
// exist. Returns null on success, or the resource key that was missing.
function apply_anomaly_choice(PDO $db, int $planetId, int $playerId, array $choice): ?string {
    // Resource keys come out of stored JSON and go straight into SQL — only ever
    // trust the known column names.
    $cost = [];
    foreach (($choice['cost'] ?? []) as $res => $amt) {
        if (in_array($res, RESOURCE_KEYS, true) && $amt > 0) $cost[$res] = (float)$amt;
    }
    $gain = [];
    foreach (($choice['gain'] ?? []) as $res => $amt) {
        if (in_array($res, RESOURCE_KEYS, true) && $amt > 0) $gain[$res] = (float)$amt;
    }

    // Check affordability up front — a half-applied choice is worse than a refusal.
    if ($cost) {
        $have = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
        $have->execute([$planetId, $playerId]);
        $r = $have->fetch() ?: [];
        foreach ($cost as $res => $amt) {
            if ((float)($r[$res] ?? 0) < $amt) return $res;
        }
    }

    foreach ($cost as $res => $amt) {
        $db->prepare(
            "UPDATE hs_planet_resources SET $res = GREATEST(0, $res - ?)
             WHERE planet_id=? AND player_id=?"
        )->execute([$amt, $planetId, $playerId]);
    }
    // Paid out through the cap-aware credit: a meteor haul on a nearly full
    // store tops the silo up and stops there instead of overshooting.
    credit_resources($db, $planetId, $playerId, $gain, planet_storage_caps($db, $planetId, $playerId));

    $delta = (float)($choice['battery'] ?? 0);
    if ($delta != 0.0) {
        $ppLevel = power_plant_level($db, $planetId, $playerId);
        if ($ppLevel > 0) {
            ensure_power_battery($db, $planetId, $playerId);
            $row = $db->prepare(
                'SELECT charge, TIMESTAMPDIFF(SECOND, charge_updated_at, NOW()) AS elapsed
                 FROM hs_power_battery WHERE planet_id=? AND player_id=?'
            );
            $row->execute([$planetId, $playerId]);
            $bb    = $row->fetch();
            $drain = battery_drain_per_hour($ppLevel);
            $live  = max(0.0, (float)$bb['charge'] - $drain * ((int)$bb['elapsed'] / 3600.0));
            $new   = max(0.0, min(POWER_BATTERY_MAX, $live + $delta));

            $db->prepare(
                'UPDATE hs_power_battery SET charge=?, charge_updated_at=NOW()
                 WHERE planet_id=? AND player_id=?'
            )->execute([$new, $planetId, $playerId]);
        }
    }

    return null;
}

// ── Refined resource rename (2026-08-07) ──────────────────────────────────────
// The four refinery outputs were reworked from "better metal" into four distinct
// functional materials. RESOURCE_KEYS drives the column names in the resource
// UPDATE, so the columns have to follow the rename. Adds the new columns and
// carries any existing stock over once. MySQL 5.7 compatible (no IF NOT EXISTS).
const REFINED_RENAMES = [
    'super_alloy'   => 'duraplate',
    'quantum_shard' => 'plasma_core',
    'pure_crystal'  => 'superconductor',
    'nano_alloy'    => 'vital_gel',
];

function migrate_refined_resources(PDO $db): void {
    static $done = false;
    if ($done) return;
    $done = true;

    // One cheap probe — if the first new column is there the migration already ran
    try {
        if ($db->query("SHOW COLUMNS FROM hs_planet_resources LIKE 'duraplate'")->fetch()) return;
    } catch (\Throwable $e) { return; }

    foreach (REFINED_RENAMES as $old => $new) {
        try { $db->exec("ALTER TABLE hs_planet_resources ADD COLUMN $new FLOAT DEFAULT 0"); } catch (\Throwable $e) {}
        // Carry the old stock over, then drop the retired column
        try { $db->exec("UPDATE hs_planet_resources SET $new = $old"); } catch (\Throwable $e) {}
        try { $db->exec("ALTER TABLE hs_planet_resources DROP COLUMN $old"); } catch (\Throwable $e) {}
    }
}

function compute_resources(PDO $db, int $planetId, int $playerId, string $planetType): void {
    migrate_refined_resources($db);

    $row = $db->prepare(
        'SELECT *, TIMESTAMPDIFF(SECOND, resources_computed_at, NOW()) AS elapsed
         FROM hs_planet_resources WHERE planet_id=? AND player_id=?'
    );
    $row->execute([$planetId, $playerId]);
    $r = $row->fetch();
    if (!$r || $r['elapsed'] < 1) return;

    $elapsed = min((int)$r['elapsed'], 86400);

    $levels = completed_building_levels($db, $planetId, $playerId);

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

    $caps = storage_caps_from_levels($levels);

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
