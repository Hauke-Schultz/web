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
//   staffDrain   – workers permanently assigned to this building while it is active
//                  Upgrades increase the drain by the delta (new - current level).
//   unlocks      – [{ slot }] — planet slots unlocked on completion
//   popBonus     – flat max-population increase on completion (frees up new worker slots)

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
        effect:      'Unlocks the Mining tile · 1 worker',
        production:  {},
        staffDrain:  1,
        unlocks:     [{ slot: 2 }],
      },
      {
        level:       2,
        cost:        { metal: 120, crystal: 40 },
        buildTime:   90,
        effect:      'Unlocks the Energy tile · +5 pop · uses 2 energy · 2 workers',
        production:  {},
        energyDrain: 2,
        staffDrain:  2,
        unlocks:     [{ slot: 4 }],
        popBonus:    5,
      },
      {
        level:       3,
        cost:        { metal: 350, crystal: 120 },
        buildTime:   300,
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
    description: 'Housing blocks for your growing population.',
    levels: [
      {
        level:       1,
        cost:        { metal: 30 },
        buildTime:   30,
        effect:      '+3 max pop · uses 1 energy · 1 worker',
        production:  {},
        energyDrain: 1,
        staffDrain:  1,
        popBonus:    3,
      },
      {
        level:       2,
        cost:        { metal: 80, crystal: 20 },
        buildTime:   90,
        effect:      '+5 max pop · uses 2 energy · 1 worker',
        production:  {},
        energyDrain: 2,
        staffDrain:  1,
        popBonus:    5,
      },
      {
        level:       3,
        cost:        { metal: 200, crystal: 60 },
        buildTime:   240,
        effect:      '+10 max pop · uses 3 energy · 2 workers',
        production:  {},
        energyDrain: 3,
        staffDrain:  2,
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
        effect:     'Provides +6 energy/s · 1 worker',
        production: { energy: 6 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 80, crystal: 40 },
        buildTime:  90,
        effect:     'Provides +14 energy/s · 2 workers',
        production: { energy: 14 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 200, crystal: 100 },
        buildTime:  240,
        effect:     'Provides +28 energy/s · 3 workers',
        production: { energy: 28 },
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
    description: 'Extracts metal ore from the surface. Consumes energy to operate.',
    levels: [
      {
        level:           1,
        cost:            { metal: 10 },
        buildTime:       15,
        effect:          '+3 metal/s · 300 storage · uses 3 energy · 2 workers',
        production:      { metal: 3 },
        energyDrain:     3,
        staffDrain:      2,
        storageCapacity: { metal: 300 },
      },
      {
        level:           2,
        cost:            { metal: 50, crystal: 10 },
        buildTime:       60,
        effect:          '+7 metal/s · 700 storage · uses 5 energy · 4 workers',
        production:      { metal: 7 },
        energyDrain:     5,
        staffDrain:      4,
        storageCapacity: { metal: 700 },
      },
      {
        level:           3,
        cost:            { metal: 130, crystal: 30 },
        buildTime:       180,
        effect:          '+15 metal/s · 1500 storage · uses 9 energy · 6 workers',
        production:      { metal: 15 },
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
    description: 'Bores deep into crystal veins. Consumes energy to operate.',
    levels: [
      {
        level:           1,
        cost:            { metal: 20 },
        buildTime:       25,
        effect:          '+2 crystal/s · 200 storage · uses 2 energy · 2 workers',
        production:      { crystal: 2 },
        energyDrain:     2,
        staffDrain:      2,
        storageCapacity: { crystal: 200 },
      },
      {
        level:           2,
        cost:            { metal: 80 },
        buildTime:       90,
        effect:          '+5 crystal/s · 500 storage · uses 4 energy · 3 workers',
        production:      { crystal: 5 },
        energyDrain:     4,
        staffDrain:      3,
        storageCapacity: { crystal: 500 },
      },
      {
        level:           3,
        cost:            { metal: 200, crystal: 20 },
        buildTime:       240,
        effect:          '+10 crystal/s · 1000 storage · uses 7 energy · 5 workers',
        production:      { crystal: 10 },
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
        cost:       { metal: 40, crystal: 20 },
        buildTime:  40,
        effect:     'Provides +10 energy/s · 1 worker',
        production: { energy: 10 },
        staffDrain: 1,
      },
      {
        level:      2,
        cost:       { metal: 100, crystal: 50 },
        buildTime:  120,
        effect:     'Provides +22 energy/s · 2 workers',
        production: { energy: 22 },
        staffDrain: 2,
      },
      {
        level:      3,
        cost:       { metal: 250, crystal: 120 },
        buildTime:  300,
        effect:     'Provides +45 energy/s · 3 workers',
        production: { energy: 45 },
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
        cost:       { metal: 200, crystal: 100 },
        buildTime:  180,
        effect:     'Provides +35 energy/s · 2 workers',
        production: { energy: 35 },
        staffDrain: 2,
      },
      {
        level:      2,
        cost:       { metal: 500, crystal: 250 },
        buildTime:  480,
        effect:     'Provides +75 energy/s · 4 workers',
        production: { energy: 75 },
        staffDrain: 4,
      },
      {
        level:      3,
        cost:       { metal: 1200, crystal: 600 },
        buildTime:  900,
        effect:     'Provides +150 energy/s · 7 workers',
        production: { energy: 150 },
        staffDrain: 7,
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
        effect:      'Enables technology research · uses 5 energy · 3 workers',
        production:  {},
        energyDrain: 5,
        staffDrain:  3,
      },
      {
        level:       2,
        cost:        { metal: 250, crystal: 150 },
        buildTime:   360,
        effect:      '+50% research speed · uses 8 energy · 5 workers',
        production:  {},
        energyDrain: 8,
        staffDrain:  5,
      },
      {
        level:       3,
        cost:        { metal: 600, crystal: 400 },
        buildTime:   720,
        effect:      'Unlocks advanced technologies · uses 14 energy · 8 workers',
        production:  {},
        energyDrain: 14,
        staffDrain:  8,
      },
    ],
  },
}
