<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId    = (int)($b['planetId']    ?? 0);
$buildingKey = trim($b['buildingKey']  ?? '');
$recipeIndex = (int)($b['recipeIndex'] ?? 0);
$count       = max(1, (int)($b['count'] ?? 1));

if (!$planetId || !$buildingKey) fail('planetId and buildingKey required');

$def = building_def($buildingKey);
if (!$def || empty($def['conversions'])) fail('No conversions for this building');

$recipe = $def['conversions'][$recipeIndex] ?? null;
if (!$recipe) fail('Invalid recipe index');

$db = getDB();

// Verify ownership and building level > 0
$own = $db->prepare(
    'SELECT p.type FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

// Resolve completed build timers first, so a freshly-finished refinery
// (build_ends_at just elapsed client-side) can convert without a page reload.
resolve_timers($db, $planetId, $playerId);

$bRow = $db->prepare('SELECT level FROM hs_buildings WHERE planet_id=? AND player_id=? AND building_key=? AND level>0 AND build_ends_at IS NULL');
$bRow->execute([$planetId, $playerId, $buildingKey]);
$bLevel = (int)($bRow->fetchColumn() ?: 0);
if ($bLevel < 1) fail('Building not constructed or in progress');

compute_resources($db, $planetId, $playerId, $planet['type']);

// Check total cost (recipe input × count)
$totalCost = [];
foreach ($recipe['input'] as $res => $amt) {
    $totalCost[$res] = $amt * $count;
}
$resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$resRow->execute([$planetId, $playerId]);
$res = $resRow->fetch();
foreach ($totalCost as $resource => $amount) {
    if (($res[$resource] ?? 0) < $amount) fail("Not enough $resource");
}

// Deduct cost
$sets = array_map(fn($r) => "$r = $r - ?", array_keys($totalCost));
$db->prepare(
    'UPDATE hs_planet_resources SET ' . implode(', ', $sets) . ' WHERE planet_id=? AND player_id=?'
)->execute([...array_values($totalCost), $planetId, $playerId]);

// Duration per batch: durationBase / building level (higher level = faster)
$duration = max(1, (int)ceil($recipe['durationBase'] / $bLevel));
$totalDuration = $duration * $count;

// One queue row per (building, recipe) — ordering more DEEPENS it, it never
// opens a second production line. A plain INSERT here meant that clicking twice
// while a job ran created two rows that resolved side by side, which quietly
// doubled a refinery's throughput for the price of a second click. The queue is
// the intended shape: `remaining` counts the runs still to come.
$existing = $db->prepare(
    'SELECT id, UNIX_TIMESTAMP(ends_at) AS ends_ts FROM hs_conversion_queues
     WHERE planet_id=? AND player_id=? AND building_key=? AND recipe_index=?'
);
$existing->execute([$planetId, $playerId, $buildingKey, $recipeIndex]);
$queue = $existing->fetch();

if ($queue) {
    $db->prepare('UPDATE hs_conversion_queues SET remaining = remaining + ? WHERE id=?')
       ->execute([$count, $queue['id']]);

    // The running batch keeps its own clock — only the tail grew.
    ok([
        'endsAt'        => (int)$queue['ends_ts'] * 1000,
        'count'         => $count,
        'queued'        => true,
        'totalDuration' => $totalDuration,
    ]);
}

$db->prepare(
    'INSERT INTO hs_conversion_queues (planet_id, player_id, building_key, recipe_index, ends_at, remaining)
     VALUES (?,?,?,?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?)'
)->execute([$planetId, $playerId, $buildingKey, $recipeIndex, $duration, $count - 1]);

ok([
    'endsAt'        => (time() + $duration) * 1000,
    'count'         => $count,
    'queued'        => false,
    'totalDuration' => $totalDuration,
]);
