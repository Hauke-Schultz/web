<?php
require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../config.php';
method('POST');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$b        = body();
$fromId   = (int)($b['fromPlanetId'] ?? 0);
$toId     = (int)($b['toPlanetId']   ?? 0);
$ships    = max(1, (int)($b['ships'] ?? 1));
// Sealed orders: the fleet flies with them and cannot be re-tasked in flight.
// Anything that is not an explicit plunder order is a disable order.
$order    = ($b['order'] ?? 'disable') === 'plunder' ? 'plunder' : 'disable';

if (!$fromId || !$toId || $fromId === $toId) fail('fromPlanetId and toPlanetId required');

$db = getDB();
migrate_raid_missions($db);

// Verify ownership of the launching planet
$fromRow = $db->prepare(
    'SELECT p.system_id, p.type FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id=po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$fromRow->execute([$fromId, $playerId]);
$from = $fromRow->fetch();
if (!$from) fail('From-planet not found or not owned', 404);

// Finished builds land in the dock first — a shipyard alone launches nothing.
resolve_timers($db, $fromId, $playerId);

$toRow = $db->prepare('SELECT system_id FROM hs_planets WHERE id=?');
$toRow->execute([$toId]);
$to = $toRow->fetch();
if (!$to) fail('Target planet not found', 404);

$fromSystemId = (int)$from['system_id'];
$toSystemId   = (int)$to['system_id'];

// The target must belong to somebody else — this is the one mission aimed at a
// player, not at a place.
$ownerRow = $db->prepare('SELECT player_id FROM hs_planet_ownership WHERE planet_id=?');
$ownerRow->execute([$toId]);
$defenderId = (int)($ownerRow->fetchColumn() ?: 0);
if (!$defenderId)               fail('Nobody lives on this planet');
if ($defenderId === $playerId)  fail('That is your own colony');

// The first days belong to learning the game, not to losing a refinery run.
if (player_is_protected($db, $defenderId)) {
    fail('This commander is under beginner protection', 403);
}

// You can only raid what you have looked at. Inside your own home system
// ownership is public, so no flight is needed to know who lives there; anywhere
// else a spy drone has to have surveyed the planet first.
if ($toSystemId !== $fromSystemId) {
    $intel = spy_intel_map($db, $playerId);
    if (!isset($intel[$toId])) {
        fail('Send a spy drone first — a raid needs a surveyed planet');
    }
}

// One raid at a time per launching planet, like every other flight.
$active = $db->prepare(
    "SELECT COUNT(*) FROM hs_missions
     WHERE player_id=? AND type='raid' AND status='in_flight'
       AND (from_planet_id=? OR to_planet_id=?)"
);
$active->execute([$playerId, $fromId, $fromId]);
if ((int)$active->fetchColumn() > 0) fail('A fleet from this planet is already under way');

// The hulls are the cost; they were paid for when they were built. Consumed one
// by one so a half-available dock cannot launch a fleet it does not have.
$docked = $db->prepare(
    "SELECT quantity FROM hs_units WHERE planet_id=? AND player_id=? AND unit_key='corvette'"
);
$docked->execute([$fromId, $playerId]);
$available = (int)($docked->fetchColumn() ?: 0);
if ($available < 1) fail('No corvette in the dock — build one first');
if ($ships > $available) $ships = $available;

// Fuel: one power cell per hull, paid at launch. This is what makes a raid cost
// something every time, where the ships themselves are a one-off investment.
$fuelKey  = array_key_first(RAID_FUEL_COST);
$fuelNeed = $ships;
compute_resources($db, $fromId, $playerId, $from['type']);
$fuelRow = $db->prepare("SELECT $fuelKey FROM hs_planet_resources WHERE planet_id=? AND player_id=?");
$fuelRow->execute([$fromId, $playerId]);
if ((int)floor((float)($fuelRow->fetchColumn() ?: 0)) < $fuelNeed) {
    fail("Not enough $fuelKey — a sortie costs one per ship");
}

$db->prepare(
    "UPDATE hs_planet_resources SET $fuelKey = GREATEST(0, $fuelKey - ?)
     WHERE planet_id=? AND player_id=?"
)->execute([$fuelNeed, $fromId, $playerId]);

$db->prepare(
    "UPDATE hs_units SET quantity = quantity - ?
     WHERE planet_id=? AND player_id=? AND unit_key='corvette' AND quantity >= ?"
)->execute([$ships, $fromId, $playerId, $ships]);

$flightTime = raid_flight_seconds($db, $fromSystemId, $toSystemId);

$db->prepare(
    "INSERT INTO hs_missions (player_id, type, from_planet_id, to_planet_id, ends_at, leg, ships, raid_order)
     VALUES (?,'raid',?,?, DATE_ADD(NOW(), INTERVAL ? SECOND), 'out', ?, ?)"
)->execute([$playerId, $fromId, $toId, $flightTime, $ships, $order]);

ok([
    'missionId' => (int)$db->lastInsertId(),
    'ships'     => $ships,
    'order'     => $order,
    'fuel'      => $fuelNeed,
    'endsAt'    => (time() + $flightTime) * 1000,
]);
