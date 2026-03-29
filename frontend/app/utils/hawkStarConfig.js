/**
 * hawkStarConfig.js
 *
 * Static game data — designed to map 1:1 to future DB tables.
 *
 * DB table mapping:
 *   RESOURCES      → resources
 *   TILE_TYPES     → tile_types
 *   PLANET_GRID    → planet_grid_slots
 *   BUILDINGS      → buildings
 *   BUILDING_LEVELS → building_levels  (buildingId + level as composite PK)
 *
 * Player state stored separately (see index.vue):
 *   playerResources  → player_resources  { playerId, resource, amount }
 *   playerSlots      → player_planet_slots { playerId, slot, unlocked }
 *   playerBuildings  → player_buildings  { playerId, buildingId, level, buildEndsAt }
 */

// ── Unit production costs ─────────────────────────────────────────────────────
// Cost to build ONE unit (drone / probe / ship). Building level divides buildTimeBase.
export const UNIT_COSTS = {
  recon_drone:  { cost: { metal: 60,  crystal: 25  }, buildTimeBase: 30  },
  galaxy_probe: { cost: { metal: 100, crystal: 50  }, buildTimeBase: 40  },
  colony_ship:  { cost: { metal: 300, crystal: 150 }, buildTimeBase: 60  },
  warship:      { cost: { metal: 600, crystal: 300 }, buildTimeBase: 120 },
  freighter:    { cost: { metal: 400, crystal: 200 }, buildTimeBase: 90  },
}

// Cargo capacity per freighter bay level (in resource units)
export const FREIGHTER_CARGO_CAPACITY = [0, 200, 500, 1000]

// ── Warship classes ───────────────────────────────────────────────────────────
// Each warship built gets a snapshot of its class stats + empty weapon slots.
export const WARSHIP_CLASSES = {
  frigate: {
    id:          'frigate',
    name:        'Hawk Frigate',
    icon:        '🛡️',
    hull:        150,
    shield:      30,
    speed:       8,
    weaponSlots: 2,
    description: 'Light combat vessel. Fast and agile with 2 weapon slots.',
  },
}

// ── Planet types ──────────────────────────────────────────────────────────────
// Maps from mock planet.type (rock/gas/lava/ice/ocean) to game type.
// Each type unlocks or restricts certain buildings.
export const PLANET_TYPES = {
  terrestrial: {
    id:          'terrestrial',
    name:        'Terrestrial',
    icon:        '🌍',
    mockTypes:   ['rock', 'gas'],
    description: 'Balanced planet. All standard buildings available, no special bonuses.',
  },
  volcanic: {
    id:          'volcanic',
    name:        'Volcanic',
    icon:        '🌋',
    mockTypes:   ['lava'],
    description: 'Rich in metal. Special mining & energy buildings, limited agriculture.',
  },
  frozen: {
    id:          'frozen',
    name:        'Frozen',
    icon:        '🧊',
    mockTypes:   ['ice'],
    description: 'Crystal-rich permafrost. Special excavators and cryo research.',
  },
  ocean: {
    id:          'ocean',
    name:        'Ocean',
    icon:        '🌊',
    mockTypes:   ['ocean'],
    description: 'Farming paradise. Enormous population potential, weak mining.',
  },
}

// Maps mock planet.type → PLANET_TYPES key
export const MOCK_TYPE_TO_PLANET_TYPE = Object.fromEntries(
  Object.values(PLANET_TYPES).flatMap(pt => pt.mockTypes.map(t => [t, pt.id]))
)

// ── Resources ─────────────────────────────────────────────────────────────────
export const RESOURCES = {
  population: { id: 'population', name: 'Population', icon: '👥', color: '#a78bfa' },
  metal:      { id: 'metal',      name: 'Metal',      icon: '⚙️',  color: '#94a3b8' },
  crystal:    { id: 'crystal',    name: 'Crystal',    icon: '💎',  color: '#67e8f9' },
  alloy:      { id: 'alloy',      name: 'Alloy',      icon: '🧱',  color: '#cbd5f5', planetTypes: ['terrestrial'] },
  cryo:       { id: 'cryo',       name: 'Cryonite',   icon: '❄️',  color: '#a5f3fc', planetTypes: ['frozen'] },
  obsidian:   { id: 'obsidian',   name: 'Obsidian',   icon: '🪨',  color: '#1f2937', planetTypes: ['volcanic'] },
  biomass:    { id: 'biomass',    name: 'Biomass',    icon: '🌿',  color: '#4ade80', planetTypes: ['ocean'] },
  energy:        { id: 'energy',        name: 'Energy',        icon: '⚡',  color: '#fbbf24' },
  // ── Refined resources (tradeable, produced via High-Tech buildings) ──────
  pure_crystal:  { id: 'pure_crystal',  name: 'Pure Crystal',  icon: '🔷',  color: '#38bdf8', refined: true },
  super_alloy:   { id: 'super_alloy',   name: 'Super Alloy',   icon: '🔩',  color: '#e2e8f0', refined: true },
  quantum_shard: { id: 'quantum_shard', name: 'Quantum Shard', icon: '💠',  color: '#818cf8', refined: true },
  nano_alloy:    { id: 'nano_alloy',    name: 'Nano Alloy',    icon: '🔧',  color: '#93c5fd', refined: true },
  // ── Weapon ordnance (produced in Weapon Lab, equipped on warships) ──────────
  kinetic_round:   { id: 'kinetic_round',   name: 'Kinetic Round',   icon: '🔹',  color: '#94a3b8', weapon: true },
  plasma_cell:     { id: 'plasma_cell',     name: 'Plasma Cell',     icon: '🔴',  color: '#f87171', weapon: true },
}

// ── Tile types ────────────────────────────────────────────────────────────────
export const TILE_TYPES = {
  base:          { id: 'base',          name: 'Base',          icon: '🏛️', description: 'Colony command center' },
  mining:        { id: 'mining',        name: 'Mining',        icon: '⛏️', description: 'Raw resource extraction' },
  energy:        { id: 'energy',        name: 'Energy',        icon: '🔋', description: 'Power generation' },
  research:      { id: 'research',      name: 'Research',      icon: '🔬', description: 'Technology development' },
  communication: { id: 'communication', name: 'Communication', icon: '📡', description: 'Intel, navigation & interplanetary trade' },
  spacebase:     { id: 'spacebase',     name: 'Space Base',    icon: '🚀', description: 'Launch pad for probes, colony ships and freighters' },
  agriculture:   { id: 'agriculture',   name: 'Agriculture',   icon: '🌿', description: 'Food production and special crop cultivation for advanced research' },
  defense:       { id: 'defense',       name: 'Defense',       icon: '🛡️', description: 'Planetary shields, weapons platforms and early-warning systems' },
  hightech:      { id: 'hightech',      name: 'High-Tech',     icon: '⚗️', description: 'Advanced material refinement and planet-exclusive high-tier processing' },
}

// ── Planet grid (3×3, slot 5 = center = base) ────────────────────────────────
// slot:     1–9 (reading order, 5 = center)
// tileType: null = unknown/locked, string = tile type id
export const PLANET_GRID = [
  { slot: 1, tileType: 'defense',      startsUnlocked: false },
  { slot: 2, tileType: 'mining',       startsUnlocked: false },
  { slot: 3, tileType: 'spacebase',    startsUnlocked: false },
  { slot: 4, tileType: 'energy',       startsUnlocked: false },
  { slot: 5, tileType: 'base',         startsUnlocked: true },
  { slot: 6, tileType: 'communication', startsUnlocked: false },
  { slot: 7, tileType: 'agriculture',  startsUnlocked: false },
  { slot: 8, tileType: 'research',     startsUnlocked: false },
  { slot: 9, tileType: 'hightech',     startsUnlocked: false },
]

// ── Buildings ─────────────────────────────────────────────────────────────────
// Each building belongs to a tileType and has an array of upgrade levels.
// Level index 0 = initial build (level 1), index 1 = first upgrade (level 2), etc.
//
// Each level entry:
//   cost            – { resourceId: amount } — one-time cost when queuing the build
//   buildTime       – seconds until complete
//   effect          – human-readable description (i18n key later)
//   production      – { resourceId: amountPerTick } — resources added each tick
//   energyDrain     – energy consumed per tick while this building is active
//                     Energy producers have no drain; all other buildings do.
//   staffDrain      – workers permanently assigned to this building while active
//                     Upgrades increase the drain by the delta (new - current level).
//   storageCapacity – { resourceId: amount } — adds to max storage for that resource
//   unlocks         – [{ slot }] — planet slots unlocked on completion
//   popBonus        – flat max-population increase on completion

export const BUILDINGS = {

  // ── Base tile ──────────────────────────────────────────────────────────────

  command_center: {
    id:          'command_center',
    name:        'Command Center',
    tileType:    'base',
    icon:        '🏛️',
    description: 'The heart of your colony. Must be built before anything else.',
    levels: [
      {
        level:      1,
        cost:       {},
        buildTime:  5,
        effect:     'First Building · 1 worker',
        production: {},
        staffDrain: 1,
        unlocks:    [{ slot: 2 }, { slot: 4 }],
      },
      {
        level:       2,
        cost:        { metal: 80, crystal: 30 },
        buildTime:   20,
        effect:      'Unlocks the Research tile · +5 pop · uses 2 energy · 2 workers',
        production:  {},
        energyDrain: 2,
        staffDrain:  2,
        unlocks:     [{ slot: 8 }],
        popBonus:    5,
      },
      {
        level:       3,
        cost:        { metal: 300, crystal: 100 },
        buildTime:   40,
        effect:      '+10 pop · uses 3 energy · 3 workers',
        production:  {},
        energyDrain: 3,
        staffDrain:  3,
        popBonus:    10,
      },
    ],
  },

  quarters: {
    id:          'quarters',
    name:        'Quarters',
    tileType:    'base',
    icon:        '🏠',
    description: 'Housing for your growing workforce.',
    levels: [
      {
        level:       1,
        cost:        { metal: 40 },
        buildTime:   10,
        effect:      '+4 max pop · uses 1 energy · 1 worker',
        production:  {},
        energyDrain: 1,
        staffDrain:  1,
        popBonus:    4,
      },
      {
        level:       2,
        cost:        { metal: 100, crystal: 30 },
        buildTime:   20,
        effect:      '+6 max pop · uses 2 energy · 1 worker',
        production:  {},
        energyDrain: 2,
        staffDrain:  1,
        popBonus:    6,
      },
      {
        level:       3,
        cost:        { metal: 260, crystal: 80 },
        buildTime:   30,
        effect:      '+12 max pop · uses 3 energy · 2 workers',
        production:  {},
        energyDrain: 3,
        staffDrain:  1,
        popBonus:    12,
      },
      {
        level:       4,
        cost:        { metal: 550, crystal: 180 },
        buildTime:   40,
        effect:      '+20 max pop · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 4,
        staffDrain:  1,
        popBonus:    20,
      },
      {
        level:       5,
        cost:        { metal: 1000, crystal: 350 },
        buildTime:   50,
        effect:      '+32 max pop · uses 7 energy · 4 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  1,
        popBonus:    32,
      },
      {
        level:       6,
        cost:        { metal: 1800, crystal: 650 },
        buildTime:   55,
        effect:      '+50 max pop · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  1,
        popBonus:    50,
      },
      {
        level:       7,
        cost:        { metal: 3200, crystal: 1200 },
        buildTime:   58,
        effect:      '+75 max pop · uses 14 energy · 7 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  3,
        popBonus:    75,
      },
      {
        level:       8,
        cost:        { metal: 5500, crystal: 2200 },
        buildTime:   60,
        effect:      '+110 max pop · uses 20 energy · 10 workers',
        production:  {},
        energyDrain: 12,
        staffDrain:  5,
        popBonus:    110,
      },
    ],
  },

  // Power Plant — produces energy, no drain. Moved to energy tile.
  power_plant: {
    id:          'power_plant',
    name:        'Power Plant',
    tileType:    'energy',
    icon:        '⚡',
    description: 'Powers the colony. Build and upgrade to support more buildings.',
    levels: [
      {
        level:      1,
        cost:       { crystal: 25 },
        buildTime:  10,
        effect:     '+5 energy/s · 1 worker',
        production: { energy: 5 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 70, crystal: 35 },
        buildTime:  25,
        effect:     '+12 energy/s · 2 workers',
        production: { energy: 12 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 180, crystal: 90 },
        buildTime:  45,
        effect:     '+25 energy/s · 3 workers',
        production: { energy: 25 },
        staffDrain: 3,
      },
      {
        level:      4,
        cost:       { metal: 200, crystal: 100 },
        buildTime:  55,
        effect:     '+32 energy/s · 3 workers',
        production: { energy: 32 },
        staffDrain: 3,
      },
      {
        level:      5,
        cost:       { metal: 210, crystal: 110 },
        buildTime:  59,
        effect:     '+36 energy/s · 4 workers',
        production: { energy: 36 },
        staffDrain: 4,
      },
      {
        level:      6,
        cost:       { metal: 250, crystal: 130 },
        buildTime:  59,
        effect:     '+40 energy/s · 4 workers',
        production: { energy: 40 },
        staffDrain: 4,
      }
    ],
  },

  // ── Mining tile ────────────────────────────────────────────────────────────

  metal_mine: {
    id:          'metal_mine',
    name:        'Metal Mine',
    tileType:    'mining',
    icon:        '⛏️',
    description: 'Extracts metal ore from the surface.',
    levels: [
      {
        level:           1,
        cost:            { metal: 30 },
        buildTime:       10,
        effect:          '+2 metal/s · 300 storage · uses 3 energy · 2 workers',
        production:      { metal: 2 },
        energyDrain:     3,
        staffDrain:      2,
        storageCapacity: { metal: 300 },
      },
      {
        level:           2,
        cost:            { metal: 80, crystal: 20 },
        buildTime:       25,
        effect:          '+5 metal/s · 700 storage · uses 5 energy · 4 workers',
        production:      { metal: 5 },
        energyDrain:     5,
        staffDrain:      4,
        storageCapacity: { metal: 700 },
      },
      {
        level:           3,
        cost:            { metal: 220, crystal: 60 },
        buildTime:       45,
        effect:          '+12 metal/s · 1500 storage · uses 9 energy · 6 workers',
        production:      { metal: 12 },
        energyDrain:     9,
        staffDrain:      6,
        storageCapacity: { metal: 1500 },
      },
      {
        level:           4,
        cost:            { metal: 240, crystal: 80 },
        buildTime:       50,
        effect:          '+16 metal/s · 1900 storage · uses 9 energy · 6 workers',
        production:      { metal: 16 },
        energyDrain:     9,
        staffDrain:      6,
        storageCapacity: { metal: 1900 },
      },
    ],
  },

  crystal_drill: {
    id:          'crystal_drill',
    name:        'Crystal Drill',
    tileType:    'mining',
    icon:        '💎',
    description: 'Bores deep into crystal veins.',
    levels: [
      {
        level:           1,
        cost:            { metal: 50 },
        buildTime:       15,
        effect:          '+1 crystal/s · 200 storage · uses 2 energy · 2 workers',
        production:      { crystal: 1 },
        energyDrain:     2,
        staffDrain:      2,
        storageCapacity: { crystal: 200 },
      },
      {
        level:           2,
        cost:            { metal: 110, crystal: 30 },
        buildTime:       30,
        effect:          '+3 crystal/s · 500 storage · uses 4 energy · 3 workers',
        production:      { crystal: 3 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { crystal: 500 },
      },
      {
        level:           3,
        cost:            { metal: 280, crystal: 80 },
        buildTime:       50,
        effect:          '+7 crystal/s · 1000 storage · uses 7 energy · 5 workers',
        production:      { crystal: 7 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { crystal: 1000 },
      },
      {
        level:           4,
        cost:            { metal: 300, crystal: 100 },
        buildTime:       55,
        effect:          '+10 crystal/s · 1300 storage · uses 7 energy · 5 workers',
        production:      { crystal: 10 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { crystal: 1300 },
      },
    ],
  },

  // Alloy Forge — terrestrial only, requires Laboratory Lv 2
  alloy_forge: {
    id:               'alloy_forge',
    name:             'Alloy Forge',
    tileType:         'mining',
    planetTypes:      ['terrestrial'],
    icon:             '🧱',
    description:      'Smelts metal into refined alloy. Requires Laboratory Lv 2.',
    requiresBuilding: 'laboratory',
    requiresLevel:    2,
    levels: [
      {
        level:           1,
        cost:            { metal: 80, crystal: 30 },
        buildTime:       20,
        effect:          '+1 alloy/s · 150 storage · uses 4 energy · 3 workers',
        production:      { alloy: 1 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { alloy: 150 },
      },
      {
        level:           2,
        cost:            { metal: 200, crystal: 80, alloy: 20 },
        buildTime:       35,
        effect:          '+3 alloy/s · 400 storage · uses 7 energy · 5 workers',
        production:      { alloy: 3 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { alloy: 400 },
      },
      {
        level:           3,
        cost:            { metal: 500, crystal: 200, alloy: 80 },
        buildTime:       50,
        effect:          '+7 alloy/s · 900 storage · uses 12 energy · 8 workers',
        production:      { alloy: 7 },
        energyDrain:     12,
        staffDrain:      8,
        storageCapacity: { alloy: 900 },
      },
      {
        level:           4,
        cost:            { metal: 1100, crystal: 450, alloy: 200 },
        buildTime:       60,
        effect:          '+15 alloy/s · 2000 storage · uses 20 energy · 12 workers',
        production:      { alloy: 15 },
        energyDrain:     20,
        staffDrain:      12,
        storageCapacity: { alloy: 2000 },
      },
    ],
  },

  // Biomass Collector — ocean only, requires Laboratory Lv 2
  biomass_collector: {
    id:               'biomass_collector',
    name:             'Biomass Collector',
    tileType:         'mining',
    planetTypes:      ['ocean'],
    icon:             '🌿',
    description:      'Harvests organic biomass from ocean floors. Requires Laboratory Lv 2.',
    requiresBuilding: 'laboratory',
    requiresLevel:    2,
    levels: [
      {
        level:           1,
        cost:            { metal: 80, crystal: 30 },
        buildTime:       20,
        effect:          '+1 biomass/s · 150 storage · uses 4 energy · 3 workers',
        production:      { biomass: 1 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { biomass: 150 },
      },
      {
        level:           2,
        cost:            { metal: 200, crystal: 80, biomass: 20 },
        buildTime:       35,
        effect:          '+3 biomass/s · 400 storage · uses 7 energy · 5 workers',
        production:      { biomass: 3 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { biomass: 400 },
      },
      {
        level:           3,
        cost:            { metal: 500, crystal: 200, biomass: 80 },
        buildTime:       50,
        effect:          '+7 biomass/s · 900 storage · uses 12 energy · 8 workers',
        production:      { biomass: 7 },
        energyDrain:     12,
        staffDrain:      8,
        storageCapacity: { biomass: 900 },
      },
      {
        level:           4,
        cost:            { metal: 1100, crystal: 450, biomass: 200 },
        buildTime:       60,
        effect:          '+15 biomass/s · 2000 storage · uses 20 energy · 12 workers',
        production:      { biomass: 15 },
        energyDrain:     20,
        staffDrain:      12,
        storageCapacity: { biomass: 2000 },
      },
    ],
  },

  // Obsidian Quarry — volcanic only, requires Laboratory Lv 2
  obsidian_quarry: {
    id:               'obsidian_quarry',
    name:             'Obsidian Quarry',
    tileType:         'mining',
    planetTypes:      ['volcanic'],
    icon:             '🪨',
    description:      'Excavates volcanic obsidian from lava fields. Requires Laboratory Lv 2.',
    requiresBuilding: 'laboratory',
    requiresLevel:    2,
    levels: [
      {
        level:           1,
        cost:            { metal: 80, crystal: 30 },
        buildTime:       20,
        effect:          '+1 obsidian/s · 150 storage · uses 4 energy · 3 workers',
        production:      { obsidian: 1 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { obsidian: 150 },
      },
      {
        level:           2,
        cost:            { metal: 200, crystal: 80, obsidian: 20 },
        buildTime:       35,
        effect:          '+3 obsidian/s · 400 storage · uses 7 energy · 5 workers',
        production:      { obsidian: 3 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { obsidian: 400 },
      },
      {
        level:           3,
        cost:            { metal: 500, crystal: 200, obsidian: 80 },
        buildTime:       50,
        effect:          '+7 obsidian/s · 900 storage · uses 12 energy · 8 workers',
        production:      { obsidian: 7 },
        energyDrain:     12,
        staffDrain:      8,
        storageCapacity: { obsidian: 900 },
      },
      {
        level:           4,
        cost:            { metal: 1100, crystal: 450, obsidian: 200 },
        buildTime:       60,
        effect:          '+15 obsidian/s · 2000 storage · uses 20 energy · 12 workers',
        production:      { obsidian: 15 },
        energyDrain:     20,
        staffDrain:      12,
        storageCapacity: { obsidian: 2000 },
      },
    ],
  },

  // Cryo Extractor — frozen only, requires Laboratory Lv 2
  cryo_extractor: {
    id:               'cryo_extractor',
    name:             'Cryo Extractor',
    tileType:         'mining',
    planetTypes:      ['frozen'],
    icon:             '❄️',
    description:      'Harvests cryonite from frozen veins. Requires Laboratory Lv 2.',
    requiresBuilding: 'laboratory',
    requiresLevel:    2,
    levels: [
      {
        level:           1,
        cost:            { metal: 80, crystal: 30 },
        buildTime:       20,
        effect:          '+1 cryo/s · 150 storage · uses 4 energy · 3 workers',
        production:      { cryo: 1 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { cryo: 150 },
      },
      {
        level:           2,
        cost:            { metal: 200, crystal: 80, cryo: 20 },
        buildTime:       35,
        effect:          '+3 cryo/s · 400 storage · uses 7 energy · 5 workers',
        production:      { cryo: 3 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { cryo: 400 },
      },
      {
        level:           3,
        cost:            { metal: 500, crystal: 200, cryo: 80 },
        buildTime:       50,
        effect:          '+7 cryo/s · 900 storage · uses 12 energy · 8 workers',
        production:      { cryo: 7 },
        energyDrain:     12,
        staffDrain:      8,
        storageCapacity: { cryo: 900 },
      },
      {
        level:           4,
        cost:            { metal: 1100, crystal: 450, cryo: 200 },
        buildTime:       60,
        effect:          '+15 cryo/s · 2000 storage · uses 20 energy · 12 workers',
        production:      { cryo: 15 },
        energyDrain:     20,
        staffDrain:      12,
        storageCapacity: { cryo: 2000 },
      },
    ],
  },

  // ── Energy tile ────────────────────────────────────────────────────────────

  solar_array: {
    id:          'solar_array',
    name:        'Solar Array',
    tileType:    'energy',
    icon:        '☀️',
    description: 'Harvests solar energy. No energy drain.',
    requiresBuilding: 'power_plant',
    requiresLevel: 1,
    levels: [
      {
        level:      1,
        cost:       { metal: 50, crystal: 30 },
        buildTime:  20,
        effect:     '+8 energy/s · 1 worker',
        production: { energy: 8 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 130, crystal: 65 },
        buildTime:  35,
        effect:     '+18 energy/s · 2 workers',
        production: { energy: 18 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 320, crystal: 160 },
        buildTime:  55,
        effect:     '+38 energy/s · 3 workers',
        production: { energy: 38 },
        staffDrain: 3,
      },
    ],
  },

  cryo_reactor: {
    id:          'cryo_reactor',
    name:        'Cryo Reactor',
    tileType:    'energy',
    planetTypes: ['frozen'],
    icon:        '🧊',
    description: 'Harnesses extreme cold for high-yield energy. No energy drain. Frozen planets only.',
    requiresBuilding: 'power_plant',
    requiresLevel: 4,
    levels: [
      {
        level:      1,
        cost:       { metal: 200, crystal: 80, cryo: 40 },
        buildTime:  30,
        effect:     '+40 energy/s · 2 workers',
        production: { energy: 40 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 200, cryo: 120 },
        buildTime:  50,
        effect:     '+90 energy/s · 4 workers',
        production: { energy: 90 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 500, cryo: 300 },
        buildTime:  60,
        effect:     '+180 energy/s · 7 workers',
        production: { energy: 180 },
        staffDrain: 7,
      },
    ],
  },

  alloy_fusion_reactor: {
    id:          'alloy_fusion_reactor',
    name:        'Alloy Fusion Reactor',
    tileType:    'energy',
    planetTypes: ['terrestrial'],
    icon:        '⚛️',
    description: 'Fuses refined alloy under extreme pressure for high-yield energy. No energy drain. Terrestrial planets only.',
    levels: [
      {
        level:      1,
        cost:       { metal: 200, crystal: 80, alloy: 40 },
        buildTime:  30,
        effect:     '+40 energy/s · 2 workers',
        production: { energy: 40 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 200, alloy: 120 },
        buildTime:  50,
        effect:     '+90 energy/s · 4 workers',
        production: { energy: 90 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 500, alloy: 300 },
        buildTime:  60,
        effect:     '+180 energy/s · 7 workers',
        production: { energy: 180 },
        staffDrain: 7,
      },
    ],
  },

  obsidian_plasma_core: {
    id:          'obsidian_plasma_core',
    name:        'Obsidian Plasma Core',
    tileType:    'energy',
    planetTypes: ['volcanic'],
    icon:        '🔴',
    description: 'Superheats obsidian into plasma for massive energy output. No energy drain. Volcanic planets only.',
    levels: [
      {
        level:      1,
        cost:       { metal: 200, crystal: 80, obsidian: 40 },
        buildTime:  30,
        effect:     '+45 energy/s · 2 workers',
        production: { energy: 45 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 200, obsidian: 120 },
        buildTime:  50,
        effect:     '+100 energy/s · 4 workers',
        production: { energy: 100 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 500, obsidian: 300 },
        buildTime:  60,
        effect:     '+200 energy/s · 7 workers',
        production: { energy: 200 },
        staffDrain: 7,
      },
    ],
  },

  biomass_reactor: {
    id:          'biomass_reactor',
    name:        'Biomass Reactor',
    tileType:    'energy',
    planetTypes: ['ocean'],
    icon:        '🌱',
    description: 'Converts organic biomass into clean, sustained energy. No energy drain. Ocean planets only.',
    levels: [
      {
        level:      1,
        cost:       { metal: 200, crystal: 80, biomass: 40 },
        buildTime:  30,
        effect:     '+35 energy/s · 2 workers',
        production: { energy: 35 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 200, biomass: 120 },
        buildTime:  50,
        effect:     '+80 energy/s · 4 workers',
        production: { energy: 80 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 500, biomass: 300 },
        buildTime:  60,
        effect:     '+160 energy/s · 7 workers',
        production: { energy: 160 },
        staffDrain: 7,
      },
    ],
  },

  // ── Communication tile ─────────────────────────────────────────────────────
  // Unlocked by Laboratory Lv1. Houses intel, navigation and trade buildings.
  // All three are stub definitions — full mechanics arrive in Step 3+.

  galaxy_probe: {
    id:          'galaxy_probe',
    name:        'Galaxy Probe',
    tileType:    'spacebase',
    icon:        '🔭',
    description: 'Launches long-range probes to distant star systems. Reveals planet count on arrival.',
    levels: [
      {
        level:       1,
        cost:        { metal: 180, crystal: 120 },
        buildTime:   35,
        effect:      'Send 1 probe at a time — reveals planet count on arrival · uses 4 energy · 2 workers',
        production:  {},
        energyDrain: 4,
        staffDrain:  2,
      },
      {
        level:       2,
        cost:        { metal: 420, crystal: 280 },
        buildTime:   50,
        effect:      'Send 2 probes simultaneously · 2× travel speed · uses 7 energy · 3 workers',
        production:  {},
        energyDrain: 7,
        staffDrain:  3,
      },
      {
        level:       3,
        cost:        { metal: 900, crystal: 600 },
        buildTime:   60,
        effect:      'Send 3 probes simultaneously · 3× travel speed · uses 12 energy · 5 workers',
        production:  {},
        energyDrain: 12,
        staffDrain:  5,
      },
    ],
  },

  star_map: {
    id:          'star_map',
    name:        'Star Map',
    tileType:    'communication',
    icon:        '🗺️',
    description: 'Charts the known galaxy. Required for interplanetary navigation.',
    levels: [
      {
        level:       1,
        cost:        { metal: 80, crystal: 100 },
        buildTime:   25,
        effect:      'Unlocks Solar System view — survey all planets in your home system · uses 3 energy · 2 workers',
        production:  {},
        energyDrain: 3,
        staffDrain:  2,
      },
      {
        level:       2,
        cost:        { metal: 200, crystal: 250 },
        buildTime:   45,
        effect:      'Unlocks Galaxy view — nearby star systems & trade routes visible · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
      },
      {
        level:       3,
        cost:        { metal: 500, crystal: 600 },
        buildTime:   60,
        effect:      'Full galaxy scan — all systems & owner flags visible · uses 9 energy · 5 workers',
        production:  {},
        energyDrain: 9,
        staffDrain:  5,
      },
    ],
  },

  // ── Research tile ──────────────────────────────────────────────────────────

  space_tech: {
    id:          'space_tech',
    name:        'Space Technology',
    tileType:    'research',
    icon:        '🚀',
    description: 'Advances propulsion and navigation science. Unlocks the Space Base tile.',
    levels: [
      {
        level:       1,
        cost:        { metal: 200, crystal: 150 },
        buildTime:   35,
        effect:      'Unlocks Space Base tile · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
        unlocks:     [{ slot: 3 }],
      },
      {
        level:       2,
        cost:        { metal: 500, crystal: 320 },
        buildTime:   50,
        effect:      'Faster probe travel speed · improved ship range · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1100, crystal: 700 },
        buildTime:   60,
        effect:      'Advanced colonization tech · reduced ship build times · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
  },

  laboratory: {
    id:          'laboratory',
    name:        'Laboratory',
    tileType:    'research',
    icon:        '🔬',
    description: 'Drives scientific progress. High energy consumer.',
    levels: [
      {
        level:       1,
        cost:        { metal: 130, crystal: 80 },
        buildTime:   20,
        effect:      'Unlocks Communication tile · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
        unlocks:     [{ slot: 6 }],
      },
      {
        level:       2,
        cost:        { metal: 320, crystal: 180 },
        buildTime:   40,
        effect:      'Unlocks High-Tech tile · +50% research speed · uses 8 energy · 5 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  5,
        unlocks:     [{ slot: 9 }],
      },
      {
        level:       3,
        cost:        { metal: 800, crystal: 450 },
        buildTime:   55,
        effect:      'Unlocks advanced technologies · uses 14 energy · 8 workers',
        production:  {},
        energyDrain: 14,
        staffDrain:  8,
      },
    ],
  },

  weapons_research: {
    id:          'weapons_research',
    name:        'Weapons Research',
    tileType:    'research',
    icon:        '⚔️',
    description: 'Military science division. Unlocks the planetary Defense tile.',
    levels: [
      {
        level:       1,
        cost:        { metal: 180, crystal: 100 },
        buildTime:   25,
        effect:      'Unlocks Defense tile · basic weapon blueprints · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
        unlocks:     [{ slot: 1 }],
      },
      {
        level:       2,
        cost:        { metal: 450, crystal: 250 },
        buildTime:   45,
        effect:      'Advanced shielding & missile tech · uses 9 energy · 5 workers',
        production:  {},
        energyDrain: 9,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1000, crystal: 600 },
        buildTime:   60,
        effect:      'Orbital weapons platform blueprints · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
  },

  // ── Space Base tile ────────────────────────────────────────────────────────
  // Unlocked by Space Technology Lv1. Houses probes and colony ships.

  recon_drone: {
    id:          'recon_drone',
    name:        'Recon Drone',
    tileType:    'spacebase',
    icon:        '🛸',
    description: 'Short-range drone that flies to planets in the home system to reveal their details.',
    levels: [
      {
        level:       1,
        cost:        { metal: 250, crystal: 100 },
        buildTime:   35,
        effect:      'Scout 1 planet at a time · standard flight speed · uses 5 energy · 2 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  2,
      },
      {
        level:       2,
        cost:        { metal: 600, crystal: 250 },
        buildTime:   50,
        effect:      'Scout 2 planets simultaneously · 2× flight speed · uses 8 energy · 3 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  3,
      },
      {
        level:       3,
        cost:        { metal: 1300, crystal: 550 },
        buildTime:   60,
        effect:      'Scout 3 planets simultaneously · 3× flight speed · uses 14 energy · 5 workers',
        production:  {},
        energyDrain: 14,
        staffDrain:  5,
      },
    ],
  },

  colony_ship: {
    id:          'colony_ship',
    name:        'Colony Ship',
    tileType:    'spacebase',
    icon:        '🚀',
    description: 'Transports colonists to unoccupied planets in the solar system.',
    levels: [
      {
        level:       1,
        cost:        { metal: 400, crystal: 200 },
        buildTime:   45,
        effect:      'Colonize 1 uncolonized planet in home system · uses 8 energy · 4 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  4,
      },
      {
        level:       2,
        cost:        { metal: 900, crystal: 450 },
        buildTime:   55,
        effect:      'Colonize planets in adjacent star systems · uses 14 energy · 7 workers',
        production:  {},
        energyDrain: 14,
        staffDrain:  7,
      },
      {
        level:       3,
        cost:        { metal: 2000, crystal: 1000 },
        buildTime:   60,
        effect:      'Mass colonization fleet · reach distant star systems · uses 24 energy · 12 workers',
        production:  {},
        energyDrain: 24,
        staffDrain:  12,
      },
    ],
  },

  warship_bay: {
    id:               'warship_bay',
    name:             'Warship Bay',
    tileType:         'spacebase',
    icon:             '⚔️',
    description:      'Heavy construction dock for warships. Requires Super Alloy and Pure Crystal. Needs Space Technology Lv 2.',
    requiresBuilding: 'space_tech',
    requiresLevel:    2,
    levels: [
      {
        level:       1,
        cost:        { metal: 800, crystal: 400 },
        buildTime:   60,
        effect:      'Enables warship construction · 1 warship slot · uses 12 energy · 5 workers',
        production:  {},
        energyDrain: 12,
        staffDrain:  5,
      },
      {
        level:       2,
        cost:        { metal: 1800, crystal: 900, nano_alloy: 50, pure_crystal: 25 },
        buildTime:   80,
        effect:      '2× build speed · 2 warship slots · firepower +50% · uses 20 energy · 8 workers',
        production:  {},
        energyDrain: 20,
        staffDrain:  8,
      },
      {
        level:       3,
        cost:        { metal: 4000, crystal: 2000, nano_alloy: 120, pure_crystal: 60 },
        buildTime:   100,
        effect:      '4× build speed · 3 warship slots · firepower +120% · uses 35 energy · 14 workers',
        production:  {},
        energyDrain: 35,
        staffDrain:  14,
      },
    ],
  },

  freighter_bay: {
    id:               'freighter_bay',
    name:             'Freighter Bay',
    tileType:         'spacebase',
    icon:             '🚢',
    description:      'Cargo dock for building freighters. Transport resources between your colonies. Needs Space Technology Lv 1.',
    requiresBuilding: 'space_tech',
    requiresLevel:    1,
    levels: [
      {
        level:       1,
        cost:        { metal: 500, crystal: 250 },
        buildTime:   60,
        effect:      'Build freighters · 200 cargo capacity · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       2,
        cost:        { metal: 1200, crystal: 600 },
        buildTime:   80,
        effect:      '500 cargo capacity · 2× build speed · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
      {
        level:       3,
        cost:        { metal: 2800, crystal: 1400 },
        buildTime:   100,
        effect:      '1000 cargo capacity · 4× build speed · uses 28 energy · 14 workers',
        production:  {},
        energyDrain: 28,
        staffDrain:  14,
      },
    ],
  },

  // ── Volcanic-only buildings ────────────────────────────────────────────────

  geothermal_tap: {
    id:          'geothermal_tap',
    name:        'Geothermal Tap',
    tileType:    'energy',
    planetTypes: ['volcanic'],
    icon:        '♨️',
    description: 'Harnesses volcanic heat for cheap, reliable energy output.',
    levels: [
      {
        level:      1,
        cost:       { metal: 30, crystal: 10 },
        buildTime:  10,
        effect:     '+10 energy/s · 1 worker',
        production: { energy: 10 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 80, crystal: 25 },
        buildTime:  25,
        effect:     '+24 energy/s · 2 workers',
        production: { energy: 24 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 200, crystal: 60 },
        buildTime:  45,
        effect:     '+50 energy/s · 3 workers',
        production: { energy: 50 },
        staffDrain: 3,
      },
    ],
  },

  // ── Frozen-only buildings ──────────────────────────────────────────────────

  tidal_generator: {
    id:          'tidal_generator',
    name:        'Tidal Generator',
    tileType:    'energy',
    planetTypes: ['ocean'],
    icon:        '🌊',
    description: 'Harvests kinetic energy from ocean tides. Cheap and reliable.',
    levels: [
      {
        level:      1,
        cost:       { metal: 35, crystal: 15 },
        buildTime:  12,
        effect:     '+9 energy/s · 1 worker',
        production: { energy: 9 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 90, crystal: 40 },
        buildTime:  28,
        effect:     '+20 energy/s · 2 workers',
        production: { energy: 20 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 220, crystal: 100 },
        buildTime:  50,
        effect:     '+42 energy/s · 3 workers',
        production: { energy: 42 },
        staffDrain: 3,
      },
    ],
  },

  // ── High-Tech tile ─────────────────────────────────────────────────────────
  // Planet-exclusive advanced processing. Each planet type gets its own refinery.

  cryo_refinery: {
    id:          'cryo_refinery',
    name:        'Cryo Refinery',
    tileType:    'hightech',
    planetTypes: ['frozen'],
    icon:        '🧬',
    description: 'Converts raw materials using cryonite into superior refined substances. Frozen planets only.',
    levels: [
      {
        level:       1,
        cost:        { metal: 300, crystal: 150, cryo: 80 },
        buildTime:   40,
        effect:      'Unlocks Crystal→Pure Crystal & Alloy→Super Alloy conversion · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350, cryo: 200 },
        buildTime:   60,
        effect:      '2× conversion throughput · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1600, crystal: 800, cryo: 500 },
        buildTime:   80,
        effect:      '4× throughput · unlocks Pure Crystal→Quantum Shard · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
    conversions: [
      { input: { crystal: 10, cryo: 5  }, output: { pure_crystal: 1  }, durationBase: 20 },
      { input: { alloy:   10, cryo: 5  }, output: { super_alloy:  1  }, durationBase: 20 },
      { input: { pure_crystal: 5, cryo: 10 }, output: { quantum_shard: 1 }, durationBase: 60, requiresLevel: 3 },
    ],
  },

  nano_forge: {
    id:          'nano_forge',
    name:        'Nano Forge',
    tileType:    'hightech',
    planetTypes: ['terrestrial'],
    icon:        '🔧',
    description: 'Reshapes alloy at the molecular level into high-performance nano materials. Terrestrial planets only.',
    levels: [
      {
        level:       1,
        cost:        { metal: 300, crystal: 150, alloy: 80 },
        buildTime:   40,
        effect:      'Unlocks Nano Alloy conversion · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350, alloy: 200 },
        buildTime:   60,
        effect:      '2× conversion throughput · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1600, crystal: 800, alloy: 500 },
        buildTime:   80,
        effect:      '4× throughput · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
    conversions: [
      { input: { alloy: 10, metal: 20 }, output: { nano_alloy: 1 }, durationBase: 20 },
    ],
  },

  obsidian_foundry: {
    id:          'obsidian_foundry',
    name:        'Obsidian Foundry',
    tileType:    'hightech',
    planetTypes: ['volcanic'],
    icon:        '🌋',
    description: 'Smelts obsidian under extreme volcanic pressure into industrial-grade materials. Volcanic planets only.',
    levels: [
      {
        level:       1,
        cost:        { metal: 300, crystal: 150, obsidian: 80 },
        buildTime:   40,
        effect:      'Processes obsidian into refined materials · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350, obsidian: 200 },
        buildTime:   60,
        effect:      '2× conversion throughput · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1600, crystal: 800, obsidian: 500 },
        buildTime:   80,
        effect:      '4× throughput · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
    conversions: [],
  },

  bio_lab: {
    id:          'bio_lab',
    name:        'Bio Lab',
    tileType:    'hightech',
    planetTypes: ['ocean'],
    icon:        '🧫',
    description: 'Synthesizes ocean biomass into advanced organic compounds. Ocean planets only.',
    levels: [
      {
        level:       1,
        cost:        { metal: 300, crystal: 150, biomass: 80 },
        buildTime:   40,
        effect:      'Processes biomass into refined materials · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350, biomass: 200 },
        buildTime:   60,
        effect:      '2× conversion throughput · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1600, crystal: 800, biomass: 500 },
        buildTime:   80,
        effect:      '4× throughput · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
    conversions: [],
  },

  // ── Defense tile ───────────────────────────────────────────────────────────
  // Unlocked by Weapons Research Lv1. Houses shields, weapons and radar.

  shield_generator: {
    id:          'shield_generator',
    name:        'Shield Generator',
    tileType:    'defense',
    icon:        '🛡️',
    description: 'Projects an energy barrier around the planet to absorb incoming damage.',
    levels: [
      {
        level:       1,
        cost:        { metal: 300, crystal: 150 },
        buildTime:   35,
        effect:      'Basic shield — absorbs 20% incoming damage · uses 8 energy · 3 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350 },
        buildTime:   50,
        effect:      'Enhanced shield — absorbs 40% incoming damage · uses 15 energy · 5 workers',
        production:  {},
        energyDrain: 15,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1500, crystal: 750 },
        buildTime:   60,
        effect:      'Fortress shield — absorbs 60% incoming damage · uses 25 energy · 8 workers',
        production:  {},
        energyDrain: 25,
        staffDrain:  8,
      },
    ],
  },

  crystal_deflector: {
    id:               'crystal_deflector',
    name:             'Crystal Deflector Matrix',
    tileType:         'defense',
    icon:             '🔷',
    description:      'Pure Crystal lattice that bends incoming energy away from the planet. Far superior to conventional shields. Requires Weapons Research Lv 2 and Pure Crystal.',
    requiresBuilding: 'weapons_research',
    requiresLevel:    2,
    levels: [
      {
        level:        1,
        cost:         { metal: 500, crystal: 300, pure_crystal: 8 },
        buildTime:    50,
        effect:       'Crystal shield — absorbs 70% incoming damage · uses 18 energy · 4 workers',
        production:   {},
        energyDrain:  18,
        staffDrain:   4,
        shieldStrength: 70,
      },
      {
        level:        2,
        cost:         { metal: 1200, crystal: 600, pure_crystal: 20 },
        buildTime:    70,
        effect:       'Resonant shield — absorbs 85% incoming damage · uses 30 energy · 6 workers',
        production:   {},
        energyDrain:  30,
        staffDrain:   6,
        shieldStrength: 85,
      },
      {
        level:        3,
        cost:         { metal: 2800, crystal: 1200, pure_crystal: 50 },
        buildTime:    90,
        effect:       'Phase matrix — absorbs 95% damage · reflects 20% back at attacker · uses 50 energy · 10 workers',
        production:   {},
        energyDrain:  50,
        staffDrain:   10,
        shieldStrength: 95,
        damageReflect: 20,
      },
    ],
  },

  // ── Weapon Lab (hightech tile) ─────────────────────────────────────────────
  // Available on all planet types. Requires Weapons Research Lv 2.
  // Produces weapon ordnance that will later be equippable on warships.

  weapon_lab: {
    id:               'weapon_lab',
    name:             'Weapon Lab',
    tileType:         'hightech',
    icon:             '🔬',
    description:      'Military research facility. Synthesises weapon ordnance that can be equipped on warships. Requires Weapons Research Lv 2.',
    requiresBuilding: 'weapons_research',
    requiresLevel:    2,
    levels: [
      {
        level:       1,
        cost:        { metal: 500, crystal: 250, nano_alloy: 8 },
        buildTime:   50,
        effect:      'Unlocks Kinetic Round production · uses 8 energy · 4 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  4,
      },
      {
        level:       2,
        cost:        { metal: 1200, crystal: 600, nano_alloy: 20, pure_crystal: 10 },
        buildTime:   70,
        effect:      '2× throughput · unlocks Plasma Cell production · uses 16 energy · 7 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  7,
      },
      {
        level:       3,
        cost:        { metal: 2800, crystal: 1400, quantum_shard: 8, super_alloy: 15 },
        buildTime:   90,
        effect:      '4× throughput · unlocks Quantum Warhead production · uses 28 energy · 12 workers',
        production:  {},
        energyDrain: 28,
        staffDrain:  12,
      },
    ],
    conversions: [
      { input: { metal: 20, nano_alloy:    3 }, output: { kinetic_round:   1 }, durationBase: 30, requiresLevel: 1 },
      { input: { pure_crystal: 3, crystal: 15 }, output: { plasma_cell:    1 }, durationBase: 45, requiresLevel: 2 },
    ],
  },

  // ── Agriculture tile ───────────────────────────────────────────────────────

  farm: {
    id:          'farm',
    name:        'Farm',
    tileType:    'agriculture',
    icon:        '🌱',
    description: 'Cultivates the local ecosystem. Enables growing your planet\'s unique trade crop.',
    levels: [
      {
        level:       1,
        cost:        { metal: 50, crystal: 20 },
        buildTime:   15,
        effect:      'Enables crop cultivation · uses 2 energy · 2 workers',
        production:  {},
        energyDrain: 2,
        staffDrain:  2,
      },
      {
        level:       2,
        cost:        { metal: 150, crystal: 60 },
        buildTime:   30,
        effect:      '2× crop growth speed · uses 4 energy · 3 workers',
        production:  {},
        energyDrain: 4,
        staffDrain:  3,
      },
      {
        level:       3,
        cost:        { metal: 380, crystal: 160 },
        buildTime:   50,
        effect:      '3× crop growth speed · uses 6 energy · 4 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  4,
      },
    ],
  },
}
