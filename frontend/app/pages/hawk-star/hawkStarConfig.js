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
  recon_drone:  { cost: { metal: 60,  crystal: 25  }, buildTimeBase: 90  },
  galaxy_probe: { cost: { metal: 100, crystal: 50  }, buildTimeBase: 150 },
  colony_ship:  { cost: { metal: 300, crystal: 150 }, buildTimeBase: 300 },
}

// ── Resources ─────────────────────────────────────────────────────────────────
export const RESOURCES = {
  population: { id: 'population', name: 'Population', icon: '👥', color: '#a78bfa' },
  metal:      { id: 'metal',      name: 'Metal',      icon: '⚙️',  color: '#94a3b8' },
  crystal:    { id: 'crystal',    name: 'Crystal',    icon: '💎',  color: '#67e8f9' },
  energy:     { id: 'energy',     name: 'Energy',     icon: '⚡',  color: '#fbbf24' },
}

// ── Tile types ────────────────────────────────────────────────────────────────
export const TILE_TYPES = {
  base:     { id: 'base',     name: 'Base',     icon: '🏛️', description: 'Colony command center' },
  mining:   { id: 'mining',   name: 'Mining',   icon: '⛏️', description: 'Raw resource extraction' },
  energy:   { id: 'energy',   name: 'Energy',   icon: '🔋', description: 'Power generation' },
  research:      { id: 'research',      name: 'Research',      icon: '🔬', description: 'Technology development' },
  communication: { id: 'communication', name: 'Communication', icon: '📡', description: 'Intel, navigation & interplanetary trade' },
  spacebase:     { id: 'spacebase',     name: 'Space Base',    icon: '🚀', description: 'Launch pad for probes and colony ships' },
}

// ── Planet grid (3×3, slot 5 = center = base) ────────────────────────────────
// slot:     1–9 (reading order, 5 = center)
// tileType: null = unknown/locked, string = tile type id
export const PLANET_GRID = [
  { slot: 1, tileType: null,       startsUnlocked: false },
  { slot: 2, tileType: 'mining',   startsUnlocked: false },
  { slot: 3, tileType: 'spacebase', startsUnlocked: false },
  { slot: 4, tileType: 'energy',   startsUnlocked: true },
  { slot: 5, tileType: 'base',     startsUnlocked: true },
  { slot: 6, tileType: 'communication', startsUnlocked: false },
  { slot: 7, tileType: null,       startsUnlocked: false },
  { slot: 8, tileType: 'research', startsUnlocked: false },
  { slot: 9, tileType: null,       startsUnlocked: false },
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
        effect:     'Unlocks the Mining tile · 1 worker',
        production: {},
        staffDrain: 1,
        unlocks:    [{ slot: 2 }],
      },
      {
        level:       2,
        cost:        { metal: 80, crystal: 30 },
        buildTime:   120,
        effect:      'Unlocks the Energy tile · +5 pop · uses 2 energy · 2 workers',
        production:  {},
        energyDrain: 2,
        staffDrain:  2,
        popBonus:    5,
      },
      {
        level:       3,
        cost:        { metal: 300, crystal: 100 },
        buildTime:   360,
        effect:      'Unlocks the Research tile · +10 pop · uses 3 energy · 3 workers',
        production:  {},
        energyDrain: 3,
        staffDrain:  3,
        unlocks:     [{ slot: 8 }],
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
        buildTime:   25,
        effect:      '+4 max pop · uses 1 energy · 1 worker',
        production:  {},
        energyDrain: 1,
        staffDrain:  1,
        popBonus:    4,
      },
      {
        level:       2,
        cost:        { metal: 100, crystal: 30 },
        buildTime:   150,
        effect:      '+6 max pop · uses 2 energy · 1 worker',
        production:  {},
        energyDrain: 2,
        staffDrain:  1,
        popBonus:    6,
      },
      {
        level:       3,
        cost:        { metal: 260, crystal: 80 },
        buildTime:   360,
        effect:      '+12 max pop · uses 3 energy · 2 workers',
        production:  {},
        energyDrain: 3,
        staffDrain:  2,
        popBonus:    12,
      },
      {
        level:       4,
        cost:        { metal: 550, crystal: 180 },
        buildTime:   720,
        effect:      '+20 max pop · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
        popBonus:    20,
      },
      {
        level:       5,
        cost:        { metal: 1000, crystal: 350 },
        buildTime:   1200,
        effect:      '+32 max pop · uses 7 energy · 4 workers',
        production:  {},
        energyDrain: 7,
        staffDrain:  4,
        popBonus:    32,
      },
      {
        level:       6,
        cost:        { metal: 1800, crystal: 650 },
        buildTime:   1800,
        effect:      '+50 max pop · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
        popBonus:    50,
      },
      {
        level:       7,
        cost:        { metal: 3200, crystal: 1200 },
        buildTime:   2700,
        effect:      '+75 max pop · uses 14 energy · 7 workers',
        production:  {},
        energyDrain: 14,
        staffDrain:  7,
        popBonus:    75,
      },
      {
        level:       8,
        cost:        { metal: 5500, crystal: 2200 },
        buildTime:   3600,
        effect:      '+110 max pop · uses 20 energy · 10 workers',
        production:  {},
        energyDrain: 20,
        staffDrain:  10,
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
        effect:     '+5 energy/s · 1 worker',
        production: { energy: 5 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 70, crystal: 35 },
        buildTime:  150,
        effect:     '+12 energy/s · 2 workers',
        production: { energy: 12 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 180, crystal: 90 },
        buildTime:  360,
        effect:     '+25 energy/s · 3 workers',
        production: { energy: 25 },
        staffDrain: 3,
      },
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
        buildTime:       25,
        effect:          '+2 metal/s · 300 storage · uses 3 energy · 2 workers',
        production:      { metal: 2 },
        energyDrain:     3,
        staffDrain:      2,
        storageCapacity: { metal: 300 },
      },
      {
        level:           2,
        cost:            { metal: 80, crystal: 20 },
        buildTime:       150,
        effect:          '+5 metal/s · 700 storage · uses 5 energy · 4 workers',
        production:      { metal: 5 },
        energyDrain:     5,
        staffDrain:      4,
        storageCapacity: { metal: 700 },
      },
      {
        level:           3,
        cost:            { metal: 220, crystal: 60 },
        buildTime:       420,
        effect:          '+12 metal/s · 1500 storage · uses 9 energy · 6 workers',
        production:      { metal: 12 },
        energyDrain:     9,
        staffDrain:      6,
        storageCapacity: { metal: 1500 },
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
        buildTime:       35,
        effect:          '+1 crystal/s · 200 storage · uses 2 energy · 2 workers',
        production:      { crystal: 1 },
        energyDrain:     2,
        staffDrain:      2,
        storageCapacity: { crystal: 200 },
      },
      {
        level:           2,
        cost:            { metal: 110, crystal: 30 },
        buildTime:       180,
        effect:          '+3 crystal/s · 500 storage · uses 4 energy · 3 workers',
        production:      { crystal: 3 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { crystal: 500 },
      },
      {
        level:           3,
        cost:            { metal: 280, crystal: 80 },
        buildTime:       480,
        effect:          '+7 crystal/s · 1000 storage · uses 7 energy · 5 workers',
        production:      { crystal: 7 },
        energyDrain:     7,
        staffDrain:      5,
        storageCapacity: { crystal: 1000 },
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
    levels: [
      {
        level:      1,
        cost:       { metal: 50, crystal: 30 },
        buildTime:  60,
        effect:     '+8 energy/s · 1 worker',
        production: { energy: 8 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 130, crystal: 65 },
        buildTime:  210,
        effect:     '+18 energy/s · 2 workers',
        production: { energy: 18 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 320, crystal: 160 },
        buildTime:  480,
        effect:     '+38 energy/s · 3 workers',
        production: { energy: 38 },
        staffDrain: 3,
      },
    ],
  },

  fusion_reactor: {
    id:          'fusion_reactor',
    name:        'Fusion Reactor',
    tileType:    'energy',
    icon:        '🔮',
    description: 'High-yield fusion core. No energy drain.',
    levels: [
      {
        level:      1,
        cost:       { metal: 250, crystal: 120 },
        buildTime:  300,
        effect:     '+35 energy/s · 2 workers',
        production: { energy: 35 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 600, crystal: 300 },
        buildTime:  720,
        effect:     '+75 energy/s · 4 workers',
        production: { energy: 75 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1400, crystal: 700 },
        buildTime:  1200,
        effect:     '+150 energy/s · 7 workers',
        production: { energy: 150 },
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
        buildTime:   360,
        effect:      'Send 1 probe at a time — reveals planet count on arrival · uses 4 energy · 2 workers',
        production:  {},
        energyDrain: 4,
        staffDrain:  2,
      },
      {
        level:       2,
        cost:        { metal: 420, crystal: 280 },
        buildTime:   720,
        effect:      'Send 2 probes simultaneously · 2× travel speed · uses 7 energy · 3 workers',
        production:  {},
        energyDrain: 7,
        staffDrain:  3,
      },
      {
        level:       3,
        cost:        { metal: 900, crystal: 600 },
        buildTime:   1440,
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
        buildTime:   300,
        effect:      'Unlocks Solar System view — survey all planets in your home system · uses 3 energy · 2 workers',
        production:  {},
        energyDrain: 3,
        staffDrain:  2,
      },
      {
        level:       2,
        cost:        { metal: 200, crystal: 250 },
        buildTime:   720,
        effect:      'Unlocks Galaxy view — nearby star systems & trade routes visible · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
      },
      {
        level:       3,
        cost:        { metal: 500, crystal: 600 },
        buildTime:   1440,
        effect:      'Full galaxy scan — all systems & owner flags visible · uses 9 energy · 5 workers',
        production:  {},
        energyDrain: 9,
        staffDrain:  5,
      },
    ],
  },

  trade_harbor: {
    id:          'trade_harbor',
    name:        'Trade Harbor',
    tileType:    'communication',
    icon:        '🚀',
    description: 'Interplanetary docking hub for trade ships and resource exchange.',
    levels: [
      {
        level:       1,
        cost:        { metal: 200, crystal: 100 },
        buildTime:   480,
        effect:      'Enables resource trading with other players · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 500, crystal: 250 },
        buildTime:   900,
        effect:      'Access to galactic market pricing · uses 8 energy · 5 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1200, crystal: 600 },
        buildTime:   1800,
        effect:      'Passive income from established trade routes · uses 14 energy · 8 workers',
        production:  {},
        energyDrain: 14,
        staffDrain:  8,
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
        buildTime:   420,
        effect:      'Unlocks Space Base tile · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
        unlocks:     [{ slot: 3 }],
      },
      {
        level:       2,
        cost:        { metal: 500, crystal: 320 },
        buildTime:   900,
        effect:      'Faster probe travel speed · improved ship range · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1100, crystal: 700 },
        buildTime:   1800,
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
        buildTime:   180,
        effect:      'Enables technology research · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
        unlocks:     [{ slot: 6 }],
      },
      {
        level:       2,
        cost:        { metal: 320, crystal: 180 },
        buildTime:   540,
        effect:      '+50% research speed · Unlocks Communication tile · uses 8 energy · 5 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 800, crystal: 450 },
        buildTime:   900,
        effect:      'Unlocks advanced technologies · uses 14 energy · 8 workers',
        production:  {},
        energyDrain: 14,
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
        buildTime:   480,
        effect:      'Scout 1 planet at a time · standard flight speed · uses 5 energy · 2 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  2,
      },
      {
        level:       2,
        cost:        { metal: 600, crystal: 250 },
        buildTime:   960,
        effect:      'Scout 2 planets simultaneously · 2× flight speed · uses 8 energy · 3 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  3,
      },
      {
        level:       3,
        cost:        { metal: 1300, crystal: 550 },
        buildTime:   1800,
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
        buildTime:   720,
        effect:      'Colonize 1 uncolonized planet in home system · uses 8 energy · 4 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  4,
      },
      {
        level:       2,
        cost:        { metal: 900, crystal: 450 },
        buildTime:   1440,
        effect:      'Colonize planets in adjacent star systems · uses 14 energy · 7 workers',
        production:  {},
        energyDrain: 14,
        staffDrain:  7,
      },
      {
        level:       3,
        cost:        { metal: 2000, crystal: 1000 },
        buildTime:   2880,
        effect:      'Mass colonization fleet · reach distant star systems · uses 24 energy · 12 workers',
        production:  {},
        energyDrain: 24,
        staffDrain:  12,
      },
    ],
  },
}
