<?php
/**
 * Set the cargo drone's manifest.
 *
 * The client sends the FULL desired hold, not a delta — the server diffs it
 * against what is stored and moves the difference on or off the planet. That
 * makes the call idempotent (a lost response can simply be retried) and lets
 * "unload all" be an ordinary write of an empty manifest.
 */
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId = (int)($b['planetId'] ?? 0);
$wanted   = $b['cargo'] ?? [];

if (!$planetId)         fail('planetId required');
if (!is_array($wanted)) fail('cargo must be an object');

$db = getDB();

$own = $db->prepare(
    'SELECT p.type FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

resolve_timers($db, $planetId, $playerId);
ensure_cargo_table($db);

// Normalise the request: whitelist, integers, drop zeroes
$target = [];
foreach ($wanted as $res => $amt) {
    if (!in_array($res, CARGO_LOADABLE, true)) fail("$res cannot be loaded onto a cargo drone");
    $amt = (int)$amt;
    if ($amt < 0) fail('Cargo amounts cannot be negative');
    if ($amt > 0) $target[$res] = $amt;
}
if (array_sum($target) > CARGO_CAPACITY) {
    fail('The hold only takes ' . CARGO_CAPACITY . ' items');
}

// The drone has to exist and be sitting in the dock — a manifest cannot be
// changed while it is in flight.
$row = $db->prepare('SELECT cargo, mission_id FROM hs_cargo WHERE planet_id=? AND player_id=?');
$row->execute([$planetId, $playerId]);
$record = $row->fetch();
if (!$record)                     fail('No cargo drone on this planet');
if ($record['mission_id'] !== null) fail('The cargo drone is in flight');

$current = json_decode($record['cargo'] ?? '{}', true);
if (!is_array($current)) $current = [];

// Loading takes the goods off the planet immediately, so the same unit can never
// be spent twice while the drone is away. Unloading puts them straight back.
compute_resources($db, $planetId, $playerId, $planet['type']);

$resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$resRow->execute([$planetId, $playerId]);
$res = $resRow->fetch();

$deltas = [];
foreach (CARGO_LOADABLE as $key) {
    $diff = ($target[$key] ?? 0) - ($current[$key] ?? 0);
    if ($diff === 0) continue;
    if ($diff > 0 && ($res[$key] ?? 0) < $diff) fail("Not enough $key on this planet");
    $deltas[$key] = $diff;
}

if ($deltas) {
    $sets = array_map(fn($k) => "$k = GREATEST(0, $k - ?)", array_keys($deltas));
    $db->prepare(
        'UPDATE hs_planet_resources SET ' . implode(', ', $sets) . ' WHERE planet_id=? AND player_id=?'
    )->execute([...array_values($deltas), $planetId, $playerId]);
}

$db->prepare('UPDATE hs_cargo SET cargo=? WHERE planet_id=? AND player_id=?')
   ->execute([json_encode($target), $planetId, $playerId]);

ok([
    'cargo' => (object)$target,
    'total' => array_sum($target),
]);
