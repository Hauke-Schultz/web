<?php
// ONE SHOT from the orbital battery at one foreign satellite. This is what
// replaced the satellite's 168 h lifetime: espionage now ends because somebody
// ends it — and since 2026-08-28 that somebody has to aim.
//
// The endpoint used to kill outright for one power cell. It now fires a single
// round: the cell is spent whether or not the round connects, a hit adds one to
// `satellite_hits`, and the satellite dies on the SATELLITE_ARMOR-th. The damage
// lives in the database rather than in the tab that dealt it, so a salvo broken
// off half way is not wasted — it is a softer satellite next time.
//
// What the server can and cannot check, stated plainly: it cannot see the
// gunner's screen, so `hit` is taken on trust exactly as salvage/catch.php takes
// its own. What makes that acceptable here is the ammunition. A client that
// reports nothing but hits still pays SATELLITE_ARMOR cells per kill — precisely
// what a perfect gunner pays — so the worst a forged report buys is the skill,
// never the price.
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$planetId = (int)($b['planetId'] ?? 0);
$targetId = (int)($b['targetPlayerId'] ?? 0);
// Absent or malformed counts as a miss: a bad payload must only ever cost the
// shooter a cell, never advance the kill.
$hit      = !empty($b['hit']);
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

ensure_spy_intel_table($db);

// The target has to be up there before anything is spent on it. This also pins
// the row every later statement addresses.
$sat = $db->prepare(
    'SELECT satellite_hits,
            TIMESTAMPDIFF(MICROSECOND, satellite_shot_at, NOW(3)) / 1000 AS since_ms
     FROM hs_spy_intel
     WHERE player_id=? AND planet_id=? AND satellite_active=1'
);
$sat->execute([$targetId, $planetId]);
$row = $sat->fetch();
if (!$row) fail('No such satellite in orbit');

// A floor on the rate, for the player's sake rather than the game's: a client
// stuck in a loop would otherwise empty the planet's power cells in a second.
// NULL means nothing has ever been fired at this one.
$since = $row['since_ms'];
if ($since !== null && (float)$since < INTERCEPT_MIN_SHOT_MS) {
    fail('Firing too fast', 429);
}

compute_resources($db, $planetId, $playerId, $planet['type']);

$resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$resRow->execute([$planetId, $playerId]);
$have = $resRow->fetch() ?: [];
foreach (INTERCEPT_COST as $res => $amt) {
    if ((float)($have[$res] ?? 0) < $amt) fail('Not enough ' . $res);
}

// Claim the round BEFORE charging for it, and let the DATABASE decide whether
// there was anything to fire at. Every guard lives in the WHERE clause, so two
// rounds racing each other are resolved by the engine rather than by the gap
// between a read and a write in PHP:
//
//   satellite_active = 1        it is still up there
//   satellite_hits < ARMOR      it is not already as dead as it can get
//
// Both matter, and the second one was learned the hard way: three rounds fired
// at once all passed the `active` test, all incremented, and the satellite ended
// on five hits out of three — two cells spent on a wreck. `active` alone cannot
// catch that, because none of the three had claimed the KILL yet.
//
// A refused claim costs nothing. The charge below is only ever reached by a round
// that this statement agreed was fired at a live target.
$hits  = (int)$row['satellite_hits'];
$claim = $hit
    ? $db->prepare(
        'UPDATE hs_spy_intel SET satellite_hits = satellite_hits + 1, satellite_shot_at = NOW(3)
         WHERE player_id=? AND planet_id=? AND satellite_active=1 AND satellite_hits < ?'
      )
    : $db->prepare(
        'UPDATE hs_spy_intel SET satellite_shot_at = NOW(3)
         WHERE player_id=? AND planet_id=? AND satellite_active=1 AND satellite_hits < ?'
      );
$claim->execute([$targetId, $planetId, SATELLITE_ARMOR]);
if ($claim->rowCount() < 1) fail('No such satellite in orbit');
if ($hit) $hits++;

foreach (INTERCEPT_COST as $res => $amt) {
    $db->prepare(
        "UPDATE hs_planet_resources SET $res = GREATEST(0, $res - ?)
         WHERE planet_id=? AND player_id=?"
    )->execute([$amt, $planetId, $playerId]);
}

// The wreck is identified — that is the whole point of shooting it down rather
// than merely jamming it, and it is what a player can act on afterwards.
$destroyed = null;
if ($hits >= SATELLITE_ARMOR && destroy_spy_satellite($db, $targetId, $planetId)) {
    $spy = $db->prepare('SELECT username, portrait FROM hs_players WHERE id=?');
    $spy->execute([$targetId]);
    $who = $spy->fetch() ?: ['username' => null, 'portrait' => null];
    $destroyed = [
        'playerId' => $targetId,
        'username' => $who['username'],
        'portrait' => $who['portrait'],
    ];
}

$resRow->execute([$planetId, $playerId]);
$res = $resRow->fetch();
unset($res['planet_id'], $res['player_id'], $res['resources_computed_at']);

ok([
    // What this one round did. `destroyed` stays null until the last hit lands,
    // so the client can tell "another dent" from "it is coming down".
    'hit'        => $hit,
    'hits'       => $hits,
    'armor'      => SATELLITE_ARMOR,
    'destroyed'  => $destroyed,
    'satellites' => foreign_satellites($db, $planetId, $playerId),
    'resources'  => $res,
]);
