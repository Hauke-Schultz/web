/**
 * hawkStarGalaxyMock.js
 *
 * Per-player galaxy generator — a new galaxy is created on first run and
 * persisted in the save. On reload, the stored galaxy is restored.
 * Will be replaced by a real backend API call in the multiplayer phase.
 *
 * Future DB shape:
 *   galaxy_systems  { id, playerId, name, x, y, starClass }
 *   system_factions { systemId, name, portrait, disposition }
 *   system_planets  { id, systemId, name, type, state, owner }
 */

const ROMAN_LOWER = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii']
const ROMAN_UPPER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
const STAR_CLASSES = ['G', 'K', 'M', 'F']
const HABITABLE_TYPES = ['terrestrial', 'volcanic', 'frozen', 'ocean']

// ── Name + position pools for generated systems ───────────────────────────────
// NPC systems occupy: kepler (50, 49) and vorn (78, 24)

const SYSTEM_NAME_POOL = [
  'Arix', 'Vega', 'Helix', 'Nova', 'Zerath', 'Tartus',
  'Cygnus', 'Lyra', 'Fenris', 'Oryx', 'Altair', 'Kronos',
  'Deneb', 'Spica', 'Procyon', 'Castor', 'Phalos', 'Solux',
  'Mirach', 'Fornax', 'Dracor', 'Nexar', 'Valeth', 'Koryn',
]

const POSITION_POOL = [
  { x: 14, y: 16 }, { x: 40, y: 10 }, { x: 68, y: 14 },
  { x: 90, y: 58 }, { x: 76, y: 82 }, { x: 50, y: 88 },
  { x: 22, y: 80 }, { x:  8, y: 52 }, { x: 20, y: 36 },
  { x: 62, y: 56 }, { x: 36, y: 62 }, { x: 55, y: 28 },
]

// ── Fixed NPC systems (always included, two NPCs for testing) ─────────────────

const NPC_SYSTEMS = [
  {
    id: 'kepler', name: 'Kepler System', x: 50, y: 49, starClass: 'G',
    factions: [{ name: 'Asha', portrait: '👩‍🚀', disposition: 'friendly' }],
    planets: [
      { id: 'kepler_i',   name: 'Kepler I',   type: 'terrestrial',   state: 'ally',          owner: 'Asha'  },
      { id: 'kepler_ii',  name: 'Kepler II',  type: 'volcanic',      state: 'uncolonized',   owner: null    },
      { id: 'kepler_iii', name: 'Kepler III', type: 'frozen',        state: 'ally',          owner: 'Asha'  },
      { id: 'kepler_iv',  name: 'Kepler IV',  type: 'ocean',         state: 'uncolonized',   owner: null    },
      { id: 'kepler_v',   name: 'Kepler V',   type: 'uninhabitable', state: 'uninhabitable', owner: null    },
      { id: 'kepler_vi',  name: 'Kepler VI',  type: 'uninhabitable', state: 'uninhabitable', owner: null    },
      { id: 'kepler_vii', name: 'Kepler VII', type: 'uninhabitable', state: 'uninhabitable', owner: null    },
    ],
  },
  {
    id: 'vorn', name: 'Vorn System', x: 78, y: 24, starClass: 'M',
    factions: [{ name: 'Krath', portrait: '💀', disposition: 'hostile' }],
    planets: [
      { id: 'vorn_i',   name: 'Vorn I',   type: 'volcanic',      state: 'enemy',         owner: 'Krath' },
      { id: 'vorn_ii',  name: 'Vorn II',  type: 'terrestrial',   state: 'enemy',         owner: 'Krath' },
      { id: 'vorn_iii', name: 'Vorn III', type: 'uninhabitable', state: 'uninhabitable', owner: null    },
      { id: 'vorn_iv',  name: 'Vorn IV',  type: 'frozen',        state: 'uncolonized',   owner: null    },
      { id: 'vorn_v',   name: 'Vorn V',   type: 'uninhabitable', state: 'uninhabitable', owner: null    },
      { id: 'vorn_vi',  name: 'Vorn VI',  type: 'ocean',         state: 'uncolonized',   owner: null    },
    ],
  },
]

// ── Generator helpers ─────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildPlanets(systemId, shortName) {
  const extraCount = 2 + Math.floor(Math.random() * 3) // 2–4 uninhabitable → 6–8 total
  const types = shuffle([...HABITABLE_TYPES, ...Array(extraCount).fill('uninhabitable')])
  return types.map((type, i) => ({
    id:    `${systemId}_${ROMAN_LOWER[i]}`,
    name:  `${shortName} ${ROMAN_UPPER[i]}`,
    type,
    state: type === 'uninhabitable' ? 'uninhabitable' : 'uncolonized',
    owner: null,
  }))
}

function generateEmptySystems(count = 7) {
  const names     = shuffle([...SYSTEM_NAME_POOL]).slice(0, count)
  const positions = shuffle([...POSITION_POOL]).slice(0, count)
  return names.map((name, i) => {
    const id       = name.toLowerCase()
    const { x, y } = positions[i]
    return {
      id,
      name:      `${name} System`,
      x,
      y,
      starClass: STAR_CLASSES[Math.floor(Math.random() * STAR_CLASSES.length)],
      planets:   buildPlanets(id, name),
    }
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export const generateGalaxy = () => [...NPC_SYSTEMS, ...generateEmptySystems(1)]
