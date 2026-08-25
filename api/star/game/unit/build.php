<?php
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId = (int)($b['planetId'] ?? 0);
$unitKey  = trim($b['unitKey']  ?? '');
// Only batchable units read `count`; everything else stays one per build.
$count    = max(1, (int)($b['count'] ?? 1));

if (!$planetId || !$unitKey) fail('planetId and unitKey required');

$def = UNIT_COSTS[$unitKey] ?? null;
if (!$def) fail('Unknown unit');

if (!in_array($unitKey, UNIT_BATCH_KEYS, true)) $count = 1;

$db = getDB();

// Verify ownership
$own = $db->prepare(
    'SELECT p.type, po.is_home FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

// Everything that flies is built at the home planet — a colony is a resource
// base, not a second shipyard. The cargo drone carries no 'homeOnly' flag and
// is therefore the one unit a colony can produce.
if (!empty($def['homeOnly']) && !$planet['is_home']) {
    fail('This unit can only be built on your home planet');
}

// Resolve timers first so a dock building that just finished counts here.
resolve_timers($db, $planetId, $playerId);

// The unit's production facility must be finished before units can be produced.
// One facility serves a whole unit class, so it is named explicitly per unit
// rather than derived from the unit key.
$facility = $def['facility'] ?? $unitKey;
$builtRow = $db->prepare(
    'SELECT level FROM hs_buildings
     WHERE planet_id=? AND player_id=? AND building_key=? AND level>0 AND build_ends_at IS NULL'
);
$builtRow->execute([$planetId, $playerId, $facility]);
if (!$builtRow->fetch()) fail('Facility for this unit is not built on this planet');

// Only one unit of a kind in production at a time
$current = $db->prepare('SELECT build_ends_at FROM hs_units WHERE planet_id=? AND player_id=? AND unit_key=?');
$current->execute([$planetId, $playerId, $unitKey]);
if ($current->fetchColumn()) fail('Unit already in production');

// The cargo drone is limited to one per planet — not one in the dock, one in
// existence. Its hs_cargo row is created here and never deleted, so it blocks a
// rebuild whether the drone is in production, docked, loaded or away on a run.
if ($unitKey === 'cargo_drone') {
    ensure_cargo_table($db);
    $existing = $db->prepare('SELECT 1 FROM hs_cargo WHERE planet_id=? AND player_id=?');
    $existing->execute([$planetId, $playerId]);
    if ($existing->fetch()) fail('This planet already has a cargo drone');
}

// Warships need a berth. The weapons_building is the gate as well as the cap:
// without one there is no fleet at all, and hulls already docked or already in
// the running batch count against the limit.
if ($unitKey === 'corvette') {
    $cap  = fleet_cap($db, $planetId, $playerId);
    if ($cap < 1) fail('No weapons building on this planet — warships need one');
    $free = $cap - fleet_size($db, $planetId, $playerId);
    if ($free < 1) fail("Fleet limit reached ($cap ships)");
    if ($count > $free) $count = $free;
}

// Check & deduct cost
compute_resources($db, $planetId, $playerId, $planet['type']);

// Crewed units (colony ship, corvette) take their crew out of the free workers
$crew = (float)($def['crew'] ?? 0) * $count;
if ($crew > 0 && free_workers($db, $planetId, $playerId) < $crew) {
    fail("Not enough free workers — this order needs a crew of " . (int)$crew);
}

// The whole batch is paid for up front, exactly like a conversion order.
$cost = [];
foreach ($def['cost'] as $resource => $amount) {
    $cost[$resource] = $amount * $count;
}
$resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$resRow->execute([$planetId, $playerId]);
$res = $resRow->fetch();
foreach ($cost as $resource => $amount) {
    if (($res[$resource] ?? 0) < $amount) fail("Not enough $resource");
}
$sets = array_map(fn($r) => "$r = $r - ?", array_keys($cost));
$db->prepare(
    'UPDATE hs_planet_resources SET ' . implode(', ', $sets) . ' WHERE planet_id=? AND player_id=?'
)->execute([...array_values($cost), $planetId, $playerId]);

// The crew boards right away — they are gone from this planet from now on
if ($crew > 0) {
    $db->prepare(
        'UPDATE hs_planet_resources SET population = GREATEST(0, population - ?)
         WHERE planet_id=? AND player_id=?'
    )->execute([$crew, $planetId, $playerId]);
}

// Queue the build. A batch is ONE timer over the whole order — the squadron
// lands together, so ordering four does not shorten anything, it only saves
// three clicks and the returns in between.
$buildTime = (int)$def['buildTimeBase'] * $count;
$db->prepare(
    'INSERT INTO hs_units (planet_id, player_id, unit_key, quantity, build_ends_at, build_started_at, build_count)
     VALUES (?,?,?,0, DATE_ADD(NOW(), INTERVAL ? SECOND), NOW(), ?)
     ON DUPLICATE KEY UPDATE build_ends_at = DATE_ADD(NOW(), INTERVAL ? SECOND), build_started_at = NOW(), build_count = ?'
)->execute([$planetId, $playerId, $unitKey, $buildTime, $count, $buildTime, $count]);

// Claim the planet's cargo-drone slot as soon as the build starts
if ($unitKey === 'cargo_drone') {
    $db->prepare(
        "INSERT IGNORE INTO hs_cargo (planet_id, player_id, cargo, mission_id) VALUES (?,?,'{}',NULL)"
    )->execute([$planetId, $playerId]);
}

ok([
    'unitKey'        => $unitKey,
    'endsAt'         => (time() + $buildTime) * 1000,
    'buildStartedAt' => time() * 1000,
    'crew'           => $crew,
    // May be lower than requested — the fleet limit clamps the order.
    'count'          => $count,
]);
