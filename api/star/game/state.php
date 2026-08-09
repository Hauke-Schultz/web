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
$recruit = recruit_state($db, $planetId, $playerId);
$units   = units_state($db, $planetId, $playerId);
$cargo   = cargo_state($db, $planetId, $playerId);

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
    'SELECT id, type, from_planet_id, to_planet_id, ends_at, leg
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
        // 'out' / 'back' on cargo runs, null on every one-way mission type
        'leg'          => $m['leg'],
    ];
}

// All planets ever revealed by completed recon drone missions for this player
$droneScannedRaw = $db->prepare(
    'SELECT DISTINCT to_planet_id FROM hs_missions
     WHERE player_id=? AND type=\'recon_drone\' AND status=\'done\''
);
$droneScannedRaw->execute([$playerId]);
$droneScannedPlanets = array_values(array_map('intval', $droneScannedRaw->fetchAll(PDO::FETCH_COLUMN)));

// Cargo runs that actually landed. The outbound leg is the delivery; the return
// leg is bookkeeping. Drives the onboarding checklist, which needs a durable
// flag rather than the in-flight missions above.
$cargoDoneRaw = $db->prepare(
    'SELECT COUNT(*) FROM hs_missions
     WHERE player_id=? AND type=\'cargo_drone\' AND status=\'done\' AND leg=\'out\''
);
$cargoDoneRaw->execute([$playerId]);
$cargoDeliveries = (int)$cargoDoneRaw->fetchColumn();

$convRaw = $db->prepare(
    'SELECT id, building_key, recipe_index, ends_at, remaining
     FROM hs_conversion_queues WHERE planet_id=? AND player_id=? ORDER BY ends_at ASC'
);
$convRaw->execute([$planetId, $playerId]);
$convQueues = [];
foreach ($convRaw->fetchAll() as $c) {
    $convQueues[] = [
        'id'          => (int)$c['id'],
        'buildingKey' => $c['building_key'],
        'recipeIndex' => (int)$c['recipe_index'],
        'endsAt'      => strtotime($c['ends_at']) * 1000,
        'remaining'   => (int)$c['remaining'],
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
    'cargoDeliveries'    => $cargoDeliveries,
    'conversionQueues'   => $convQueues,
    'battery'            => $battery,
    'recruit'            => $recruit,
    'cargo'              => $cargo,
]);
