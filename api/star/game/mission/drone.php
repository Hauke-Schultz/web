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

// Verify ownership of from-planet and drone_hangar building
$fromRow = $db->prepare(
    'SELECT p.system_id, p.type FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$fromRow->execute([$fromId, $playerId]);
$from = $fromRow->fetch();
if (!$from) fail('From-planet not found or not owned', 404);

$droneBuilt = $db->prepare(
    'SELECT level FROM hs_buildings WHERE planet_id=? AND player_id=? AND building_key=\'drone_hangar\' AND level>0 AND build_ends_at IS NULL'
);
$droneBuilt->execute([$fromId, $playerId]);
if (!$droneBuilt->fetch()) fail('Recon Drone not built on this planet');

// A finished drone must be sitting in the dock — the facility alone is not enough
resolve_units($db, $fromId, $playerId);

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

// The drone itself is the cost — resources were already paid when it was built
if (!consume_unit($db, $fromId, $playerId, 'recon_drone')) {
    fail('No recon drone available — build one at the dock first');
}

$planetOrder = $db->prepare('SELECT id FROM hs_planets WHERE system_id=? ORDER BY id ASC');
$planetOrder->execute([$from['system_id']]);
$orderedIds  = array_column($planetOrder->fetchAll(), 'id');
$fi = array_search($fromId, $orderedIds);
$ti = array_search($toId,   $orderedIds);
$dist       = max(1, abs((int)$fi - (int)$ti));
$flightTime = UNIT_COSTS['recon_drone']['flightTimeBase'] * $dist;

$db->prepare(
    'INSERT INTO hs_missions (player_id, type, from_planet_id, to_planet_id, ends_at)
     VALUES (?,\'recon_drone\',?,?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
)->execute([$playerId, $fromId, $toId, $flightTime]);

$missionId = (int)$db->lastInsertId();
$endsAt    = time() + $flightTime;

ok(['missionId' => $missionId, 'endsAt' => $endsAt * 1000]);
