<?php
require_once __DIR__ . '/../bootstrap.php';
method('GET');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$db       = getDB();

// All systems with their planets
$systems = $db->query(
    'SELECT s.id, s.name, s.x, s.y, s.star_class FROM hs_star_systems s ORDER BY s.id'
)->fetchAll();

// All planet ownership (players + NPCs)
$playerOwnership = $db->query(
    'SELECT po.planet_id, po.player_id, pl.username, pl.portrait, pl.disposition
     FROM hs_planet_ownership po
     JOIN hs_players pl ON pl.id = po.player_id'
)->fetchAll();
$pOwn = [];
foreach ($playerOwnership as $row) {
    $pOwn[$row['planet_id']] = [
        'playerId'    => (int)$row['player_id'],
        'username'    => $row['username'],
        'portrait'    => $row['portrait'],
        'disposition' => $row['disposition'],
    ];
}

$npcOwnership = $db->query(
    'SELECT npo.planet_id, nf.id AS faction_id, nf.name, nf.portrait, nf.disposition
     FROM hs_npc_planet_ownership npo
     JOIN hs_npc_factions nf ON nf.id = npo.faction_id'
)->fetchAll();
$nOwn = [];
foreach ($npcOwnership as $row) {
    $nOwn[$row['planet_id']] = [
        'factionId'   => (int)$row['faction_id'],
        'name'        => $row['name'],
        'portrait'    => $row['portrait'],
        'disposition' => $row['disposition'],
    ];
}

// NPC factions per system
$factions = $db->query('SELECT * FROM hs_npc_factions')->fetchAll();
$factionsBySystem = [];
foreach ($factions as $f) {
    $factionsBySystem[$f['system_id']][] = [
        'name'        => $f['name'],
        'portrait'    => $f['portrait'],
        'disposition' => $f['disposition'],
    ];
}

// Planets per system
$planets = $db->query('SELECT * FROM hs_planets ORDER BY id')->fetchAll();
$planetsBySystem = [];
foreach ($planets as $p) {
    $pid   = (int)$p['id'];
    $owner = $pOwn[$pid] ?? $nOwn[$pid] ?? null;
    $planetsBySystem[$p['system_id']][] = [
        'id'    => $pid,
        'name'  => $p['name'],
        'type'  => $p['type'],
        'owner' => $owner,
    ];
}

// Assemble response
$result = [];
foreach ($systems as $sys) {
    $sid      = (int)$sys['id'];
    $result[] = [
        'id'        => $sid,
        'name'      => $sys['name'],
        'x'         => (float)$sys['x'],
        'y'         => (float)$sys['y'],
        'starClass' => $sys['star_class'],
        'factions'  => $factionsBySystem[$sid] ?? [],
        'planets'   => $planetsBySystem[$sid]  ?? [],
    ];
}

ok($result);
