import { ref, computed } from 'vue'
import { TILE_TYPES, PLANET_GRID, BUILDINGS } from './hawkStarConfig.js'

// ── Singleton state ────────────────────────────────────────
const planetName = ref('Kepler Prime')

const playerResources = ref({
  population: 15,
  metal:      200,
  crystal:    80,
  energy:     0,
})

const playerSlots = ref(
  PLANET_GRID.map(s => ({ ...s, unlocked: s.startsUnlocked }))
)

const playerBuildings = ref(
  Object.fromEntries(
    Object.keys(BUILDINGS).map(id => [id, { level: 0, buildEndsAt: null }])
  )
)

const activeSlot = ref(5)
const now = ref(Date.now())
let tickInterval = null

// ── Active tile ────────────────────────────────────────────
const activeSlotDef = computed(() =>
  playerSlots.value.find(s => s.slot === activeSlot.value)
)

const activeTileType = computed(() =>
  activeSlotDef.value?.tileType ? TILE_TYPES[activeSlotDef.value.tileType] : null
)

const selectSlot = (slot) => {
  if (!slot.unlocked) return
  activeSlot.value = slot.slot
}

// ── Building helpers ───────────────────────────────────────
const buildingsForActiveSlot = computed(() => {
  if (!activeTileType.value) return []
  return Object.values(BUILDINGS).filter(b => b.tileType === activeTileType.value.id)
})

const getLevel = (id) => playerBuildings.value[id]?.level ?? 0

const isBuildingInProgress = (id) => playerBuildings.value[id]?.buildEndsAt !== null

const nextLevelDef = (id) => BUILDINGS[id]?.levels[getLevel(id)] ?? null

const effectiveLevel = (state) => state.buildEndsAt ? state.level + 1 : state.level

// ── Production & energy ────────────────────────────────────
const grossProduction = computed(() => {
  const prod = {}
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    if (state.level === 0) continue
    const levelDef = BUILDINGS[id]?.levels[state.level - 1]
    for (const [res, amt] of Object.entries(levelDef?.production ?? {})) {
      prod[res] = (prod[res] ?? 0) + amt
    }
  }
  return prod
})

const totalEnergyDrain = computed(() => {
  let drain = 0
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    const lvl = effectiveLevel(state)
    if (lvl === 0) continue
    drain += BUILDINGS[id]?.levels[lvl - 1]?.energyDrain ?? 0
  }
  return drain
})

const production = computed(() => ({
  ...grossProduction.value,
  energy: (grossProduction.value.energy ?? 0) - totalEnergyDrain.value,
}))

const energyDeficit = computed(() => production.value.energy < 0)

// ── Staff / population ─────────────────────────────────────
const totalStaffDrain = computed(() => {
  let drain = 0
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    const lvl = effectiveLevel(state)
    if (lvl === 0) continue
    drain += BUILDINGS[id]?.levels[lvl - 1]?.staffDrain ?? 0
  }
  return drain
})

const freeWorkers = computed(() => playerResources.value.population - totalStaffDrain.value)

// ── Storage caps ───────────────────────────────────────────
const BASE_STORAGE = { metal: 100, crystal: 50 }

const maxStorage = computed(() => {
  const caps = { ...BASE_STORAGE }
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    if (state.level === 0) continue
    const storage = BUILDINGS[id]?.levels[state.level - 1]?.storageCapacity ?? {}
    for (const [res, cap] of Object.entries(storage)) {
      caps[res] = (caps[res] ?? 0) + cap
    }
  }
  return caps
})

// ── Build checks ───────────────────────────────────────────
const canAfford = (cost) => {
  for (const [res, amt] of Object.entries(cost)) {
    if ((playerResources.value[res] ?? 0) < amt) return false
  }
  return true
}

const hasEnoughPower = (id) => {
  const next = nextLevelDef(id)
  if (!next?.energyDrain) return true
  const currentDrain = getLevel(id) > 0
    ? (BUILDINGS[id]?.levels[getLevel(id) - 1]?.energyDrain ?? 0) : 0
  return production.value.energy - (next.energyDrain - currentDrain) >= 0
}

const hasEnoughStaff = (id) => {
  const next = nextLevelDef(id)
  if (!next?.staffDrain) return true
  const currentDrain = getLevel(id) > 0
    ? (BUILDINGS[id]?.levels[getLevel(id) - 1]?.staffDrain ?? 0) : 0
  return freeWorkers.value - (next.staffDrain - currentDrain) >= 0
}

const staffDelta = (id) => {
  const next = nextLevelDef(id)
  if (!next?.staffDrain) return 0
  const current = getLevel(id) > 0 ? (BUILDINGS[id]?.levels[getLevel(id) - 1]?.staffDrain ?? 0) : 0
  return next.staffDrain - current
}

const commandCenterBuilt = computed(() => playerBuildings.value['command_center']?.level >= 1)
const starMapLevel      = computed(() => {
  const state = playerBuildings.value['star_map']
  return state ? effectiveLevel(state) : 0
})
const reconDroneLevel   = computed(() => {
  const state = playerBuildings.value['recon_drones']
  return state ? effectiveLevel(state) : 0
})

const canBuild = (id) =>
  (id === 'command_center' || commandCenterBuilt.value) &&
  canAfford(nextLevelDef(id)?.cost ?? {}) &&
  hasEnoughPower(id) &&
  hasEnoughStaff(id)

const startBuild = (id) => {
  const next = nextLevelDef(id)
  if (!next || isBuildingInProgress(id) || !canBuild(id)) return
  for (const [res, amt] of Object.entries(next.cost)) {
    playerResources.value[res] -= amt
  }
  playerBuildings.value[id].buildEndsAt = Date.now() + next.buildTime * 1000
}

// Current built level definition (null if not yet built)
const currentLevelDef = (id) => {
  const lvl = getLevel(id)
  return lvl > 0 ? (BUILDINGS[id]?.levels[lvl - 1] ?? null) : null
}

// ── Offline status ─────────────────────────────────────────
const isOffline = (id) => {
  if (!energyDeficit.value) return false
  const lvl = playerBuildings.value[id]?.level ?? 0
  if (lvl === 0) return false
  return (BUILDINGS[id]?.levels[lvl - 1]?.energyDrain ?? 0) > 0
}

// ── Grid helpers ───────────────────────────────────────────
const unlockRequirement = (slot) => {
  for (const building of Object.values(BUILDINGS)) {
    for (const lvl of building.levels) {
      if (lvl.unlocks?.some(u => u.slot === slot)) {
        return { building, level: lvl.level }
      }
    }
  }
  return null
}

const slotsOnSlot = (slot) => {
  const tileType = playerSlots.value.find(s => s.slot === slot)?.tileType
  if (!tileType) return []
  return Object.values(BUILDINGS)
    .filter(b => b.tileType === tileType)
    .map(b => ({
      id:       b.id,
      level:    getLevel(b.id),
      building: isBuildingInProgress(b.id),
      offline:  isOffline(b.id),
    }))
    .filter(b => b.level > 0 || b.building)
}

// ── Time helpers ───────────────────────────────────────────
const remainingSec = (buildEndsAt) =>
  Math.max(0, Math.ceil((buildEndsAt - now.value) / 1000))

const formatTime = (sec) =>
  sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`

// Returns CSS animation style for the progress fill.
// Uses Date.now() (non-reactive) so the style is only re-evaluated when
// buildEndsAt changes (new build), not every tick — the CSS animation
// then plays forward naturally without flashing or disappearing early.
const buildProgressStyle = (id) => {
  const state = playerBuildings.value[id]
  if (!state?.buildEndsAt) return {}
  const buildTime = BUILDINGS[id]?.levels[getLevel(id)]?.buildTime ?? 1
  const elapsed = Math.max(0, (Date.now() - (state.buildEndsAt - buildTime * 1000)) / 1000)
  return {
    animationDuration: `${buildTime}s`,
    animationDelay: `-${elapsed}s`,
  }
}

// ── LocalStorage persistence ───────────────────────────────
const SAVE_KEY = 'hawk-star-save'

const saveGame = () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    planetName:      planetName.value,
    playerResources: playerResources.value,
    playerSlots:     playerSlots.value.map(s => ({ slot: s.slot, unlocked: s.unlocked })),
    playerBuildings: playerBuildings.value,
  }))
}

const loadGame = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.planetName)      planetName.value = data.planetName
    if (data.playerResources) playerResources.value = data.playerResources
    if (data.playerSlots) {
      playerSlots.value = playerSlots.value.map(s => {
        const saved = data.playerSlots.find(ps => ps.slot === s.slot)
        return saved ? { ...s, unlocked: saved.unlocked } : s
      })
    }
    if (data.playerBuildings) {
      for (const [id, state] of Object.entries(data.playerBuildings)) {
        if (playerBuildings.value[id]) playerBuildings.value[id] = state
      }
    }
  } catch (e) {
    console.warn('[hawk-star] Failed to load save:', e)
  }
}

export const resetGame = () => {
  localStorage.removeItem(SAVE_KEY)
  location.reload()
}

// ── Tick ───────────────────────────────────────────────────
const tick = () => {
  now.value = Date.now()

  for (const [id, state] of Object.entries(playerBuildings.value)) {
    if (!state.buildEndsAt || state.buildEndsAt > now.value) continue
    state.level += 1
    state.buildEndsAt = null
    const levelDef = BUILDINGS[id]?.levels[state.level - 1]
    if (levelDef?.unlocks) {
      for (const { slot } of levelDef.unlocks) {
        const s = playerSlots.value.find(ps => ps.slot === slot)
        if (s) s.unlocked = true
      }
    }
    if (levelDef?.popBonus) {
      playerResources.value.population += levelDef.popBonus
    }
  }

  for (const [res, amt] of Object.entries(production.value)) {
    const newVal = Math.max(0, (playerResources.value[res] ?? 0) + amt)
    const cap = maxStorage.value[res]
    playerResources.value[res] = cap !== undefined ? Math.min(newVal, cap) : newVal
  }

  saveGame()
}

export const startTick = () => {
  if (tickInterval) return
  loadGame()
  tickInterval = setInterval(tick, 1000)
}

export const stopTick = () => {
  clearInterval(tickInterval)
  tickInterval = null
}

// ── Composable export ──────────────────────────────────────
export function useHawkStar() {
  return {
    // state
    planetName,
    playerResources,
    playerSlots,
    playerBuildings,
    activeSlot,
    now,
    // active tile
    activeTileType,
    selectSlot,
    buildingsForActiveSlot,
    // building helpers
    getLevel,
    isBuildingInProgress,
    nextLevelDef,
    canBuild,
    startBuild,
    hasEnoughPower,
    hasEnoughStaff,
    staffDelta,
    isOffline,
    // production
    grossProduction,
    totalEnergyDrain,
    production,
    energyDeficit,
    // staff
    totalStaffDrain,
    freeWorkers,
    // storage
    maxStorage,
    // current level stats
    currentLevelDef,
    // communication
    starMapLevel,
    reconDroneLevel,
    // grid
    unlockRequirement,
    slotsOnSlot,
    // time
    remainingSec,
    formatTime,
    buildProgressStyle,
  }
}
