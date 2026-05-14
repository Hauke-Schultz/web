<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId    = (int)($b['planetId']    ?? 0);
$buildingKey = trim($b['buildingKey']  ?? '');

if (!$planetId || !$buildingKey) fail('planetId and buildingKey required');

$def = building_def($buildingKey);
if (!$def) fail('Unknown building');
if (is_global($buildingKey)) fail('Use /game/research for global research', 400);

$db = getDB();

// Verify ownership
$own = $db->prepare(
    'SELECT p.type FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

// Planet type restriction
if (!empty($def['planetTypes']) && !in_array($planet['type'], $def['planetTypes'], true)) {
    fail('Building not available on this planet type');
}

// Load current building state
$bRow = $db->prepare('SELECT level, build_ends_at FROM hs_buildings WHERE planet_id=? AND player_id=? AND building_key=?');
$bRow->execute([$planetId, $playerId, $buildingKey]);
$current = $bRow->fetch() ?: ['level' => 0, 'build_ends_at' => null];

if ($current['build_ends_at']) fail('Building already in progress');

$currentLevel = (int)$current['level'];
$nextLevel    = $currentLevel + 1;
$levelDef     = level_def($buildingKey, $nextLevel);
if (!$levelDef) fail('Already at max level');

// requiresBuilding check
if (!empty($def['requiresBuilding'])) {
    $reqKey   = $def['requiresBuilding'];
    $reqLevel = $def['requiresLevel'] ?? 1;
    $reqRow   = $db->prepare('SELECT level FROM hs_buildings WHERE planet_id=? AND player_id=? AND building_key=?');
    $reqRow->execute([$planetId, $playerId, $reqKey]);
    $reqCurrent = (int)($reqRow->fetchColumn() ?: 0);
    if ($reqCurrent < $reqLevel) fail("Requires $reqKey level $reqLevel");
}

// Check one build at a time (per planet)
$inProgress = $db->prepare(
    'SELECT COUNT(*) FROM hs_buildings WHERE planet_id=? AND player_id=? AND build_ends_at IS NOT NULL'
);
$inProgress->execute([$planetId, $playerId]);
if ((int)$inProgress->fetchColumn() > 0) fail('Another building is already in progress on this planet');

// Lazy resource computation before deducting cost
compute_resources($db, $planetId, $playerId, $planet['type']);

// Check & deduct cost
$cost = $levelDef['cost'] ?? [];
if (!empty($cost)) {
    $resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
    $resRow->execute([$planetId, $playerId]);
    $res = $resRow->fetch();
    foreach ($cost as $resource => $amount) {
        if (($res[$resource] ?? 0) < $amount) fail("Not enough $resource");
    }
    $sets = array_map(fn($r) => "$r = $r - ?", array_keys($cost));
    $db->prepare(
        'UPDATE hs_planet_resources SET ' . implode(', ', $sets) .
        ' WHERE planet_id=? AND player_id=?'
    )->execute([...array_values($cost), $planetId, $playerId]);
}

// Queue build
$buildTime = $levelDef['buildTime'];
$db->prepare(
    'INSERT INTO hs_buildings (planet_id, player_id, building_key, level, build_ends_at)
     VALUES (?,?,?,?, DATE_ADD(NOW(), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE build_ends_at = DATE_ADD(NOW(), INTERVAL ? SECOND)'
)->execute([$planetId, $playerId, $buildingKey, $currentLevel, $buildTime, $buildTime]);

$endsAt = $db->prepare('SELECT build_ends_at FROM hs_buildings WHERE planet_id=? AND player_id=? AND building_key=?');
$endsAt->execute([$planetId, $playerId, $buildingKey]);
$endsAtVal = $endsAt->fetchColumn();

ok(['buildingKey' => $buildingKey, 'endsAt' => strtotime($endsAtVal) * 1000]);
