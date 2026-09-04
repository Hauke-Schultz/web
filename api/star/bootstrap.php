<?php
/**
 * Shared bootstrap for all /api/star/* endpoints.
 * Include this at the top of every endpoint file.
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/../db.php';
// Bootstrap's own functions read config constants (SHIELD_DRAIN_PER_HOUR,
// UNIT_COSTS, RAID_*, …), so config belongs here rather than in every endpoint.
// Ten endpoints included only this file and worked purely by luck — until one of
// them reached a code path that touched a constant. /galaxy died with a fatal
// "Undefined constant SHIELD_DRAIN_PER_HOUR" as soon as a player had a satellite
// report on a planet that actually had a shield generator: 500, empty body, and
// a "Unexpected end of JSON input" in the browser. config.php includes nothing
// itself, so there is no cycle. The endpoints may keep their own require_once.
require_once __DIR__ . '/config.php';

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
    // Oldest first, and each one's production is booked up to the moment it
    // finished before its level changes — a building pays out at the level it
    // actually had at the time, on both sides of the upgrade.
    $done = $db->prepare(
        'SELECT building_key, level, UNIX_TIMESTAMP(build_ends_at) AS ends_ts FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND build_ends_at IS NOT NULL AND build_ends_at <= NOW()
         ORDER BY build_ends_at ASC'
    );
    $done->execute([$planetId, $playerId]);

    foreach ($done->fetchAll() as $b) {
        $key      = $b['building_key'];
        $newLevel = (int)$b['level'] + 1;

        accrue_resources($db, $planetId, $playerId, (int)$b['ends_ts']);

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

    // Effective levels: a crew is assigned the moment the build starts, and at the
    // headcount of the level being built — same rule as totalStaffDrain() on the
    // client. Skipping in-progress rows freed their whole crew for the duration,
    // so the server let through a colony ship the client had already greyed out.
    $drain = 0.0;
    foreach (effective_building_levels($db, $planetId, $playerId) as $key => $lvl) {
        $def = level_def($key, $lvl);
        $drain += (float)($def['staffDrain'] ?? 0);
    }
    return $population - $drain;
}

// ── Player profile: UI language ──────────────────────────────────────────────
// `hs_players` predates the setting, so the column is added at runtime like
// every other late arrival. Probed on its own, per the ensure_spy_intel_table()
// note: one column, one probe, one ALTER.
function ensure_player_locale(PDO $db): void {
    static $ready = false;
    if ($ready) return;
    $ready = true;
    try {
        if (!$db->query("SHOW COLUMNS FROM hs_players LIKE 'locale'")->fetch()) {
            $db->exec("ALTER TABLE hs_players ADD COLUMN locale ENUM('en','de') NOT NULL DEFAULT 'en'");
        }
    } catch (PDOException $e) { /* a read-only DB must not break login */ }
}

// Every locale the client can be switched to. Kept next to the migration so the
// ENUM and the whitelist can never drift apart.
const PLAYER_LOCALES = ['en', 'de'];

// ── Player disposition: earned, never chosen ─────────────────────────────────
// Three rungs on one ladder, in order, and you only ever climb:
//
//   friendly  everybody starts here, and this is the ONLY rung that cannot be
//             raided (see mission/raid.php)
//   neutral   the first espionage flight you send — drone or satellite. Looking
//             at somebody's planet is not an act of war, but it is not nothing
//             either, and it is the moment you stopped being harmless
//   hostile   the first raid you launch
//
// Nothing takes any of it back. A fleet you have already sent is not undone by
// a quiet week, and a cooldown would just mean waiting out your own reputation.
//
// It used to be a profile setting, and that was the bug: `friendly` is the one
// state that cannot be raided, so a dropdown offering it was a checkbox marked
// "I am invulnerable". The only honest way to be unraidable is to have raided
// nobody — so `auth/profile.php` no longer accepts the field at all, and the
// three buttons in HsProfilePanel became a read-out.
const DISPOSITIONS = ['friendly', 'neutral', 'hostile'];

function disposition_rank(string $d): int {
    $i = array_search($d, DISPOSITIONS, true);
    return $i === false ? 0 : $i;
}

function player_disposition(PDO $db, int $playerId): string {
    $row = $db->prepare('SELECT disposition FROM hs_players WHERE id=?');
    $row->execute([$playerId]);
    $d = (string)($row->fetchColumn() ?: 'friendly');
    return in_array($d, DISPOSITIONS, true) ? $d : 'friendly';
}

// Raises a player to at least $to, and never lowers anybody.
//
// The guard is in the WHERE clause rather than in a read-then-write: two flights
// launched in the same second would otherwise both read `friendly`, and the raid
// could be overwritten back down to `neutral` by the spy drone that lost the
// race. Written as "only from a rung below" it does not matter who wins.
function escalate_disposition(PDO $db, int $playerId, string $to): void {
    if (!in_array($to, DISPOSITIONS, true)) return;
    $below = array_slice(DISPOSITIONS, 0, disposition_rank($to));
    if (!$below) return;   // already the bottom rung — nothing outranks it
    $marks = implode(',', array_fill(0, count($below), '?'));
    $db->prepare("UPDATE hs_players SET disposition = ? WHERE id = ? AND disposition IN ($marks)")
       ->execute(array_merge([$to, $playerId], $below));
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
               build_count      INT NOT NULL DEFAULT 1,
               PRIMARY KEY (planet_id, player_id, unit_key)
             )'
        );
        // Hulls in the running batch. 1 for every unit that is not batchable, so
        // an existing row keeps behaving exactly as before the column existed.
        // Probed on its own — see the ensure_spy_intel_table() note on why a
        // shared guard once left a half-migrated table broken for good.
        if (!$db->query("SHOW COLUMNS FROM hs_units LIKE 'build_count'")->fetch()) {
            $db->exec('ALTER TABLE hs_units ADD COLUMN build_count INT NOT NULL DEFAULT 1');
        }
    } catch (\Throwable $e) {}
    $tableReady = true;
}

// A finished unit build lands in the planet's inventory. Missions consume from
// there — a built dock alone is never enough to launch anything.
// A batch lands as a whole squadron: `build_count` hulls at once, never one per
// tick, which is what makes ×4 an order for four ships rather than four orders.
function resolve_units(PDO $db, int $planetId, int $playerId): void {
    ensure_units_table($db);
    $db->prepare(
        'UPDATE hs_units
         SET quantity = quantity + GREATEST(1, build_count),
             build_ends_at = NULL, build_started_at = NULL, build_count = 1
         WHERE planet_id=? AND player_id=? AND build_ends_at IS NOT NULL AND build_ends_at <= NOW()'
    )->execute([$planetId, $playerId]);
}

// ── Fleet ─────────────────────────────────────────────────────────────────────

function weapons_building_level(PDO $db, int $planetId, int $playerId): int {
    $row = $db->prepare(
        'SELECT level FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND building_key=? AND build_ends_at IS NULL'
    );
    $row->execute([$planetId, $playerId, 'weapons_building']);
    return (int)($row->fetchColumn() ?: 0);
}

// Berths on this planet. Zero without a weapons_building — the fleet is gated
// behind the building, not merely limited by it.
function fleet_cap(PDO $db, int $planetId, int $playerId): int {
    return weapons_building_level($db, $planetId, $playerId) * FLEET_PER_WEAPONS_LEVEL;
}

// Corvettes of this planet that are in the air rather than in the dock. A raid
// takes its hulls out of hs_units at launch (mission/raid.php), so without this
// the berths they came from read as free — launch four, order four replacements,
// and the survivors come home to a fleet over the cap.
//
// The outbound leg carries what launched, the return leg what survived, so the
// reservation shrinks to the real number the moment the battle is resolved. A
// fleet wiped out over the target keeps its berths reserved until its mission
// row is resolved; every caller runs resolve_timers() first, so that is a matter
// of the same request.
function fleet_away(PDO $db, int $planetId, int $playerId): int {
    $row = $db->prepare(
        "SELECT COALESCE(SUM(ships), 0) FROM hs_missions
         WHERE player_id=? AND type='raid' AND status='in_flight'
           AND ((leg <> 'back' AND from_planet_id=?) OR (leg='back' AND to_planet_id=?))"
    );
    $row->execute([$playerId, $planetId, $planetId]);
    return (int)$row->fetchColumn();
}

// Hulls that already count against the cap: docked, in the running batch, and
// away on a raid. A fleet in flight is still this planet's fleet — it is coming
// back to these berths.
function fleet_size(PDO $db, int $planetId, int $playerId): int {
    ensure_units_table($db);
    $row = $db->prepare(
        'SELECT quantity, build_ends_at, build_count FROM hs_units
         WHERE planet_id=? AND player_id=? AND unit_key=?'
    );
    $row->execute([$planetId, $playerId, 'corvette']);
    $u = $row->fetch();
    $docked = $u
        ? (int)$u['quantity'] + ($u['build_ends_at'] ? max(1, (int)$u['build_count']) : 0)
        : 0;
    return $docked + fleet_away($db, $planetId, $playerId);
}

function units_state(PDO $db, int $planetId, int $playerId): array {
    ensure_units_table($db);
    $rows = $db->prepare(
        'SELECT unit_key, quantity, build_ends_at, build_started_at, build_count
         FROM hs_units WHERE planet_id=? AND player_id=?'
    );
    $rows->execute([$planetId, $playerId]);

    $units = [];
    foreach (array_keys(UNIT_COSTS) as $key) {
        $units[$key] = ['quantity' => 0, 'buildEndsAt' => null, 'buildStartedAt' => null, 'buildCount' => 1];
    }
    foreach ($rows->fetchAll() as $u) {
        $units[$u['unit_key']] = [
            'quantity'       => (int)$u['quantity'],
            'buildEndsAt'    => $u['build_ends_at']    ? strtotime($u['build_ends_at'])    * 1000 : null,
            'buildStartedAt' => $u['build_started_at'] ? strtotime($u['build_started_at']) * 1000 : null,
            // How many hulls the running build will deliver at once
            'buildCount'     => max(1, (int)$u['build_count']),
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

// The raid adds a mission type and three columns: how many hulls are aboard,
// what the fleet was ordered to do, and what it is carrying home. Probes the
// ENUM and each column on its own, so a half-migrated database heals itself.
function migrate_raid_missions(PDO $db): void {
    static $done = false;
    if ($done) return;
    $done = true;

    try {
        $col = $db->query("SHOW COLUMNS FROM hs_missions LIKE 'type'")->fetch();
        if ($col && !str_contains((string)$col['Type'], "'raid'")) {
            $db->exec(
                "ALTER TABLE hs_missions
                 MODIFY type ENUM('recon_drone','colony_ship','cargo_drone','spy_drone','spy_satellite','raid') NOT NULL"
            );
        }
    } catch (\Throwable $e) { /* keep going — the columns matter more */ }

    // `order` is reserved in SQL, hence raid_order.
    $columns = [
        'ships'      => 'INT NULL',
        'raid_order' => "VARCHAR(16) NULL",
        'loot'       => 'TEXT NULL',
    ];
    foreach ($columns as $col => $ddl) {
        try {
            if ($db->query("SHOW COLUMNS FROM hs_missions LIKE '$col'")->fetch()) continue;
            $db->exec("ALTER TABLE hs_missions ADD COLUMN $col $ddl");
        } catch (\Throwable $e) {}
    }
}

// One row per battle, read by BOTH sides. The attacker is always named — the
// defender's system card keeps a raid history per player, and a history full of
// "unknown fleet" would be worth nothing. `seen_by_*` are outboxes in the same
// spirit as satellite_lost_at: cleared when state.php hands the event over, so
// each side is told exactly once without a notification table.
function ensure_battle_reports_table(PDO $db): void {
    static $tableReady = false;
    if ($tableReady) return;
    $tableReady = true;

    try {
        $db->exec(
            'CREATE TABLE IF NOT EXISTS hs_battle_reports (
               id               INT AUTO_INCREMENT PRIMARY KEY,
               attacker_id      INT NOT NULL,
               defender_id      INT NOT NULL,
               planet_id        INT NOT NULL,
               fought_at        DATETIME NOT NULL,
               won              TINYINT(1) NOT NULL DEFAULT 0,
               plundered        TINYINT(1) NOT NULL DEFAULT 0,
               result           TEXT NULL,
               seen_by_attacker TINYINT(1) NOT NULL DEFAULT 0,
               seen_by_defender TINYINT(1) NOT NULL DEFAULT 0,
               INDEX idx_defender (defender_id, attacker_id),
               INDEX idx_attacker (attacker_id)
             )'
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
               satellite_hits   TINYINT NOT NULL DEFAULT 0,
               satellite_shot_at DATETIME(3) NULL,
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
        //   satellite_hits / satellite_shot_at — a satellite now takes several
        //     hits, so the damage has to outlive the browser tab that dealt it,
        //     and the shot rate needs a floor with sub-second resolution.
        if (!$fresh) {
            $columns = [
                'shield_seen_at'     => 'DATETIME NULL',
                'shield_charge'      => 'FLOAT NULL',
                'satellite_active'   => 'TINYINT(1) NOT NULL DEFAULT 0',
                'satellite_lost_at'  => 'DATETIME NULL',
                'satellite_hits'     => 'TINYINT NOT NULL DEFAULT 0',
                'satellite_shot_at'  => 'DATETIME(3) NULL',
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
        //
        // THE HULL IS NEW, SO THE DAMAGE IS NOT ITS OWN. The row is keyed
        // (player, planet) and deliberately never deleted, so a spy who replaces
        // a satellite that was shot down lands on the dead one's record — and
        // `satellite_hits` sitting at SATELLITE_ARMOR meant the replacement came
        // apart on the defender's very first round. Resetting it here rather than
        // on the kill is what makes it right: the kill has to LEAVE the count at
        // the armour, because that is what stops a round landing on a wreck
        // (see the claim in defense/intercept.php).
        $db->prepare(
            'INSERT INTO hs_spy_intel
               (player_id, planet_id, owner_player_id, owner_faction_id, observed_at,
                satellite_until, satellite_active, satellite_hits, satellite_shot_at,
                shield_seen_at, shield_charge)
             VALUES (?,?,?,?, NOW(), NOW(), 1, 0, NULL, NOW(), ?)
             ON DUPLICATE KEY UPDATE
               owner_player_id=VALUES(owner_player_id),
               owner_faction_id=VALUES(owner_faction_id),
               observed_at=NOW(),
               satellite_until=NOW(),
               satellite_active=1,
               satellite_hits=0,
               satellite_shot_at=NULL,
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
            'SELECT si.player_id, pl.username, pl.portrait, si.satellite_hits,
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
            // Damage survives the tab that dealt it: a salvo you broke off is
            // not wasted, it is a softer satellite the next time you come back.
            'hits'     => (int)($r['satellite_hits'] ?? 0),
            'armor'    => SATELLITE_ARMOR,
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

// Battle reports this player has not been shown yet, from either side of the
// fight. Same outbox trick as lost_satellites(): the flag is cleared as the news
// is handed over, so each battle is announced exactly once. Both sides always
// learn who they fought — the defender's raid history in the system card would
// be worthless if half of it read "unknown fleet".
function unseen_battle_reports(PDO $db, int $playerId): array {
    ensure_battle_reports_table($db);

    // state.php is the endpoint the whole game hangs off; a missed notification
    // is survivable, a white page is not.
    try {
        $rows = $db->prepare(
            'SELECT br.id, br.attacker_id, br.defender_id, br.planet_id, br.won, br.plundered, br.result,
                    UNIX_TIMESTAMP(br.fought_at) AS fought_ts,
                    p.name AS planet_name, s.name AS system_name,
                    a.username AS attacker_name, a.portrait AS attacker_portrait,
                    d.username AS defender_name, d.portrait AS defender_portrait
             FROM hs_battle_reports br
             JOIN hs_planets p       ON p.id = br.planet_id
             JOIN hs_star_systems s  ON s.id = p.system_id
             LEFT JOIN hs_players a  ON a.id = br.attacker_id
             LEFT JOIN hs_players d  ON d.id = br.defender_id
             WHERE (br.attacker_id=? AND br.seen_by_attacker=0)
                OR (br.defender_id=? AND br.seen_by_defender=0)
             ORDER BY br.fought_at ASC'
        );
        $rows->execute([$playerId, $playerId]);
        $reports = $rows->fetchAll();
        if (!$reports) return [];

        $db->prepare('UPDATE hs_battle_reports SET seen_by_attacker=1 WHERE attacker_id=? AND seen_by_attacker=0')
           ->execute([$playerId]);
        $db->prepare('UPDATE hs_battle_reports SET seen_by_defender=1 WHERE defender_id=? AND seen_by_defender=0')
           ->execute([$playerId]);

        return array_map(function ($r) use ($playerId) {
            $mine = (int)$r['attacker_id'] === $playerId;
            return [
                'id'         => (int)$r['id'],
                // Which chair you were sitting in decides how the report reads.
                'role'       => $mine ? 'attacker' : 'defender',
                'won'        => (bool)$r['won'],
                'plundered'  => (bool)$r['plundered'],
                'planetId'   => (int)$r['planet_id'],
                'planetName' => $r['planet_name'],
                'systemName' => $r['system_name'],
                'foeName'     => $mine ? $r['defender_name']     : $r['attacker_name'],
                'foePortrait' => $mine ? $r['defender_portrait'] : $r['attacker_portrait'],
                'foughtAt'   => (int)$r['fought_ts'] * 1000,
                'result'     => json_decode((string)$r['result'], true) ?: [],
            ];
        }, $reports);
    } catch (\Throwable $e) {
        return [];
    }
}

// The most recent attack on each of this player's planets, keyed by planet id.
//
// Deliberately NOT read through the seen-flag outbox: `unseen_battle_reports()`
// hands a report over exactly once and clears the flag, which makes it a
// notification. This is the standing record the empire board prints under a
// planet — "you were raided, this is who and this is what they took" has to
// survive a reload, and it has to still be there a week later.
//
// One row per planet, so the whole board costs a single query.
function last_raids_on_planets(PDO $db, int $playerId): array {
    ensure_battle_reports_table($db);

    try {
        $rows = $db->prepare(
            'SELECT br.planet_id, br.attacker_id, br.won, br.plundered, br.result,
                    UNIX_TIMESTAMP(br.fought_at) AS fought_ts,
                    a.username AS attacker_name, a.portrait AS attacker_portrait
             FROM hs_battle_reports br
             JOIN (
                 SELECT planet_id, MAX(fought_at) AS mx
                 FROM hs_battle_reports WHERE defender_id = ?
                 GROUP BY planet_id
             ) last ON last.planet_id = br.planet_id AND last.mx = br.fought_at
             LEFT JOIN hs_players a ON a.id = br.attacker_id
             WHERE br.defender_id = ?
             ORDER BY br.id ASC'
        );
        $rows->execute([$playerId, $playerId]);

        $out = [];
        foreach ($rows->fetchAll() as $r) {
            $result = json_decode((string)$r['result'], true) ?: [];
            // Two raids landing in the same second on the same planet both match
            // the MAX(); ordering by id means the later one wins the slot.
            $out[(int)$r['planet_id']] = [
                'attackerId' => (int)$r['attacker_id'],
                'attacker'   => $r['attacker_name'] ?? '?',
                'portrait'   => $r['attacker_portrait'] ?? '👤',
                // `won` is always from the ATTACKER's seat — from here it is the loss.
                'won'        => (bool)$r['won'],
                'plundered'  => (bool)$r['plundered'],
                'foughtAt'   => (int)$r['fought_ts'] * 1000,
                'loot'       => $result['loot'] ?? [],
            ];
        }
        return $out;
    } catch (\Throwable $e) {
        // Same rule as the espionage reads: state.php is the endpoint the whole
        // game hangs off, and a missing history line is survivable.
        return [];
    }
}

// The full record between this player and every commander they have ever fought,
// keyed by the OTHER player's id — the data behind the ⚔️ badges in the galaxy
// card's owner list and the log that unfolds under them.
//
// Both directions are kept apart (`in*` = what they did to us, `out*` = what we
// did to them) because they read as opposite news, but the log interleaves them:
// a feud is one story and reads best in one column. Counts include won AND
// repelled attacks — three bounced attempts are exactly the thing worth seeing
// build up, from either chair.
//
// Symmetric by construction: a battle names both sides, so the attacker's log is
// the same row as the defender's, only read from the other seat.
function raid_history(PDO $db, int $playerId): array {
    ensure_battle_reports_table($db);

    try {
        $history = [];

        // A helper so a first sighting in either query creates the same shape.
        $slot = function (int $foeId) use (&$history): void {
            if (!isset($history[$foeId])) {
                $history[$foeId] = [
                    'count'     => 0,      // their raids on us — the badge's number
                    'lastAt'    => null,
                    'outCount'  => 0,      // our raids on them
                    'outLastAt' => null,
                    // Who this record is with. The system card gets the name
                    // from the system's inhabitant list, but a player-wide
                    // battle log has no system to read it off — and the foe of
                    // an old feud may well live in a system we never scanned.
                    'foeName'     => null,
                    'foePortrait' => null,
                    'log'       => [],
                ];
            }
        };

        // Exact counts per direction. Grouping by the pair rather than by one
        // column keeps this to a single query for both.
        $counts = $db->prepare(
            'SELECT attacker_id, defender_id, COUNT(*) AS n, UNIX_TIMESTAMP(MAX(fought_at)) AS last_ts
             FROM hs_battle_reports
             WHERE attacker_id=? OR defender_id=?
             GROUP BY attacker_id, defender_id'
        );
        $counts->execute([$playerId, $playerId]);

        foreach ($counts->fetchAll() as $r) {
            $mine  = (int)$r['attacker_id'] === $playerId;
            $foeId = $mine ? (int)$r['defender_id'] : (int)$r['attacker_id'];
            $slot($foeId);
            if ($mine) {
                $history[$foeId]['outCount']  = (int)$r['n'];
                $history[$foeId]['outLastAt'] = (int)$r['last_ts'] * 1000;
            } else {
                $history[$foeId]['count']  = (int)$r['n'];
                $history[$foeId]['lastAt'] = (int)$r['last_ts'] * 1000;
            }
        }

        if (!$history) return [];

        // One lookup for every commander we have a record with. Not folded into
        // the query above: that one groups by the pair and would have to join
        // both seats to name the one that is not us.
        $ids  = array_keys($history);
        $mark = implode(',', array_fill(0, count($ids), '?'));
        $who  = $db->prepare("SELECT id, username, portrait FROM hs_players WHERE id IN ($mark)");
        $who->execute($ids);
        foreach ($who->fetchAll() as $r) {
            $history[(int)$r['id']]['foeName']     = $r['username'];
            $history[(int)$r['id']]['foePortrait'] = $r['portrait'] ?? '👤';
        }

        // The detail rows. Capped (see RAID_LOG_SCAN) — only the list is
        // truncated, never the counts above.
        $rows = $db->prepare(
            'SELECT br.id, br.attacker_id, br.defender_id, br.won, br.plundered, br.result,
                    UNIX_TIMESTAMP(br.fought_at) AS fought_ts,
                    p.name AS planet_name, s.name AS system_name
             FROM hs_battle_reports br
             JOIN hs_planets p      ON p.id = br.planet_id
             JOIN hs_star_systems s ON s.id = p.system_id
             WHERE br.attacker_id=? OR br.defender_id=?
             ORDER BY br.fought_at DESC
             LIMIT ' . (int)RAID_LOG_SCAN
        );
        $rows->execute([$playerId, $playerId]);

        foreach ($rows->fetchAll() as $r) {
            $mine  = (int)$r['attacker_id'] === $playerId;
            $foeId = $mine ? (int)$r['defender_id'] : (int)$r['attacker_id'];
            $slot($foeId);
            if (count($history[$foeId]['log']) >= RAID_LOG_ENTRIES) continue;

            $res = json_decode((string)$r['result'], true);
            if (!is_array($res)) $res = [];

            $history[$foeId]['log'][] = [
                'id'         => (int)$r['id'],
                // Which chair we were sitting in decides how every number below
                // reads: `lost` is our hulls when attacking, theirs when not.
                'role'       => $mine ? 'attacker' : 'defender',
                'won'        => (bool)$r['won'],
                'plundered'  => (bool)$r['plundered'],
                'planetName' => $r['planet_name'],
                'systemName' => $r['system_name'],
                'foughtAt'   => (int)$r['fought_ts'] * 1000,
                'order'      => $res['order'] ?? 'disable',
                // Attacker's side of the ledger: hulls sent, hulls shot down.
                'ships'      => (int)($res['ships'] ?? 0),
                'lost'       => (int)($res['lost'] ?? 0),
                'firepower'  => (int)($res['firepower'] ?? 0),
                // Defender's side: what the volley did to the two meters. Sent
                // as before/after so the UI can show the drop, not just a delta.
                'shieldBefore'  => (float)($res['shieldBefore']  ?? 0),
                'shieldAfter'   => (float)($res['shieldAfter']   ?? 0),
                'batteryBefore' => (float)($res['batteryBefore'] ?? 0),
                'batteryAfter'  => (float)($res['batteryAfter']  ?? 0),
                'loot'       => (object)(is_array($res['loot'] ?? null) ? $res['loot'] : []),
            ];
        }

        return $history;
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

// ── The raid ──────────────────────────────────────────────────────────────────

function raid_flight_seconds(PDO $db, int $fromSystemId, int $toSystemId): int {
    $dist = system_distance($db, $fromSystemId, $toSystemId);
    return max(RAID_FLIGHT_MIN, (int)round($dist * RAID_FLIGHT_PER_DIST));
}

// Was this planet's silo already emptied inside the cooldown window? Read off
// the reports rather than stored on the planet — the history IS the state.
function planet_plunder_locked(PDO $db, int $planetId): bool {
    ensure_battle_reports_table($db);
    $row = $db->prepare(
        'SELECT 1 FROM hs_battle_reports
         WHERE planet_id=? AND plundered=1 AND fought_at > DATE_SUB(NOW(), INTERVAL ? HOUR) LIMIT 1'
    );
    $row->execute([$planetId, RAID_PLUNDER_COOLDOWN_HOURS]);
    return (bool)$row->fetchColumn();
}

function player_is_protected(PDO $db, int $playerId): bool {
    $row = $db->prepare(
        'SELECT created_at > DATE_SUB(NOW(), INTERVAL ? DAY) FROM hs_players WHERE id=?'
    );
    $row->execute([RAID_NEWBIE_PROTECTION_DAYS, $playerId]);
    return (bool)$row->fetchColumn();
}

// The orbital battery firing on its own. Returns how many hulls it killed —
// one per power cell out of the defender's own stock, capped per volley. Without
// the building it never fires: the gun is also the sensor.
function orbital_volley(PDO $db, int $planetId, int $defenderId, int $incoming): int {
    if ($incoming < 1) return 0;
    if (orbital_defense_level($db, $planetId, $defenderId) < 1) return 0;

    $ammoKey = array_key_first(RAID_INTERCEPT_COST);
    $perShot = (int)RAID_INTERCEPT_COST[$ammoKey];

    $row = $db->prepare("SELECT $ammoKey FROM hs_planet_resources WHERE planet_id=? AND player_id=?");
    $row->execute([$planetId, $defenderId]);
    $stock = (int)floor((float)($row->fetchColumn() ?: 0));

    $shots = min($incoming, RAID_INTERCEPT_SHOTS, intdiv($stock, max(1, $perShot)));
    if ($shots < 1) return 0;

    $db->prepare(
        "UPDATE hs_planet_resources SET $ammoKey = GREATEST(0, $ammoKey - ?)
         WHERE planet_id=? AND player_id=?"
    )->execute([$shots * $perShot, $planetId, $defenderId]);

    return $shots;
}

// Writes a meter (shield or battery) back to an absolute value. Both are stored
// as "charge at a timestamp" and decay from there, so setting the timestamp to
// NOW() is what makes the new value the truth from this moment on.
function set_meter_charge(PDO $db, string $table, int $planetId, int $playerId, float $charge): void {
    $db->prepare(
        "UPDATE $table SET charge=?, charge_updated_at=NOW() WHERE planet_id=? AND player_id=?"
    )->execute([max(0.0, $charge), $planetId, $playerId]);
}

/**
 * What a meter read at a given moment — not now.
 *
 * A battle is fought when the fleet ARRIVES, but it is only computed when the
 * attacker next loads their state, which can be hours later. Reading the meter
 * at resolve time would hand the attacker a free exploit: launch, then stay
 * logged out until the shield has drained itself to nothing (1.25 %/h) and let
 * the delay win the battle. So the charge is rewound to the arrival timestamp.
 *
 * If the defender charged AFTER the fleet arrived, `charge_updated_at` is later
 * than the battle and there is nothing to rewind — the stored value is used as
 * it stands. That favours the defender, which is the safe direction to be wrong
 * in: nobody loses a shield they paid for after the shooting stopped.
 */
function meter_charge_at(PDO $db, string $table, int $planetId, int $playerId, float $drainPerHour, string $at): float {
    $row = $db->prepare(
        "SELECT charge, GREATEST(0, TIMESTAMPDIFF(SECOND, charge_updated_at, ?)) AS elapsed
         FROM $table WHERE planet_id=? AND player_id=?"
    );
    $row->execute([$at, $planetId, $playerId]);
    $r = $row->fetch();
    if (!$r) return 0.0;

    return max(0.0, (float)$r['charge'] - $drainPerHour * (max(0, (int)$r['elapsed']) / 3600.0));
}

/**
 * Fight one raid and return the report as an array.
 *
 * Deterministic, by design: the whole outcome is firepower against
 * shield % + battery %. The uncertainty a raid carries is not a die — it is
 * that a satellite reports the shield and never the battery, so the attacker
 * knows one of the two numbers they have to beat.
 */
function resolve_raid_battle(PDO $db, int $attackerId, int $planetId, int $ships, string $order, string $arrivedAt): array {
    ensure_battle_reports_table($db);

    $ownerRow = $db->prepare('SELECT player_id FROM hs_planet_ownership WHERE planet_id=?');
    $ownerRow->execute([$planetId]);
    $defenderId = (int)($ownerRow->fetchColumn() ?: 0);

    // Nobody home — the colony was abandoned or never existed. The fleet finds
    // an empty orbit and turns around intact.
    if (!$defenderId || $defenderId === $attackerId) {
        return ['abort' => 'no_target', 'survivors' => $ships, 'loot' => []];
    }

    // The defender's own timers have to run before their meters are read, or a
    // shield charged an hour ago through a build that has since finished would
    // be measured against stale building levels.
    resolve_timers($db, $planetId, $defenderId);

    // A missing generator or power plant is simply zero — an undeveloped colony
    // is trivially raidable, and it has nothing in its silo either. The state
    // calls are what create the rows and check the buildings; the charges then
    // come from the arrival timestamp, not from now (see meter_charge_at).
    $shield  = shield_state($db, $planetId, $defenderId);
    $battery = battery_state($db, $planetId, $defenderId);

    $shieldBefore = $shield
        ? meter_charge_at($db, 'hs_shield', $planetId, $defenderId, SHIELD_DRAIN_PER_HOUR, $arrivedAt)
        : 0.0;
    $batteryBefore = $battery
        ? meter_charge_at($db, 'hs_power_battery', $planetId, $defenderId,
                          battery_drain_per_hour((int)$battery['powerPlantLevel']), $arrivedAt)
        : 0.0;

    // First volley: the battery fires as the fleet arrives.
    $killed    = orbital_volley($db, $planetId, $defenderId, $ships);
    $survivors = max(0, $ships - $killed);
    $firepower = $survivors * (int)UNIT_COSTS['corvette']['firepower'];

    $won = $firepower >= $shieldBefore + $batteryBefore && $survivors > 0;

    if ($won) {
        $shieldAfter  = 0.0;
        $batteryAfter = 0.0;
    } else {
        // Damage lands anyway: shield first, the rest into the battery. Because
        // firepower is below the sum, the battery can never reach 0 here — a
        // repelled attack still softens the target for the next wave.
        $shieldAfter  = max(0.0, $shieldBefore - $firepower);
        $spill        = max(0.0, $firepower - $shieldBefore);
        $batteryAfter = max(0.0, $batteryBefore - $spill);
    }

    if ($shield)  set_meter_charge($db, 'hs_shield',        $planetId, $defenderId, $shieldAfter);
    if ($battery) set_meter_charge($db, 'hs_power_battery', $planetId, $defenderId, $batteryAfter);

    // Plunder: only on a victory, only on that order, and only if this silo has
    // not already been emptied inside the cooldown.
    $loot       = [];
    $plundered  = false;
    $lootVolley = 0;
    if ($won && $order === 'plunder' && !planet_plunder_locked($db, $planetId)) {
        // The fleet has to hold orbit and load — and the battery gets one more
        // shot at it while it does. This fires BEFORE the goods are taken, so a
        // defender's power cells can still be spent defending them.
        $lootVolley = orbital_volley($db, $planetId, $defenderId, $survivors);
        $survivors  = max(0, $survivors - $lootVolley);
        $killed    += $lootVolley;

        if ($survivors > 0) {
            $resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
            $resRow->execute([$planetId, $defenderId]);
            $res = $resRow->fetch() ?: [];

            $sets = [];
            foreach (RAID_LOOTABLE as $key) {
                $have = (int)floor((float)($res[$key] ?? 0));
                if ($have > 0) { $loot[$key] = $have; $sets[] = "$key = 0"; }
            }
            if ($sets) {
                $db->prepare(
                    'UPDATE hs_planet_resources SET ' . implode(', ', $sets) . ' WHERE planet_id=? AND player_id=?'
                )->execute([$planetId, $defenderId]);
                $plundered = true;
            }
        }
    }

    $result = [
        'ships'         => $ships,
        'lost'          => $killed,
        'survivors'     => $survivors,
        'firepower'     => $firepower,
        'order'         => $order,
        'shieldBefore'  => round($shieldBefore, 1),
        'shieldAfter'   => round($shieldAfter, 1),
        'batteryBefore' => round($batteryBefore, 1),
        'batteryAfter'  => round($batteryAfter, 1),
        'loot'          => $loot,
        'lootVolley'    => $lootVolley,
    ];

    // Stamped with the ARRIVAL, not with the moment it was computed — otherwise
    // the raid history would read as though the fleet turned up whenever the
    // attacker happened to open the game.
    $db->prepare(
        'INSERT INTO hs_battle_reports (attacker_id, defender_id, planet_id, fought_at, won, plundered, result)
         VALUES (?,?,?,?,?,?,?)'
    )->execute([$attackerId, $defenderId, $planetId, $arrivedAt, $won ? 1 : 0, $plundered ? 1 : 0, json_encode($result)]);

    return ['won' => $won, 'survivors' => $survivors, 'loot' => $loot, 'result' => $result];
}

function resolve_missions(PDO $db, int $playerId): void {
    // Re-entrancy guard, and the raid is what made it necessary: resolving an
    // attack calls resolve_timers() for the DEFENDER so their meters are current,
    // and the defender may have a raid of their own in flight against the
    // attacker. Two players raiding each other would otherwise resolve each
    // other forever. The guard covers the call while it is on the stack only —
    // a later call in the same request still runs normally.
    static $running = [];
    if (isset($running[$playerId])) return;
    $running[$playerId] = true;

    try {
        resolve_missions_inner($db, $playerId);
    } finally {
        unset($running[$playerId]);
    }
}

function resolve_missions_inner(PDO $db, int $playerId): void {
    migrate_cargo_missions($db);
    migrate_spy_missions($db);
    migrate_raid_missions($db);

    $done = $db->prepare(
        "SELECT id, type, from_planet_id, to_planet_id, leg, ships, raid_order, loot, ends_at
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

        // A raid is two legs, like a cargo run: the strike out, and the ships
        // that survived it coming home with whatever they took.
        if ($m['type'] === 'raid') {
            if ($m['leg'] === 'back') {
                // Home: hulls re-enter the dock, loot lands in the silo. Paid
                // through the cap-aware credit even though refined goods have no
                // cap — the one place that rule could change is here.
                $survivors = max(0, (int)$m['ships']);
                if ($survivors > 0) {
                    ensure_units_table($db);
                    $db->prepare(
                        "INSERT INTO hs_units (planet_id, player_id, unit_key, quantity)
                         VALUES (?,?,'corvette',?)
                         ON DUPLICATE KEY UPDATE quantity = quantity + ?"
                    )->execute([$toId, $playerId, $survivors, $survivors]);
                }
                $loot = json_decode((string)($m['loot'] ?? ''), true);
                if (is_array($loot) && $loot) {
                    credit_resources($db, $toId, $playerId, $loot, planet_storage_caps($db, $toId, $playerId));
                }
            } else {
                $battle = resolve_raid_battle(
                    $db, $playerId, $toId,
                    max(0, (int)$m['ships']),
                    ($m['raid_order'] ?? 'disable') === 'plunder' ? 'plunder' : 'disable',
                    (string)$m['ends_at']
                );

                // Only survivors fly home. A fleet wiped out over the target
                // starts no return leg at all — there is nothing left to fly it.
                $survivors = max(0, (int)($battle['survivors'] ?? 0));
                if ($survivors > 0) {
                    $sysRow = $db->prepare('SELECT system_id FROM hs_planets WHERE id=?');
                    $sysRow->execute([$fromId]);
                    $fromSys = (int)$sysRow->fetchColumn();
                    $sysRow->execute([$toId]);
                    $toSys   = (int)$sysRow->fetchColumn();

                    $db->prepare(
                        "INSERT INTO hs_missions (player_id, type, from_planet_id, to_planet_id, ends_at, leg, ships, loot)
                         VALUES (?,'raid',?,?, DATE_ADD(NOW(), INTERVAL ? SECOND), 'back', ?, ?)"
                    )->execute([
                        $playerId, $toId, $fromId,
                        raid_flight_seconds($db, $toSys, $fromSys),
                        $survivors,
                        json_encode($battle['loot'] ?? []),
                    ]);
                }
            }
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

// ── Salvage fishing ───────────────────────────────────────────────────────────
// Player-wide, not per planet: scrap is a currency, and one purse for four
// planets is what stops four planets being four incomes. Which planet you fish
// from decides flavour later, never amount.
function ensure_salvage(PDO $db, int $playerId): void {
    static $tableReady = false;
    if (!$tableReady) {
        try {
            $db->exec(
                'CREATE TABLE IF NOT EXISTS hs_salvage (
                   player_id INT NOT NULL,
                   scrap INT NOT NULL DEFAULT 0,
                   hold FLOAT NOT NULL DEFAULT 0,
                   hold_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   last_catch_at DATETIME NULL,
                   PRIMARY KEY (player_id)
                 )'
            );
            $db->exec(
                'CREATE TABLE IF NOT EXISTS hs_salvage_finds (
                   player_id INT NOT NULL,
                   find_key VARCHAR(32) NOT NULL,
                   found_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   PRIMARY KEY (player_id, find_key)
                 )'
            );
        } catch (\Throwable $e) {}
        $tableReady = true;
    }
    // A new player starts with a full hold. The tile opens with the very first
    // build, and an empty hold would meet them with a toy that pays nothing.
    $db->prepare(
        'INSERT IGNORE INTO hs_salvage (player_id, scrap, hold, hold_updated_at)
         VALUES (?, 0, ?, NOW())'
    )->execute([$playerId, SALVAGE_HOLD_MAX]);
}

// What is already in the cabinet. Three callers need it — the state block, the
// hold ceiling and the roll — so it is one query in one place.
function salvage_owned_finds(PDO $db, int $playerId): array {
    $rows = $db->prepare('SELECT find_key FROM hs_salvage_finds WHERE player_id=?');
    $rows->execute([$playerId]);
    return $rows->fetchAll(PDO::FETCH_COLUMN);
}

// The live hold: stored value plus what has regenerated since, clamped to the
// cap. Same no-cron trick as the recruit pool — an absent player finds a full
// hold, never a backlog. The cap itself is per player, because `hold` finds
// raise it permanently.
function salvage_state(PDO $db, int $playerId): array {
    ensure_salvage($db, $playerId);
    $row = $db->prepare(
        'SELECT scrap, hold, TIMESTAMPDIFF(SECOND, hold_updated_at, NOW()) AS elapsed
         FROM hs_salvage WHERE player_id=?'
    );
    $row->execute([$playerId]);
    $r = $row->fetch();

    $finds   = salvage_owned_finds($db, $playerId);
    $max     = salvage_hold_max($finds);
    $stored  = $r ? (float)$r['hold'] : $max;
    $elapsed = $r ? max(0, (int)$r['elapsed']) : 0;
    $hold    = min($max, $stored + SALVAGE_HOLD_PER_HOUR * ($elapsed / 3600.0));

    return [
        'scrap'       => $r ? (int)$r['scrap'] : 0,
        'hold'        => round($hold, 3),
        'holdMax'     => $max,
        'holdPerHour' => SALVAGE_HOLD_PER_HOUR,
        'finds'       => $finds,
    ];
}

// Artefacts are unique per player, so the roll only ever considers what is not
// already in the cabinet and stops entirely once the list is exhausted. That
// uniqueness IS the rate limit — there is nothing here to farm however often
// the client claims a hit.
function salvage_roll_find(PDO $db, int $playerId): string|null {
    if (!SALVAGE_FINDS) return null;
    if (mt_rand(1, 10000) > (int)round(SALVAGE_FIND_CHANCE * 10000)) return null;

    $pool = array_values(array_diff(array_keys(SALVAGE_FINDS), salvage_owned_finds($db, $playerId)));
    if (!$pool) return null;
    return $pool[mt_rand(0, count($pool) - 1)];
}

// Pays out an artefact's one-off. Call it AFTER the find is recorded: the hold
// bonus reads the cabinet back to work out the new ceiling, and the entry has
// to be in there for that number to include itself.
//
// The return value is what the panel prints. It says what was actually granted
// rather than what the catalogue promises — a capped store or a missing planet
// changes the answer, and the line under the toast should not lie about it.
function salvage_apply_find(PDO $db, int $playerId, ?int $planetId, string $key): array {
    $effect = SALVAGE_FINDS[$key]['effect'] ?? null;
    if (!$effect) return [];

    switch ($effect['type']) {
        case 'hold':
            // The bonus arrives as free room as well, not merely as a higher
            // ceiling: a permanent +25 that only pays out over the next two
            // hours of regeneration would not read as a reward at all.
            $max = salvage_hold_max(salvage_owned_finds($db, $playerId));
            $db->prepare('UPDATE hs_salvage SET hold = LEAST(hold + ?, ?) WHERE player_id=?')
               ->execute([(float)$effect['amount'], $max, $playerId]);
            return ['type' => 'hold', 'amount' => (int)$effect['amount']];

        case 'scrap':
            // Straight into the purse, past the hold — same licence the finds
            // themselves have, and safe for the same reason: it happens once.
            $db->prepare('UPDATE hs_salvage SET scrap = scrap + ? WHERE player_id=?')
               ->execute([(int)$effect['amount'], $playerId]);
            return ['type' => 'scrap', 'amount' => (int)$effect['amount']];

        case 'resources':
            // Capped on delivery like every other payout in the game, so a full
            // store keeps what fits and nothing more.
            if (!$planetId) return ['type' => 'resources', 'resources' => []];
            credit_resources(
                $db, $planetId, $playerId,
                $effect['resources'],
                planet_storage_caps($db, $planetId, $playerId)
            );
            return ['type' => 'resources', 'resources' => $effect['resources']];

        case 'portrait':
            // Nothing to do here. The profile panel reads the cabinet and adds
            // the avatar to its picker — the server only records that it is owned.
            return ['type' => 'portrait', 'portrait' => $effect['portrait']];
    }
    return [];
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
    return storage_caps_from_levels(standing_building_levels($db, $planetId, $playerId));
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

// building_key => level for everything standing on the planet, at the level it
// *currently* operates at. A building being upgraded keeps its old level here:
// a Lv3 metal mine upgrading to Lv4 is still a working Lv3 mine, it does not
// shut down for the duration. This used to filter on `build_ends_at IS NULL`,
// which dropped the row entirely and stopped the mine's production, its storage
// cap and its energy output for the whole upgrade — while the client kept
// previewing the old rate, so every stock snapped back to its pre-upgrade
// value on the next sync.
// Level 0 is still excluded: a *first* build is a construction site, not a
// building, and produces nothing until it finishes.
// For what a building *reserves* (energy, workers), see effective_building_levels().
function standing_building_levels(PDO $db, int $planetId, int $playerId): array {
    $rows = $db->prepare(
        'SELECT building_key, level FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND level>0'
    );
    $rows->execute([$planetId, $playerId]);
    $levels = [];
    foreach ($rows->fetchAll() as $b) $levels[$b['building_key']] = (int)$b['level'];
    return $levels;
}

// building_key => level a building's *upkeep* is charged at. A running build
// already draws the energy and the workers of the level it is heading for —
// mirrors effectiveLevel() in useHawkStar.js, which is what the build buttons
// check against, so client and server reserve the same amount. Includes a
// first build (level 0 + running timer = level 1 reserved).
function effective_building_levels(PDO $db, int $planetId, int $playerId): array {
    $rows = $db->prepare(
        'SELECT building_key, level, build_ends_at FROM hs_buildings
         WHERE planet_id=? AND player_id=? AND (level>0 OR build_ends_at IS NOT NULL)'
    );
    $rows->execute([$planetId, $playerId]);
    $levels = [];
    foreach ($rows->fetchAll() as $b) {
        $levels[$b['building_key']] = (int)$b['level'] + ($b['build_ends_at'] !== null ? 1 : 0);
    }
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
    $levels = standing_building_levels($db, $planetId, $playerId);
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
        // Present only on the cards that are flown rather than clicked. Read
        // live from the config rather than stored on the row: unlike the payouts
        // — which are frozen at creation so an offer can never change under the
        // player — this only says HOW the card is answered, and a card that
        // stayed clickable because it was rolled before the feature shipped
        // would be a puzzle rather than a promise kept.
        'minigame'  => anomaly_def($row['type'])['minigame'] ?? null,
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
    accrue_resources($db, $planetId, $playerId);
}

// Credits everything the planet made between its last accrual and $untilTs
// (default: now), at the rates that hold *for that stretch*. The cutoff is what
// resolve_buildings() uses to close the books at the second an upgrade lands:
// without it the whole offline stretch was paid out at the new level, so a 24h
// mine upgrade collected 24h of Lv4 output for 24h of Lv3 work.
function accrue_resources(PDO $db, int $planetId, int $playerId, ?int $untilTs = null): void {
    migrate_refined_resources($db);

    $row = $db->prepare(
        'SELECT *, UNIX_TIMESTAMP(resources_computed_at) AS computed_ts, UNIX_TIMESTAMP(NOW()) AS now_ts
         FROM hs_planet_resources WHERE planet_id=? AND player_id=?'
    );
    $row->execute([$planetId, $playerId]);
    $r = $row->fetch();
    if (!$r) return;

    $nowTs = $untilTs ?? (int)$r['now_ts'];

    // A row that has never been stamped (NULL / zero date) has nothing to accrue
    // *from* — start its clock here rather than reading the gap as "since 1970"
    // and paying out the full 24h cap.
    $computedTs = (int)$r['computed_ts'];
    if ($computedTs <= 0) {
        $db->prepare(
            'UPDATE hs_planet_resources SET resources_computed_at = FROM_UNIXTIME(?)
             WHERE planet_id=? AND player_id=?'
        )->execute([$nowTs, $planetId, $playerId]);
        return;
    }

    $elapsed = $nowTs - $computedTs;
    if ($elapsed < 1) return;

    $elapsed = min($elapsed, 86400);

    $levels = standing_building_levels($db, $planetId, $playerId);

    // Two different questions, two different level sets: what a building *makes*
    // it makes at the level standing today, what it *costs* it costs at the level
    // it is being upgraded to. canBuild() in useHawkStar.js refuses any build that
    // would push the balance negative, so charging the new drain up front cannot
    // brown out a planet on its own.
    $energyProd  = 0;
    foreach ($levels as $key => $lvl) {
        $def = level_def($key, $lvl);
        if (!$def) continue;
        $energyProd += $def['production']['energy'] ?? 0;
    }
    $energyDrain = 0;
    foreach (effective_building_levels($db, $planetId, $playerId) as $key => $lvl) {
        $def = level_def($key, $lvl);
        if (!$def) continue;
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
    $sets[] = 'resources_computed_at = FROM_UNIXTIME(?)';
    $vals   = [...array_values($updates), $nowTs, $planetId, $playerId];

    $db->prepare(
        'UPDATE hs_planet_resources SET ' . implode(', ', $sets) . ' WHERE planet_id=? AND player_id=?'
    )->execute($vals);
}
