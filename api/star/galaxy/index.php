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

// ── What this player is allowed to see ───────────────────────────────────────
// Who sits on which planet is a secret outside your own system: a deep-space
// scan tells you WHO lives in a system and how many planets they hold, a spy
// drone tells you WHICH planet is theirs. Hiding it here rather than in the UI
// is what makes it a secret — the response is what a client can read.
$scannedRow = $db->prepare(
    "SELECT system_id FROM hs_system_contacts WHERE player_id=? AND scan_state='scanned'"
);
$scannedRow->execute([$playerId]);
$scannedSystems = array_map('intval', $scannedRow->fetchAll(PDO::FETCH_COLUMN));

// What this player has looked at: a stored observation per planet, plus a `live`
// flag while a satellite is still transmitting from its orbit.
$intel = spy_intel_map($db, $playerId);

// Snapshots name a player id, so the response needs everyone's identity — the
// owner it reports may not even be the current one any more, which is the point.
$playersById = [];
foreach ($db->query('SELECT id, username, portrait, disposition FROM hs_players')->fetchAll() as $pl) {
    $playersById[(int)$pl['id']] = [
        'playerId'    => (int)$pl['id'],
        'username'    => $pl['username'],
        'portrait'    => $pl['portrait'],
        'disposition' => $pl['disposition'],
    ];
}

// Where you live. Your own system is not a free pass to its contents: a world
// three orbits out is a dot on the chart until a recon drone has flown past it,
// exactly as the solar view has always drawn it. What the home system does buy
// is that the finding never ages — you are there, so a surveyed neighbour is
// reported live rather than as a dated snapshot.
$homeSysRow = $db->prepare(
    'SELECT p.system_id FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id = po.planet_id
     WHERE po.player_id=? AND po.is_home=1 LIMIT 1'
);
$homeSysRow->execute([$playerId]);
$homeSystemId = (int)($homeSysRow->fetchColumn() ?: 0);

// Every planet a recon drone has reached. Landed, not resolved: /galaxy does not
// run resolve_timers(), so a flight that is over but whose row is still pending
// must count too — otherwise the reveal waits for the next state.php load.
$reconRow = $db->prepare(
    "SELECT DISTINCT to_planet_id FROM hs_missions
     WHERE player_id=? AND type='recon_drone' AND (status='done' OR ends_at <= NOW())"
);
$reconRow->execute([$playerId]);
$surveyed = array_flip(array_map('intval', $reconRow->fetchAll(PDO::FETCH_COLUMN)));

// Planets per system
$planets = $db->query('SELECT * FROM hs_planets ORDER BY id')->fetchAll();
$planetsBySystem   = [];
$inhabitedSystems  = [];
$ownersBySystem    = [];
foreach ($planets as $p) {
    $pid      = (int)$p['id'];
    $sid      = (int)$p['system_id'];
    $owner    = $pOwn[$pid] ?? $nOwn[$pid] ?? null;

    if ($owner) {
        $inhabitedSystems[$sid] = true;

        // System-level roll-up: WHO is here, nothing else. Not which planets and
        // deliberately not how many either — a count is a strong hint on a
        // six-planet system, and the point is that every planet costs a drone.
        $key = isset($owner['playerId']) ? 'p' . $owner['playerId'] : 'f' . ($owner['factionId'] ?? 0);
        $ownersBySystem[$sid][$key] = $owner;
    }

    // Visibility is a property of the PLANET, never of whether it happens to be
    // occupied: if empty planets came back as "known" and occupied ones did not,
    // the hidden ones would be exactly the interesting ones and the secret would
    // be readable straight off the list. Unspied means unknown either way.
    //
    // `$mine` is current knowledge that needs no report: a colony of yours, or a
    // home-system world a drone has surveyed. Everything else in the home system
    // is as blank as deep space — the recon drone is what buys it.
    $mine = ($owner['playerId'] ?? null) === $playerId
         || ($sid === $homeSystemId && isset($surveyed[$pid]));
    $seen = $intel[$pid] ?? null;

    // Three ways to know something, and only the first two are current:
    //   your own space  → live, always
    //   live satellite  → live, until it stops transmitting
    //   drone report    → what was true at `observedAt`, and nothing since
    $reported = null;
    if ($mine || ($seen && $seen['live'])) {
        $reported = $owner;
    } elseif ($seen) {
        $reported = $seen['ownerPlayerId'] !== null
            ? ($playersById[$seen['ownerPlayerId']] ?? null)
            : ($seen['ownerFactionId'] !== null ? ($nOwn[$pid] ?? null) : null);
    }

    $planetsBySystem[$sid][] = [
        'id'    => $pid,
        'name'  => $p['name'],
        // The type is part of the survey, not free with the star chart: a drone
        // reports what kind of world it flew past. It never changes, so unlike
        // the owner it is not stored as a snapshot — once looked at, it is known.
        'type'  => $mine || $seen !== null ? $p['type'] : null,
        'owner' => $reported,
        // false = "you have not looked yet", which is not the same as "free"
        'known' => $mine || $seen !== null,
        // How old the report is, and whether anything is still watching. Absent
        // for your own space, which needs no espionage to stay current.
        'intel' => $mine || !$seen ? null : [
            'observedAt'     => $seen['observedAt'],
            'live'           => $seen['live'],
            // When it was placed, not when it expires — a satellite orbits until
            // the planet below shoots it down.
            'satelliteSince' => $seen['live'] ? $seen['satelliteSince'] : null,
            // What the satellite adds on top of the drone's finding. Live while
            // it transmits, then the last reading it took, with its own date —
            // a shield charge ages far faster than "who lives here".
            'shield'         => spy_shield_report($db, $pid, $seen),
        ],
    ];
}

// Assemble response
$result = [];
foreach ($systems as $sys) {
    $sid     = (int)$sys['id'];
    $scanned = $sid === $homeSystemId || in_array($sid, $scannedSystems, true);

    $result[] = [
        'id'        => $sid,
        'name'      => $sys['name'],
        'x'         => (float)$sys['x'],
        'y'         => (float)$sys['y'],
        'starClass' => $sys['star_class'],
        'factions'  => $factionsBySystem[$sid] ?? [],
        'planets'   => $planetsBySystem[$sid]  ?? [],
        // Always sent: the galaxy map has always listed inhabited systems as the
        // ones worth scanning, and that is the hook that makes a scan a decision.
        'inhabited' => isset($inhabitedSystems[$sid]),
        // Only after a scan: names, portraits and planet counts of the residents.
        'inhabitants' => $scanned ? array_values($ownersBySystem[$sid] ?? []) : [],
    ];
}

ok($result);
