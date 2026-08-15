<?php
/**
 * PHP mirror of hawkStarConfig.js — used for server-side cost validation,
 * build times, production computation, and slot unlocking.
 * Keep in sync with frontend/app/utils/hawkStarConfig.js.
 */

// 'facility' names the spacebase building that has to stand on the planet before
// this unit can be produced. Several units share one facility — the drone hangar
// builds every drone, the shipyard every ship.
const UNIT_COSTS = [
    'recon_drone' => ['facility' => 'drone_hangar', 'cost' => ['metal' => 60,  'crystal' => 25],  'buildTimeBase' => 5400,  'flightTimeBase' => 3600],
    // 'crew' is taken out of the planet's free workers when the ship is built —
    // the settlers board it and leave with the ship.
    // The power_cell gates expansion behind the laboratory → power_cell_lab branch.
    'colony_ship' => ['facility' => 'shipyard', 'cost' => ['metal' => 300, 'crystal' => 150, 'power_cell' => 1], 'crew' => 6, 'buildTimeBase' => 21600, 'flightTimeBase' => 7200],
    // One per planet (see CARGO_* below) — the only way to move goods between
    // planets. flightTimeBase applies to each leg, so a neighbour is 1 h out, 1 h back.
    'cargo_drone' => ['facility' => 'drone_hangar', 'cost' => ['metal' => 120, 'crystal' => 60, 'power_cell' => 2], 'buildTimeBase' => 5400, 'flightTimeBase' => 3600],
    // The only unit that leaves the home system. It reveals who owns ONE planet
    // in a scanned foreign system and is consumed doing it — the superconductor
    // in the cost is the sensor package, which puts espionage behind a frozen
    // planet's refinery or a cargo run.
    'spy_drone'   => ['facility' => 'drone_hangar', 'cost' => ['metal' => 150, 'crystal' => 80, 'superconductor' => 1], 'buildTimeBase' => 7200],
    // Stays in orbit and keeps transmitting: the same target as the drone, but
    // the finding stays live instead of ageing. Structure + Control, per the
    // house rule that a build cost demands two domains the recipe does not.
    'spy_satellite' => ['facility' => 'drone_hangar', 'cost' => ['metal' => 300, 'crystal' => 150, 'superconductor' => 1, 'duraplate' => 1], 'buildTimeBase' => 14400],
    // The warship. Ordered as a batch (see UNIT_BATCH_KEYS) and the only unit
    // with a `firepower` stat — 20 points against a defender's shield, then the
    // battery. Two crew per hull is the real brake: a full fleet is 24 people
    // off a planet whose recruit pool caps at 18.
    'corvette'    => ['facility' => 'shipyard', 'cost' => ['metal' => 250, 'crystal' => 120, 'duraplate' => 1], 'crew' => 2, 'buildTimeBase' => 10800, 'firepower' => 20],
];

// ── Fleet ─────────────────────────────────────────────────────────────────────
// Units that may be ordered several at a time. A batch is one timer over
// count × buildTimeBase and lands as a whole squadron — same shape as a
// conversion batch, and for the same reason: clicking once per hull is a chore,
// not a decision. Everything not listed here stays at one per build.
const UNIT_BATCH_KEYS = ['corvette'];

// How many warships a planet may hold, per level of its `weapons_building`.
// Lv1 = 4 · Lv2 = 8 · Lv3 = 12. This is the cap on aggression: four corvettes
// are 80 points of firepower, which cannot crack a charged planet (100 shield +
// 100 battery) but flattens a neglected one. Counts hulls in the dock AND hulls
// in production. Mirrors FLEET_PER_WEAPONS_LEVEL in hawkStarConfig.js.
const FLEET_PER_WEAPONS_LEVEL = 4;

// ── Espionage ─────────────────────────────────────────────────────────────────
// Flight time uses the same distance formula as a deep-space scan (galaxy/scan.php):
// a spy drone travels at signal speed, so a neighbouring system is the 2 h floor
// and the far side of the galaxy is ~8 h. Distance is between star systems, not
// planets — inside a system every planet is the same trip.
const SPY_FLIGHT_MIN      = 7200;   // seconds, minimum one-way flight
const SPY_FLIGHT_PER_DIST = 180;    // seconds per unit of system distance

// A drone reports ONCE. What it saw is stored with the moment it saw it and
// never updates itself — the galaxy moves on, the report does not. After
// SPY_INTEL_STALE_HOURS it is drawn as stale and wants a fresh flight.
const SPY_INTEL_STALE_HOURS = 48;

// A satellite keeps the same planet live for as long as it transmits — and it
// transmits until somebody shoots it down. What stops espionage from being
// solved once and for all is therefore no longer a timer but the target: an
// `orbital_defense` on the watched planet finds it and destroys it, which is
// also what makes placing one a wager rather than a purchase (see
// INTERCEPT_COST). Until 2026-08-13 this was a flat 168 h lifetime.

// One shot from the orbital battery. Deliberately cheap next to the satellite it
// kills (300 M · 150 C · 1 SC · 1 DP): the expense was the battery itself, and a
// defender who has built one should never hesitate to use it.
const INTERCEPT_COST = ['power_cell' => 1];

// ── Cargo drone ───────────────────────────────────────────────────────────────
// Only high-tech goods can be shipped. Raw resources are deliberately excluded:
// they are the ones with a storageCapacity, and compute_resources() clamps stored
// values to their cap on every tick — an overshooting delivery would silently
// evaporate. Keeping the hold to uncapped goods removes the problem entirely.
const CARGO_LOADABLE = ['power_cell', 'duraplate', 'plasma_core', 'superconductor', 'vital_gel'];

// Four single items, freely mixed — not four stacks.
const CARGO_CAPACITY = 4;

// ── The raid ──────────────────────────────────────────────────────────────────
// Sits below the cargo block because RAID_LOOTABLE is defined from
// CARGO_LOADABLE, and a const may only be built from one already declared.
//
// Warships are heavy: the 3 h floor is a same-system strike, distance is added
// on top at a slower rate than a spy drone's signal-speed flight.
const RAID_FLIGHT_MIN      = 10800;  // seconds, one-way floor
const RAID_FLIGHT_PER_DIST = 240;    // seconds per unit of system distance

// The orbital battery fires by itself: the defender is usually offline, so the
// gun is a standing order, not a click. One power cell out of the planet's own
// stock kills one corvette, up to this many per volley. A plundering fleet eats
// a SECOND volley while it loads — that is the entire price of the 💰 order.
const RAID_INTERCEPT_SHOTS = 3;
const RAID_INTERCEPT_COST  = ['power_cell' => 1];

// What a raid can carry off: refined goods only. Raw resources are capped and
// compute_resources() clamps to the cap every tick, so a raw haul would evaporate
// on the way into the attacker's silo — the same reason the cargo drone refuses
// them. Deliberately the same list, not a copy of it.
const RAID_LOOTABLE = CARGO_LOADABLE;

// A planet gives up goods once per this window. It can be knocked out again
// immediately — only the silo is off limits, so raiding cannot be farmed.
const RAID_PLUNDER_COOLDOWN_HOURS = 12;

// Nobody may be raided while their account is younger than this. The first days
// are for learning the game, not for losing a refinery run to someone who
// finished learning it months ago.
const RAID_NEWBIE_PROTECTION_DAYS = 3;

// ── Conversions ───────────────────────────────────────────────────────────────
// Largest batch a single order may hold. Because a running batch locks its
// recipe, this is also the hard ceiling on production: at most 4 units per
// 4 durations. Mirrors CONVERSION_MAX_QUEUE in hawkStarConfig.js — the client
// caps the picker, this caps the request.
const CONVERSION_MAX_BATCH = 4;

const GLOBAL_BUILDINGS = ['star_map', 'interstellar_comm'];

const BUILDINGS = [

  'command_center' => ['tileType' => 'base', 'levels' => [
    ['level'=>1,'cost'=>[],'buildTime'=>20,'production'=>[],'energyDrain'=>0,'staffDrain'=>1,'unlocks'=>[['slot'=>2],['slot'=>4]],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>80,'crystal'=>30],'buildTime'=>480,'production'=>[],'energyDrain'=>2,'staffDrain'=>2,'unlocks'=>[['slot'=>6],['slot'=>7],['slot'=>8]],'popBonus'=>5,'requiresBuilding'=>'metal_mine','requiresLevel'=>2],
    ['level'=>3,'cost'=>['metal'=>300,'crystal'=>100],'buildTime'=>3600,'production'=>[],'energyDrain'=>3,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>10],
  ]],

  // Life support is the domain that turns into people: vital gel plus supplies
  // buys a colonist outright. The recruit pool hard-caps growth at ~12/day, so
  // this is the only way past it — and the only conversion whose output is a
  // person. Priced so it never undercuts plain recruiting: one head costs two
  // vital gel (an hour of bio lab) on top of the metal.
  'med_station' => ['tileType'=>'base','requiresBuilding'=>'command_center','requiresLevel'=>3,'conversions'=>[
    ['input'=>['metal'=>120,'vital_gel'=>2],'output'=>['population'=>1],'durationBase'=>1800],
  ],'levels'=>[
    // Single level, like the refineries — throughput is tuned via durationBase.
    ['level'=>1,'cost'=>['metal'=>400,'crystal'=>200,'vital_gel'=>3,'superconductor'=>2],'buildTime'=>3600,'production'=>[],'energyDrain'=>6,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
  ]],

  'power_plant' => ['tileType' => 'energy', 'levels' => [
    ['level'=>1,'cost'=>['crystal'=>25],'buildTime'=>20,'production'=>['energy'=>5],'energyDrain'=>0,'staffDrain'=>1,'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>70,'crystal'=>35],'buildTime'=>600,'production'=>['energy'=>12],'energyDrain'=>0,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>180,'crystal'=>90],'buildTime'=>3600,'production'=>['energy'=>25],'energyDrain'=>0,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>250,'crystal'=>100],'buildTime'=>10800,'production'=>['energy'=>40],'energyDrain'=>0,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
    ['level'=>5,'cost'=>['metal'=>320,'crystal'=>130],'buildTime'=>21600,'production'=>['energy'=>56],'energyDrain'=>0,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
    ['level'=>6,'cost'=>['metal'=>440,'crystal'=>180],'buildTime'=>43200,'production'=>['energy'=>75],'energyDrain'=>0,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
  ]],

  'metal_mine' => ['tileType' => 'mining', 'levels' => [
    ['level'=>1,'cost'=>['metal'=>30],'buildTime'=>20,'production'=>['metal'=>2],'energyDrain'=>3,'staffDrain'=>2,'storageCapacity'=>['metal'=>300],'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>80,'crystal'=>20],'buildTime'=>600,'production'=>['metal'=>5],'energyDrain'=>5,'staffDrain'=>4,'storageCapacity'=>['metal'=>700],'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>220,'crystal'=>60],'buildTime'=>5400,'production'=>['metal'=>12],'energyDrain'=>9,'staffDrain'=>6,'storageCapacity'=>['metal'=>1500],'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>280,'crystal'=>100],'buildTime'=>14400,'production'=>['metal'=>20],'energyDrain'=>12,'staffDrain'=>6,'storageCapacity'=>['metal'=>2400],'unlocks'=>[],'popBonus'=>0],
    ['level'=>5,'cost'=>['metal'=>420,'crystal'=>150],'buildTime'=>28800,'production'=>['metal'=>30],'energyDrain'=>16,'staffDrain'=>6,'storageCapacity'=>['metal'=>3600],'unlocks'=>[],'popBonus'=>0],
    ['level'=>6,'cost'=>['metal'=>600,'crystal'=>210],'buildTime'=>57600,'production'=>['metal'=>42],'energyDrain'=>21,'staffDrain'=>6,'storageCapacity'=>['metal'=>5200],'unlocks'=>[],'popBonus'=>0],
  ]],

  'crystal_drill' => ['tileType' => 'mining', 'levels' => [
    ['level'=>1,'cost'=>['metal'=>50],'buildTime'=>20,'production'=>['crystal'=>1],'energyDrain'=>2,'staffDrain'=>2,'storageCapacity'=>['crystal'=>200],'unlocks'=>[],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>110,'crystal'=>30],'buildTime'=>1500,'production'=>['crystal'=>3],'energyDrain'=>4,'staffDrain'=>3,'storageCapacity'=>['crystal'=>500],'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>280,'crystal'=>80],'buildTime'=>5400,'production'=>['crystal'=>7],'energyDrain'=>7,'staffDrain'=>5,'storageCapacity'=>['crystal'=>1000],'unlocks'=>[],'popBonus'=>0],
    ['level'=>4,'cost'=>['metal'=>340,'crystal'=>100],'buildTime'=>14400,'production'=>['crystal'=>11],'energyDrain'=>9,'staffDrain'=>5,'storageCapacity'=>['crystal'=>1500],'unlocks'=>[],'popBonus'=>0],
    ['level'=>5,'cost'=>['metal'=>460,'crystal'=>250],'buildTime'=>25200,'production'=>['crystal'=>17],'energyDrain'=>12,'staffDrain'=>5,'storageCapacity'=>['crystal'=>2100],'unlocks'=>[],'popBonus'=>0],
    ['level'=>6,'cost'=>['metal'=>630,'crystal'=>350],'buildTime'=>43200,'production'=>['crystal'=>24],'energyDrain'=>15,'staffDrain'=>5,'storageCapacity'=>['crystal'=>2900],'unlocks'=>[],'popBonus'=>0],
    ['level'=>7,'cost'=>['metal'=>820,'crystal'=>600],'buildTime'=>86400,'production'=>['crystal'=>33],'energyDrain'=>19,'staffDrain'=>5,'storageCapacity'=>['crystal'=>4000],'unlocks'=>[],'popBonus'=>0],
  ]],

  // ── Refined goods spent on mining infrastructure ────────────────────────────
  // Structure is hull, armour and framing — so duraplate is not "turned into"
  // metal, it is built into a shaft frame that opens a new seam. Control is
  // computing and sensors, so a superconductor drives the array that finds a
  // rich vein. Both run at the refineries' own tempo on purpose: one alloy
  // refinery (1 duraplate / 30 min) feeds exactly one shaft, one cryo refinery
  // exactly one survey array. That is what keeps a refinery running forever
  // instead of only until the next building is paid for.
  //
  // They also feed each other — the shaft eats crystal and yields metal, the
  // array eats metal and yields crystal.
  'deep_shaft' => ['tileType'=>'mining','requiresBuilding'=>'metal_mine','requiresLevel'=>4,'conversions'=>[
    ['input'=>['crystal'=>100,'duraplate'=>1],'output'=>['metal'=>1200],'durationBase'=>1800],
  ],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>600,'crystal'=>300,'plasma_core'=>2,'vital_gel'=>2],'buildTime'=>5400,'production'=>[],'energyDrain'=>10,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
  ]],

  'survey_array' => ['tileType'=>'mining','requiresBuilding'=>'crystal_drill','requiresLevel'=>4,'conversions'=>[
    ['input'=>['metal'=>100,'superconductor'=>1],'output'=>['crystal'=>700],'durationBase'=>1800],
  ],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>500,'crystal'=>400,'plasma_core'=>2,'duraplate'=>3],'buildTime'=>5400,'production'=>[],'energyDrain'=>9,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
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

  // Production facilities — each hosts a whole class of units, not a single one.
  'drone_hangar' => ['tileType'=>'spacebase','levels'=>[
    ['level'=>1,'cost'=>['metal'=>250,'crystal'=>100],'buildTime'=>600,'production'=>[],'energyDrain'=>5,'staffDrain'=>2,'unlocks'=>[],'popBonus'=>0],
  ]],

  'shipyard' => ['tileType'=>'spacebase','levels'=>[
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

  // Until 2026-08-15 this building unlocked a slot and then did nothing for the
  // rest of the game. It is now the **fleet cap**: every level buys
  // FLEET_PER_WEAPONS_LEVEL corvette berths, which is what keeps an early
  // player from massing a fleet that no defence can answer. Structure + Power
  // in the cost, per the two-domains rule — a gun needs a frame and a reactor.
  'weapons_building' => ['tileType'=>'techcenter','levels'=>[
    ['level'=>1,'cost'=>['metal'=>180,'crystal'=>100],'buildTime'=>600,'production'=>[],'energyDrain'=>5,'staffDrain'=>3,'unlocks'=>[['slot'=>1]],'popBonus'=>0],
    ['level'=>2,'cost'=>['metal'=>600,'crystal'=>350,'duraplate'=>2,'plasma_core'=>2],'buildTime'=>7200,'production'=>[],'energyDrain'=>9,'staffDrain'=>5,'unlocks'=>[],'popBonus'=>0],
    ['level'=>3,'cost'=>['metal'=>1400,'crystal'=>800,'duraplate'=>4,'plasma_core'=>3,'superconductor'=>2],'buildTime'=>14400,'production'=>[],'energyDrain'=>14,'staffDrain'=>8,'unlocks'=>[],'popBonus'=>0],
  ]],

  // The power domain's purpose: a plasma core is three fuel cells. The
  // power_cell_lab makes one cell per 30 min from raw material — the compressor
  // makes three in the same slot if you feed it a core, which turns volcanic
  // planets into the fleet's fuel supply and gives the cargo drone something to
  // haul. Same durationBase, so the gain is throughput, not a cheaper recipe.
  'plasma_compressor' => ['tileType'=>'techcenter','requiresBuilding'=>'laboratory','requiresLevel'=>2,'conversions'=>[
    ['input'=>['metal'=>150,'plasma_core'=>1],'output'=>['power_cell'=>3],'durationBase'=>1800],
  ],'levels'=>[
    ['level'=>1,'cost'=>['metal'=>500,'crystal'=>250,'duraplate'=>4,'superconductor'=>2],'buildTime'=>5400,'production'=>[],'energyDrain'=>8,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
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
    ['input'=>['metal'=>150,'alloy'=>60],'output'=>['duraplate'=>1],'durationBase'=>1800],
  ],'levels'=>[
    // Single level on purpose — keeps the early game simple.
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>150,'alloy'=>80],'buildTime'=>3600,'production'=>[],'energyDrain'=>6,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
  ]],

  'obsidian_foundry' => ['tileType'=>'hightech','planetTypes'=>['volcanic'],'conversions'=>[
    ['input'=>['crystal'=>80,'obsidian'=>80],'output'=>['plasma_core'=>1],'durationBase'=>1800],
  ],'levels'=>[
    // Single level on purpose — keeps the early game simple.
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>150,'obsidian'=>80],'buildTime'=>3600,'production'=>[],'energyDrain'=>6,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
  ]],

  'cryo_refinery' => ['tileType'=>'hightech','planetTypes'=>['frozen'],'conversions'=>[
    ['input'=>['crystal'=>100,'cryo'=>50],'output'=>['superconductor'=>1],'durationBase'=>1800],
  ],'levels'=>[
    // Single level on purpose — keeps the early game simple.
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>150,'cryo'=>80],'buildTime'=>3600,'production'=>[],'energyDrain'=>6,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
  ]],

  'bio_lab' => ['tileType'=>'hightech','planetTypes'=>['ocean'],'conversions'=>[
    ['input'=>['metal'=>120,'biomass'=>40],'output'=>['vital_gel'=>1],'durationBase'=>1800],
  ],'levels'=>[
    // Single level on purpose — keeps the early game simple.
    ['level'=>1,'cost'=>['metal'=>300,'crystal'=>150,'biomass'=>80],'buildTime'=>3600,'production'=>[],'energyDrain'=>6,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
  ]],

  'power_cell_lab' => ['tileType'=>'hightech','conversions'=>[
    ['input'=>['metal'=>200,'crystal'=>100],'output'=>['power_cell'=>1],'durationBase'=>1800],
  ],'levels'=>[
    // Single level on purpose — keeps the early game simple.
    ['level'=>1,'cost'=>['metal'=>200,'crystal'=>100],'buildTime'=>1800,'production'=>[],'energyDrain'=>5,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
  ]],

  // Duraplate is the structural refined resource — a shield needs plating, so it
  // cannot be built from raw metal alone (terrestrial output or trade only).
  //
  // Single level on purpose (2026-08-12): the shield is no longer upgraded, it is
  // *charged*. Strength comes from the shield charge below, not from a level.
  'shield_generator' => ['tileType'=>'defense','levels'=>[
    ['level'=>1,'cost'=>['metal'=>400,'crystal'=>200,'duraplate'=>5],'buildTime'=>3600,'production'=>[],'energyDrain'=>12,'staffDrain'=>4,'unlocks'=>[],'popBonus'=>0],
  ]],

  // Finds foreign satellites over this planet and shoots them down. Control pays
  // for the sensor that spots them, Power for the gun that kills them — the two
  // domains espionage itself is built from.
  'orbital_defense' => ['tileType'=>'defense','requiresBuilding'=>'shield_generator','requiresLevel'=>1,'levels'=>[
    ['level'=>1,'cost'=>['metal'=>500,'crystal'=>300,'superconductor'=>2,'plasma_core'=>2],'buildTime'=>5400,'production'=>[],'energyDrain'=>10,'staffDrain'=>3,'unlocks'=>[],'popBonus'=>0],
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
    'duraplate','plasma_core','superconductor','vital_gel','power_cell',
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

// ── Planetary shield (charge mechanic) ────────────────────────────────────────
// Same shape as the reactor battery, with one deliberate difference: charging
// the shield is NOT free. Each click costs crystal, so holding a shield at full
// strength is a standing expense rather than a habit.
//
// The drain is set so a full shield loses ~30 % a day: a player who tops it up
// on login keeps it standing for about three days without touching it. A click
// buys 8 h of full strength (10 % at 1.25 %/h), so holding it there costs ~19
// crystal per hour — noticeable on a young colony, small change on a developed
// one. Unlike the battery, an empty shield has no side effect on the planet:
// it is protection, not infrastructure.
const SHIELD_MAX            = 100.0;  // % strength
const SHIELD_CLICK          = 10.0;   // % gained per charge click
const SHIELD_DRAIN_PER_HOUR = 1.25;   // 30 %/day → 80 h (3.3 d) full → empty
const SHIELD_CLICK_COST     = ['crystal' => 150];

// ── Population recruitment (base tile, daily growth pool) ──────────────────────
// A recruit pool refills over time up to a cap; a +1 click moves one recruit into
// the population. Away long → pool sits at the cap (never hundreds queued).
const RECRUIT_GROWTH_PER_DAY = 12.0;  // pool refill rate per day
const RECRUIT_POOL_MAX       = 18.0;  // max pending recruits (~1.5 days)

// A fresh colony only wakes 6 of the ship's crew — the rest of the population has
// to be recruited at the normal rate, from an empty pool. The home planet keeps
// its full starting pool so a new player can recruit right away.
const COLONY_START_POP = 6.0;

function recruit_growth_per_hour(): float {
    return RECRUIT_GROWTH_PER_DAY / 24.0;
}

// ── Anomalies (planet events) ─────────────────────────────────────────────────
// Every few hours something happens on a planet and waits on the anomaly tile.
// Each anomaly is a fork between two *fully visible, guaranteed* outcomes — the
// randomness is in which anomaly shows up, never in what a choice pays out.
//
// Templates below are materialised into concrete numbers the moment an anomaly
// is rolled (materialize_anomaly_choice) and stored on the row. Everything after
// that reads the stored deltas, so the panel can promise exact amounts and a
// later config change can never alter an offer the player is already looking at.
//
// Adding an anomaly is a config entry — apply_anomaly_choice() stays untouched.
const ANOMALY_INTERVAL_HOURS = 6;   // earliest next roll after the previous one
const ANOMALY_TTL_HOURS      = 12;  // an untouched anomaly expires after this

// Raw-resource payouts are a share of the planet's *storage capacity*, not flat
// numbers: compute_resources() clamps to the cap on every tick, so a flat amount
// tuned for the late game would silently evaporate on an early planet. A share
// scales itself and stays worth clicking at every stage.
//
// The baseline stands in before any storage building exists, where the real cap
// is still 0 and a share of it would pay out nothing.
const ANOMALY_CAP_BASELINE = [
    'metal' => 300, 'crystal' => 200,
    'alloy' => 150, 'obsidian' => 150, 'cryo' => 150, 'biomass' => 150,
];

// The planet-exclusive raw resource, mirrors the planetTypes gates on the
// alloy_forge / obsidian_quarry / cryo_extractor / biomass_collector buildings.
const ANOMALY_PLANET_RAW = [
    'terrestrial' => 'alloy',
    'volcanic'    => 'obsidian',
    'frozen'      => 'cryo',
    'ocean'       => 'biomass',
];

// Goods a wreck can be carrying. High-tech only — they have no storageCapacity,
// so a salvage find is never clamped away.
const ANOMALY_SALVAGE_POOL = ['power_cell','duraplate','plasma_core','superconductor','vital_gel'];

// Template keys per choice:
//   gain          – flat resource deltas (high-tech goods, population)
//   cost          – flat resource deltas subtracted; the choice is refused if unaffordable
//   gainShareOfCap / costShareOfCap – share of that resource's storage cap
//                   ('@planetRaw' resolves to the planet's exclusive raw resource)
//   salvage       – N random high-tech goods, rolled at creation so the offer is exact
//   battery       – percentage points added to the reactor battery (clamped 0…max)
const ANOMALIES = [

    // Debris field: pure resource pick — which of the two do you need right now?
    'meteor' => ['icon' => '☄️', 'weight' => 20, 'choices' => [
        'crystal' => ['gainShareOfCap' => ['crystal' => 0.35]],
        'metal'   => ['gainShareOfCap' => ['metal'   => 0.35]],
    ]],

    // Derelict freighter: rare refined goods vs. a solid pile of raw material.
    'wreck' => ['icon' => '🛰️', 'weight' => 20, 'choices' => [
        'salvage' => ['salvage' => 2],
        'scrap'   => ['gainShareOfCap' => ['metal' => 0.30, 'crystal' => 0.20]],
    ]],

    // Ion storm: free grid uptime vs. bottled energy you can ship or spend later.
    // Needs a reactor — without one the battery choice would be a dud option.
    'solar_storm' => ['icon' => '🌞', 'weight' => 20, 'requiresBuilding' => 'power_plant', 'choices' => [
        'channel' => ['battery' => 40],
        'harvest' => ['gain' => ['power_cell' => 2]],
    ]],

    // Convoy asking to dock: workers cost you supplies, waving them through pays.
    'refugees' => ['icon' => '👥', 'weight' => 15, 'choices' => [
        'accept' => ['gain' => ['population' => 4], 'costShareOfCap' => ['metal' => 0.25]],
        'trade'  => ['gain' => ['power_cell' => 2]],
    ]],

    // Passing comet: spend power cells to catch the planet-exclusive raw resource,
    // or take the safe crystal reading. The exclusive raws sit on much smaller
    // storage caps than crystal, so their share has to be the larger one for the
    // paid option to stay worth paying for.
    'comet' => ['icon' => '🧊', 'weight' => 15, 'choices' => [
        'capture' => ['cost' => ['power_cell' => 2], 'gainShareOfCap' => ['@planetRaw' => 0.60]],
        'scan'    => ['gainShareOfCap' => ['crystal' => 0.20]],
    ]],

    // ── One event per high-tech good ─────────────────────────────────────────
    // Every refinery output can also *arrive* on a planet that cannot produce
    // it. All five share the same shape: pay raw material for the finished
    // good, or skip it and take a plain raw haul instead.
    //
    // The paid side is strongest early and mid game — the cost is a share of
    // the storage cap while the payout is a flat 2–3 units, so a late-game
    // planet with a big silo pays a lot for very little. That is the intended
    // curve: this is the young colony's stopgap until it has its own refinery
    // or a cargo drone route, not a substitute for either.

    // Abandoned orbital dock — the hull presses still run. → Duraplate
    'drydock' => ['icon' => '🏗️', 'weight' => 8, 'choices' => [
        'plating' => ['costShareOfCap' => ['metal' => 0.18], 'gain' => ['duraplate' => 2]],
        'spares'  => ['gainShareOfCap' => ['metal' => 0.45]],
    ]],

    // Ejected reactor core, still hot — contain it or let it burn out. → Plasma Core
    'reactor_core' => ['icon' => '🔥', 'weight' => 8, 'choices' => [
        'contain' => ['costShareOfCap' => ['crystal' => 0.18], 'gain' => ['plasma_core' => 2]],
        'vent'    => ['gain' => ['power_cell' => 2]],
    ]],

    // Dead relay station: switching cores vs. the data still in its buffers. → Superconductor
    'dead_relay' => ['icon' => '📶', 'weight' => 8, 'choices' => [
        'cores' => ['costShareOfCap' => ['crystal' => 0.15], 'gain' => ['superconductor' => 2]],
        'tap'   => ['gainShareOfCap' => ['crystal' => 0.40]],
    ]],

    // Crashed research pod with living cultures aboard. → Vital Gel
    'bio_pod' => ['icon' => '🦠', 'weight' => 8, 'choices' => [
        'cultivate' => ['costShareOfCap' => ['metal' => 0.15], 'gain' => ['vital_gel' => 2]],
        'nutrients' => ['gainShareOfCap' => ['@planetRaw' => 0.35]],
    ]],

    // Forgotten fuel depot — pump the tanks or cut up the shell. → Power Cell
    'fuel_depot' => ['icon' => '⛽', 'weight' => 8, 'choices' => [
        'siphon' => ['costShareOfCap' => ['metal' => 0.15], 'gain' => ['power_cell' => 3]],
        'strip'  => ['gainShareOfCap' => ['metal' => 0.20, 'crystal' => 0.20]],
    ]],

    // ── Flavour events ───────────────────────────────────────────────────────

    // The only place raw metal buys refined goods outright. What is in the hold
    // is rolled at creation, so the trader's offer is exact before you pay.
    'trader' => ['icon' => '🤝', 'weight' => 10, 'choices' => [
        'buy'    => ['costShareOfCap' => ['metal' => 0.40], 'salvage' => 2],
        'barter' => ['gainShareOfCap' => ['crystal' => 0.25]],
    ]],

    // Crewless ship drifting past with its locks open: the whole decision is
    // whether one power cell is worth two extra goods.
    'ghost_ship' => ['icon' => '👻', 'weight' => 8, 'choices' => [
        'board' => ['cost' => ['power_cell' => 1], 'salvage' => 3],
        'pod'   => ['salvage' => 1],
    ]],

    // The planet ploughs through a dust cloud — the free route to the exclusive
    // raw resource, smaller than the comet's paid capture.
    'stardust' => ['icon' => '🌌', 'weight' => 12, 'choices' => [
        'collect' => ['gainShareOfCap' => ['@planetRaw' => 0.45]],
        'filter'  => ['gainShareOfCap' => ['metal' => 0.25, 'crystal' => 0.15]],
    ]],
];

// The planet slot the anomaly tile lives on.
const ANOMALY_SLOT = 7;

function anomaly_def(string $type): array|null {
    return ANOMALIES[$type] ?? null;
}

// Weighted pick over the anomalies that make sense on this planet. Anything that
// would resolve into a dud choice — a comet on a planet with no exclusive raw
// resource, an ion storm with no reactor to charge — is filtered out first.
function pick_anomaly_type(string $planetType, array $buildingLevels): string|null {
    $hasRaw   = isset(ANOMALY_PLANET_RAW[$planetType]);
    $eligible = [];

    foreach (ANOMALIES as $type => $a) {
        $needs = $a['requiresBuilding'] ?? null;
        if ($needs && (int)($buildingLevels[$needs] ?? 0) < 1) continue;
        if (!$hasRaw && str_contains(json_encode($a['choices']), '@planetRaw')) continue;
        $eligible[$type] = $a['weight'];
    }
    if (!$eligible) return null;

    $roll = mt_rand(1, array_sum($eligible));
    foreach ($eligible as $type => $weight) {
        $roll -= $weight;
        if ($roll <= 0) return $type;
    }
    return array_key_first($eligible);
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
