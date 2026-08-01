<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$buildingKey = trim($b['buildingKey'] ?? '');

if (!$buildingKey) fail('buildingKey required');
if (!is_global($buildingKey)) fail('Use /game/build for planet buildings');

$def = building_def($buildingKey);
if (!$def) fail('Unknown building');

$db = getDB();

// Resolve completed global-research timers first, so a freshly-finished
// prerequisite (e.g. star_map that just completed client-side) counts toward
// the requirement check below without needing a page reload.
resolve_global_research($db, $playerId);

// Load current research state
$rRow = $db->prepare('SELECT level, build_ends_at FROM hs_global_research WHERE player_id=? AND building_key=?');
$rRow->execute([$playerId, $buildingKey]);
$current = $rRow->fetch() ?: ['level' => 0, 'build_ends_at' => null];

if ($current['build_ends_at']) fail('Research already in progress');

$currentLevel = (int)$current['level'];
$nextLevel    = $currentLevel + 1;
$levelDef     = level_def($buildingKey, $nextLevel);
if (!$levelDef) fail('Already at max level');

// requiresBuilding check (e.g. interstellar_comm requires star_map lv3)
if (!empty($def['requiresBuilding'])) {
    $reqKey   = $def['requiresBuilding'];
    $reqLevel = $def['requiresLevel'] ?? 1;
    $reqRow   = $db->prepare('SELECT level FROM hs_global_research WHERE player_id=? AND building_key=?');
    $reqRow->execute([$playerId, $reqKey]);
    if ((int)($reqRow->fetchColumn() ?: 0) < $reqLevel) {
        fail("Requires $reqKey level $reqLevel");
    }
}

// One global research at a time
$inProgress = $db->prepare(
    'SELECT COUNT(*) FROM hs_global_research WHERE player_id=? AND build_ends_at IS NOT NULL'
);
$inProgress->execute([$playerId]);
if ((int)$inProgress->fetchColumn() > 0) fail('Another research is already in progress');

// Cost deducted from home planet
$homePlanet = $db->prepare(
    'SELECT po.planet_id, p.type FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.player_id=? AND po.is_home=1'
);
$homePlanet->execute([$playerId]);
$home = $homePlanet->fetch();
if (!$home) fail('Home planet not found', 500);

compute_resources($db, $home['planet_id'], $playerId, $home['type']);

$cost = $levelDef['cost'] ?? [];
if (!empty($cost)) {
    $resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
    $resRow->execute([$home['planet_id'], $playerId]);
    $res = $resRow->fetch();
    foreach ($cost as $resource => $amount) {
        if (($res[$resource] ?? 0) < $amount) fail("Not enough $resource");
    }
    $sets = array_map(fn($r) => "$r = $r - ?", array_keys($cost));
    $db->prepare(
        'UPDATE hs_planet_resources SET ' . implode(', ', $sets) .
        ' WHERE planet_id=? AND player_id=?'
    )->execute([...array_values($cost), $home['planet_id'], $playerId]);
}

$buildTime = $levelDef['buildTime'];
$db->prepare(
    'INSERT INTO hs_global_research (player_id, building_key, level, build_ends_at)
     VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE build_ends_at = DATE_ADD(NOW(), INTERVAL ? SECOND)'
)->execute([$playerId, $buildingKey, $currentLevel, $buildTime, $buildTime]);

$endsAt = $db->prepare('SELECT build_ends_at FROM hs_global_research WHERE player_id=? AND building_key=?');
$endsAt->execute([$playerId, $buildingKey]);

ok(['buildingKey' => $buildingKey, 'endsAt' => strtotime($endsAt->fetchColumn()) * 1000]);
