<?php
// Shoots one foreign satellite out of this planet's orbit. This is what replaced
// the satellite's 168 h lifetime: espionage now ends because somebody ends it.
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId = (int)($b['planetId'] ?? 0);
$targetId = (int)($b['targetPlayerId'] ?? 0);
if (!$planetId) fail('planetId required');
if (!$targetId) fail('targetPlayerId required');

$db = getDB();

// Verify ownership
$own = $db->prepare(
    'SELECT p.type, p.name FROM hs_planet_ownership po JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

// The shot costs a power cell, so the stock has to be settled first — same
// order as the shield charge click.
resolve_timers($db, $planetId, $playerId);

if (orbital_defense_level($db, $planetId, $playerId) <= 0) {
    fail('No orbital defense on this planet');
}

compute_resources($db, $planetId, $playerId, $planet['type']);

$resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$resRow->execute([$planetId, $playerId]);
$have = $resRow->fetch() ?: [];
foreach (INTERCEPT_COST as $res => $amt) {
    if ((float)($have[$res] ?? 0) < $amt) fail('Not enough ' . $res);
}

// Claim the kill BEFORE charging for it: two fast clicks on the same target
// would otherwise pay twice for one satellite. destroy_spy_satellite() only
// reports success when this call is the one that took it down.
if (!destroy_spy_satellite($db, $targetId, $planetId)) {
    fail('No such satellite in orbit');
}

foreach (INTERCEPT_COST as $res => $amt) {
    $db->prepare(
        "UPDATE hs_planet_resources SET $res = GREATEST(0, $res - ?)
         WHERE planet_id=? AND player_id=?"
    )->execute([$amt, $planetId, $playerId]);
}

// The wreck is identified — that is the whole point of shooting it down rather
// than merely jamming it, and it is what a player can act on afterwards.
$spy = $db->prepare('SELECT username, portrait FROM hs_players WHERE id=?');
$spy->execute([$targetId]);
$who = $spy->fetch() ?: ['username' => null, 'portrait' => null];

$resRow->execute([$planetId, $playerId]);
$res = $resRow->fetch();
unset($res['planet_id'], $res['player_id'], $res['resources_computed_at']);

ok([
    'destroyed'  => ['playerId' => $targetId, 'username' => $who['username'], 'portrait' => $who['portrait']],
    'satellites' => foreign_satellites($db, $planetId, $playerId),
    'resources'  => $res,
]);
