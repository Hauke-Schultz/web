<?php
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

// Verify ownership of from-planet and recon_drone building
$fromRow = $db->prepare(
    'SELECT p.system_id, p.type FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$fromRow->execute([$fromId, $playerId]);
$from = $fromRow->fetch();
if (!$from) fail('From-planet not found or not owned', 404);

$droneBuilt = $db->prepare(
    'SELECT level FROM hs_buildings WHERE planet_id=? AND player_id=? AND building_key=\'recon_drone\' AND level>0 AND build_ends_at IS NULL'
);
$droneBuilt->execute([$fromId, $playerId]);
if (!$droneBuilt->fetch()) fail('Recon Drone not built on this planet');

// To-planet must be in the same system
$toRow = $db->prepare('SELECT system_id FROM hs_planets WHERE id=?');
$toRow->execute([$toId]);
$to = $toRow->fetch();
if (!$to || $to['system_id'] !== $from['system_id']) fail('Target planet must be in the same system');

// Only one active drone mission at a time from this planet
$active = $db->prepare(
    'SELECT COUNT(*) FROM hs_missions WHERE player_id=? AND type=\'recon_drone\' AND from_planet_id=? AND status=\'in_flight\''
);
$active->execute([$playerId, $fromId]);
if ((int)$active->fetchColumn() > 0) fail('A drone mission is already active from this planet');

// Build cost (UNIT_COSTS)
compute_resources($db, $fromId, $playerId, $from['type']);

$cost = UNIT_COSTS['recon_drone']['cost'];
$resRow = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$resRow->execute([$fromId, $playerId]);
$res = $resRow->fetch();
foreach ($cost as $resource => $amount) {
    if (($res[$resource] ?? 0) < $amount) fail("Not enough $resource");
}
$sets = array_map(fn($r) => "$r = $r - ?", array_keys($cost));
$db->prepare(
    'UPDATE hs_planet_resources SET ' . implode(', ', $sets) . ' WHERE planet_id=? AND player_id=?'
)->execute([...array_values($cost), $fromId, $playerId]);

$flightTime = UNIT_COSTS['recon_drone']['buildTimeBase'];
$db->prepare(
    'INSERT INTO hs_missions (player_id, type, from_planet_id, to_planet_id, ends_at)
     VALUES (?,\'recon_drone\',?,?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
)->execute([$playerId, $fromId, $toId, $flightTime]);

$missionId = (int)$db->lastInsertId();
$endsAt    = time() + $flightTime;

ok(['missionId' => $missionId, 'endsAt' => $endsAt * 1000]);
