<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../config.php';
method('POST');

$jwt       = auth();
$playerId  = (int)$jwt['sub'];
$data      = body();
$planetId  = (int)($data['planetId']  ?? 0);
$cellIndex = isset($data['cellIndex']) ? (int)$data['cellIndex'] : -1;

if (!$planetId)               fail('planetId required');
if ($cellIndex < 0 || $cellIndex > 8) fail('cellIndex must be 0–8');

$db = getDB();

$own = $db->prepare(
    'SELECT p.type FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id = po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);
$planetType = $planet['type'];

$farmStmt = $db->prepare(
    "SELECT level FROM hs_buildings
     WHERE planet_id=? AND player_id=? AND building_key='farm' AND build_ends_at IS NULL"
);
$farmStmt->execute([$planetId, $playerId]);
$farmLevel = (int)($farmStmt->fetchColumn() ?: 0);
if ($farmLevel === 0) fail('Farm not built');

$agriStmt = $db->prepare('SELECT current_grid FROM hs_agriculture WHERE planet_id=? AND player_id=?');
$agriStmt->execute([$planetId, $playerId]);
$agri = $agriStmt->fetch();
if (!$agri) fail('No agriculture state — load state first');

$cells = $agri['current_grid'] ? json_decode($agri['current_grid'], true) : null;
if (!$cells || !isset($cells[$cellIndex])) fail('Invalid cell index');

$cell  = $cells[$cellIndex];
$nowMs = (int)(microtime(true) * 1000);

if ($cell['growsAt'] > $nowMs) fail('Cell not ready yet');

// Credit resources
$caps  = [];
$bRows = $db->prepare(
    'SELECT building_key, level FROM hs_buildings
     WHERE planet_id=? AND player_id=? AND level>0 AND build_ends_at IS NULL'
);
$bRows->execute([$planetId, $playerId]);
foreach ($bRows->fetchAll() as $b) {
    $def = level_def($b['building_key'], (int)$b['level']);
    foreach (($def['storageCapacity'] ?? []) as $r => $cap) {
        $caps[$r] = ($caps[$r] ?? 0) + $cap;
    }
}

$harvested = $cell['yield'];
foreach ($harvested as $res => $amt) {
    if (!in_array($res, RESOURCE_KEYS, true)) continue;
    if (isset($caps[$res])) {
        $db->prepare(
            "UPDATE hs_planet_resources SET $res = LEAST($res + ?, ?) WHERE planet_id=? AND player_id=?"
        )->execute([$amt, $caps[$res], $planetId, $playerId]);
    } else {
        $db->prepare(
            "UPDATE hs_planet_resources SET $res = $res + ? WHERE planet_id=? AND player_id=?"
        )->execute([$amt, $planetId, $playerId]);
    }
}

// Reset the harvested cell with a new crop + new timer
$cells[$cellIndex] = reset_cell($farmLevel, $planetType);

$db->prepare(
    'UPDATE hs_agriculture SET current_grid=? WHERE planet_id=? AND player_id=?'
)->execute([json_encode($cells, JSON_UNESCAPED_UNICODE), $planetId, $playerId]);

// Return harvested amounts + new cell state (with ready flag)
$newCell           = $cells[$cellIndex];
$newCell['ready']  = $newCell['growsAt'] <= $nowMs;

ok([
    'harvested' => $harvested,
    'cell'      => $newCell,
]);
