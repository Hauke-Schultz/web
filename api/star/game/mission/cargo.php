<?php
/**
 * Launch a loaded cargo drone at a target planet.
 *
 * Unlike the colony ship, ownership of the target is deliberately NOT a
 * condition — foreign and uncolonized planets are valid destinations, which is
 * what makes this the foundation for player-to-player trade. The only gate is
 * that the planet must be known: revealed by a completed recon drone mission, or
 * owned by the player (your own home planet is never scanned by your own drones).
 */
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$fromId   = (int)($b['fromPlanetId'] ?? 0);
$toId     = (int)($b['toPlanetId']   ?? 0);

if (!$fromId || !$toId || $fromId === $toId) fail('fromPlanetId and toPlanetId required');

$db = getDB();

$fromRow = $db->prepare(
    'SELECT p.system_id FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$fromRow->execute([$fromId, $playerId]);
$from = $fromRow->fetch();
if (!$from) fail('From-planet not found or not owned', 404);

// Resolve first so a drone that just landed or a build that just finished counts
resolve_timers($db, $fromId, $playerId);
ensure_cargo_table($db);

// Targets outside the home system are out of scope for v1 — the distance
// calculation is based on the planet's orbit index within one system.
$toRow = $db->prepare('SELECT system_id FROM hs_planets WHERE id=?');
$toRow->execute([$toId]);
$to = $toRow->fetch();
if (!$to) fail('Target planet not found', 404);
if ((int)$to['system_id'] !== (int)$from['system_id']) fail('Target planet must be in the same system');

// Known-or-owned. The frontend checks the same thing, but that is not a security
// boundary — an unknown planet must not become a destination via a crafted call.
$known = $db->prepare(
    "SELECT 1 FROM hs_missions
     WHERE player_id=? AND type='recon_drone' AND status='done' AND to_planet_id=?
     UNION
     SELECT 1 FROM hs_planet_ownership WHERE player_id=? AND planet_id=?"
);
$known->execute([$playerId, $toId, $playerId, $toId]);
if (!$known->fetch()) fail('Target planet is unknown — send a recon drone first');

$cargoRow = $db->prepare('SELECT cargo, mission_id FROM hs_cargo WHERE planet_id=? AND player_id=?');
$cargoRow->execute([$fromId, $playerId]);
$record = $cargoRow->fetch();
if (!$record)                       fail('No cargo drone on this planet');
if ($record['mission_id'] !== null) fail('The cargo drone is already in flight');

$cargo = json_decode($record['cargo'] ?? '{}', true);
if (!is_array($cargo) || array_sum($cargo) < 1) fail('Load the drone before launching it');

// The drone leaves the dock. Resources were paid when it was built, the goods
// when it was loaded — the launch itself costs nothing.
if (!consume_unit($db, $fromId, $playerId, 'cargo_drone')) {
    fail('No cargo drone available — build one at the dock first');
}

$flightTime = UNIT_COSTS['cargo_drone']['flightTimeBase']
            * planet_distance($db, (int)$from['system_id'], $fromId, $toId);

$db->prepare(
    "INSERT INTO hs_missions (player_id, type, from_planet_id, to_planet_id, ends_at, leg)
     VALUES (?,'cargo_drone',?,?, DATE_ADD(NOW(), INTERVAL ? SECOND), 'out')"
)->execute([$playerId, $fromId, $toId, $flightTime]);
$missionId = (int)$db->lastInsertId();

// Pin the manifest to the flight — this is what stops it being edited mid-run
$db->prepare('UPDATE hs_cargo SET mission_id=? WHERE planet_id=? AND player_id=?')
   ->execute([$missionId, $fromId, $playerId]);

ok(['missionId' => $missionId, 'endsAt' => (time() + $flightTime) * 1000]);
