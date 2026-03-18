/**
 * hawkStarGalaxyMock.js
 *
 * Static frontend mock for the galaxy & planet network (Step 2).
 * Will be replaced by real API data in Step 3.
 *
 * System fields:
 *   id          – unique key
 *   name        – display name of the star system
 *   x, y        – position on the galaxy map (0–100 %)
 *   starClass   – spectral class (cosmetic)
 *   home        – true only for the player's starting system
 *   minLevel    – star map level required to reveal this system
 *   state       – true state: own | uncolonized | enemy | ally
 *                 (hidden behind fog of war until recon drones scan it)
 *   planets     – array of planet objects (see below)
 *
 * Planet fields:
 *   id          – unique key
 *   name        – display name
 *   state       – own | uncolonized | enemy | ally
 *   owner       – faction name or null (only enemy/ally)
 *   isHome      – true for the player's home planet
 *   slots       – tile count (own planets only; null otherwise)
 *
 * Visibility rules (enforced in HsGalaxyMap.vue):
 *   • System visible    → starMapLevel  >= system.minLevel
 *   • System state/detail visible → reconDroneLevel >= system.minLevel OR system.home
 *   • Without drone coverage: state shown as 'unknown', planets hidden
 */

export const GALAXY_SYSTEMS = [

  // ── minLevel 0 — always visible (home) ───────────────────────────────────

  {
    id: 'kepler', name: 'Kepler System', x: 50, y: 49,
    starClass: 'G', home: true, minLevel: 0, state: 'own',
    planets: [
      { id: 'kepler_prime', name: 'Kepler Prime', state: 'own', owner: null, isHome: true, slots: 9 },
    ],
  },

  // ── minLevel 1 — near range (5 systems) ───────────────────────────────────

  {
    id: 'vega9', name: 'Vega-9', x: 37, y: 30,
    starClass: 'K', home: false, minLevel: 1, state: 'uncolonized',
    planets: [
      { id: 'vega_alpha', name: 'Vega Alpha', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'vega_beta',  name: 'Vega Beta',  state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'arix', name: 'Arix System', x: 64, y: 27,
    starClass: 'M', home: false, minLevel: 1, state: 'enemy',
    planets: [
      { id: 'arix_prime', name: 'Arix Prime', state: 'enemy', owner: 'Zarkon', isHome: false, slots: null },
    ],
  },

  {
    id: 'nebula3', name: 'Nebula-3', x: 71, y: 57,
    starClass: 'F', home: false, minLevel: 1, state: 'uncolonized',
    planets: [
      { id: 'nebula3_i',   name: 'Nebula-3 I',   state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nebula3_ii',  name: 'Nebula-3 II',  state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nebula3_iii', name: 'Nebula-3 III', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'tartus', name: 'Tartus', x: 33, y: 64,
    starClass: 'K', home: false, minLevel: 1, state: 'uncolonized',
    planets: [
      { id: 'tartus_iv', name: 'Tartus IV', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'tartus_v',  name: 'Tartus V',  state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'sol_minor', name: 'Sol Minor', x: 54, y: 63,
    starClass: 'G', home: false, minLevel: 1, state: 'uncolonized',
    planets: [
      { id: 'sol_minor_i', name: 'Sol Minor I', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  // ── minLevel 2 — mid range (6 systems) ────────────────────────────────────

  {
    id: 'solaris', name: 'Solaris', x: 21, y: 38,
    starClass: 'G', home: false, minLevel: 2, state: 'uncolonized',
    planets: [
      { id: 'solaris_prime', name: 'Solaris Prime', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'kronos', name: 'Kronos System', x: 80, y: 35,
    starClass: 'K', home: false, minLevel: 2, state: 'enemy',
    planets: [
      { id: 'kronos_vi',  name: 'Kronos VI',  state: 'enemy', owner: 'Vexar', isHome: false, slots: null },
      { id: 'kronos_vii', name: 'Kronos VII', state: 'enemy', owner: 'Vexar', isHome: false, slots: null },
    ],
  },

  {
    id: 'dusk', name: 'Dusk System', x: 18, y: 75,
    starClass: 'M', home: false, minLevel: 2, state: 'uncolonized',
    planets: [
      { id: 'dusk_i', name: 'Dusk I', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'helix7', name: 'Helix-7', x: 58, y: 80,
    starClass: 'F', home: false, minLevel: 2, state: 'ally',
    planets: [
      { id: 'helix7_prime', name: 'Helix-7 Prime', state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'helix7_ii',    name: 'Helix-7 II',    state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'helix7_iii',   name: 'Helix-7 III',   state: 'uncolonized', owner: null,   isHome: false, slots: null },
    ],
  },

  {
    id: 'cygnus', name: 'Cygnus', x: 26, y: 20,
    starClass: 'M', home: false, minLevel: 2, state: 'enemy',
    planets: [
      { id: 'cygnus_a', name: 'Cygnus A', state: 'enemy', owner: 'Zarkon', isHome: false, slots: null },
    ],
  },

  {
    id: 'praxis', name: 'Praxis Belt', x: 75, y: 74,
    starClass: 'G', home: false, minLevel: 2, state: 'uncolonized',
    planets: [
      { id: 'praxis_i',  name: 'Praxis I',  state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'praxis_ii', name: 'Praxis II', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  // ── minLevel 3 — far range (8 systems) ────────────────────────────────────

  {
    id: 'andor', name: 'Andor Belt', x: 84, y: 68,
    starClass: 'K', home: false, minLevel: 3, state: 'uncolonized',
    planets: [
      { id: 'andor_prime', name: 'Andor Prime', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'andor_ii',    name: 'Andor II',    state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'rift', name: 'Rift Delta', x: 13, y: 18,
    starClass: 'M', home: false, minLevel: 3, state: 'enemy',
    planets: [
      { id: 'rift_i', name: 'Rift Delta I', state: 'enemy', owner: 'Zarkon', isHome: false, slots: null },
    ],
  },

  {
    id: 'oberon', name: 'Oberon System', x: 44, y: 12,
    starClass: 'F', home: false, minLevel: 3, state: 'enemy',
    planets: [
      { id: 'oberon_i',  name: 'Oberon I',  state: 'enemy',       owner: 'Vexar', isHome: false, slots: null },
      { id: 'oberon_ii', name: 'Oberon II', state: 'uncolonized', owner: null,    isHome: false, slots: null },
    ],
  },

  {
    id: 'nova', name: 'Nova Cluster', x: 91, y: 20,
    starClass: 'G', home: false, minLevel: 3, state: 'uncolonized',
    planets: [
      { id: 'nova_i',   name: 'Nova I',   state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nova_ii',  name: 'Nova II',  state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nova_iii', name: 'Nova III', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'ember', name: 'Ember IV', x: 9, y: 55,
    starClass: 'M', home: false, minLevel: 3, state: 'uncolonized',
    planets: [
      { id: 'ember_iv', name: 'Ember IV', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'zerath', name: 'Zerath', x: 88, y: 82,
    starClass: 'K', home: false, minLevel: 3, state: 'enemy',
    planets: [
      { id: 'zerath_prime', name: 'Zerath Prime', state: 'enemy', owner: 'Zarkon', isHome: false, slots: null },
      { id: 'zerath_ii',    name: 'Zerath II',    state: 'enemy', owner: 'Zarkon', isHome: false, slots: null },
    ],
  },

  {
    id: 'lyra', name: 'Lyra Gate', x: 36, y: 88,
    starClass: 'G', home: false, minLevel: 3, state: 'uncolonized',
    planets: [
      { id: 'lyra_i',  name: 'Lyra I',  state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'lyra_ii', name: 'Lyra II', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'perseus', name: 'Perseus', x: 65, y: 10,
    starClass: 'F', home: false, minLevel: 3, state: 'ally',
    planets: [
      { id: 'perseus_alpha', name: 'Perseus Alpha', state: 'ally', owner: 'Asha', isHome: false, slots: null },
    ],
  },
]

// Trade routes shown at star map lv2+
export const TRADE_ROUTES = [
  ['kepler',    'vega9'],
  ['kepler',    'nebula3'],
  ['kepler',    'sol_minor'],
  ['kepler',    'helix7'],
  ['vega9',     'solaris'],
  ['vega9',     'cygnus'],
  ['nebula3',   'kronos'],
  ['sol_minor', 'tartus'],
  ['helix7',    'praxis'],
]
