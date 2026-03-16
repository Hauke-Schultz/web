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
  research: { id: 'research', name: 'Research', icon: '🔬', description: 'Technology development' },
}

// ── Planet grid (3×3, slot 5 = center = base) ────────────────────────────────
// slot:     1–9 (reading order, 5 = center)
// tileType: null = unknown/locked, string = tile type id
export const PLANET_GRID = [
  { slot: 1, tileType: null,     startsUnlocked: false },
  { slot: 2, tileType: 'mining', startsUnlocked: false },
  { slot: 3, tileType: null,     startsUnlocked: false },
  { slot: 4, tileType: 'energy', startsUnlocked: false },
  { slot: 5, tileType: 'base',   startsUnlocked: true  },
  { slot: 6, tileType: null,     startsUnlocked: false },
  { slot: 7, tileType: null,     startsUnlocked: false },
  { slot: 8, tileType: 'research', startsUnlocked: false },
  { slot: 9, tileType: null,     startsUnlocked: false },
]

// ── Buildings ─────────────────────────────────────────────────────────────────
// Each building belongs to a tileType and has an array of upgrade levels.
// Level index 0 = initial build (level 1), index 1 = first upgrade (level 2), etc.
//
// Each level entry:
//   cost         – { resourceId: amount } — one-time cost when queuing the build
//   buildTime    – seconds until complete
//   effect       – human-readable description (i18n key later)
//   production   – { resourceId: amountPerTick } — resources added each tick (metal, crystal, energy)
//   energyDrain  – energy consumed per tick while this building is active
//                  Energy producers have no drain; all other buildings do.
//   unlocks      – [{ slot }] — planet slots unlocked on completion
//   popBonus     – flat population increase on completion

export const BUILDINGS = {

  // ── Base tile ──────────────────────────────────────────────────────────────
  command_center: {
    id:          'command_center',
    name:        'Command Center',
    tileType:    'base',
    icon:        '🏛️',
    description: 'The heart of your colony. Must be built first.',
    levels: [
      {
        level:       1,
        cost:        {},
        buildTime:   10,
        effect:      'Unlocks the Mining tile · uses 1 energy',
        production:  {},
        energyDrain: 1,
        unlocks:     [{ slot: 2 }],
      },
      {
        level:       2,
        cost:        { metal: 120, crystal: 40 },
        buildTime:   90,
        effect:      'Unlocks the Energy tile · +5 population · uses 2 energy',
        production:  {},
        energyDrain: 2,
        unlocks:     [{ slot: 4 }],
        popBonus:    5,
      },
      {
        level:       3,
        cost:        { metal: 350, crystal: 120 },
        buildTime:   300,
        effect:      'Unlocks the Research tile · +10 population · uses 3 energy',
        production:  {},
        energyDrain: 3,
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
    description: 'Housing blocks for your growing population.',
    levels: [
      {
        level:       1,
        cost:        { metal: 30 },
        buildTime:   30,
        effect:      '+3 max population · uses 1 energy',
        production:  {},
        energyDrain: 1,
        popBonus:    3,
      },
      {
        level:       2,
        cost:        { metal: 80, crystal: 20 },
        buildTime:   90,
        effect:      '+5 max population · uses 2 energy',
        production:  {},
        energyDrain: 2,
        popBonus:    5,
      },
      {
        level:       3,
        cost:        { metal: 200, crystal: 60 },
        buildTime:   240,
        effect:      '+10 max population · uses 3 energy',
        production:  {},
        energyDrain: 3,
        popBonus:    10,
      },
    ],
  },

  // Power Plant: produces energy, no drain. Needs to cover all other buildings.
  power_plant: {
    id:          'power_plant',
    name:        'Power Plant',
    tileType:    'base',
    icon:        '⚡',
    description: 'Powers the colony. Build and upgrade to support more buildings.',
    levels: [
      {
        level:      1,
        cost:       { crystal: 15 },
        buildTime:  20,
        effect:     'Provides +6 energy/s',
        production: { energy: 6 },
      },
      {
        level:      2,
        cost:       { metal: 80, crystal: 40 },
        buildTime:  90,
        effect:     'Provides +14 energy/s',
        production: { energy: 14 },
      },
      {
        level:      3,
        cost:       { metal: 200, crystal: 100 },
        buildTime:  240,
        effect:     'Provides +28 energy/s',
        production: { energy: 28 },
      },
    ],
  },

  // ── Mining tile ────────────────────────────────────────────────────────────
  metal_mine: {
    id:          'metal_mine',
    name:        'Metal Mine',
    tileType:    'mining',
    icon:        '⛏️',
    description: 'Extracts metal ore from the surface. Consumes energy to operate.',
    levels: [
      {
        level:       1,
        cost:        { metal: 10 },
        buildTime:   15,
        effect:      '+3 metal/s · uses 3 energy',
        production:  { metal: 3 },
        energyDrain: 3,
      },
      {
        level:       2,
        cost:        { metal: 50, crystal: 10 },
        buildTime:   60,
        effect:      '+7 metal/s · uses 5 energy',
        production:  { metal: 7 },
        energyDrain: 5,
      },
      {
        level:       3,
        cost:        { metal: 130, crystal: 30 },
        buildTime:   180,
        effect:      '+15 metal/s · uses 9 energy',
        production:  { metal: 15 },
        energyDrain: 9,
      },
    ],
  },

  crystal_drill: {
    id:          'crystal_drill',
    name:        'Crystal Drill',
    tileType:    'mining',
    icon:        '💎',
    description: 'Bores deep into crystal veins. Consumes energy to operate.',
    levels: [
      {
        level:       1,
        cost:        { metal: 20 },
        buildTime:   25,
        effect:      '+2 crystal/s · uses 2 energy',
        production:  { crystal: 2 },
        energyDrain: 2,
      },
      {
        level:       2,
        cost:        { metal: 80 },
        buildTime:   90,
        effect:      '+5 crystal/s · uses 4 energy',
        production:  { crystal: 5 },
        energyDrain: 4,
      },
      {
        level:       3,
        cost:        { metal: 200, crystal: 20 },
        buildTime:   240,
        effect:      '+10 crystal/s · uses 7 energy',
        production:  { crystal: 10 },
        energyDrain: 7,
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
        cost:       { metal: 40, crystal: 20 },
        buildTime:  40,
        effect:     'Provides +10 energy/s',
        production: { energy: 10 },
      },
      {
        level:      2,
        cost:       { metal: 100, crystal: 50 },
        buildTime:  120,
        effect:     'Provides +22 energy/s',
        production: { energy: 22 },
      },
      {
        level:      3,
        cost:       { metal: 250, crystal: 120 },
        buildTime:  300,
        effect:     'Provides +45 energy/s',
        production: { energy: 45 },
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
        cost:       { metal: 200, crystal: 100 },
        buildTime:  180,
        effect:     'Provides +35 energy/s',
        production: { energy: 35 },
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 250 },
        buildTime:  480,
        effect:     'Provides +75 energy/s',
        production: { energy: 75 },
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 600 },
        buildTime:  900,
        effect:     'Provides +150 energy/s',
        production: { energy: 150 },
      },
    ],
  },

  // ── Research tile ──────────────────────────────────────────────────────────
  laboratory: {
    id:          'laboratory',
    name:        'Laboratory',
    tileType:    'research',
    icon:        '🔬',
    description: 'Drives scientific progress. High energy consumer.',
    levels: [
      {
        level:       1,
        cost:        { metal: 100, crystal: 60 },
        buildTime:   120,
        effect:      'Enables technology research · uses 5 energy',
        production:  {},
        energyDrain: 5,
      },
      {
        level:       2,
        cost:        { metal: 250, crystal: 150 },
        buildTime:   360,
        effect:      '+50% research speed · uses 8 energy',
        production:  {},
        energyDrain: 8,
      },
      {
        level:       3,
        cost:        { metal: 600, crystal: 400 },
        buildTime:   720,
        effect:      'Unlocks advanced technologies · uses 14 energy',
        production:  {},
        energyDrain: 14,
      },
    ],
  },
}
