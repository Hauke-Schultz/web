<?php
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$fromId   = (int)($b['fromPlanetId'] ?? 0);
$toId     = (int)($b['toPlanetId']   ?? 0);
// Both espionage units fly the same route under the same rules — only what they
// do on arrival differs, so one endpoint serves both.
$unitKey  = ($b['unit'] ?? 'spy_drone') === 'spy_satellite' ? 'spy_satellite' : 'spy_drone';

if (!$fromId || !$toId || $fromId === $toId) fail('fromPlanetId and toPlanetId required');

$db = getDB();
migrate_spy_missions($db);

// Verify ownership of the launching planet
$fromRow = $db->prepare(
    'SELECT p.system_id FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$fromRow->execute([$fromId, $playerId]);
$from = $fromRow->fetch();
if (!$from) fail('From-planet not found or not owned', 404);

$hangar = $db->prepare(
    "SELECT level FROM hs_buildings
     WHERE planet_id=? AND player_id=? AND building_key='drone_hangar' AND level>0 AND build_ends_at IS NULL"
);
$hangar->execute([$fromId, $playerId]);
if (!$hangar->fetch()) fail('Drone Hangar not built on this planet');

// A finished drone must be sitting in the dock — the hangar alone is not enough
resolve_units($db, $fromId, $playerId);

// The target must be a real planet in another system
$toRow = $db->prepare('SELECT system_id FROM hs_planets WHERE id=?');
$toRow->execute([$toId]);
$to = $toRow->fetch();
if (!$to) fail('Target planet not found', 404);

$fromSystemId = (int)$from['system_id'];
$toSystemId   = (int)$to['system_id'];
if ($toSystemId === $fromSystemId) {
    fail('Planets in your own system need no spy drone');
}

// The system has to be scanned first — you cannot spy on a place you have not
// found. This mirrors the messaging gate and is re-checked here because the
// frontend condition is not a security boundary.
$contact = $db->prepare(
    "SELECT scan_state FROM hs_system_contacts WHERE player_id=? AND system_id=?"
);
$contact->execute([$playerId, $toSystemId]);
if (($contact->fetchColumn() ?: 'unscanned') !== 'scanned') {
    fail('Scan the system before sending a spy drone');
}

// A planet already covered by a live satellite has nothing left to report — a
// second unit would buy information you are receiving anyway. Re-spying a stale
// drone report, on the other hand, is exactly what drones are for.
$intel = spy_intel_map($db, $playerId);
if (($intel[$toId]['live'] ?? false)) {
    fail('A satellite is already transmitting from this planet', 409);
}

// A satellite is placed, not sent looking: it needs an orbit that has been
// surveyed once. The drone is what finds out whether the planet is worth
// watching at all, so it always comes first.
if ($unitKey === 'spy_satellite' && !isset($intel[$toId])) {
    fail('Send a spy drone first — a satellite needs a surveyed planet');
}

// One espionage flight at a time per launching planet, like the recon drone
$active = $db->prepare(
    "SELECT COUNT(*) FROM hs_missions
     WHERE player_id=? AND type IN ('spy_drone','spy_satellite')
       AND from_planet_id=? AND status='in_flight'"
);
$active->execute([$playerId, $fromId]);
if ((int)$active->fetchColumn() > 0) fail('An espionage flight is already under way from this planet');

// The unit itself is the cost — resources were paid when it was built, and
// neither of the two comes back.
if (!consume_unit($db, $fromId, $playerId, $unitKey)) {
    fail('No ' . ($unitKey === 'spy_satellite' ? 'spy satellite' : 'spy drone')
         . ' available — build one at the dock first');
}

$flightTime = spy_flight_seconds($db, $fromSystemId, $toSystemId);

$db->prepare(
    "INSERT INTO hs_missions (player_id, type, from_planet_id, to_planet_id, ends_at)
     VALUES (?,?,?,?, DATE_ADD(NOW(), INTERVAL ? SECOND))"
)->execute([$playerId, $unitKey, $fromId, $toId, $flightTime]);

// You have stopped being harmless. Looking at somebody's planet is not an act
// of war, which is why this is `neutral` and not `hostile` — but it is not
// nothing either, and `friendly` is the rung that cannot be raided. Reading
// other people's colonies from behind that shield is the one thing the ladder
// exists to prevent.
//
// The satellite counts as much as the drone: both are eyes on somebody else's
// orbit, and the endpoint that serves both should not treat one as innocent.
// Escalation is on the LAUNCH, not on arrival — the decision is what costs you
// the rung, and a fleet recalled at the last moment is still a fleet you sent.
escalate_disposition($db, $playerId, 'neutral');

// `disposition` rides back with the launch so the profile card can recolour on
// the spot. Without it the rung you just climbed would not show until the next
// reload, and a consequence you cannot see is not a consequence.
ok([
    'missionId'   => (int)$db->lastInsertId(),
    'unit'        => $unitKey,
    'endsAt'      => (time() + $flightTime) * 1000,
    'disposition' => player_disposition($db, $playerId),
]);
