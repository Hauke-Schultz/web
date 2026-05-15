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
  colony_ship:  { cost: { metal: 300, crystal: 150 }, buildTimeBase: 60  },
}

// ── Planet types ──────────────────────────────────────────────────────────────
// Each type unlocks or restricts certain buildings.
export const PLANET_TYPES = {
  terrestrial: {
    id:          'terrestrial',
    name:        'Terrestrial',
    icon:        '🌍',
    description: 'Balanced planet. All standard buildings available, no special bonuses.',
  },
  volcanic: {
    id:          'volcanic',
    name:        'Volcanic',
    icon:        '🌋',
    description: 'Rich in metal. Special mining & energy buildings, limited agriculture.',
  },
  frozen: {
    id:          'frozen',
    name:        'Frozen',
    icon:        '🧊',
    description: 'Crystal-rich permafrost. Special excavators and cryo research.',
  },
  ocean: {
    id:          'ocean',
    name:        'Ocean',
    icon:        '🌊',
    description: 'Farming paradise. Enormous population potential, weak mining.',
  },
  uninhabitable: {
    id:          'uninhabitable',
    name:        'Uninhabitable',
    icon:        '🌑',
    description: 'Hostile or barren — colonization not possible.',
  },
}

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
  power_cell:      { id: 'power_cell',      name: 'Power Cell',      icon: '🔋',  color: '#fbbf24' },
}

// ── Tile types ────────────────────────────────────────────────────────────────
export const TILE_TYPES = {
  base:          { id: 'base',          name: 'Base',          icon: '🏛️', description: 'Colony command center' },
  mining:        { id: 'mining',        name: 'Mining',        icon: '⛏️', description: 'Raw resource extraction' },
  energy:        { id: 'energy',        name: 'Energy',        icon: '🔋', description: 'Power generation' },
  techcenter:    { id: 'techcenter',    name: 'Tech Center',   icon: '🔬', description: 'Tech Center' },
  comm_center:   { id: 'comm_center',   name: 'Comm Center',   icon: '📡', description: 'Global technologies — researched once, applied across all planets' },
  spacebase:     { id: 'spacebase',     name: 'Space Base',    icon: '🚀', description: 'Launch pad for drones and colony ships' },
  agriculture:   { id: 'agriculture',   name: 'Agriculture',   icon: '🌿', description: 'Reserved — no buildings yet' },
  defense:       { id: 'defense',       name: 'Defense',       icon: '🛡️', description: 'Planetary shields, weapons platforms and early-warning systems' },
  hightech:      { id: 'hightech',      name: 'High-Tech',     icon: '⚗️', description: 'Advanced material refinement and planet-exclusive high-tier processing' },
  dock:          { id: 'dock',          name: 'Dock',          icon: '🛸', description: 'Ship management, missions and fleet operations' },
  warship_bay:   { id: 'warship_bay',   name: 'Warship Bay',   icon: '⚔️', description: 'Placeholder — no buildings yet' },
  orbit:         { id: 'orbit',         name: 'Orbit',         icon: '🛰️', description: 'Orbital infrastructure — placeholder' },
}

// ── Planet grid (3×3, slot 5 = center = base) ────────────────────────────────
// slot:     1–9 (reading order, 5 = center)
// tileType: null = unknown/locked, string = tile type id
export const PLANET_GRID = [
  { slot: 1,  tileType: 'defense',     startsUnlocked: false },
  { slot: 2,  tileType: 'mining',      startsUnlocked: false },
  { slot: 3,  tileType: 'spacebase',   startsUnlocked: false },
  { slot: 4,  tileType: 'energy',      startsUnlocked: false },
  { slot: 5,  tileType: 'base',        startsUnlocked: true  },
  { slot: 6,  tileType: 'comm_center',  startsUnlocked: false },
  { slot: 7,  tileType: 'agriculture', startsUnlocked: false },
  { slot: 8,  tileType: 'techcenter',  startsUnlocked: false },
  { slot: 9,  tileType: 'hightech',    startsUnlocked: false },
  { slot: 10, tileType: 'dock',        startsUnlocked: false },
  { slot: 11, tileType: 'warship_bay', startsUnlocked: false },
  { slot: 12, tileType: 'orbit',       startsUnlocked: false },
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

// Build-time progression philosophy:
//   Tier 1 (lv1 basics):     2–5 min   → fun first session
//   Tier 2 (lv2 upgrades):   10–30 min → short break
//   Tier 3 (lv3):            1–3 h     → morning / evening check-in
//   Tier 4 (lv4):            4–8 h     → once a day
//   Tier 5+ (top levels):    12–24 h   → daily dedication
// All values in seconds. Scale globally via buildTimeFactor in dev tools.

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
        buildTime:  20,
        effect:     'First Building · 1 worker',
        production: {},
        staffDrain: 1,
        unlocks:    [{ slot: 2 }, { slot: 4 }],
      },
      {
        level:       2,
        cost:        { metal: 80, crystal: 30 },
        buildTime:   480,
        effect:      'Unlocks the Tech Center tile · +5 pop · uses 2 energy · 2 workers',
        production:  {},
        energyDrain: 2,
        staffDrain:  2,
        unlocks:     [{ slot: 6 }, { slot: 8 }],
        popBonus:    5,
      },
      {
        level:       3,
        cost:        { metal: 300, crystal: 100 },
        buildTime:   3600,
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
        buildTime:   20,
        effect:      '+4 max pop · uses 1 energy',
        production:  {},
        energyDrain: 1,
        popBonus:    4,
      },
      {
        level:       2,
        cost:        { metal: 100, crystal: 30 },
        buildTime:   300,
        effect:      '+6 max pop · uses 2 energy',
        production:  {},
        energyDrain: 2,
        popBonus:    6,
      },
      {
        level:       3,
        cost:        { metal: 260, crystal: 80 },
        buildTime:   2400,
        effect:      '+12 max pop · uses 3 energy',
        production:  {},
        energyDrain: 3,
        popBonus:    12,
      },
      {
        level:       4,
        cost:        { metal: 550, crystal: 180 },
        buildTime:   7200,
        effect:      '+20 max pop · uses 5 energy',
        production:  {},
        energyDrain: 4,
        popBonus:    20,
      },
      {
        level:       5,
        cost:        { metal: 1000, crystal: 350 },
        buildTime:   18000,
        effect:      '+32 max pop · uses 7 energy',
        production:  {},
        energyDrain: 5,
        popBonus:    32,
      },
      {
        level:       6,
        cost:        { metal: 1300, crystal: 650 },
        buildTime:   28800,
        effect:      '+50 max pop · uses 10 energy',
        production:  {},
        energyDrain: 6,
        popBonus:    50,
      },
      {
        level:       7,
        cost:        { metal: 1600, crystal: 1200 },
        buildTime:   57600,
        effect:      '+75 max pop · uses 14 energy',
        production:  {},
        energyDrain: 10,
        popBonus:    75,
      },
      {
        level:       8,
        cost:        { metal: 1800, crystal: 1400 },
        buildTime:   86400,
        effect:      '+110 max pop · uses 20 energy',
        production:  {},
        energyDrain: 12,
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
        buildTime:  20,
        effect:     '+5 energy · 1 worker',
        production: { energy: 5 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 70, crystal: 35 },
        buildTime:  600,
        effect:     '+12 energy · 2 workers',
        production: { energy: 12 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 180, crystal: 90 },
        buildTime:  3600,
        effect:     '+25 energy · 3 workers',
        production: { energy: 25 },
        staffDrain: 3,
      },
      {
        level:      4,
        cost:       { metal: 200, crystal: 100 },
        buildTime:  10800,
        effect:     '+32 energy · 3 workers',
        production: { energy: 32 },
        staffDrain: 3,
      },
      {
        level:      5,
        cost:       { metal: 210, crystal: 110 },
        buildTime:  21600,
        effect:     '+36 energy · 4 workers',
        production: { energy: 36 },
        staffDrain: 4,
      },
      {
        level:      6,
        cost:       { metal: 250, crystal: 130 },
        buildTime:  43200,
        effect:     '+40 energy · 4 workers',
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
        buildTime:       20,
        effect:          '+2 metal/s · 300 storage · uses 3 energy · 2 workers',
        production:      { metal: 2 },
        energyDrain:     3,
        staffDrain:      2,
        storageCapacity: { metal: 300 },
      },
      {
        level:           2,
        cost:            { metal: 80, crystal: 20 },
        buildTime:       600,
        effect:          '+5 metal/s · 700 storage · uses 5 energy · 4 workers',
        production:      { metal: 5 },
        energyDrain:     5,
        staffDrain:      4,
        storageCapacity: { metal: 700 },
      },
      {
        level:           3,
        cost:            { metal: 220, crystal: 60 },
        buildTime:       5400,
        effect:          '+12 metal/s · 1500 storage · uses 9 energy · 6 workers',
        production:      { metal: 12 },
        energyDrain:     9,
        staffDrain:      6,
        storageCapacity: { metal: 1500 },
      },
      {
        level:           4,
        cost:            { metal: 240, crystal: 80 },
        buildTime:       14400,
        effect:          '+16 metal/s · 2000 storage · uses 9 energy · 6 workers',
        production:      { metal: 16 },
        energyDrain:     9,
        staffDrain:      6,
        storageCapacity: { metal: 2000 },
      },
      {
        level:           5,
        cost:            { metal: 340, crystal: 100 },
        buildTime:       28800,
        effect:          '+22 metal/s · 2500 storage · uses 9 energy · 6 workers',
        production:      { metal: 22 },
        energyDrain:     9,
        staffDrain:      6,
        storageCapacity: { metal: 2500 },
      },
      {
        level:           6,
        cost:            { metal: 440, crystal: 130 },
        buildTime:       57600,
        effect:          '+28 metal/s · 3000 storage · uses 9 energy · 6 workers',
        production:      { metal: 28 },
        energyDrain:     9,
        staffDrain:      6,
        storageCapacity: { metal: 3000 },
      }
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
        buildTime:       20,
        effect:          '+1 crystal/s · 200 storage · uses 2 energy · 2 workers',
        production:      { crystal: 1 },
        energyDrain:     2,
        staffDrain:      2,
        storageCapacity: { crystal: 200 },
      },
      {
        level:           2,
        cost:            { metal: 110, crystal: 30 },
        buildTime:       1500,
        effect:          '+3 crystal/s · 500 storage · uses 4 energy · 3 workers',
        production:      { crystal: 3 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { crystal: 500 },
      },
      {
        level:           3,
        cost:            { metal: 280, crystal: 80 },
        buildTime:       5400,
        effect:          '+7 crystal/s · 1000 storage · uses 7 energy · 5 workers',
        production:      { crystal: 7 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { crystal: 1000 },
      },
      {
        level:           4,
        cost:            { metal: 300, crystal: 100 },
        buildTime:       14400,
        effect:          '+10 crystal/s · 1300 storage · uses 7 energy · 5 workers',
        production:      { crystal: 10 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { crystal: 1300 },
      },
      {
        level:           5,
        cost:            { metal: 400, crystal: 130 },
        buildTime:       25200,
        effect:          '+15 crystal/s · 1700 storage · uses 7 energy · 5 workers',
        production:      { crystal: 15 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { crystal: 1700 },
      },
      {
        level:           6,
        cost:            { metal: 420, crystal: 160 },
        buildTime:       43200,
        effect:          '+18 crystal/s · 2000 storage · uses 7 energy · 5 workers',
        production:      { crystal: 18 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { crystal: 2000 },
      },
      {
        level:           7,
        cost:            { metal: 480, crystal: 200 },
        buildTime:       86400,
        effect:          '+25 crystal/s · 2500 storage · uses 7 energy · 5 workers',
        production:      { crystal: 25 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { crystal: 2500 },
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
        buildTime:       900,
        effect:          '+1 alloy/s · 150 storage · uses 4 energy · 3 workers',
        production:      { alloy: 1 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { alloy: 150 },
      },
      {
        level:           2,
        cost:            { metal: 200, crystal: 80, alloy: 20 },
        buildTime:       5400,
        effect:          '+3 alloy/s · 400 storage · uses 7 energy · 5 workers',
        production:      { alloy: 3 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { alloy: 400 },
      },
      {
        level:           3,
        cost:            { metal: 500, crystal: 200, alloy: 80 },
        buildTime:       21600,
        effect:          '+7 alloy/s · 900 storage · uses 12 energy · 8 workers',
        production:      { alloy: 7 },
        energyDrain:     12,
        staffDrain:      8,
        storageCapacity: { alloy: 900 },
      },
      {
        level:           4,
        cost:            { metal: 1100, crystal: 450, alloy: 200 },
        buildTime:       57600,
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
        buildTime:       900,
        effect:          '+1 biomass/s · 150 storage · uses 4 energy · 3 workers',
        production:      { biomass: 1 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { biomass: 150 },
      },
      {
        level:           2,
        cost:            { metal: 200, crystal: 80, biomass: 20 },
        buildTime:       5400,
        effect:          '+3 biomass/s · 400 storage · uses 7 energy · 5 workers',
        production:      { biomass: 3 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { biomass: 400 },
      },
      {
        level:           3,
        cost:            { metal: 500, crystal: 200, biomass: 80 },
        buildTime:       21600,
        effect:          '+7 biomass/s · 900 storage · uses 12 energy · 8 workers',
        production:      { biomass: 7 },
        energyDrain:     12,
        staffDrain:      8,
        storageCapacity: { biomass: 900 },
      },
      {
        level:           4,
        cost:            { metal: 1100, crystal: 450, biomass: 200 },
        buildTime:       57600,
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
        buildTime:       900,
        effect:          '+1 obsidian/s · 150 storage · uses 4 energy · 3 workers',
        production:      { obsidian: 1 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { obsidian: 150 },
      },
      {
        level:           2,
        cost:            { metal: 200, crystal: 80, obsidian: 20 },
        buildTime:       5400,
        effect:          '+3 obsidian/s · 400 storage · uses 7 energy · 5 workers',
        production:      { obsidian: 3 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { obsidian: 400 },
      },
      {
        level:           3,
        cost:            { metal: 500, crystal: 200, obsidian: 80 },
        buildTime:       21600,
        effect:          '+7 obsidian/s · 900 storage · uses 12 energy · 8 workers',
        production:      { obsidian: 7 },
        energyDrain:     12,
        staffDrain:      8,
        storageCapacity: { obsidian: 900 },
      },
      {
        level:           4,
        cost:            { metal: 1100, crystal: 450, obsidian: 200 },
        buildTime:       57600,
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
        buildTime:       900,
        effect:          '+1 cryo/s · 150 storage · uses 4 energy · 3 workers',
        production:      { cryo: 1 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { cryo: 150 },
      },
      {
        level:           2,
        cost:            { metal: 200, crystal: 80, cryo: 20 },
        buildTime:       5400,
        effect:          '+3 cryo/s · 400 storage · uses 7 energy · 5 workers',
        production:      { cryo: 3 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { cryo: 400 },
      },
      {
        level:           3,
        cost:            { metal: 500, crystal: 200, cryo: 80 },
        buildTime:       21600,
        effect:          '+7 cryo/s · 900 storage · uses 12 energy · 8 workers',
        production:      { cryo: 7 },
        energyDrain:     12,
        staffDrain:      8,
        storageCapacity: { cryo: 900 },
      },
      {
        level:           4,
        cost:            { metal: 1100, crystal: 450, cryo: 200 },
        buildTime:       57600,
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
        buildTime:  300,
        effect:     '+8 energy · 1 worker',
        production: { energy: 8 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 130, crystal: 65 },
        buildTime:  1800,
        effect:     '+18 energy · 2 workers',
        production: { energy: 18 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 320, crystal: 160 },
        buildTime:  10800,
        effect:     '+38 energy · 3 workers',
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
        buildTime:  3600,
        effect:     '+40 energy · 2 workers',
        production: { energy: 40 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 200, cryo: 120 },
        buildTime:  14400,
        effect:     '+90 energy · 4 workers',
        production: { energy: 90 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 500, cryo: 300 },
        buildTime:  43200,
        effect:     '+180 energy · 7 workers',
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
        buildTime:  3600,
        effect:     '+40 energy · 2 workers',
        production: { energy: 40 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 200, alloy: 120 },
        buildTime:  14400,
        effect:     '+90 energy · 4 workers',
        production: { energy: 90 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 500, alloy: 300 },
        buildTime:  43200,
        effect:     '+180 energy · 7 workers',
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
        buildTime:  3600,
        effect:     '+45 energy · 2 workers',
        production: { energy: 45 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 200, obsidian: 120 },
        buildTime:  14400,
        effect:     '+100 energy · 4 workers',
        production: { energy: 100 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 500, obsidian: 300 },
        buildTime:  43200,
        effect:     '+200 energy · 7 workers',
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
        buildTime:  3600,
        effect:     '+35 energy · 2 workers',
        production: { energy: 35 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 200, biomass: 120 },
        buildTime:  14400,
        effect:     '+80 energy · 4 workers',
        production: { energy: 80 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 500, biomass: 300 },
        buildTime:  43200,
        effect:     '+160 energy · 7 workers',
        production: { energy: 160 },
        staffDrain: 7,
      },
    ],
  },

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
        buildTime:   600,
        effect:      'Scout 1 planet at a time · standard flight speed · uses 5 energy · 2 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  2,
      },
    ],
  },

  star_map: {
    id:          'star_map',
    name:        'Star Map',
    tileType:    'comm_center',
    icon:        '🗺️',
    global:      true,
    description: 'Charts the known galaxy. Required for interplanetary navigation. Researched once — unlocks globally across all planets.',
    levels: [
      {
        level:       1,
        cost:        { metal: 80, crystal: 100 },
        buildTime:   480,
        effect:      'Unlocks Solar System view — survey all planets in your home system',
        production:  {},
      },
      {
        level:       2,
        cost:        { metal: 200, crystal: 250 },
        buildTime:   5400,
        effect:      'Unlocks Galaxy view — all star systems visible',
        production:  {},
      },
      {
        level:       3,
        cost:        { metal: 500, crystal: 600, alloy: 80 },
        buildTime:   10800,
        effect:      'Enables deep-space scanning — actively scan unknown star systems (one at a time, takes several hours)',
        production:  {},
      },
    ],
  },

  interstellar_comm: {
    id:               'interstellar_comm',
    name:             'Interstellar Communication',
    tileType:         'comm_center',
    icon:             '📶',
    global:           true,
    requiresBuilding: 'star_map',
    requiresLevel:    3,
    description: 'Deep-space signal array. Allows scanning inhabited systems and exchanging predefined messages with other civilizations.',
    levels: [
      {
        level:      1,
        cost:       { metal: 300, crystal: 400 },
        buildTime:  10800,
        effect:     'Unlock system scanning and predefined messaging',
        production: {},
      },
    ],
  },

  space_building: {
    id:          'space_building',
    name:        'Space Technology',
    tileType:    'techcenter',
    icon:        '🚀',
    description: 'Advances propulsion and navigation science. Unlocks the Space Base tile.',
    levels: [
      {
        level:       1,
        cost:        { metal: 200, crystal: 150 },
        buildTime:   720,
        effect:      'Unlocks Space Base · Unlocks Dock · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
        unlocks:     [{ slot: 3 }, { slot: 10 }],
      },
      {
        level:       2,
        cost:        { metal: 500, crystal: 320 },
        buildTime:   10800,
        effect:      'Unlocks Warship Bay · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
    ],
  },

  laboratory: {
    id:          'laboratory',
    name:        'Laboratory',
    tileType:    'techcenter',
    icon:        '🔬',
    description: 'Drives scientific progress. High energy consumer.',
    levels: [
      {
        level:       1,
        cost:        { metal: 130, crystal: 80 },
        buildTime:   480,
        effect:      'Unlocks High-Tech tile · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
        unlocks:     [{ slot: 9 }],
      },
      {
        level:       2,
        cost:        { metal: 320, crystal: 180 },
        buildTime:   5400,
        effect:      'Unlocks Alloy Forge · +50% research speed · uses 8 energy · 5 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  5,
      },
    ],
  },

  weapons_building: {
    id:          'weapons_building',
    name:        'Weapon Technology',
    tileType:    'techcenter',
    icon:        '⚔️',
    description: 'Military science division. Unlocks the planetary Defense tile.',
    levels: [
      {
        level:       1,
        cost:        { metal: 180, crystal: 100 },
        buildTime:   600,
        effect:      'Unlocks Defense tile · basic weapon blueprints · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
        unlocks:     [{ slot: 1 }],
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
        buildTime:   2400,
        effect:      'Colonize 1 uncolonized planet in home system · uses 8 energy · 4 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  4,
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
        buildTime:  20,
        effect:     '+10 energy · 1 worker',
        production: { energy: 10 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 80, crystal: 25 },
        buildTime:  1200,
        effect:     '+24 energy · 2 workers',
        production: { energy: 24 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 200, crystal: 60 },
        buildTime:  5400,
        effect:     '+50 energy · 3 workers',
        production: { energy: 50 },
        staffDrain: 3,
      },
    ],
  },

  // ── Ocean-only buildings ───────────────────────────────────────────────────

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
        buildTime:  20,
        effect:     '+9 energy · 1 worker',
        production: { energy: 9 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 90, crystal: 40 },
        buildTime:  1200,
        effect:     '+20 energy · 2 workers',
        production: { energy: 20 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 220, crystal: 100 },
        buildTime:  5400,
        effect:     '+42 energy · 3 workers',
        production: { energy: 42 },
        staffDrain: 3,
      },
    ],
  },

  // ── High-Tech tile ─────────────────────────────────────────────────────────
  // One refinery per planet type. Each produces exactly one refined resource.
  // Players must trade or freight to obtain the other three.

  alloy_refinery: {
    id:          'alloy_refinery',
    name:        'Alloy Refinery',
    tileType:    'hightech',
    planetTypes: ['terrestrial'],
    icon:        '🧱',
    description: 'Fuses metal and alloy into Super Alloy. Terrestrial planets only.',
    levels: [
      {
        level:       1,
        cost:        { metal: 300, crystal: 150, alloy: 80 },
        buildTime:   3600,
        effect:      'Unlocks Super Alloy production · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350, alloy: 200 },
        buildTime:   21600,
        effect:      '2× throughput · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1600, crystal: 800, alloy: 500 },
        buildTime:   57600,
        effect:      '4× throughput · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
    conversions: [
      { input: { metal: 15, alloy: 8 }, output: { super_alloy: 1 }, durationBase: 22 },
    ],
  },

  obsidian_foundry: {
    id:          'obsidian_foundry',
    name:        'Obsidian Foundry',
    tileType:    'hightech',
    planetTypes: ['volcanic'],
    icon:        '🌋',
    description: 'Superheats obsidian and crystal under volcanic pressure into Quantum Shards. Volcanic planets only.',
    levels: [
      {
        level:       1,
        cost:        { metal: 300, crystal: 150, obsidian: 80 },
        buildTime:   3600,
        effect:      'Unlocks Quantum Shard production · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350, obsidian: 200 },
        buildTime:   21600,
        effect:      '2× throughput · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1600, crystal: 800, obsidian: 500 },
        buildTime:   57600,
        effect:      '4× throughput · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
    conversions: [
      { input: { crystal: 8, obsidian: 8 }, output: { quantum_shard: 1 }, durationBase: 30 },
    ],
  },

  cryo_refinery: {
    id:          'cryo_refinery',
    name:        'Cryo Refinery',
    tileType:    'hightech',
    planetTypes: ['frozen'],
    icon:        '🧬',
    description: 'Purifies crystal using cryonite into Pure Crystal. Frozen planets only.',
    levels: [
      {
        level:       1,
        cost:        { metal: 300, crystal: 150, cryo: 80 },
        buildTime:   3600,
        effect:      'Unlocks Pure Crystal production · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350, cryo: 200 },
        buildTime:   21600,
        effect:      '2× throughput · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1600, crystal: 800, cryo: 500 },
        buildTime:   57600,
        effect:      '4× throughput · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
    conversions: [
      { input: { crystal: 10, cryo: 5 }, output: { pure_crystal: 1 }, durationBase: 20 },
    ],
  },

  bio_lab: {
    id:          'bio_lab',
    name:        'Bio Lab',
    tileType:    'hightech',
    planetTypes: ['ocean'],
    icon:        '🧫',
    description: 'Synthesizes biomass and metal into Nano Alloy. Ocean planets only.',
    levels: [
      {
        level:       1,
        cost:        { metal: 300, crystal: 150, biomass: 80 },
        buildTime:   3600,
        effect:      'Unlocks Nano Alloy production · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350, biomass: 200 },
        buildTime:   21600,
        effect:      '2× throughput · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1600, crystal: 800, biomass: 500 },
        buildTime:   57600,
        effect:      '4× throughput · uses 16 energy · 8 workers',
        production:  {},
        energyDrain: 16,
        staffDrain:  8,
      },
    ],
    conversions: [
      { input: { metal: 12, biomass: 4 }, output: { nano_alloy: 1 }, durationBase: 18 },
    ],
  },

  // ── Power Cell Lab (universal — all planet types) ─────────────────────────

  power_cell_lab: {
    id:          'power_cell_lab',
    name:        'Power Cell Lab',
    tileType:    'hightech',
    icon:        '🔋',
    description: 'Manufactures universal power cells for starships. Available on every planet type.',
    levels: [
      {
        level:       1,
        cost:        { metal: 200, crystal: 100 },
        buildTime:   1800,
        effect:      'Produce Power Cells · 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 500, crystal: 250 },
        buildTime:   14400,
        effect:      'Faster production · 8 energy · 4 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  4,
      },
      {
        level:       3,
        cost:        { metal: 1200, crystal: 600 },
        buildTime:   43200,
        effect:      'Maximum output · 12 energy · 6 workers',
        production:  {},
        energyDrain: 12,
        staffDrain:  6,
      },
    ],
    conversions: [
      { input: { metal: 20, crystal: 10 }, output: { power_cell: 1 }, durationBase: 30 },
    ],
  },

  // ── Defense tile ───────────────────────────────────────────────────────────

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
        buildTime:   900,
        effect:      'Basic shield — absorbs 20% incoming damage · uses 8 energy · 3 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 700, crystal: 350 },
        buildTime:   14400,
        effect:      'Enhanced shield — absorbs 40% incoming damage · uses 15 energy · 5 workers',
        production:  {},
        energyDrain: 15,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1500, crystal: 750 },
        buildTime:   57600,
        effect:      'Fortress shield — absorbs 60% incoming damage · uses 25 energy · 8 workers',
        production:  {},
        energyDrain: 25,
        staffDrain:  8,
      },
    ],
  },
}

// ── Communication — emoji picker ─────────────────────────────────────────────

export const COMM_EMOJIS = [
  // Gestures & hands
  '👋', '🤝', '✌️', '🫡', '👍', '👎',
  '👏', '🙏', '✋', '🫶', '🤜', '🤛',
  // Faces & emotions
  '😊', '🥰', '😘', '💋', '😂', '😭',
  '😤', '😡', '😱', '🤔', '😎', '🤩',
  // Hearts & affection
  '❤️', '💛', '💚', '🖤',
  '💕', '💝', '💘', '🔥', '💫',
  // Space & trade
  '🌟', '🕊️', '💎', '🛸',
  '🚀', '💰', '📦', '🌈', '🌿', '🪐',
  // Warnings & conflict
  '⚠️', '🛑', '☠️', '⚔️', '🛡️',
  // Schimpfen & Chaos
  '💩', '🤬', '🤡', '🐀', '🦠',
  '🗑️', '💣',  '😈', '🤮',
]

// Base signal travel time in seconds per galaxy-distance unit.
// Halved at interstellar_comm Lv2.
export const SIGNAL_SPEED_BASE = 120
