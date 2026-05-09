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
 *   planets     – array of planet objects (see below)
 *
 * Planet fields:
 *   id          – unique key
 *   name        – display name
 *   type        – terrestrial | volcanic | frozen | ocean | uninhabitable
 *   state       – own | uncolonized | scanning | colonizing | uninhabitable | unknown
 *   owner       – faction name or null
 *   isHome      – true for the player's home planet
 *   slots       – tile count (own planets only; null otherwise)
 *
 * Galaxy design:
 *   - Each player gets their own galaxy — no enemies at start.
 *   - Home system has exactly one of each habitable type (terrestrial, volcanic,
 *     frozen, ocean) plus 3 uninhabitable planets.
 *   - All other systems contain a mix of habitable (uncolonized) and uninhabitable
 *     planets — no owners, no factions.
 *   - The player starts on a random habitable planet in a randomly chosen
 *     uninhabited system (no planet with an owner).
 *   - Kepler System is pre-inhabited by NPC "Asha" (2 colonized planets).
 */

export const GALAXY_SYSTEMS = [

  // ── Kepler — NPC-inhabited, player cannot start here ────────────────────────

  {
    id: 'kepler', name: 'Kepler System', x: 50, y: 49,
    starClass: 'G',
    planets: [
      { id: 'kepler_prime', name: 'Kepler Prime', type: 'terrestrial',  state: 'ally',          owner: 'Asha', },
      { id: 'kepler_ii',   name: 'Kepler II',    type: 'volcanic',      state: 'uncolonized',   owner: null,   },
      { id: 'kepler_iii',  name: 'Kepler III',   type: 'frozen',        state: 'ally',          owner: 'Asha', },
      { id: 'kepler_iv',   name: 'Kepler IV',    type: 'ocean',         state: 'uncolonized',   owner: null,   },
      { id: 'kepler_v',    name: 'Kepler V',     type: 'uninhabitable', state: 'uninhabitable', owner: null,   },
      { id: 'kepler_vi',   name: 'Kepler VI',    type: 'uninhabitable', state: 'uninhabitable', owner: null,   },
      { id: 'kepler_vii',  name: 'Kepler VII',   type: 'uninhabitable', state: 'uninhabitable', owner: null,   },
    ],
  },

  {
    id: 'vega9', name: 'Vega-9', x: 37, y: 30,
    starClass: 'K',
    planets: [
      { id: 'vega_i',   name: 'Vega I',   type: 'terrestrial',   state: 'uncolonized',   owner: null, },
      { id: 'vega_ii',  name: 'Vega II',  type: 'volcanic',      state: 'uncolonized',   owner: null, },
      { id: 'vega_iii', name: 'Vega III', type: 'frozen',        state: 'uncolonized',   owner: null, },
      { id: 'vega_iv',  name: 'Vega IV',  type: 'ocean',         state: 'uncolonized',   owner: null, },
      { id: 'vega_v',   name: 'Vega V',   type: 'uninhabitable', state: 'uninhabitable', owner: null, },
    ],
  },

  {
    id: 'arix', name: 'Arix System', x: 64, y: 27,
    starClass: 'M',
    planets: [
      { id: 'arix_i',   name: 'Arix I',   type: 'volcanic',     state: 'uncolonized',   owner: null, },
      { id: 'arix_ii',  name: 'Arix II',  type: 'terrestrial',  state: 'uncolonized',   owner: null, },
      { id: 'arix_iii', name: 'Arix III', type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'arix_iv',  name: 'Arix IV',  type: 'frozen',       state: 'uncolonized',   owner: null, },
      { id: 'arix_v',   name: 'Arix V',   type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'arix_vi',  name: 'Arix VI',  type: 'ocean',        state: 'uncolonized',   owner: null, },
    ],
  },

  {
    id: 'nebula3', name: 'Nebula-3', x: 68, y: 58,
    starClass: 'F',
    planets: [
      { id: 'nebula3_i',   name: 'Nebula-3 I',   type: 'terrestrial',  state: 'uncolonized',   owner: null, },
      { id: 'nebula3_ii',  name: 'Nebula-3 II',  type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'nebula3_iii', name: 'Nebula-3 III', type: 'frozen',       state: 'uncolonized',   owner: null, },
      { id: 'nebula3_iv',  name: 'Nebula-3 IV',  type: 'ocean',        state: 'uncolonized',   owner: null, },
      { id: 'nebula3_v',   name: 'Nebula-3 V',   type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'nebula3_vi',  name: 'Nebula-3 VI',  type: 'volcanic',     state: 'uncolonized',   owner: null, },
      { id: 'nebula3_vii', name: 'Nebula-3 VII', type: 'uninhabitable', state: 'uninhabitable', owner: null, },
    ],
  },

  {
    id: 'tartus', name: 'Tartus', x: 29, y: 62,
    starClass: 'K',
    planets: [
      { id: 'tartus_i',   name: 'Tartus I',   type: 'terrestrial',  state: 'uncolonized',   owner: null, },
      { id: 'tartus_ii',  name: 'Tartus II',  type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'tartus_iii', name: 'Tartus III', type: 'volcanic',     state: 'uncolonized',   owner: null, },
      { id: 'tartus_iv',  name: 'Tartus IV',  type: 'frozen',       state: 'uncolonized',   owner: null, },
      { id: 'tartus_v',   name: 'Tartus V',   type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'tartus_vi',  name: 'Tartus VI',  type: 'ocean',        state: 'uncolonized',   owner: null, },
    ],
  },

  {
    id: 'kronos', name: 'Kronos System', x: 79, y: 36,
    starClass: 'K',
    planets: [
      { id: 'kronos_i',   name: 'Kronos I',   type: 'volcanic',     state: 'uncolonized',   owner: null, },
      { id: 'kronos_ii',  name: 'Kronos II',  type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'kronos_iii', name: 'Kronos III', type: 'terrestrial',  state: 'uncolonized',   owner: null, },
      { id: 'kronos_iv',  name: 'Kronos IV',  type: 'ocean',        state: 'uncolonized',   owner: null, },
      { id: 'kronos_v',   name: 'Kronos V',   type: 'frozen',       state: 'uncolonized',   owner: null, },
      { id: 'kronos_vi',  name: 'Kronos VI',  type: 'uninhabitable', state: 'uninhabitable', owner: null, },
    ],
  },

  {
    id: 'helix7', name: 'Helix-7', x: 56, y: 79,
    starClass: 'F',
    planets: [
      { id: 'helix7_i',    name: 'Helix-7 I',    type: 'ocean',        state: 'uncolonized',   owner: null, },
      { id: 'helix7_ii',   name: 'Helix-7 II',   type: 'terrestrial',  state: 'uncolonized',   owner: null, },
      { id: 'helix7_iii',  name: 'Helix-7 III',  type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'helix7_iv',   name: 'Helix-7 IV',   type: 'frozen',       state: 'uncolonized',   owner: null, },
      { id: 'helix7_v',    name: 'Helix-7 V',    type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'helix7_vi',   name: 'Helix-7 VI',   type: 'volcanic',     state: 'uncolonized',   owner: null, },
      { id: 'helix7_vii',  name: 'Helix-7 VII',  type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'helix7_viii', name: 'Helix-7 VIII', type: 'uninhabitable', state: 'uninhabitable', owner: null, },
    ],
  },

  {
    id: 'nova', name: 'Nova Cluster', x: 88, y: 20,
    starClass: 'G',
    planets: [
      { id: 'nova_i',   name: 'Nova I',   type: 'terrestrial',  state: 'uncolonized',   owner: null, },
      { id: 'nova_ii',  name: 'Nova II',  type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'nova_iii', name: 'Nova III', type: 'frozen',       state: 'uncolonized',   owner: null, },
      { id: 'nova_iv',  name: 'Nova IV',  type: 'ocean',        state: 'uncolonized',   owner: null, },
      { id: 'nova_v',   name: 'Nova V',   type: 'volcanic',     state: 'uncolonized',   owner: null, },
      { id: 'nova_vi',  name: 'Nova VI',  type: 'uninhabitable', state: 'uninhabitable', owner: null, },
    ],
  },

  {
    id: 'zerath', name: 'Zerath', x: 21, y: 18,
    starClass: 'K',
    planets: [
      { id: 'zerath_i',   name: 'Zerath I',   type: 'volcanic',     state: 'uncolonized',   owner: null, },
      { id: 'zerath_ii',  name: 'Zerath II',  type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'zerath_iii', name: 'Zerath III', type: 'frozen',       state: 'uncolonized',   owner: null, },
      { id: 'zerath_iv',  name: 'Zerath IV',  type: 'terrestrial',  state: 'uncolonized',   owner: null, },
      { id: 'zerath_v',   name: 'Zerath V',   type: 'uninhabitable', state: 'uninhabitable', owner: null, },
      { id: 'zerath_vi',  name: 'Zerath VI',  type: 'ocean',        state: 'uncolonized',   owner: null, },
    ],
  },
]
