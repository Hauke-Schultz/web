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
  base:          { id: 'base',          name: 'Base',          icon: '🏛️', description: 'Colony command center' },
  mining:        { id: 'mining',        name: 'Mining',        icon: '⛏️', description: 'Raw resource extraction' },
  energy:        { id: 'energy',        name: 'Energy',        icon: '🔋', description: 'Power generation' },
  research:      { id: 'research',      name: 'Research',      icon: '🔬', description: 'Technology development' },
  communication: { id: 'communication', name: 'Communication', icon: '📡', description: 'Intel, navigation & interplanetary trade' },
  spacebase:     { id: 'spacebase',     name: 'Space Base',    icon: '🚀', description: 'Launch pad for probes and colony ships' },
  agriculture:   { id: 'agriculture',   name: 'Agriculture',   icon: '🌿', description: 'Food production and special crop cultivation for advanced research' },
  defense:       { id: 'defense',       name: 'Defense',       icon: '🛡️', description: 'Planetary shields, weapons platforms and early-warning systems' },
}

// ── Planet grid (3×3, slot 5 = center = base) ────────────────────────────────
// slot:     1–9 (reading order, 5 = center)
// tileType: null = unknown/locked, string = tile type id
export const PLANET_GRID = [
  { slot: 1, tileType: 'defense',      startsUnlocked: false },
  { slot: 2, tileType: 'mining',       startsUnlocked: false },
  { slot: 3, tileType: 'spacebase',    startsUnlocked: false },
  { slot: 4, tileType: 'energy',       startsUnlocked: true },
  { slot: 5, tileType: 'base',         startsUnlocked: true },
  { slot: 6, tileType: 'communication', startsUnlocked: false },
  { slot: 7, tileType: 'agriculture',  startsUnlocked: true },
  { slot: 8, tileType: 'research',     startsUnlocked: false },
  { slot: 9, tileType: null,           startsUnlocked: false },
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
        buildTime:   20,
        effect:      'Unlocks the Energy tile · +5 pop · uses 2 energy · 2 workers',
        production:  {},
        energyDrain: 2,
        staffDrain:  2,
        popBonus:    5,
      },
      {
        level:       3,
        cost:        { metal: 300, crystal: 100 },
        buildTime:   40,
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
        staffDrain:  2,
        popBonus:    12,
      },
      {
        level:       4,
        cost:        { metal: 550, crystal: 180 },
        buildTime:   40,
        effect:      '+20 max pop · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
        popBonus:    20,
      },
      {
        level:       5,
        cost:        { metal: 1000, crystal: 350 },
        buildTime:   50,
        effect:      '+32 max pop · uses 7 energy · 4 workers',
        production:  {},
        energyDrain: 7,
        staffDrain:  4,
        popBonus:    32,
      },
      {
        level:       6,
        cost:        { metal: 1800, crystal: 650 },
        buildTime:   55,
        effect:      '+50 max pop · uses 10 energy · 5 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  5,
        popBonus:    50,
      },
      {
        level:       7,
        cost:        { metal: 3200, crystal: 1200 },
        buildTime:   58,
        effect:      '+75 max pop · uses 14 energy · 7 workers',
        production:  {},
        energyDrain: 14,
        staffDrain:  7,
        popBonus:    75,
      },
      {
        level:       8,
        cost:        { metal: 5500, crystal: 2200 },
        buildTime:   60,
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
        buildTime:  30,
        effect:     '+35 energy/s · 2 workers',
        production: { energy: 35 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 600, crystal: 300 },
        buildTime:  50,
        effect:     '+75 energy/s · 4 workers',
        production: { energy: 75 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1400, crystal: 700 },
        buildTime:  60,
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
        buildTime:   35,
        effect:      'Enables resource trading with other players · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 500, crystal: 250 },
        buildTime:   50,
        effect:      'Access to galactic market pricing · uses 8 energy · 5 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 1200, crystal: 600 },
        buildTime:   60,
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
        effect:      'Enables technology research · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
        unlocks:     [{ slot: 6 }],
      },
      {
        level:       2,
        cost:        { metal: 320, crystal: 180 },
        buildTime:   40,
        effect:      '+50% research speed · Unlocks Communication tile · uses 8 energy · 5 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  5,
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

  missile_battery: {
    id:          'missile_battery',
    name:        'Missile Battery',
    tileType:    'defense',
    icon:        '🎯',
    description: 'Anti-ship missile launchers. Intercepts incoming fleets before they reach orbit.',
    levels: [
      {
        level:       1,
        cost:        { metal: 200, crystal: 80 },
        buildTime:   25,
        effect:      'Intercepts 1 ship per wave · uses 5 energy · 2 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  2,
      },
      {
        level:       2,
        cost:        { metal: 500, crystal: 200 },
        buildTime:   45,
        effect:      'Intercepts 3 ships per wave · 2× missile speed · uses 10 energy · 4 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  4,
      },
      {
        level:       3,
        cost:        { metal: 1100, crystal: 450 },
        buildTime:   60,
        effect:      'Intercepts 6 ships per wave · point-defense mode · uses 18 energy · 7 workers',
        production:  {},
        energyDrain: 18,
        staffDrain:  7,
      },
    ],
  },

  orbital_cannon: {
    id:          'orbital_cannon',
    name:        'Orbital Cannon',
    tileType:    'defense',
    icon:        '💥',
    description: 'Heavy rail-gun platform in low orbit. Deals massive damage to attackers.',
    levels: [
      {
        level:       1,
        cost:        { metal: 600, crystal: 300 },
        buildTime:   40,
        effect:      'High-damage strike once per battle · uses 12 energy · 5 workers',
        production:  {},
        energyDrain: 12,
        staffDrain:  5,
      },
      {
        level:       2,
        cost:        { metal: 1400, crystal: 700 },
        buildTime:   55,
        effect:      'Fires 2× per battle · 50% more damage · uses 22 energy · 9 workers',
        production:  {},
        energyDrain: 22,
        staffDrain:  9,
      },
      {
        level:       3,
        cost:        { metal: 3000, crystal: 1500 },
        buildTime:   60,
        effect:      'Fires 4× per battle · planetary siege mode unlocked · uses 38 energy · 14 workers',
        production:  {},
        energyDrain: 38,
        staffDrain:  14,
      },
    ],
  },

  planetary_radar: {
    id:          'planetary_radar',
    name:        'Planetary Radar',
    tileType:    'defense',
    icon:        '🔭',
    description: 'Early-warning network. Detects incoming fleets and alerts the colony.',
    levels: [
      {
        level:       1,
        cost:        { metal: 120, crystal: 60 },
        buildTime:   20,
        effect:      'Detects fleets 1 system away · 30s advance warning · uses 3 energy · 2 workers',
        production:  {},
        energyDrain: 3,
        staffDrain:  2,
      },
      {
        level:       2,
        cost:        { metal: 300, crystal: 150 },
        buildTime:   40,
        effect:      'Detects fleets 3 systems away · reveals fleet size · uses 6 energy · 3 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  3,
      },
      {
        level:       3,
        cost:        { metal: 700, crystal: 350 },
        buildTime:   60,
        effect:      'Galaxy-wide detection · reveals fleet composition · uses 11 energy · 5 workers',
        production:  {},
        energyDrain: 11,
        staffDrain:  5,
      },
    ],
  },

  // ── Agriculture tile ───────────────────────────────────────────────────────

  greenhouse: {
    id:          'greenhouse',
    name:        'Greenhouse',
    tileType:    'agriculture',
    icon:        '🌱',
    description: 'Basic food production. Enables crop cultivation for research.',
    levels: [
      {
        level:       1,
        cost:        { metal: 50, crystal: 20 },
        buildTime:   15,
        effect:      '+8 max pop · enables Nutri-Kelp cultivation · uses 2 energy · 2 workers',
        production:  {},
        energyDrain: 2,
        staffDrain:  2,
        popBonus:    8,
      },
      {
        level:       2,
        cost:        { metal: 150, crystal: 60 },
        buildTime:   30,
        effect:      '+12 max pop · enables Synth Grain · faster crop growth · uses 4 energy · 3 workers',
        production:  {},
        energyDrain: 4,
        staffDrain:  3,
        popBonus:    12,
      },
      {
        level:       3,
        cost:        { metal: 380, crystal: 160 },
        buildTime:   50,
        effect:      '+20 max pop · crop grow time halved again · uses 6 energy · 4 workers',
        production:  {},
        energyDrain: 6,
        staffDrain:  4,
        popBonus:    20,
      },
    ],
  },

  hydroponic_farm: {
    id:          'hydroponic_farm',
    name:        'Hydroponic Farm',
    tileType:    'agriculture',
    icon:        '🌾',
    description: 'Precision cultivation chambers for specialized research crops.',
    levels: [
      {
        level:       1,
        cost:        { metal: 130, crystal: 80 },
        buildTime:   25,
        effect:      '+10 max pop · enables Crystal Moss cultivation · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
        popBonus:    10,
      },
      {
        level:       2,
        cost:        { metal: 320, crystal: 200 },
        buildTime:   45,
        effect:      '+15 max pop · enables Xenoflora · 2× crop speed · uses 8 energy · 5 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  5,
        popBonus:    15,
      },
      {
        level:       3,
        cost:        { metal: 750, crystal: 480 },
        buildTime:   60,
        effect:      '+25 max pop · grow 2 crops simultaneously · uses 14 energy · 8 workers',
        production:  {},
        energyDrain: 14,
        staffDrain:  8,
        popBonus:    25,
      },
    ],
  },

  biosphere: {
    id:          'biosphere',
    name:        'Biosphere',
    tileType:    'agriculture',
    icon:        '🏔️',
    description: 'A self-contained planetary ecosystem. Enables exotic rare crops.',
    levels: [
      {
        level:       1,
        cost:        { metal: 550, crystal: 320 },
        buildTime:   50,
        effect:      '+35 max pop · enables Stellar Spore cultivation · uses 10 energy · 6 workers',
        production:  {},
        energyDrain: 10,
        staffDrain:  6,
        popBonus:    35,
      },
      {
        level:       2,
        cost:        { metal: 1300, crystal: 750 },
        buildTime:   60,
        effect:      '+60 max pop · planetary terraforming prep · uses 18 energy · 10 workers',
        production:  {},
        energyDrain: 18,
        staffDrain:  10,
        popBonus:    60,
      },
    ],
  },
}

// ── Crop definitions ──────────────────────────────────────────────────────────
// Crops are cultivated one at a time (queue). Grow time is divided by the
// level of the requiresBuilding. Harvested crops land in inventory.
// popBonus crops apply their bonus automatically on harvest.
// researchUnlock crops accumulate in inventory — used later by the Research tile.

export const CROP_DEFS = {
  nutri_kelp: {
    id:               'nutri_kelp',
    name:             'Nutri-Kelp',
    icon:             '🌿',
    requiresBuilding: 'greenhouse',
    requiresLevel:    1,
    cost:             { metal: 5, crystal: 10 },
    growTimeBase:     20,
    popBonus:         5,
    researchUnlock:   null,
    description:      '+5 max population on harvest',
  },
  synth_grain: {
    id:               'synth_grain',
    name:             'Synth Grain',
    icon:             '🌾',
    requiresBuilding: 'greenhouse',
    requiresLevel:    2,
    cost:             { metal: 20, crystal: 30 },
    growTimeBase:     30,
    popBonus:         0,
    researchUnlock:   'bio_processing',
    description:      'Unlocks Bio-Processing research',
  },
  crystal_moss: {
    id:               'crystal_moss',
    name:             'Crystal Moss',
    icon:             '💠',
    requiresBuilding: 'hydroponic_farm',
    requiresLevel:    1,
    cost:             { metal: 50, crystal: 15 },
    growTimeBase:     40,
    popBonus:         0,
    researchUnlock:   'crystal_synthesis',
    description:      'Unlocks Crystal Synthesis research',
  },
  xenoflora: {
    id:               'xenoflora',
    name:             'Xenoflora',
    icon:             '🌸',
    requiresBuilding: 'hydroponic_farm',
    requiresLevel:    2,
    cost:             { metal: 90, crystal: 55 },
    growTimeBase:     50,
    popBonus:         0,
    researchUnlock:   'genetic_enhancement',
    description:      'Unlocks Genetic Enhancement research',
  },
  stellar_spore: {
    id:               'stellar_spore',
    name:             'Stellar Spore',
    icon:             '✨',
    requiresBuilding: 'biosphere',
    requiresLevel:    1,
    cost:             { metal: 130, crystal: 95 },
    growTimeBase:     60,
    popBonus:         0,
    researchUnlock:   'terraforming_compound',
    description:      'Unlocks Terraforming research',
  },
}
