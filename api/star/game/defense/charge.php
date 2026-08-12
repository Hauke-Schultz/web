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

// Settle timers and credit production first — the click costs crystal, so it has
// to be checked against the stock the player actually has right now.
resolve_timers($db, $planetId, $playerId);

if (shield_generator_level($db, $planetId, $playerId) <= 0) fail('No shield generator on this planet');

compute_resources($db, $planetId, $playerId, $planet['type']);

ensure_shield($db, $planetId, $playerId);

// Refuse a click that would be paid for but wasted: at full strength there is
// nothing to add, and charging anyway would silently burn the crystal.
$row = $db->prepare(
    'SELECT charge, TIMESTAMPDIFF(SECOND, charge_updated_at, NOW()) AS elapsed
     FROM hs_shield WHERE planet_id=? AND player_id=?'
);
$row->execute([$planetId, $playerId]);
$s    = $row->fetch();
$live = max(0.0, (float)$s['charge'] - SHIELD_DRAIN_PER_HOUR * ((int)$s['elapsed'] / 3600.0));
if ($live >= SHIELD_MAX) fail('Shield already at full strength');

$resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$resRow->execute([$planetId, $playerId]);
$have = $resRow->fetch() ?: [];
foreach (SHIELD_CLICK_COST as $res => $amt) {
    if ((float)($have[$res] ?? 0) < $amt) fail('Not enough ' . $res);
}

foreach (SHIELD_CLICK_COST as $res => $amt) {
    $db->prepare(
        "UPDATE hs_planet_resources SET $res = GREATEST(0, $res - ?)
         WHERE planet_id=? AND player_id=?"
    )->execute([$amt, $planetId, $playerId]);
}

$db->prepare(
    'UPDATE hs_shield SET charge=?, charge_updated_at=NOW()
     WHERE planet_id=? AND player_id=?'
)->execute([min(SHIELD_MAX, $live + SHIELD_CLICK), $planetId, $playerId]);

// The cost came out of the stock, so the client gets the fresh resource row with
// it — otherwise the crystal count would stay stale until the next sync.
$resRow->execute([$planetId, $playerId]);
$res = $resRow->fetch();
unset($res['planet_id'], $res['player_id'], $res['resources_computed_at']);

ok([
    'shield'    => shield_state($db, $planetId, $playerId),
    'resources' => $res,
]);
