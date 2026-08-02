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

// Verify ownership of from-planet and colony_ship building
$fromRow = $db->prepare(
    'SELECT p.system_id, p.type FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$fromRow->execute([$fromId, $playerId]);
$from = $fromRow->fetch();
if (!$from) fail('From-planet not found or not owned', 404);

$shipBuilt = $db->prepare(
    'SELECT level FROM hs_buildings WHERE planet_id=? AND player_id=? AND building_key=\'colony_ship\' AND level>0 AND build_ends_at IS NULL'
);
$shipBuilt->execute([$fromId, $playerId]);
if (!$shipBuilt->fetch()) fail('Colony Ship not built on this planet');

// A finished ship must be sitting in the dock — the facility alone is not enough
resolve_units($db, $fromId, $playerId);

// Target must be habitable, unowned, in same system, scanned by drone
$toRow = $db->prepare(
    'SELECT p.system_id, p.type FROM hs_planets p
     WHERE p.id=? AND p.type != \'uninhabitable\''
);
$toRow->execute([$toId]);
$to = $toRow->fetch();
if (!$to) fail('Target is uninhabitable');
if ($to['system_id'] !== $from['system_id']) fail('Target must be in same system');

$alreadyOwned = $db->prepare('SELECT id FROM hs_planet_ownership WHERE planet_id=?');
$alreadyOwned->execute([$toId]);
if ($alreadyOwned->fetch()) fail('Planet already colonized');

$npcOwned = $db->prepare('SELECT planet_id FROM hs_npc_planet_ownership WHERE planet_id=?');
$npcOwned->execute([$toId]);
if ($npcOwned->fetch()) fail('Planet belongs to an NPC faction');

// One active colony mission at a time from this planet
$active = $db->prepare(
    'SELECT COUNT(*) FROM hs_missions WHERE player_id=? AND type=\'colony_ship\' AND from_planet_id=? AND status=\'in_flight\''
);
$active->execute([$playerId, $fromId]);
if ((int)$active->fetchColumn() > 0) fail('A colony mission is already active from this planet');

// The ship itself is the cost — resources were already paid when it was built
if (!consume_unit($db, $fromId, $playerId, 'colony_ship')) {
    fail('No colony ship available — build one at the dock first');
}

$planetOrder = $db->prepare('SELECT id FROM hs_planets WHERE system_id=? ORDER BY id ASC');
$planetOrder->execute([$from['system_id']]);
$orderedIds  = array_column($planetOrder->fetchAll(), 'id');
$fi = array_search($fromId, $orderedIds);
$ti = array_search($toId,   $orderedIds);
$dist       = max(1, abs((int)$fi - (int)$ti));
$flightTime = UNIT_COSTS['colony_ship']['flightTimeBase'] * $dist;

$db->prepare(
    'INSERT INTO hs_missions (player_id, type, from_planet_id, to_planet_id, ends_at)
     VALUES (?,\'colony_ship\',?,?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
)->execute([$playerId, $fromId, $toId, $flightTime]);

// On arrival the frontend will call a "complete mission" endpoint (Phase 1+).
// For now: schedule completion — the mission row stays in_flight until resolved.
// A GET /game/state will trigger completion check on next load.

$missionId = (int)$db->lastInsertId();
ok(['missionId' => $missionId, 'endsAt' => (time() + $flightTime) * 1000]);
