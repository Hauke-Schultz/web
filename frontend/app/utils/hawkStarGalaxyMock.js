/**
 * hawkStarGalaxyMock.js
 *
 * Static frontend mock for the galaxy & planet network.
 * Will be replaced by real API data in Step 3.
 *
 * System fields:
 *   id          – unique key
 *   name        – display name of the star system
 *   x, y        – position on the galaxy map (0–100 %)
 *   starClass   – spectral class (cosmetic)
 *   home        – true only for the player's starting system
 *   minLevel    – star map level required to reveal this system (future use)
 *   planets     – array of planet objects (see below)
 *
 * Planet fields:
 *   id          – unique key
 *   name        – display name
 *   type        – terrestrial | volcanic | frozen | ocean
 *   state       – own | uncolonized | enemy | ally
 *   owner       – faction name or null
 *   isHome      – true for the player's home planet
 *   slots       – tile count (own planets only; null otherwise)
 */

export const GALAXY_SYSTEMS = [

  // ── home system (always visible) ────────────────────────────────────────────

  {
    id: 'kepler', name: 'Kepler System', x: 50, y: 49,
    starClass: 'G', home: true, minLevel: 0,
    planets: [
      { id: 'kepler_prime', name: 'Kepler Prime', type: 'terrestrial', state: 'ally',        owner: 'Asha', isHome: true,  slots: 9 },
      { id: 'kepler_ii',   name: 'Kepler II',    type: 'terrestrial', state: 'uncolonized', owner: null,     isHome: false, slots: null },
      { id: 'kepler_iii',  name: 'Kepler III',   type: 'frozen',      state: 'uncolonized', owner: null,     isHome: false, slots: null },
      { id: 'kepler_iv',   name: 'Kepler IV',    type: 'volcanic',    state: 'enemy',       owner: 'Zarkon', isHome: false, slots: null },
      { id: 'kepler_v',    name: 'Kepler V',     type: 'terrestrial', state: 'uncolonized', owner: null,     isHome: false, slots: null },
      { id: 'kepler_vi',   name: 'Kepler VI',    type: 'ocean',       state: 'uncolonized', owner: null,     isHome: false, slots: null },
    ],
  },

  // ── minLevel 1 — near range ──────────────────────────────────────────────────

  {
    id: 'vega9', name: 'Vega-9', x: 37, y: 30,
    starClass: 'K', home: false, minLevel: 1,
    planets: [
      { id: 'vega_i',   name: 'Vega I',   type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'vega_ii',  name: 'Vega II',  type: 'volcanic',    state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'vega_iii', name: 'Vega III', type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'vega_iv',  name: 'Vega IV',  type: 'frozen',      state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'vega_v',   name: 'Vega V',   type: 'ocean',       state: 'enemy',       owner: 'Zarkon',  isHome: false, slots: null },
    ],
  },

  {
    id: 'arix', name: 'Arix System', x: 64, y: 27,
    starClass: 'M', home: false, minLevel: 1,
    planets: [
      { id: 'arix_i',   name: 'Arix I',   type: 'volcanic',    state: 'enemy',       owner: 'Zarkon', isHome: false, slots: null },
      { id: 'arix_ii',  name: 'Arix II',  type: 'terrestrial', state: 'enemy',       owner: 'Zarkon', isHome: false, slots: null },
      { id: 'arix_iii', name: 'Arix III', type: 'terrestrial', state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'arix_iv',  name: 'Arix IV',  type: 'frozen',      state: 'uncolonized', owner: null,     isHome: false, slots: null },
      { id: 'arix_v',  name: 'Arix V',  type: 'frozen',      state: 'uncolonized', owner: null,     isHome: false, slots: null },
      { id: 'arix_vi',  name: 'Arix VI',  type: 'frozen',      state: 'uncolonized', owner: null,     isHome: false, slots: null },
    ],
  },

  {
    id: 'nebula3', name: 'Nebula-3', x: 68, y: 58,
    starClass: 'F', home: false, minLevel: 1,
    planets: [
      { id: 'nebula3_i',   name: 'Nebula-3 I',   type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nebula3_ii',  name: 'Nebula-3 II',  type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nebula3_iii', name: 'Nebula-3 III', type: 'frozen',      state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'nebula3_iv',  name: 'Nebula-3 IV',  type: 'ocean',       state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nebula3_v',   name: 'Nebula-3 V',   type: 'volcanic',    state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nebula3_vi',  name: 'Nebula-3 VI',  type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nebula3_vii', name: 'Nebula-3 VII', type: 'terrestrial', state: 'enemy',       owner: 'Zarkon',  isHome: false, slots: null },
    ],
  },

  // ── minLevel 2 — mid range ───────────────────────────────────────────────────

  {
    id: 'tartus', name: 'Tartus', x: 29, y: 62,
    starClass: 'K', home: false, minLevel: 2,
    planets: [
      { id: 'tartus_i',   name: 'Tartus I',   type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'tartus_ii',  name: 'Tartus II',  type: 'terrestrial', state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'tartus_iii', name: 'Tartus III', type: 'volcanic',    state: 'enemy',       owner: 'Zarkon',  isHome: false, slots: null },
      { id: 'tartus_iv',  name: 'Tartus IV',  type: 'frozen',      state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'tartus_v',   name: 'Tartus V',   type: 'ocean',       state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'tartus_vi',  name: 'Tartus VI',  type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'kronos', name: 'Kronos System', x: 79, y: 36,
    starClass: 'K', home: false, minLevel: 2,
    planets: [
      { id: 'kronos_i',   name: 'Kronos I',   type: 'volcanic',    state: 'enemy',       owner: 'Vexar', isHome: false, slots: null },
      { id: 'kronos_ii',  name: 'Kronos II',  type: 'terrestrial', state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'kronos_iii', name: 'Kronos III', type: 'terrestrial', state: 'enemy',       owner: 'Vexar', isHome: false, slots: null },
      { id: 'kronos_iv',  name: 'Kronos IV',  type: 'terrestrial', state: 'uncolonized', owner: null,    isHome: false, slots: null },
      { id: 'kronos_v',   name: 'Kronos V',   type: 'frozen',      state: 'uncolonized', owner: null,    isHome: false, slots: null },
      { id: 'kronos_vi',   name: 'Kronos VI',   type: 'frozen',      state: 'uncolonized', owner: null,    isHome: false, slots: null },
    ],
  },

  {
    id: 'helix7', name: 'Helix-7', x: 56, y: 79,
    starClass: 'F', home: false, minLevel: 2,
    planets: [
      { id: 'helix7_i',    name: 'Helix-7 I',    type: 'ocean',       state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'helix7_ii',   name: 'Helix-7 II',   type: 'terrestrial', state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'helix7_iii',  name: 'Helix-7 III',  type: 'frozen',      state: 'uncolonized', owner: null,   isHome: false, slots: null },
      { id: 'helix7_iv',   name: 'Helix-7 IV',   type: 'terrestrial', state: 'uncolonized', owner: null,   isHome: false, slots: null },
      { id: 'helix7_v',    name: 'Helix-7 V',    type: 'volcanic',    state: 'uncolonized', owner: null,   isHome: false, slots: null },
      { id: 'helix7_vi',   name: 'Helix-7 VI',   type: 'terrestrial', state: 'uncolonized', owner: null,   isHome: false, slots: null },
      { id: 'helix7_vii',  name: 'Helix-7 VII',  type: 'ocean',       state: 'enemy',       owner: 'Zarkon',   isHome: false, slots: null },
      { id: 'helix7_viii', name: 'Helix-7 VIII', type: 'frozen',      state: 'uncolonized', owner: null,   isHome: false, slots: null },
    ],
  },

  // ── minLevel 3 — far range ───────────────────────────────────────────────────

  {
    id: 'nova', name: 'Nova Cluster', x: 88, y: 20,
    starClass: 'G', home: false, minLevel: 3,
    planets: [
      { id: 'nova_i',   name: 'Nova I',   type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nova_ii',  name: 'Nova II',  type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nova_iii', name: 'Nova III', type: 'frozen',      state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'nova_iv',  name: 'Nova IV',  type: 'ocean',       state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nova_v',   name: 'Nova V',   type: 'volcanic',    state: 'uncolonized', owner: null, isHome: false, slots: null },
      { id: 'nova_vi',  name: 'Nova VI',  type: 'terrestrial', state: 'uncolonized', owner: null, isHome: false, slots: null },
    ],
  },

  {
    id: 'zerath', name: 'Zerath', x: 21, y: 18,
    starClass: 'K', home: false, minLevel: 3,
    planets: [
      { id: 'zerath_i',   name: 'Zerath I',   type: 'volcanic',    state: 'enemy',       owner: 'Zarkon', isHome: false, slots: null },
      { id: 'zerath_ii',  name: 'Zerath II',  type: 'terrestrial', state: 'ally',        owner: 'Asha', isHome: false, slots: null },
      { id: 'zerath_iii', name: 'Zerath III', type: 'frozen',      state: 'uncolonized', owner: null,     isHome: false, slots: null },
      { id: 'zerath_iv',  name: 'Zerath IV',  type: 'terrestrial', state: 'uncolonized', owner: null,     isHome: false, slots: null },
      { id: 'zerath_v',  name: 'Zerath V',  type: 'terrestrial', state: 'uncolonized', owner: null,     isHome: false, slots: null },
      { id: 'zerath_vi',  name: 'Zerath VI',  type: 'terrestrial', state: 'uncolonized', owner: null,     isHome: false, slots: null },
    ],
  },
]

// Trade routes (defined but not rendered in current Galaxy Map view)
export const TRADE_ROUTES = [
  ['kepler', 'vega9'],
  ['kepler', 'nebula3'],
  ['kepler', 'tartus'],
  ['kepler', 'helix7'],
  ['vega9',  'arix'],
  ['vega9',  'tartus'],
  ['arix',   'kronos'],
  ['nebula3', 'kronos'],
  ['helix7',  'nova'],
]
