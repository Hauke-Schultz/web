import { ref, computed } from 'vue'
import { TILE_TYPES, PLANET_GRID, BUILDINGS, RESOURCES, UNIT_COSTS, PLANET_TYPES, COMM_EMOJIS, NPC_RESPONSES, SIGNAL_SPEED_BASE } from '~/utils/hawkStarConfig.js'
import { GALAXY_SYSTEMS } from '~/utils/hawkStarGalaxyMock.js'

// ── Starting planet pool — pick a random uninhabited system ──────────────────
const HABITABLE_TYPES = new Set(['terrestrial', 'volcanic', 'frozen', 'ocean'])
const buildStartPool = () => {
  // Only consider systems where no planet has an owner (no NPC inhabitants)
  const emptySystems = GALAXY_SYSTEMS.filter(sys => sys.planets.every(p => !p.owner))
  if (emptySystems.length === 0) return []
  const sys = emptySystems[Math.floor(Math.random() * emptySystems.length)]
  return sys.planets
    .filter(p => HABITABLE_TYPES.has(p.type) && p.state === 'uncolonized')
    .map(p => ({
      system:     sys.name,
      systemId:   sys.id,
      planet:     p.name,
      planetId:   p.id,
      planetType: p.type,
    }))
}

const randomStartConfig = () => {
  const pool = buildStartPool()
  return pool[Math.floor(Math.random() * pool.length)]
}

// ── Singleton state ────────────────────────────────────────
const playerName   = ref('')
const homeConfig   = ref(randomStartConfig())
const systemName   = ref(homeConfig.value.system)
const homeSystemId = ref(homeConfig.value.systemId)
const homePlanetId = ref(homeConfig.value.planetId)
const isFirstRun   = computed(() => playerName.value === '')

// ── Dev tuning ─────────────────────────────────────────────
const tickRateMs      = ref(1000)
const buildTimeFactor = ref(1)

// ── Per-planet state (slots + buildings + resources) ───────
const allPlanetStates = ref({})

// ── Global research (built once, applies to all planets) ───
const globalResearch = ref(
  Object.fromEntries(
    Object.values(BUILDINGS)
      .filter(b => b.global)
      .map(b => [b.id, { level: 0, buildEndsAt: null, buildStartedAt: null }])
  )
)

// ── Notifications (persistent done-events) ────────────────
const notifications = ref([])

// ── Communication ─────────────────────────────────────────
// systemContacts: per-system scan state
// commLog: all sent/received messages (newest first)
const systemContacts = ref(
  Object.fromEntries(
    GALAXY_SYSTEMS.map(s => [s.id, { scanState: 'unscanned', scanEndsAt: null }])
  )
)
const commLog = ref([])

const dismissNotification = (id) => {
  const idx = notifications.value.findIndex(n => n.id === id)
  if (idx !== -1) notifications.value.splice(idx, 1)
}

const HOME_START_RESOURCES   = { population: 20, metal: 400, crystal: 180, alloy: 0, cryo: 0, obsidian: 0, biomass: 0, energy: 0, pure_crystal: 0, super_alloy: 0, quantum_shard: 0, nano_alloy: 0, power_cell: 0 }
const COLONY_START_RESOURCES = { population: 15,  metal: 200,  crystal: 80, alloy: 0, cryo: 0, obsidian: 0, biomass: 0, energy: 0, pure_crystal: 0, super_alloy: 0, quantum_shard: 0, nano_alloy: 0, power_cell: 0 }

const freshDock = () => ({
  reconDroneInventory:    0,
  reconDroneBuild:        null,
  activeDroneMissions:    [],
  colonyShipInventory:    0,
  colonyShipBuild:        null,
  activeColonyMissions:   [],
})

const initializePlanetState = (planetId, pType, pName, isHome = false) => {
  if (allPlanetStates.value[planetId]) return
  allPlanetStates.value[planetId] = {
    planetType:       pType,
    planetName:       pName,
    resources:        isHome ? { ...HOME_START_RESOURCES } : { ...COLONY_START_RESOURCES },
    slots:            PLANET_GRID.map(s => ({ ...s, unlocked: s.startsUnlocked })),
    buildings:        Object.fromEntries(Object.keys(BUILDINGS).map(id => [id, { level: 0, buildEndsAt: null }])),
    dock:             freshDock(),
    conversionQueues: [],
  }
}

initializePlanetState(homeConfig.value.planetId, homeConfig.value.planetType, homeConfig.value.planet, true)

const activePlanetId = ref(homeConfig.value.planetId)

const setActivePlanet = (planetId) => {
  if (!allPlanetStates.value[planetId]) return
  activePlanetId.value = planetId
  activeSlot.value = 5
}

// Computed aliases — Vue tracks nested mutations through these
const playerSlots     = computed(() => allPlanetStates.value[activePlanetId.value]?.slots ?? [])
const playerBuildings = computed(() => {
  const pb = allPlanetStates.value[activePlanetId.value]?.buildings ?? {}
  return { ...pb, ...globalResearch.value }
})
const planetType      = computed(() => allPlanetStates.value[activePlanetId.value]?.planetType ?? 'terrestrial')
const planetName      = computed(() => allPlanetStates.value[activePlanetId.value]?.planetName ?? '')

// ── Home system (reactive, drives Solar System + Galaxy views) ─────────────
const homeSystem = computed(() => GALAXY_SYSTEMS.find(s => s.id === homeSystemId.value))

// Per-planet resource aliases
const playerResources = computed(() => allPlanetStates.value[activePlanetId.value]?.resources ?? {})
const homeResources   = computed(() => allPlanetStates.value[homePlanetId.value]?.resources ?? {})


const activeSlot = ref(5)
const now = ref(Date.now())
let tickInterval = null
let lastProdAt   = 0

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
  return Object.values(BUILDINGS).filter(b =>
    b.tileType === activeTileType.value.id &&
    (!b.planetTypes || b.planetTypes.includes(planetType.value))
  )
})

const getLevel = (id) => playerBuildings.value[id]?.level ?? 0

const isBuildingInProgress = (id) => playerBuildings.value[id]?.buildEndsAt !== null

const nextLevelDef = (id) => BUILDINGS[id]?.levels[getLevel(id)] ?? null

const effectiveLevel = (state) => state.buildEndsAt ? state.level + 1 : state.level

// ── Production & energy (active planet) ───────────────────
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
const BASE_STORAGE = { metal: 100, crystal: 50, alloy: 50, cryo: 50, obsidian: 50, biomass: 50, pure_crystal: 50, super_alloy: 50, quantum_shard: 50, nano_alloy: 50 }

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

// Unit builds always draw from home planet
const canAffordFromHome = (cost) => {
  const res = allPlanetStates.value[homePlanetId.value]?.resources ?? {}
  for (const [r, amt] of Object.entries(cost)) {
    if ((res[r] ?? 0) < amt) return false
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

// research center: active planet (each planet can build independently)
const researchCenterBuilt = computed(() => playerBuildings.value['command_center']?.level >= 1)

// Space facilities always read from home planet
const homeBuilding = (id) => allPlanetStates.value[homePlanetId.value]?.buildings[id]
const starMapLevel = computed(() => effectiveLevel(globalResearch.value.star_map ?? { level: 0, buildEndsAt: null }))
const spaceTechLevel = computed(() => {
  const state = homeBuilding('space_tech')
  return state ? effectiveLevel(state) : 0
})
const reconDroneLevel = computed(() => {
  const state = playerBuildings.value['recon_drone']
  return state?.level ?? 0
})
const colonyShipLevel = computed(() => {
  const state = playerBuildings.value['colony_ship']
  return state?.level ?? 0
})
const isBuildingLocked = (id) => {
  const req = BUILDINGS[id]?.requiresBuilding
  if (!req) return false
  return getLevel(req) < (BUILDINGS[id]?.requiresLevel ?? 1)
}

const canBuild = (id) =>
  !isBuildingLocked(id) &&
  canAfford(nextLevelDef(id)?.cost ?? {}) &&
  hasEnoughPower(id) &&
  hasEnoughStaff(id)

const startBuild = (id) => {
  const next = nextLevelDef(id)
  if (!next || isBuildingInProgress(id) || !canBuild(id)) return
  const res = allPlanetStates.value[activePlanetId.value].resources
  for (const [r, amt] of Object.entries(next.cost)) {
    res[r] -= amt
  }
  const _buildMs = next.buildTime * buildTimeFactor.value * 1000
  if (BUILDINGS[id]?.global) {
    globalResearch.value[id].buildStartedAt = Date.now()
    globalResearch.value[id].buildEndsAt    = Date.now() + _buildMs
  } else {
    allPlanetStates.value[activePlanetId.value].buildings[id].buildStartedAt = Date.now()
    allPlanetStates.value[activePlanetId.value].buildings[id].buildEndsAt    = Date.now() + _buildMs
  }
}

const currentLevelDef = (id) => {
  const lvl = getLevel(id)
  return lvl > 0 ? (BUILDINGS[id]?.levels[lvl - 1] ?? null) : null
}

// ── Offline status ─────────────────────────────────────────
const isOffline = (id) => {
  if (!energyDeficit.value) return false
  const lvl = getLevel(id)
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

const buildProgressStyle = (id) => {
  const state = playerBuildings.value[id]
  if (!state?.buildEndsAt) return {}
  const buildTime = BUILDINGS[id]?.levels[getLevel(id)]?.buildTime ?? 1
  const pct = Math.min(100, Math.max(0, (1 - (state.buildEndsAt - now.value) / (buildTime * buildTimeFactor.value * 1000)) * 100))
  return { width: `${pct}%` }
}

// (homeSystem computed is declared near the top of the singleton state)

// ── Recon Drones (home system planet scouting) ────────────
// playerScannedPlanets: planets whose info has been revealed by a drone arriving
const playerScannedPlanets = ref([homePlanetId.value])
// Per-planet dock aliases (computed from active planet's dock)
const reconDroneInventory = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.reconDroneInventory ?? 0)
const reconDroneBuild     = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.reconDroneBuild ?? null)
const activeDroneMissions    = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeDroneMissions ?? [])
const allActiveDroneMissions = computed(() => Object.values(allPlanetStates.value).flatMap(s => s.dock?.activeDroneMissions ?? []))

const droneBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.recon_drone.buildTimeBase * buildTimeFactor.value)
)

const droneFlightTime = (planetId) => {
  const idx = homeSystem.value?.planets.findIndex(p => p.id === planetId) ?? 0
  return Math.ceil(60 * (idx + 1))
}

const droneFlightTimeBetween = (fromId, toId) => {
  const ps = homeSystem.value?.planets ?? []
  const fi = ps.findIndex(p => p.id === fromId)
  const ti = ps.findIndex(p => p.id === toId)
  const dist = Math.max(1, Math.abs(fi - ti))
  return Math.ceil(60 * dist)
}

const canBuildDrone = computed(() =>
  reconDroneLevel.value > 0 &&
  !reconDroneBuild.value &&
  canAfford(UNIT_COSTS.recon_drone.cost)
)

const buildReconDrone = () => {
  if (!canBuildDrone.value) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  const res = allPlanetStates.value[activePlanetId.value].resources
  for (const [r, amt] of Object.entries(UNIT_COSTS.recon_drone.cost)) {
    res[r] -= amt
  }
  dock.reconDroneBuild = { endsAt: Date.now() + droneBuildTime.value * 1000, startedAt: Date.now() }
}

const canSendDrone = (planetId) =>
  reconDroneInventory.value > 0 &&
  !playerScannedPlanets.value.includes(planetId) &&
  !activeDroneMissions.value.find(m => m.planetId === planetId) &&
  activeDroneMissions.value.length < 1

const sendReconDrone = (planetId, fromPlanetId) => {
  if (!canSendDrone(planetId)) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  dock.reconDroneInventory -= 1
  const ft = fromPlanetId ? droneFlightTimeBetween(fromPlanetId, planetId) : droneFlightTime(planetId)
  dock.activeDroneMissions.push({ planetId, endsAt: Date.now() + ft * 1000, startedAt: Date.now() })
}

const remainingDroneSec = (planetId) => {
  const m = allActiveDroneMissions.value.find(m => m.planetId === planetId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

const droneProgressStyle = (planetId) => {
  const m = allActiveDroneMissions.value.find(m => m.planetId === planetId)
  if (!m) return {}
  const ft = droneFlightTime(planetId)
  return { animationDuration: `${ft}s` }
}

const droneBuildProgressStyle = computed(() => {
  const build = reconDroneBuild.value
  if (!build) return {}
  const pct = Math.min(100, Math.max(0, (now.value - build.startedAt) / (build.endsAt - build.startedAt) * 100))
  return { width: `${pct}%` }
})


// ── Colony Ships (home system colonization) ────────────────
const playerColonizedPlanets = ref([homePlanetId.value])
// Per-planet dock aliases
const colonyShipInventory  = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.colonyShipInventory ?? 0)
const colonyShipBuild      = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.colonyShipBuild ?? null)
const activeColonyMissions    = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeColonyMissions ?? [])
const allActiveColonyMissions = computed(() => Object.values(allPlanetStates.value).flatMap(s => s.dock?.activeColonyMissions ?? []))

const colonyShipBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.colony_ship.buildTimeBase / Math.max(1, colonyShipLevel.value) * buildTimeFactor.value)
)

const colonyFlightTime = (planetId) => {
  const idx = homeSystem.value?.planets.findIndex(p => p.id === planetId) ?? 0
  return Math.ceil(120 * (idx + 1) / Math.max(1, colonyShipLevel.value))
}

const colonyFlightTimeBetween = (fromId, toId) => {
  const ps = homeSystem.value?.planets ?? []
  const fi = ps.findIndex(p => p.id === fromId)
  const ti = ps.findIndex(p => p.id === toId)
  const dist = Math.max(1, Math.abs(fi - ti))
  return Math.ceil(120 * dist / Math.max(1, colonyShipLevel.value))
}

const canBuildColonyShip = computed(() =>
  colonyShipLevel.value > 0 &&
  !colonyShipBuild.value &&
  canAfford(UNIT_COSTS.colony_ship.cost)
)

const buildColonyShip = () => {
  if (!canBuildColonyShip.value) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  const res = allPlanetStates.value[activePlanetId.value].resources
  for (const [r, amt] of Object.entries(UNIT_COSTS.colony_ship.cost)) {
    res[r] -= amt
  }
  dock.colonyShipBuild = { endsAt: Date.now() + colonyShipBuildTime.value * 1000, startedAt: Date.now() }
}

const canSendColonyShip = (planetId) => {
  const planet = homeSystem.value?.planets.find(p => p.id === planetId)
  return (
    colonyShipInventory.value > 0 &&
    !!planet &&
    planetId !== homePlanetId.value &&
    planet.state === 'uncolonized' &&
    playerScannedPlanets.value.includes(planetId) &&
    !playerColonizedPlanets.value.includes(planetId) &&
    !activeColonyMissions.value.find(m => m.planetId === planetId) &&
    activeColonyMissions.value.length < Math.max(1, colonyShipLevel.value)
  )
}

const sendColonyShip = (planetId, fromPlanetId) => {
  if (!canSendColonyShip(planetId)) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  dock.colonyShipInventory -= 1
  const ft = fromPlanetId ? colonyFlightTimeBetween(fromPlanetId, planetId) : colonyFlightTime(planetId)
  dock.activeColonyMissions.push({ planetId, endsAt: Date.now() + ft * 1000, startedAt: Date.now() })
}

const remainingColonySec = (planetId) => {
  const m = allActiveColonyMissions.value.find(m => m.planetId === planetId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

const colonyProgressStyle = (planetId) => {
  const m = allActiveColonyMissions.value.find(m => m.planetId === planetId)
  if (!m) return {}
  const ft      = colonyFlightTime(planetId)
  return { animationDuration: `${ft}s` }
}

const colonyShipBuildProgressStyle = computed(() => {
  const build = colonyShipBuild.value
  if (!build) return {}
  const pct = Math.min(100, Math.max(0, (now.value - build.startedAt) / (build.endsAt - build.startedAt) * 100))
  return { width: `${pct}%` }
})

// Helper: storage caps for any planet (used when delivering cargo)
const maxStorageForPlanet = (planetId) => {
  const pb = allPlanetStates.value[planetId]?.buildings ?? {}
  const caps = { ...BASE_STORAGE }
  for (const [id, state] of Object.entries(pb)) {
    if (state.level === 0) continue
    const storage = BUILDINGS[id]?.levels[state.level - 1]?.storageCapacity ?? {}
    for (const [res, cap] of Object.entries(storage)) {
      caps[res] = (caps[res] ?? 0) + cap
    }
  }
  return caps
}

const getPlanetName      = (planetId) => allPlanetStates.value[planetId]?.planetName ?? '?'
const getPlanetResources = (planetId) => allPlanetStates.value[planetId]?.resources ?? {}

const planetHasDock = (planetId) =>
  (allPlanetStates.value[planetId]?.slots ?? []).some(s => s.tileType === 'dock' && s.unlocked)


// ── Communication ─────────────────────────────────────────

const interstellarCommLevel = computed(() =>
  globalResearch.value['interstellar_comm']?.level ?? 0
)

// Signal travel time in seconds between the player's home system and a target system.
// Distance is Euclidean on the 0–100 coordinate grid.
const signalTravelTime = (targetSystemId) => {
  const home = GALAXY_SYSTEMS.find(s => s.id === homeSystemId.value)
  const target = GALAXY_SYSTEMS.find(s => s.id === targetSystemId)
  if (!home || !target) return SIGNAL_SPEED_BASE
  const dist = Math.sqrt(Math.pow(target.x - home.x, 2) + Math.pow(target.y - home.y, 2))
  const factor = interstellarCommLevel.value >= 2 ? 0.5 : 1
  return Math.max(10, Math.round(dist * factor * buildTimeFactor.value))
}

const canScanSystem = (systemId) => {
  if (interstellarCommLevel.value < 1) return false
  const contact = systemContacts.value[systemId]
  return contact?.scanState === 'unscanned'
}

const scanSystem = (systemId) => {
  if (!canScanSystem(systemId)) return
  const travelSec = signalTravelTime(systemId)
  systemContacts.value[systemId] = {
    scanState:  'scanning',
    scanEndsAt: Date.now() + travelSec * 1000,
  }
}

const canMessageSystem = (systemId) =>
  interstellarCommLevel.value >= 1 &&
  systemContacts.value[systemId]?.scanState === 'scanned'

const sendMessage = (systemId, messageKey) => {
  if (!canMessageSystem(systemId)) return
  const sys = GALAXY_SYSTEMS.find(s => s.id === systemId)
  if (!sys) return
  const travelSec = signalTravelTime(systemId)
  const id = `msg_${Date.now()}_${systemId}`
  commLog.value.unshift({
    id,
    direction:    'sent',
    systemId,
    systemName:   sys.name,
    factions:     sys.factions ?? [],
    messageKey,
    timestamp:    Date.now(),
    travelEndsAt: Date.now() + travelSec * 1000,
    replyEndsAt:  null,
  })
}

// Called from the tick when a sent message's signal arrives.
const _deliverMessage = (entry) => {
  const sys = GALAXY_SYSTEMS.find(s => s.id === entry.systemId)
  const factions = sys?.factions ?? []
  // Each faction sends a reply after the same travel time back
  for (const faction of factions) {
    const pool = NPC_RESPONSES[faction.disposition] ?? NPC_RESPONSES.neutral
    const responseKey = pool[Math.floor(Math.random() * pool.length)]
    const travelSec = signalTravelTime(entry.systemId)
    commLog.value.unshift({
      id:           `msg_${Date.now()}_reply_${faction.name}`,
      direction:    'received',
      systemId:     entry.systemId,
      systemName:   sys.name,
      factions:     [faction],
      messageKey:   responseKey,
      timestamp:    Date.now(),
      travelEndsAt: Date.now() + travelSec * 1000,
      replyEndsAt:  null,
    })
  }
  entry.replyEndsAt = entry.travelEndsAt // mark delivered
}


// ── Conversion Queues (High-Tech / Refinery) ───────────────
// Per-planet array of independent running jobs.
// Each job: { buildingId, recipeIndex, planetId, endsAt, remaining }
// Different recipes run in parallel; same recipe adds to 'remaining'.

const conversionQueues = computed(() =>
  allPlanetStates.value[activePlanetId.value]?.conversionQueues ?? []
)

// Compute conversion time using a specific planet's building level (for tick)
const conversionTimeForPlanet = (buildingId, recipeIndex, planetId) => {
  const recipe = BUILDINGS[buildingId]?.conversions?.[recipeIndex]
  if (!recipe) return 0
  const lvl = allPlanetStates.value[planetId]?.buildings[buildingId]?.level ?? 0
  const throughput = Math.pow(2, lvl - 1) // lv1→1×, lv2→2×, lv3→4×
  return Math.ceil(recipe.durationBase / Math.max(1, throughput) * buildTimeFactor.value)
}

const conversionTime = (buildingId, recipeIndex) =>
  conversionTimeForPlanet(buildingId, recipeIndex, activePlanetId.value)

// Max batch size the player can queue (based on active planet's building level)
const conversionMaxBatch = (buildingId) => {
  const lvl = getLevel(buildingId)
  if (lvl >= 3) return 20
  if (lvl >= 2) return 10
  return 1
}

const isConversionRunning = (buildingId, recipeIndex) =>
  conversionQueues.value.some(q => q.buildingId === buildingId && q.recipeIndex === recipeIndex)

// canConvert: checks level/lock/affordability for starting a new job
const canConvert = (buildingId, recipeIndex) => {
  const recipe = BUILDINGS[buildingId]?.conversions?.[recipeIndex]
  if (!recipe) return false
  const lvl = getLevel(buildingId)
  if (lvl === 0) return false
  if (recipe.requiresLevel && lvl < recipe.requiresLevel) return false
  return canAfford(recipe.input)
}

// count: total runs to queue. If recipe already running → adds to remaining.
const startConversion = (buildingId, recipeIndex, count = 1) => {
  const planetId = activePlanetId.value
  const queues   = allPlanetStates.value[planetId]?.conversionQueues
  if (!queues) return

  const existing = queues.find(q => q.buildingId === buildingId && q.recipeIndex === recipeIndex)
  if (existing) {
    // Already running — just stack more runs (resources deducted lazily in tick)
    existing.remaining += count
    return
  }

  if (!canConvert(buildingId, recipeIndex)) return
  const recipe = BUILDINGS[buildingId].conversions[recipeIndex]
  const res    = allPlanetStates.value[planetId].resources
  for (const [r, amt] of Object.entries(recipe.input)) {
    res[r] -= amt
  }
  queues.push({
    buildingId,
    recipeIndex,
    planetId,
    endsAt:    Date.now() + conversionTime(buildingId, recipeIndex) * 1000,
    remaining: Math.max(0, count - 1),
  })
}

const remainingConversionSec = (q) =>
  Math.max(0, Math.ceil((q.endsAt - now.value) / 1000))

const conversionProgressStyle = (q) => {
  const ct = conversionTimeForPlanet(q.buildingId, q.recipeIndex, q.planetId)
  const startedAt = q.endsAt - ct * 1000
  const pct = Math.min(100, Math.max(0, (now.value - startedAt) / (ct * 1000) * 100))
  return { width: `${pct}%` }
}

// ── LocalStorage persistence ───────────────────────────────
const DEV_KEY = 'hawk-star-dev'

const saveDevSettings = () => {
  localStorage.setItem(DEV_KEY, JSON.stringify({
    tickRateMs:      tickRateMs.value,
    buildTimeFactor: buildTimeFactor.value,
  }))
}

const loadDevSettings = () => {
  try {
    const raw = localStorage.getItem(DEV_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.tickRateMs)      tickRateMs.value      = data.tickRateMs
    if (data.buildTimeFactor) buildTimeFactor.value = data.buildTimeFactor
  } catch { /* ignore */ }
}

loadDevSettings()

const SAVE_KEY     = 'hawk-star-save'
const SAVE_VERSION = 22

const saveGame = () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version:               SAVE_VERSION,
    savedAt:               Date.now(),
    playerName:            playerName.value,
    systemName:            systemName.value,
    homeSystemId:          homeSystemId.value,
    homePlanetId:          homePlanetId.value,
    activePlanetId:        activePlanetId.value,
    allPlanetStates:       Object.fromEntries(
      Object.entries(allPlanetStates.value).map(([pid, ps]) => [pid, {
        planetType:       ps.planetType,
        planetName:       ps.planetName,
        resources:        ps.resources,
        slots:            ps.slots.map(s => ({ slot: s.slot, unlocked: s.unlocked })),
        buildings:        ps.buildings,
        dock:             ps.dock,
        conversionQueues: ps.conversionQueues ?? [],
      }])
    ),
    playerScannedPlanets:   playerScannedPlanets.value,
    playerColonizedPlanets: playerColonizedPlanets.value,
    notifications:          notifications.value,
    globalResearch:         globalResearch.value,
    systemContacts:         systemContacts.value,
    commLog:                commLog.value,
  }))
}

const loadGame = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    // Discard saves from an older format (before unit inventory system)
    if ((data.version ?? 1) < SAVE_VERSION) {
      localStorage.removeItem(SAVE_KEY)
      return
    }
    if (data.playerName)   playerName.value   = data.playerName
    if (data.systemName)   systemName.value   = data.systemName
    if (data.homeSystemId) homeSystemId.value = data.homeSystemId
    if (data.homePlanetId) homePlanetId.value = data.homePlanetId
    if (data.allPlanetStates) {
      for (const [pid, ps] of Object.entries(data.allPlanetStates)) {
        const freshSlots     = PLANET_GRID.map(s => ({ ...s, unlocked: s.startsUnlocked }))
        const freshBuildings = Object.fromEntries(Object.keys(BUILDINGS).map(id => [id, { level: 0, buildEndsAt: null }]))
        const isHome = pid === (data.homePlanetId ?? homePlanetId.value)
        const savedDock = ps.dock ?? {}
        allPlanetStates.value[pid] = {
          planetType: ps.planetType ?? 'terrestrial',
          planetName: ps.planetName ?? '',
          resources:  ps.resources ?? (isHome ? { ...HOME_START_RESOURCES } : { ...COLONY_START_RESOURCES }),
          slots: freshSlots.map(s => {
            const saved = ps.slots?.find(ps2 => ps2.slot === s.slot)
            return saved ? { ...s, unlocked: saved.unlocked } : s
          }),
          buildings: Object.fromEntries(
            Object.keys(BUILDINGS).map(id => [id, ps.buildings?.[id] ?? freshBuildings[id]])
          ),
          dock: {
            ...freshDock(),
            ...savedDock,
            activeDroneMissions:    Array.isArray(savedDock.activeDroneMissions)    ? savedDock.activeDroneMissions    : [],
            activeColonyMissions:   Array.isArray(savedDock.activeColonyMissions)   ? savedDock.activeColonyMissions   : [],
          },
          conversionQueues: Array.isArray(ps.conversionQueues) ? ps.conversionQueues : [],
        }
      }
    }
    // Backward compat: migrate old global conversionQueue into per-planet array
    if (data.conversionQueue) {
      const q  = data.conversionQueue
      const ps = allPlanetStates.value[q.planetId]
      if (ps && !ps.conversionQueues.find(x => x.buildingId === q.buildingId && x.recipeIndex === q.recipeIndex)) {
        ps.conversionQueues.push(q)
      }
    }
    if (data.activePlanetId && allPlanetStates.value[data.activePlanetId]) {
      activePlanetId.value = data.activePlanetId
    }
    if (Array.isArray(data.playerScannedPlanets))   playerScannedPlanets.value   = data.playerScannedPlanets
    if (Array.isArray(data.playerColonizedPlanets))  playerColonizedPlanets.value = data.playerColonizedPlanets
    if (Array.isArray(data.notifications))           notifications.value          = data.notifications
    if (data.globalResearch) {
      for (const id of Object.keys(globalResearch.value)) {
        if (data.globalResearch[id]) globalResearch.value[id] = data.globalResearch[id]
      }
    }
    if (data.systemContacts) {
      for (const [sysId, contact] of Object.entries(data.systemContacts)) {
        if (systemContacts.value[sysId]) systemContacts.value[sysId] = contact
      }
    }
    if (Array.isArray(data.commLog)) commLog.value = data.commLog

    // Offline production — apply missed ticks since last save
    if (data.savedAt) {
      const offlineMs    = Math.min(Date.now() - data.savedAt, MAX_OFFLINE_MS)
      const offlineTicks = Math.floor(offlineMs / tickRateMs.value)
      applyOfflineProduction(offlineTicks)
    }
    // Prevent first live tick from double-firing production
    lastProdAt = Date.now()
  } catch (e) {
    console.warn('[hawk-star] Failed to load save:', e)
  }
}

export const resetGame = () => {
  localStorage.removeItem(SAVE_KEY)
  location.reload()
}

export const completeSetup = (name) => {
  playerName.value = name.trim()
  saveGame()
}

// ── Offline production ─────────────────────────────────────
const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000

const applyOfflineProduction = (ticks) => {
  if (ticks <= 0) return

  for (const [, pstate] of Object.entries(allPlanetStates.value)) {
    const pb = pstate.buildings
    const pr = pstate.resources

    // Gross production per tick
    const prod = {}
    for (const [id, state] of Object.entries(pb)) {
      if (state.level === 0) continue
      const levelDef = BUILDINGS[id]?.levels[state.level - 1]
      for (const [res, amt] of Object.entries(levelDef?.production ?? {})) {
        prod[res] = (prod[res] ?? 0) + amt
      }
    }

    // Energy drain
    let energyDrain = 0
    for (const [id, state] of Object.entries(pb)) {
      const lvl = effectiveLevel(state)
      if (lvl === 0) continue
      energyDrain += BUILDINGS[id]?.levels[lvl - 1]?.energyDrain ?? 0
    }

    // Storage caps
    const caps = { ...BASE_STORAGE }
    for (const [id, state] of Object.entries(pb)) {
      if (state.level === 0) continue
      const storage = BUILDINGS[id]?.levels[state.level - 1]?.storageCapacity ?? {}
      for (const [res, cap] of Object.entries(storage)) {
        caps[res] = (caps[res] ?? 0) + cap
      }
    }

    // Net production (energy goes negative but is floored at 0, not stockpiled)
    const net = { ...prod, energy: (prod.energy ?? 0) - energyDrain }
    for (const [res, amt] of Object.entries(net)) {
      if (res === 'energy') continue
      if (amt === 0) continue
      const cap = caps[res]
      const newVal = Math.max(0, (pr[res] ?? 0) + amt * ticks)
      pr[res] = cap !== undefined ? Math.min(newVal, cap) : newVal
    }
  }
}

// ── Tick ───────────────────────────────────────────────────
const tick = () => {
  now.value = Date.now()
  const doProd = (now.value - lastProdAt) >= tickRateMs.value
  if (doProd) lastProdAt = now.value

  // Process all per-planet conversion queues
  for (const [pid, pstate] of Object.entries(allPlanetStates.value)) {
    const cqs = pstate.conversionQueues
    if (!cqs?.length) continue
    for (let i = cqs.length - 1; i >= 0; i--) {
      const q = cqs[i]
      if (q.endsAt > now.value) continue
      const recipe = BUILDINGS[q.buildingId]?.conversions?.[q.recipeIndex]
      if (!recipe) { cqs.splice(i, 1); continue }
      const res = pstate.resources
      for (const [r, amt] of Object.entries(recipe.output)) {
        res[r] = (res[r] ?? 0) + amt
      }
      if (q.remaining > 0) {
        let affordable = true
        for (const [r, amt] of Object.entries(recipe.input)) {
          if ((res[r] ?? 0) < amt) { affordable = false; break }
        }
        if (affordable) {
          for (const [r, amt] of Object.entries(recipe.input)) { res[r] -= amt }
          q.endsAt = now.value + conversionTimeForPlanet(q.buildingId, q.recipeIndex, pid) * 1000
          q.remaining -= 1
        } else {
          cqs.splice(i, 1)
        }
      } else {
        cqs.splice(i, 1)
      }
    }
  }

  // Complete building upgrades + resource production + dock for ALL planets
  for (const [pid, pstate] of Object.entries(allPlanetStates.value)) {
    // ── Dock processing ───────────────────────────────────
    const dock = pstate.dock
    if (dock) {
      // Recon drone build
      if (dock.reconDroneBuild && dock.reconDroneBuild.endsAt <= now.value) {
        dock.reconDroneInventory += 1
        dock.reconDroneBuild = null
        notifications.value.push({ id: `notif_${Date.now()}_unit_${pid}_drone`, type: 'unit_done', icon: '🛸', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.droneReady', timestamp: Date.now() })
      }
      // Recon drone missions → reveal planet
      for (let i = dock.activeDroneMissions.length - 1; i >= 0; i--) {
        const m = dock.activeDroneMissions[i]
        if (m.endsAt <= now.value) {
          if (!playerScannedPlanets.value.includes(m.planetId)) playerScannedPlanets.value.push(m.planetId)
          const tgt = homeSystem.value?.planets.find(p => p.id === m.planetId)?.name ?? m.planetId
          notifications.value.push({ id: `notif_${Date.now()}_msn_${pid}_drone_${m.planetId}`, type: 'mission_done', icon: '🛸', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.droneReturned', details: `→ ${tgt}`, timestamp: Date.now() })
          dock.activeDroneMissions.splice(i, 1)
        }
      }
      // Colony ship build
      if (dock.colonyShipBuild && dock.colonyShipBuild.endsAt <= now.value) {
        dock.colonyShipInventory += 1
        dock.colonyShipBuild = null
        notifications.value.push({ id: `notif_${Date.now()}_unit_${pid}_colony`, type: 'unit_done', icon: '🚀', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.colonyReady', timestamp: Date.now() })
      }
      // Colony missions → colonize planet
      for (let i = dock.activeColonyMissions.length - 1; i >= 0; i--) {
        const m = dock.activeColonyMissions[i]
        if (m.endsAt <= now.value) {
          if (!playerColonizedPlanets.value.includes(m.planetId)) {
            playerColonizedPlanets.value.push(m.planetId)
            const planet = homeSystem.value?.planets.find(p => p.id === m.planetId)
            if (planet) {
              const pType = planet.type
              initializePlanetState(m.planetId, pType, planet.name)
            }
          }
          const tgt = homeSystem.value?.planets.find(p => p.id === m.planetId)?.name ?? m.planetId
          notifications.value.push({ id: `notif_${Date.now()}_msn_${pid}_colony_${m.planetId}`, type: 'mission_done', icon: '🌍', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.colonyLanded', details: `→ ${tgt}`, timestamp: Date.now() })
          dock.activeColonyMissions.splice(i, 1)
        }
      }
    }
    const pb = pstate.buildings
    const pr = pstate.resources

    // Complete builds (skip global buildings — handled separately)
    for (const [id, state] of Object.entries(pb)) {
      if (BUILDINGS[id]?.global) continue
      if (!state.buildEndsAt || state.buildEndsAt > now.value) continue
      state.level += 1
      state.buildEndsAt = null
      state.buildStartedAt = null
      const levelDef = BUILDINGS[id]?.levels[state.level - 1]
      if (levelDef?.unlocks) {
        for (const { slot } of levelDef.unlocks) {
          const s = pstate.slots.find(ps => ps.slot === slot)
          if (s) s.unlocked = true
        }
      }
      notifications.value.push({
        id:         `notif_${Date.now()}_bld_${pid}_${id}`,
        type:       'building_done',
        icon:       '🏛️',
        planetId:   pid,
        planetName: pstate.planetName,
        buildingId: id,
        level:      state.level,
        labelKey:    'hawkStar.notifications.buildComplete',
        labelParams: { name: BUILDINGS[id]?.name ?? id, level: state.level },
        timestamp:  Date.now(),
      })
    }

    if (doProd) {
      // Production: gross output
      const prod = {}
      for (const [id, state] of Object.entries(pb)) {
        if (state.level === 0) continue
        const levelDef = BUILDINGS[id]?.levels[state.level - 1]
        for (const [res, amt] of Object.entries(levelDef?.production ?? {})) {
          prod[res] = (prod[res] ?? 0) + amt
        }
      }
      // Energy drain
      let energyDrain = 0
      for (const [id, state] of Object.entries(pb)) {
        const lvl = effectiveLevel(state)
        if (lvl === 0) continue
        energyDrain += BUILDINGS[id]?.levels[lvl - 1]?.energyDrain ?? 0
      }
      // Storage caps
      const caps = { ...BASE_STORAGE }
      for (const [id, state] of Object.entries(pb)) {
        if (state.level === 0) continue
        const storage = BUILDINGS[id]?.levels[state.level - 1]?.storageCapacity ?? {}
        for (const [res, cap] of Object.entries(storage)) {
          caps[res] = (caps[res] ?? 0) + cap
        }
      }
      // Apply net production
      const net = { ...prod, energy: (prod.energy ?? 0) - energyDrain }
      for (const [res, amt] of Object.entries(net)) {
        const cap = caps[res]
        const newVal = Math.max(0, (pr[res] ?? 0) + amt)
        pr[res] = cap !== undefined ? Math.min(newVal, cap) : newVal
      }
    }
  }

  // Complete global research (star_map and any future global buildings)
  for (const [id, state] of Object.entries(globalResearch.value)) {
    if (!state.buildEndsAt || state.buildEndsAt > now.value) continue
    state.level += 1
    state.buildEndsAt    = null
    state.buildStartedAt = null
    notifications.value.push({
      id:         `notif_${Date.now()}_research_${id}`,
      type:       'building_done',
      icon:       '🔭',
      planetId:   null,
      planetName: null,
      buildingId: id,
      level:      state.level,
      labelKey:    'hawkStar.notifications.researchComplete',
      labelParams: { name: BUILDINGS[id]?.name ?? id, level: state.level },
      timestamp:  Date.now(),
    })
  }

  // ── Communication tick ────────────────────────────────────
  // Resolve completed scan signals
  for (const [sysId, contact] of Object.entries(systemContacts.value)) {
    if (contact.scanState === 'scanning' && contact.scanEndsAt <= now.value) {
      contact.scanState  = 'scanned'
      contact.scanEndsAt = null
      const sys = GALAXY_SYSTEMS.find(s => s.id === sysId)
      notifications.value.push({
        id:        `notif_${Date.now()}_scan_${sysId}`,
        type:      'scan_done',
        icon:      '📶',
        planetId:  null,
        planetName: null,
        labelKey:  'hawkStar.comm.scanComplete',
        labelParams: { system: sys?.name ?? sysId },
        timestamp: Date.now(),
      })
    }
  }
  // Deliver sent messages (signal arrived → queue NPC reply)
  for (const entry of commLog.value) {
    if (entry.direction === 'sent' && entry.replyEndsAt === null && entry.travelEndsAt <= now.value) {
      _deliverMessage(entry)
    }
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
    playerName,
    planetName,
    systemName,
    planetType,
    homeSystemId,
    homePlanetId,
    homeSystem,
    isFirstRun,
    activePlanetId,
    setActivePlanet,
    PLANET_TYPES,
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
    isBuildingLocked,
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
    // navigation
    starMapLevel,
    // space tech
    spaceTechLevel,
    reconDroneLevel,
    colonyShipLevel,
    // recon drones
    playerScannedPlanets,
    reconDroneInventory,
    reconDroneBuild,
    activeDroneMissions,
    allActiveDroneMissions,
    droneBuildTime,
    canBuildDrone,
    buildReconDrone,
    canSendDrone,
    sendReconDrone,
    droneFlightTime,
    remainingDroneSec,
    droneProgressStyle,
    droneBuildProgressStyle,
    droneFlightTimeBetween,
    // colony ships
    playerColonizedPlanets,
    colonyShipInventory,
    colonyShipBuild,
    activeColonyMissions,
    allActiveColonyMissions,
    colonyShipBuildTime,
    canBuildColonyShip,
    buildColonyShip,
    canSendColonyShip,
    sendColonyShip,
    colonyFlightTime,
    remainingColonySec,
    colonyProgressStyle,
    colonyShipBuildProgressStyle,
    colonyFlightTimeBetween,
    getPlanetName,
    getPlanetResources,
    planetHasDock,
    // grid
    unlockRequirement,
    slotsOnSlot,
    // time
    remainingSec,
    formatTime,
    buildProgressStyle,
    // unit costs (for UI display)
    UNIT_COSTS,
    // conversions
    conversionQueues,
    conversionTime,
    conversionMaxBatch,
    isConversionRunning,
    canConvert,
    startConversion,
    remainingConversionSec,
    conversionProgressStyle,
    // notifications
    allPlanetStates,
    notifications,
    dismissNotification,
    // communication
    interstellarCommLevel,
    systemContacts,
    commLog,
    canScanSystem,
    scanSystem,
    canMessageSystem,
    sendMessage,
    signalTravelTime,
    COMM_EMOJIS,
    // dev tuning
    tickRateMs,
    buildTimeFactor,
    saveDevSettings,
  }
}
