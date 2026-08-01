<?php
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId = (int)($b['planetId'] ?? 0);
if (!$planetId) fail('planetId required');

$db = getDB();

// Verify ownership
$own = $db->prepare(
    'SELECT p.type FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

// Resolve completed timers, then credit production up to now (gated by battery
// uptime in compute_resources) before topping the battery back up.
resolve_timers($db, $planetId, $playerId);

$ppLevel = power_plant_level($db, $planetId, $playerId);
if ($ppLevel <= 0) fail('No power plant on this planet');

compute_resources($db, $planetId, $playerId, $planet['type']);

ensure_power_battery($db, $planetId, $playerId);

// Read current live charge, add one click, clamp to max, re-anchor to now.
$row = $db->prepare(
    'SELECT charge, TIMESTAMPDIFF(SECOND, charge_updated_at, NOW()) AS elapsed
     FROM hs_power_battery WHERE planet_id=? AND player_id=?'
);
$row->execute([$planetId, $playerId]);
$bb           = $row->fetch();
$drainPerHour = battery_drain_per_hour($ppLevel);
$live         = max(0.0, (float)$bb['charge'] - $drainPerHour * ((int)$bb['elapsed'] / 3600.0));
$newVal       = min(POWER_BATTERY_MAX, $live + POWER_BATTERY_CLICK);

$db->prepare(
    'UPDATE hs_power_battery SET charge=?, charge_updated_at=NOW()
     WHERE planet_id=? AND player_id=?'
)->execute([$newVal, $planetId, $playerId]);

ok(battery_state($db, $planetId, $playerId));
