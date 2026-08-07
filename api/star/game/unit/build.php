<?php
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId = (int)($b['planetId'] ?? 0);
$unitKey  = trim($b['unitKey']  ?? '');

if (!$planetId || !$unitKey) fail('planetId and unitKey required');

$def = UNIT_COSTS[$unitKey] ?? null;
if (!$def) fail('Unknown unit');

$db = getDB();

// Verify ownership
$own = $db->prepare(
    'SELECT p.type FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

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

// Check & deduct cost
compute_resources($db, $planetId, $playerId, $planet['type']);

// Crewed units (colony ship) take their settlers out of the free workers
$crew = (float)($def['crew'] ?? 0);
if ($crew > 0 && free_workers($db, $planetId, $playerId) < $crew) {
    fail("Not enough free workers — this unit needs a crew of " . (int)$crew);
}

$cost   = $def['cost'];
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

// Queue the build
$buildTime = (int)$def['buildTimeBase'];
$db->prepare(
    'INSERT INTO hs_units (planet_id, player_id, unit_key, quantity, build_ends_at, build_started_at)
     VALUES (?,?,?,0, DATE_ADD(NOW(), INTERVAL ? SECOND), NOW())
     ON DUPLICATE KEY UPDATE build_ends_at = DATE_ADD(NOW(), INTERVAL ? SECOND), build_started_at = NOW()'
)->execute([$planetId, $playerId, $unitKey, $buildTime, $buildTime]);

ok([
    'unitKey'        => $unitKey,
    'endsAt'         => (time() + $buildTime) * 1000,
    'buildStartedAt' => time() * 1000,
    'crew'           => $crew,
]);
