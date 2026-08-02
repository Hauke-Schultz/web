<?php
/**
 * PHP mirror of hawkStarConfig.js — used for server-side cost validation,
 * build times, production computation, and slot unlocking.
 * Keep in sync with frontend/app/utils/hawkStarConfig.js.
 */

const UNIT_COSTS = [
    'recon_drone' => ['cost' => ['metal' => 60,  'crystal' => 25],  'buildTimeBase' => 300,  'flightTimeBase' => 3600],
    'colony_ship' => ['cost' => ['metal' => 300, 'crystal' => 150], 'buildTimeBase' => 900, 'flightTimeBase' => 7200],
];

const GLOBAL_BUILDINGS = ['star_map', 'interstellar_comm'];

const BUILDINGS = [

  'command_center' => ['tileType' => 'base', 'levels' => [
    ['level'=>1,'cost'=>[],'buildTime'=>20,'production'=>[],'energyDrain'=>0,'staffDrain'=>1,'unlocks'=>[['slot'=>2],['slot'=>4]],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>80,'crystal'=>30],'buildTime'=>480,'production'=>[],'energyDrain'=>2,'staffDrain'=>2,'unlocks'=>[['slot'=>6],['slot'=>7],['slot'=>8]],'popBonus'=>5,'requiresBuilding'=>'metal_mine','requiresLevel'=>2],
    ['level'=>3,'cost'=>['metal'=>300,'crystal'=>100],'buildTime'=>3600,'production'=>[],'energyDrain'=>3,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>10],
  ]],

  'power_plant' => ['tileType' => 'energy', 'levels' => [
    ['level'=>1,'cost'=>['crystal'=>25],'buildTime'=>20,'production'=>['energy'=>5],'energyDrain'=>0,'staffDrain'=>1,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>70,'crystal'=>35],'buildTime'=>600,'production'=>['energy'=>12],'energyDrain'=>0,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>180,'crystal'=>90],'buildTime'=>3600,'production'=>['energy'=>25],'energyDrain'=>0,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>200,'crystal'=>100],'buildTime'=>10800,'production'=>['energy'=>32],'energyDrain'=>0,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>5,'cost'=>['metal'=>210,'crystal'=>110],'buildTime'=>21600,'production'=>['energy'=>36],'energyDrain'=>0,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
    ['level'=>6,'cost'=>['metal'=>250,'crystal'=>130],'buildTime'=>43200,'production'=>['energy'=>40],'energyDrain'=>0,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
  ]],

  'metal_mine' => ['tileType' => 'mining', 'levels' => [
    ['level'=>1,'cost'=>['metal'=>30],'buildTime'=>20,'production'=>['metal'=>2],'energyDrain'=>3,'staffDrain'=>2,'storageCapacity'=>['metal'=>300],'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>80,'crystal'=>20],'buildTime'=>600,'production'=>['metal'=>5],'energyDrain'=>5,'staffDrain'=>4,'storageCapacity'=>['metal'=>700],'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>220,'crystal'=>60],'buildTime'=>5400,'production'=>['metal'=>12],'energyDrain'=>9,'staffDrain'=>6,'storageCapacity'=>['metal'=>1500],'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>240,'crystal'=>80],'buildTime'=>14400,'production'=>['metal'=>16],'energyDrain'=>9,'staffDrain'=>6,'storageCapacity'=>['metal'=>2000],'unlocks'=>[],'popBonus'=>0],
    ['level'=>5,'cost'=>['metal'=>340,'crystal'=>100],'buildTime'=>28800,'production'=>['metal'=>22],'energyDrain'=>9,'staffDrain'=>6,'storageCapacity'=>['metal'=>2500],'unlocks'=>[],'popBonus'=>0],
    ['level'=>6,'cost'=>['metal'=>440,'crystal'=>130],'buildTime'=>57600,'production'=>['metal'=>28],'energyDrain'=>9,'staffDrain'=>6,'storageCapacity'=>['metal'=>3000],'unlocks'=>[],'popBonus'=>0],
  ]],

  'crystal_drill' => ['tileType' => 'mining', 'levels' => [
    ['level'=>1,'cost'=>['metal'=>50],'buildTime'=>20,'production'=>['crystal'=>1],'energyDrain'=>2,'staffDrain'=>2,'storageCapacity'=>['crystal'=>200],'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>110,'crystal'=>30],'buildTime'=>1500,'production'=>['crystal'=>3],'energyDrain'=>4,'staffDrain'=>3,'storageCapacity'=>['crystal'=>500],'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>280,'crystal'=>80],'buildTime'=>5400,'production'=>['crystal'=>7],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['crystal'=>1000],'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>300,'crystal'=>100],'buildTime'=>14400,'production'=>['crystal'=>10],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['crystal'=>1300],'unlocks'=>[],'popBonus'=>0],
    ['level'=>5,'cost'=>['metal'=>400,'crystal'=>130],'buildTime'=>25200,'production'=>['crystal'=>15],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['crystal'=>1700],'unlocks'=>[],'popBonus'=>0],
    ['level'=>6,'cost'=>['metal'=>420,'crystal'=>160],'buildTime'=>43200,'production'=>['crystal'=>18],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['crystal'=>2000],'unlocks'=>[],'popBonus'=>0],
    ['level'=>7,'cost'=>['metal'=>480,'crystal'=>200],'buildTime'=>86400,'production'=>['crystal'=>25],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['crystal'=>2500],'unlocks'=>[],'popBonus'=>0],
  ]],

  'alloy_forge' => ['tileType'=>'mining','planetTypes'=>['terrestrial'],'requiresBuilding'=>'laboratory','requiresLevel'=>2,'levels'=>[
    ['level'=>1,'cost'=>['metal'=>80,'crystal'=>30],'buildTime'=>900,'production'=>['alloy'=>1],'energyDrain'=>4,'staffDrain'=>3,'storageCapacity'=>['alloy'=>150],'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>200,'crystal'=>80,'alloy'=>20],'buildTime'=>5400,'production'=>['alloy'=>3],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['alloy'=>400],'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>500,'crystal'=>200,'alloy'=>80],'buildTime'=>21600,'production'=>['alloy'=>7],'energyDrain'=>12,'staffDrain'=>8,'storageCapacity'=>['alloy'=>900],'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>1100,'crystal'=>450,'alloy'=>200],'buildTime'=>57600,'production'=>['alloy'=>15],'energyDrain'=>20,'staffDrain'=>12,'storageCapacity'=>['alloy'=>2000],'unlocks'=>[],'popBonus'=>0],
  ]],

  'biomass_collector' => ['tileType'=>'mining','planetTypes'=>['ocean'],'requiresBuilding'=>'laboratory','requiresLevel'=>2,'levels'=>[
    ['level'=>1,'cost'=>['metal'=>80,'crystal'=>30],'buildTime'=>900,'production'=>['biomass'=>1],'energyDrain'=>4,'staffDrain'=>3,'storageCapacity'=>['biomass'=>150],'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>200,'crystal'=>80,'biomass'=>20],'buildTime'=>5400,'production'=>['biomass'=>3],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['biomass'=>400],'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>500,'crystal'=>200,'biomass'=>80],'buildTime'=>21600,'production'=>['biomass'=>7],'energyDrain'=>12,'staffDrain'=>8,'storageCapacity'=>['biomass'=>900],'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>1100,'crystal'=>450,'biomass'=>200],'buildTime'=>57600,'production'=>['biomass'=>15],'energyDrain'=>20,'staffDrain'=>12,'storageCapacity'=>['biomass'=>2000],'unlocks'=>[],'popBonus'=>0],
  ]],

  'obsidian_quarry' => ['tileType'=>'mining','planetTypes'=>['volcanic'],'requiresBuilding'=>'laboratory','requiresLevel'=>2,'levels'=>[
    ['level'=>1,'cost'=>['metal'=>80,'crystal'=>30],'buildTime'=>900,'production'=>['obsidian'=>1],'energyDrain'=>4,'staffDrain'=>3,'storageCapacity'=>['obsidian'=>150],'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>200,'crystal'=>80,'obsidian'=>20],'buildTime'=>5400,'production'=>['obsidian'=>3],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['obsidian'=>400],'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>500,'crystal'=>200,'obsidian'=>80],'buildTime'=>21600,'production'=>['obsidian'=>7],'energyDrain'=>12,'staffDrain'=>8,'storageCapacity'=>['obsidian'=>900],'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>1100,'crystal'=>450,'obsidian'=>200],'buildTime'=>57600,'production'=>['obsidian'=>15],'energyDrain'=>20,'staffDrain'=>12,'storageCapacity'=>['obsidian'=>2000],'unlocks'=>[],'popBonus'=>0],
  ]],

  'cryo_extractor' => ['tileType'=>'mining','planetTypes'=>['frozen'],'requiresBuilding'=>'laboratory','requiresLevel'=>2,'levels'=>[
    ['level'=>1,'cost'=>['metal'=>80,'crystal'=>30],'buildTime'=>900,'production'=>['cryo'=>1],'energyDrain'=>4,'staffDrain'=>3,'storageCapacity'=>['cryo'=>150],'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>200,'crystal'=>80,'cryo'=>20],'buildTime'=>5400,'production'=>['cryo'=>3],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['cryo'=>400],'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>500,'crystal'=>200,'cryo'=>80],'buildTime'=>21600,'production'=>['cryo'=>7],'energyDrain'=>12,'staffDrain'=>8,'storageCapacity'=>['cryo'=>900],'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>1100,'crystal'=>450,'cryo'=>200],'buildTime'=>57600,'production'=>['cryo'=>15],'energyDrain'=>20,'staffDrain'=>12,'storageCapacity'=>['cryo'=>2000],'unlocks'=>[],'popBonus'=>0],
  ]],

  'solar_array' => ['tileType'=>'energy','requiresBuilding'=>'power_plant','requiresLevel'=>1,'levels'=>[
    ['level'=>1,'cost'=>['metal'=>50,'crystal'=>30],'buildTime'=>300,'production'=>['energy'=>8],'energyDrain'=>0,'staffDrain'=>1,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>130,'crystal'=>65],'buildTime'=>1800,'production'=>['energy'=>18],'energyDrain'=>0,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>320,'crystal'=>160],'buildTime'=>10800,'production'=>['energy'=>38],'energyDrain'=>0,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
  ]],

  'cryo_reactor' => ['tileType'=>'energy','planetTypes'=>['frozen'],'requiresBuilding'=>'power_plant','requiresLevel'=>4,'levels'=>[
    ['level'=>1,'cost'=>['metal'=>200,'crystal'=>80,'cryo'=>40],'buildTime'=>3600,'production'=>['energy'=>40],'energyDrain'=>0,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>500,'crystal'=>200,'cryo'=>120],'buildTime'=>14400,'production'=>['energy'=>90],'energyDrain'=>0,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1200,'crystal'=>500,'cryo'=>300],'buildTime'=>43200,'production'=>['energy'=>180],'energyDrain'=>0,'staffDrain'=>7,'unlocks'=>[],'popBonus'=>0],
  ]],

  'alloy_fusion_reactor' => ['tileType'=>'energy','planetTypes'=>['terrestrial'],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>200,'crystal'=>80,'alloy'=>40],'buildTime'=>3600,'production'=>['energy'=>40],'energyDrain'=>0,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>500,'crystal'=>200,'alloy'=>120],'buildTime'=>14400,'production'=>['energy'=>90],'energyDrain'=>0,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1200,'crystal'=>500,'alloy'=>300],'buildTime'=>43200,'production'=>['energy'=>180],'energyDrain'=>0,'staffDrain'=>7,'unlocks'=>[],'popBonus'=>0],
  ]],

  'obsidian_plasma_core' => ['tileType'=>'energy','planetTypes'=>['volcanic'],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>200,'crystal'=>80,'obsidian'=>40],'buildTime'=>3600,'production'=>['energy'=>45],'energyDrain'=>0,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>500,'crystal'=>200,'obsidian'=>120],'buildTime'=>14400,'production'=>['energy'=>100],'energyDrain'=>0,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1200,'crystal'=>500,'obsidian'=>300],'buildTime'=>43200,'production'=>['energy'=>200],'energyDrain'=>0,'staffDrain'=>7,'unlocks'=>[],'popBonus'=>0],
  ]],

  'biomass_reactor' => ['tileType'=>'energy','planetTypes'=>['ocean'],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>200,'crystal'=>80,'biomass'=>40],'buildTime'=>3600,'production'=>['energy'=>35],'energyDrain'=>0,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>500,'crystal'=>200,'biomass'=>120],'buildTime'=>14400,'production'=>['energy'=>80],'energyDrain'=>0,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1200,'crystal'=>500,'biomass'=>300],'buildTime'=>43200,'production'=>['energy'=>160],'energyDrain'=>0,'staffDrain'=>7,'unlocks'=>[],'popBonus'=>0],
  ]],

  'geothermal_tap' => ['tileType'=>'energy','planetTypes'=>['volcanic'],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>30,'crystal'=>10],'buildTime'=>20,'production'=>['energy'=>10],'energyDrain'=>0,'staffDrain'=>1,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>80,'crystal'=>25],'buildTime'=>1200,'production'=>['energy'=>24],'energyDrain'=>0,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>200,'crystal'=>60],'buildTime'=>5400,'production'=>['energy'=>50],'energyDrain'=>0,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
  ]],

  'tidal_generator' => ['tileType'=>'energy','planetTypes'=>['ocean'],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>35,'crystal'=>15],'buildTime'=>20,'production'=>['energy'=>9],'energyDrain'=>0,'staffDrain'=>1,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>90,'crystal'=>40],'buildTime'=>1200,'production'=>['energy'=>20],'energyDrain'=>0,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>220,'crystal'=>100],'buildTime'=>5400,'production'=>['energy'=>42],'energyDrain'=>0,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
  ]],

  'recon_drone' => ['tileType'=>'spacebase','levels'=>[
    ['level'=>1,'cost'=>['metal'=>250,'crystal'=>100],'buildTime'=>600,'production'=>[],'energyDrain'=>5,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
  ]],

  'colony_ship' => ['tileType'=>'spacebase','levels'=>[
    ['level'=>1,'cost'=>['metal'=>400,'crystal'=>200],'buildTime'=>2400,'production'=>[],'energyDrain'=>8,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
  ]],

  'space_building' => ['tileType'=>'techcenter','levels'=>[
    ['level'=>1,'cost'=>['metal'=>200,'crystal'=>150],'buildTime'=>720,'production'=>[],'energyDrain'=>6,'staffDrain'=>3,'unlocks'=>[['slot'=>3],['slot'=>10]],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>500,'crystal'=>320],'buildTime'=>10800,'production'=>[],'energyDrain'=>10,'staffDrain'=>5,'unlocks'=>[],'popBonus'=>0],
  ]],

  'laboratory' => ['tileType'=>'techcenter','levels'=>[
    ['level'=>1,'cost'=>['metal'=>130,'crystal'=>80],'buildTime'=>480,'production'=>[],'energyDrain'=>5,'staffDrain'=>3,'unlocks'=>[['slot'=>9]],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>320,'crystal'=>180],'buildTime'=>5400,'production'=>[],'energyDrain'=>8,'staffDrain'=>5,'unlocks'=>[],'popBonus'=>0],
  ]],

  'weapons_building' => ['tileType'=>'techcenter','levels'=>[
    ['level'=>1,'cost'=>['metal'=>180,'crystal'=>100],'buildTime'=>600,'production'=>[],'energyDrain'=>5,'staffDrain'=>3,'unlocks'=>[['slot'=>1]],'popBonus'=>0],
  ]],

  'star_map' => ['tileType'=>'comm_center','global'=>true,'levels'=>[
    ['level'=>1,'cost'=>['metal'=>80,'crystal'=>100],'buildTime'=>480,'production'=>[],'energyDrain'=>0,'staffDrain'=>0,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>200,'crystal'=>250],'buildTime'=>5400,'production'=>[],'energyDrain'=>0,'staffDrain'=>0,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>500,'crystal'=>600],'buildTime'=>10800,'production'=>[],'energyDrain'=>0,'staffDrain'=>0,'unlocks'=>[],'popBonus'=>0],
  ]],

  'interstellar_comm' => ['tileType'=>'comm_center','global'=>true,'requiresBuilding'=>'star_map','requiresLevel'=>3,'levels'=>[
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>400],'buildTime'=>10800,'production'=>[],'energyDrain'=>0,'staffDrain'=>0,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>600,'crystal'=>800],'buildTime'=>21600,'production'=>[],'energyDrain'=>0,'staffDrain'=>0,'unlocks'=>[],'popBonus'=>0],
  ]],

  'alloy_refinery' => ['tileType'=>'hightech','planetTypes'=>['terrestrial'],'conversions'=>[
    ['input'=>['metal'=>15,'alloy'=>8],'output'=>['super_alloy'=>1],'durationBase'=>22],
  ],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>150,'alloy'=>80],'buildTime'=>3600,'production'=>[],'energyDrain'=>6,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>700,'crystal'=>350,'alloy'=>200],'buildTime'=>21600,'production'=>[],'energyDrain'=>10,'staffDrain'=>5,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1600,'crystal'=>800,'alloy'=>500],'buildTime'=>57600,'production'=>[],'energyDrain'=>16,'staffDrain'=>8,'unlocks'=>[],'popBonus'=>0],
  ]],

  'obsidian_foundry' => ['tileType'=>'hightech','planetTypes'=>['volcanic'],'conversions'=>[
    ['input'=>['crystal'=>8,'obsidian'=>8],'output'=>['quantum_shard'=>1],'durationBase'=>30],
  ],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>150,'obsidian'=>80],'buildTime'=>3600,'production'=>[],'energyDrain'=>6,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>700,'crystal'=>350,'obsidian'=>200],'buildTime'=>21600,'production'=>[],'energyDrain'=>10,'staffDrain'=>5,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1600,'crystal'=>800,'obsidian'=>500],'buildTime'=>57600,'production'=>[],'energyDrain'=>16,'staffDrain'=>8,'unlocks'=>[],'popBonus'=>0],
  ]],

  'cryo_refinery' => ['tileType'=>'hightech','planetTypes'=>['frozen'],'conversions'=>[
    ['input'=>['crystal'=>10,'cryo'=>5],'output'=>['pure_crystal'=>1],'durationBase'=>20],
  ],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>150,'cryo'=>80],'buildTime'=>3600,'production'=>[],'energyDrain'=>6,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>700,'crystal'=>350,'cryo'=>200],'buildTime'=>21600,'production'=>[],'energyDrain'=>10,'staffDrain'=>5,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1600,'crystal'=>800,'cryo'=>500],'buildTime'=>57600,'production'=>[],'energyDrain'=>16,'staffDrain'=>8,'unlocks'=>[],'popBonus'=>0],
  ]],

  'bio_lab' => ['tileType'=>'hightech','planetTypes'=>['ocean'],'conversions'=>[
    ['input'=>['metal'=>12,'biomass'=>4],'output'=>['nano_alloy'=>1],'durationBase'=>18],
  ],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>150,'biomass'=>80],'buildTime'=>3600,'production'=>[],'energyDrain'=>6,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>700,'crystal'=>350,'biomass'=>200],'buildTime'=>21600,'production'=>[],'energyDrain'=>10,'staffDrain'=>5,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1600,'crystal'=>800,'biomass'=>500],'buildTime'=>57600,'production'=>[],'energyDrain'=>16,'staffDrain'=>8,'unlocks'=>[],'popBonus'=>0],
  ]],

  'power_cell_lab' => ['tileType'=>'hightech','conversions'=>[
    ['input'=>['metal'=>20,'crystal'=>10],'output'=>['power_cell'=>1],'durationBase'=>30],
  ],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>200,'crystal'=>100],'buildTime'=>1800,'production'=>[],'energyDrain'=>5,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>500,'crystal'=>250],'buildTime'=>14400,'production'=>[],'energyDrain'=>8,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1200,'crystal'=>600],'buildTime'=>43200,'production'=>[],'energyDrain'=>12,'staffDrain'=>6,'unlocks'=>[],'popBonus'=>0],
  ]],

  'shield_generator' => ['tileType'=>'defense','levels'=>[
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>150],'buildTime'=>900,'production'=>[],'energyDrain'=>8,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>700,'crystal'=>350],'buildTime'=>14400,'production'=>[],'energyDrain'=>15,'staffDrain'=>5,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1500,'crystal'=>750],'buildTime'=>57600,'production'=>[],'energyDrain'=>25,'staffDrain'=>8,'unlocks'=>[],'popBonus'=>0],
  ]],

];

// ── Galaxy generation ─────────────────────────────────────────────────────────

const SYSTEM_NAME_POOL = [
    'Arix','Vega','Helix','Nova','Zerath','Tartus','Cygnus','Lyra',
    'Fenris','Oryx','Altair','Kronos','Deneb','Spica','Procyon','Castor',
    'Phalos','Solux','Mirach','Fornax','Dracor','Nexar','Valeth','Koryn',
    'Kepler','Vorn','Adar','Nexus','Pyrix','Zoltar','Elara','Theron',
    'Quasar','Pulsar','Rigel','Sirius','Antares','Pollux','Vela','Hydra',
];

const STAR_CLASSES  = ['G','K','M','F'];
const ROMAN_NUMERALS = ['I','II','III','IV','V','VI','VII'];
const HABITABLE_TYPES = ['terrestrial','volcanic','frozen','ocean'];

/**
 * Pick a random unused system name from the pool.
 * Falls back to "System-<N>" if the pool is exhausted.
 */
function pick_system_name(PDO $db): string {
    $used = $db->query('SELECT name FROM hs_star_systems')->fetchAll(PDO::FETCH_COLUMN);
    $usedShortNames = array_map(fn($n) => str_replace(' System', '', $n), $used);
    $available = array_values(array_diff(SYSTEM_NAME_POOL, $usedShortNames));
    if (empty($available)) {
        $count = (int)$db->query('SELECT COUNT(*) FROM hs_star_systems')->fetchColumn();
        return "System-" . ($count + 1);
    }
    return $available[array_rand($available)];
}

/**
 * Find a position (x, y) in 0–100 that is at least $minDist away from all
 * existing systems. Falls back to a random position after $maxTries attempts.
 */
function pick_system_position(PDO $db, float $minDist = 15.0, int $maxTries = 50): array {
    $existing = $db->query('SELECT x, y FROM hs_star_systems')->fetchAll();
    for ($i = 0; $i < $maxTries; $i++) {
        $x = mt_rand(5, 95);
        $y = mt_rand(5, 95);
        $ok = true;
        foreach ($existing as $e) {
            $d = sqrt(($x - $e['x']) ** 2 + ($y - $e['y']) ** 2);
            if ($d < $minDist) { $ok = false; break; }
        }
        if ($ok) return ['x' => $x, 'y' => $y];
    }
    return ['x' => mt_rand(5, 95), 'y' => mt_rand(5, 95)];
}

/**
 * Create a new star system for a registering player.
 * Returns ['systemId' => int, 'planetId' => int] for a random habitable planet.
 */
function create_player_system(PDO $db): array {
    $shortName  = pick_system_name($db);
    $systemName = "$shortName System";
    $pos        = pick_system_position($db);
    $starClass  = STAR_CLASSES[array_rand(STAR_CLASSES)];

    $db->prepare(
        'INSERT INTO hs_star_systems (galaxy_id, name, x, y, star_class) VALUES (1,?,?,?,?)'
    )->execute([$systemName, $pos['x'], $pos['y'], $starClass]);
    $systemId = (int)$db->lastInsertId();

    // 4 habitable + 2–3 uninhabitable, shuffled
    $types = HABITABLE_TYPES;
    $uninhabitableCount = mt_rand(2, 3);
    for ($i = 0; $i < $uninhabitableCount; $i++) $types[] = 'uninhabitable';
    shuffle($types);

    $stmt = $db->prepare('INSERT INTO hs_planets (system_id, name, type) VALUES (?,?,?)');
    $habitablePlanetIds = [];
    foreach ($types as $i => $type) {
        $planetName = "$shortName " . ROMAN_NUMERALS[$i];
        $stmt->execute([$systemId, $planetName, $type]);
        if ($type !== 'uninhabitable') {
            $habitablePlanetIds[] = (int)$db->lastInsertId();
        }
    }

    $homePlanetId = $habitablePlanetIds[array_rand($habitablePlanetIds)];
    return ['systemId' => $systemId, 'planetId' => $homePlanetId];
}

// All storable resource keys (energy excluded — computed, not stored)
const RESOURCE_KEYS = [
    'metal','crystal','population','alloy','obsidian','cryo','biomass',
    'pure_crystal','super_alloy','quantum_shard','nano_alloy','power_cell',
];

// ── Power battery (grid-uptime mechanic) ──────────────────────────────────────
// The power_plant holds a battery that slowly drains over time. When empty the
// whole planet grid goes offline. Drain is in % per hour, keyed by power_plant
// level — higher level = larger battery = lasts longer (Lv1 ≈ 72 h full→empty).
const POWER_BATTERY_DRAIN = [
    1 => 1.389,  // ~72 h  (3 days)
    2 => 1.042,  // ~96 h  (4 days)
    3 => 0.833,  // ~120 h (5 days)
    4 => 0.694,  // ~144 h (6 days)
    5 => 0.595,  // ~168 h (7 days)
    6 => 0.521,  // ~192 h (8 days)
];
const POWER_BATTERY_MAX   = 100.0;  // % full
const POWER_BATTERY_CLICK = 10.0;   // % gained per charge click

function battery_drain_per_hour(int $ppLevel): float {
    if ($ppLevel <= 0) return 0.0;
    return POWER_BATTERY_DRAIN[min($ppLevel, 6)] ?? POWER_BATTERY_DRAIN[6];
}

// ── Population recruitment (base tile, daily growth pool) ──────────────────────
// A recruit pool refills over time up to a cap; a +1 click moves one recruit into
// the population. Away long → pool sits at the cap (never hundreds queued).
const RECRUIT_GROWTH_PER_DAY = 5.0;   // pool refill rate per day
const RECRUIT_POOL_MAX       = 15.0;  // max pending recruits (~3 days)

function recruit_growth_per_hour(): float {
    return RECRUIT_GROWTH_PER_DAY / 24.0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function building_def(string $key): array|null {
    return BUILDINGS[$key] ?? null;
}

function level_def(string $key, int $level): array|null {
    $def = BUILDINGS[$key] ?? null;
    if (!$def || $level < 1) return null;
    return $def['levels'][$level - 1] ?? null;
}

function is_global(string $key): bool {
    return in_array($key, GLOBAL_BUILDINGS, true);
}
