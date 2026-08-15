<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../config.php';
method('GET');

$jwt      = auth();
$playerId = (int)$jwt['sub'];
$planetId = (int)($_GET['planet_id'] ?? 0);
if (!$planetId) fail('planet_id required');

$db = getDB();

// Verify ownership
$own = $db->prepare(
    'SELECT po.is_home, p.type, p.name, p.system_id
     FROM hs_planet_ownership po
     JOIN hs_planets p ON p.id = po.planet_id
     WHERE po.planet_id=? AND po.player_id=?'
);
$own->execute([$planetId, $playerId]);
$planet = $own->fetch();
if (!$planet) fail('Planet not found or not owned', 404);

// ── Resolve completed timers, then compute resources ─────────────────────────

resolve_timers($db, $planetId, $playerId);
compute_resources($db, $planetId, $playerId, $planet['type']);
$battery = battery_state($db, $planetId, $playerId);
$shield  = shield_state($db, $planetId, $playerId);
// Foreign satellites over this planet. Empty without an orbital_defense — the
// building IS the detection, so an undefended colony never learns it is watched.
$bogeys  = foreign_satellites($db, $planetId, $playerId);
// Player-wide, and self-clearing: our own satellites that were shot down since
// we were last told. Reported once, on whichever planet loads first.
$lostSats = lost_satellites($db, $playerId);
$recruit = recruit_state($db, $planetId, $playerId);
$units   = units_state($db, $planetId, $playerId);
$cargo   = cargo_state($db, $planetId, $playerId);
$anomaly = anomaly_state($db, $planetId, $playerId, $planet['type']);

// ── Load current state ────────────────────────────────────────────────────────

$resources = $db->prepare('SELECT * FROM hs_planet_resources WHERE planet_id=? AND player_id=?');
$resources->execute([$planetId, $playerId]);
$res = $resources->fetch();
unset($res['planet_id'], $res['player_id'], $res['resources_computed_at']);

$buildingsRaw = $db->prepare(
    'SELECT building_key, level, build_ends_at FROM hs_buildings WHERE planet_id=? AND player_id=?'
);
$buildingsRaw->execute([$planetId, $playerId]);
$buildings = [];
foreach ($buildingsRaw->fetchAll() as $b) {
    $buildings[$b['building_key']] = [
        'level'       => (int)$b['level'],
        'buildEndsAt' => $b['build_ends_at'] ? strtotime($b['build_ends_at']) * 1000 : null,
    ];
}

$researchRaw = $db->prepare(
    'SELECT building_key, level, build_ends_at FROM hs_global_research WHERE player_id=?'
);
$researchRaw->execute([$playerId]);
$globalResearch = [];
foreach ($researchRaw->fetchAll() as $r) {
    $globalResearch[$r['building_key']] = [
        'level'       => (int)$r['level'],
        'buildEndsAt' => $r['build_ends_at'] ? strtotime($r['build_ends_at']) * 1000 : null,
    ];
}

$slotsRaw = $db->prepare(
    'SELECT slot_index, unlocked FROM hs_planet_slots WHERE planet_id=? AND player_id=? ORDER BY slot_index'
);
$slotsRaw->execute([$planetId, $playerId]);
$slots = [];
foreach ($slotsRaw->fetchAll() as $s) {
    $slots[] = ['slot' => (int)$s['slot_index'], 'unlocked' => (bool)$s['unlocked']];
}

$missionsRaw = $db->prepare(
    'SELECT id, type, from_planet_id, to_planet_id, ends_at, leg, ships, raid_order
     FROM hs_missions WHERE player_id=? AND status=\'in_flight\' ORDER BY ends_at ASC'
);
$missionsRaw->execute([$playerId]);
$missions = [];
foreach ($missionsRaw->fetchAll() as $m) {
    $missions[] = [
        'id'           => (int)$m['id'],
        'type'         => $m['type'],
        'fromPlanetId' => (int)$m['from_planet_id'],
        'toPlanetId'   => (int)$m['to_planet_id'],
        'endsAt'       => strtotime($m['ends_at']) * 1000,
        // 'out' / 'back' on cargo runs and raids, null on every one-way type
        'leg'          => $m['leg'],
        // Raids only: hulls aboard and the sealed order they fly with
        'ships'        => $m['ships'] !== null ? (int)$m['ships'] : null,
        'raidOrder'    => $m['raid_order'],
    ];
}

// All planets ever revealed by completed recon drone missions for this player
$droneScannedRaw = $db->prepare(
    'SELECT DISTINCT to_planet_id FROM hs_missions
     WHERE player_id=? AND type=\'recon_drone\' AND status=\'done\''
);
$droneScannedRaw->execute([$playerId]);
$droneScannedPlanets = array_values(array_map('intval', $droneScannedRaw->fetchAll(PDO::FETCH_COLUMN)));

// Planets in foreign systems this player has ever looked at. Everything else in
// another system is returned without an owner by /galaxy.
$spiedPlanets = spied_planets($db, $playerId);

// Satellites ever placed. A live count would drop back to zero when one expires,
// and the onboarding checklist must not un-tick a step that was achieved.
$satDoneRaw = $db->prepare(
    "SELECT COUNT(*) FROM hs_missions
     WHERE player_id=? AND type='spy_satellite' AND status='done'"
);
$satDoneRaw->execute([$playerId]);
$satelliteDeployments = (int)$satDoneRaw->fetchColumn();

// Cargo runs that actually landed. The outbound leg is the delivery; the return
// leg is bookkeeping. Drives the onboarding checklist, which needs a durable
// flag rather than the in-flight missions above.
$cargoDoneRaw = $db->prepare(
    'SELECT COUNT(*) FROM hs_missions
     WHERE player_id=? AND type=\'cargo_drone\' AND status=\'done\' AND leg=\'out\''
);
$cargoDoneRaw->execute([$playerId]);
$cargoDeliveries = (int)$cargoDoneRaw->fetchColumn();

// Battles this player has not been shown yet, from either side. Handed over
// exactly once — the read clears the flag.
$battleReports = unseen_battle_reports($db, $playerId);

// Who has raided this player, how often, and when last. Drives the ⚔️ badge in
// the galaxy card's owner list.
$raidHistory = raid_history($db, $playerId);

$convRaw = $db->prepare(
    'SELECT id, building_key, recipe_index, ends_at, runs
     FROM hs_conversion_queues WHERE planet_id=? AND player_id=? ORDER BY ends_at ASC'
);
$convRaw->execute([$planetId, $playerId]);
$convQueues = [];
foreach ($convRaw->fetchAll() as $c) {
    $convQueues[] = [
        'id'          => (int)$c['id'],
        'buildingKey' => $c['building_key'],
        'recipeIndex' => (int)$c['recipe_index'],
        // One delivery of `runs` units at endsAt — nothing resolves before it.
        'endsAt'      => strtotime($c['ends_at']) * 1000,
        'runs'        => (int)$c['runs'],
    ];
}

ok([
    'planet' => [
        'id'       => $planetId,
        'name'     => $planet['name'],
        'type'     => $planet['type'],
        'systemId' => (int)$planet['system_id'],
        'isHome'   => (bool)$planet['is_home'],
    ],
    'resources'        => $res,
    'buildings'        => $buildings,
    'globalResearch'   => $globalResearch,
    'slots'            => $slots,
    'units'              => $units,
    'missions'           => $missions,
    'droneScannedPlanets'=> $droneScannedPlanets,
    'spiedPlanets'       => $spiedPlanets,
    'satelliteDeployments' => $satelliteDeployments,
    'cargoDeliveries'    => $cargoDeliveries,
    'conversionQueues'   => $convQueues,
    'battery'            => $battery,
    'shield'             => $shield,
    'foreignSatellites'  => $bogeys,
    'satellitesLost'     => $lostSats,
    'battleReports'      => $battleReports,
    'raidHistory'        => $raidHistory,
    'recruit'            => $recruit,
    'cargo'              => $cargo,
    'anomaly'            => $anomaly,
]);
