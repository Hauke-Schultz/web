import { ref, computed } from 'vue'
import { TILE_TYPES, PLANET_GRID, BUILDINGS, UNIT_COSTS, CROP_DEFS } from './hawkStarConfig.js'
import { GALAXY_SYSTEMS } from './hawkStarGalaxyMock.js'

// ── Starting planet pool ───────────────────────────────────
const START_CONFIGS = [
  { system: 'Kepler System',  planet: 'Kepler Prime'    },
  { system: 'Vega-9',         planet: 'Vega Reach'      },
  { system: 'Tau Ceti',       planet: 'Ceti Alpha'      },
  { system: 'Proxima Ring',   planet: 'Proxima III'     },
  { system: 'Sirius Reach',   planet: 'Sirius Outpost'  },
  { system: 'Aether Prime',   planet: 'Aethon'          },
  { system: 'Nova Horus',     planet: 'Horus Station'   },
  { system: 'Mira Delta',     planet: 'Mira IV'         },
  { system: 'Helion Belt',    planet: 'Helion Base'     },
  { system: 'Cygnus Deep',    planet: 'Cygnus Outpost'  },
]

const randomStartConfig = () =>
  START_CONFIGS[Math.floor(Math.random() * START_CONFIGS.length)]

// ── Singleton state ────────────────────────────────────────
const playerName  = ref('')
const homeConfig  = ref(randomStartConfig())
const planetName  = ref(homeConfig.value.planet)
const systemName  = ref(homeConfig.value.system)
const isFirstRun  = computed(() => playerName.value === '')

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

const starMapLevel = computed(() => {
  const state = playerBuildings.value['star_map']
  return state ? effectiveLevel(state) : 0
})
const spaceTechLevel = computed(() => {
  const state = playerBuildings.value['space_tech']
  return state ? effectiveLevel(state) : 0
})
const reconDroneLevel = computed(() => {
  const state = playerBuildings.value['recon_drone']
  return state ? effectiveLevel(state) : 0
})
const galaxyProbeLevel = computed(() => {
  const state = playerBuildings.value['galaxy_probe']
  return state ? effectiveLevel(state) : 0
})
const colonyShipLevel = computed(() => {
  const state = playerBuildings.value['colony_ship']
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

// ── Home system reference ──────────────────────────────────
const HOME_SYSTEM = GALAXY_SYSTEMS.find(s => s.home)

// ── Recon Drones (home system planet scouting) ────────────
// playerScannedPlanets: planets whose info has been revealed by a drone arriving
const playerScannedPlanets = ref(['kepler_prime'])
const reconDroneInventory  = ref(0)
const reconDroneBuild      = ref(null)  // { endsAt } | null
const activeDroneMissions  = ref([])    // [{ planetId, endsAt }]

const droneBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.recon_drone.buildTimeBase / Math.max(1, reconDroneLevel.value))
)

const droneFlightTime = (planetId) => {
  const idx = HOME_SYSTEM?.planets.findIndex(p => p.id === planetId) ?? 0
  return Math.ceil(60 * (idx + 1) / Math.max(1, reconDroneLevel.value))
}

const canBuildDrone = computed(() =>
  reconDroneLevel.value > 0 &&
  !reconDroneBuild.value &&
  canAfford(UNIT_COSTS.recon_drone.cost)
)

const buildReconDrone = () => {
  if (!canBuildDrone.value) return
  for (const [res, amt] of Object.entries(UNIT_COSTS.recon_drone.cost)) {
    playerResources.value[res] -= amt
  }
  reconDroneBuild.value = { endsAt: Date.now() + droneBuildTime.value * 1000 }
}

const canSendDrone = (planetId) =>
  reconDroneInventory.value > 0 &&
  !playerScannedPlanets.value.includes(planetId) &&
  !activeDroneMissions.value.find(m => m.planetId === planetId) &&
  activeDroneMissions.value.length < reconDroneLevel.value

const sendReconDrone = (planetId) => {
  if (!canSendDrone(planetId)) return
  reconDroneInventory.value -= 1
  activeDroneMissions.value.push({ planetId, endsAt: Date.now() + droneFlightTime(planetId) * 1000 })
}

const remainingDroneSec = (planetId) => {
  const m = activeDroneMissions.value.find(m => m.planetId === planetId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

const droneProgressStyle = (planetId) => {
  const m = activeDroneMissions.value.find(m => m.planetId === planetId)
  if (!m) return {}
  const ft = droneFlightTime(planetId)
  const elapsed = Math.max(0, (Date.now() - (m.endsAt - ft * 1000)) / 1000)
  return { animationDuration: `${ft}s`, animationDelay: `-${elapsed}s` }
}

const droneBuildProgressStyle = computed(() => {
  if (!reconDroneBuild.value) return {}
  const bt = droneBuildTime.value
  const elapsed = Math.max(0, (Date.now() - (reconDroneBuild.value.endsAt - bt * 1000)) / 1000)
  return { animationDuration: `${bt}s`, animationDelay: `-${elapsed}s` }
})

// ── Galaxy Probes (remote system scouting) ─────────────────
const HOME_SYSTEM_REF = GALAXY_SYSTEMS.find(s => s.home)
const PROBE_SPEED     = 0.4 // map-units per second at level 1

const playerProbedSystems  = ref(['kepler'])
const galaxyProbeInventory = ref(0)
const galaxyProbeBuild     = ref(null)  // { endsAt } | null
const activeGalaxyProbes   = ref([])    // [{ systemId, endsAt }]

const probeBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.galaxy_probe.buildTimeBase / Math.max(1, galaxyProbeLevel.value))
)

const probeFlightTime = (systemId) => {
  const sys = GALAXY_SYSTEMS.find(s => s.id === systemId)
  if (!sys || sys.home) return 0
  const dx   = sys.x - HOME_SYSTEM_REF.x
  const dy   = sys.y - HOME_SYSTEM_REF.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  return Math.ceil(dist / (PROBE_SPEED * Math.max(1, galaxyProbeLevel.value)))
}

const canBuildProbe = computed(() =>
  galaxyProbeLevel.value > 0 &&
  !galaxyProbeBuild.value &&
  canAfford(UNIT_COSTS.galaxy_probe.cost)
)

const buildGalaxyProbe = () => {
  if (!canBuildProbe.value) return
  for (const [res, amt] of Object.entries(UNIT_COSTS.galaxy_probe.cost)) {
    playerResources.value[res] -= amt
  }
  galaxyProbeBuild.value = { endsAt: Date.now() + probeBuildTime.value * 1000 }
}

const canSendProbe = (systemId) =>
  galaxyProbeInventory.value > 0 &&
  !playerProbedSystems.value.includes(systemId) &&
  !activeGalaxyProbes.value.find(p => p.systemId === systemId) &&
  activeGalaxyProbes.value.length < galaxyProbeLevel.value

const sendGalaxyProbe = (systemId) => {
  if (!canSendProbe(systemId)) return
  galaxyProbeInventory.value -= 1
  activeGalaxyProbes.value.push({ systemId, endsAt: Date.now() + probeFlightTime(systemId) * 1000 })
}

const remainingProbeSec = (systemId) => {
  const probe = activeGalaxyProbes.value.find(p => p.systemId === systemId)
  return probe ? Math.max(0, Math.ceil((probe.endsAt - now.value) / 1000)) : 0
}

const probeProgressStyle = (systemId) => {
  const probe = activeGalaxyProbes.value.find(p => p.systemId === systemId)
  if (!probe) return {}
  const ft      = probeFlightTime(systemId)
  const elapsed = Math.max(0, (Date.now() - (probe.endsAt - ft * 1000)) / 1000)
  return { animationDuration: `${ft}s`, animationDelay: `-${elapsed}s` }
}

const probeBuildProgressStyle = computed(() => {
  if (!galaxyProbeBuild.value) return {}
  const bt      = probeBuildTime.value
  const elapsed = Math.max(0, (Date.now() - (galaxyProbeBuild.value.endsAt - bt * 1000)) / 1000)
  return { animationDuration: `${bt}s`, animationDelay: `-${elapsed}s` }
})

// ── Colony Ships (home system colonization) ────────────────
const playerColonizedPlanets = ref(['kepler_prime'])
const colonyShipInventory    = ref(0)
const colonyShipBuild        = ref(null)  // { endsAt } | null
const activeColonyMissions   = ref([])    // [{ planetId, endsAt }]

const colonyShipBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.colony_ship.buildTimeBase / Math.max(1, colonyShipLevel.value))
)

const colonyFlightTime = (planetId) => {
  const idx = HOME_SYSTEM?.planets.findIndex(p => p.id === planetId) ?? 0
  return Math.ceil(120 * (idx + 1) / Math.max(1, colonyShipLevel.value))
}

const canBuildColonyShip = computed(() =>
  colonyShipLevel.value > 0 &&
  !colonyShipBuild.value &&
  canAfford(UNIT_COSTS.colony_ship.cost)
)

const buildColonyShip = () => {
  if (!canBuildColonyShip.value) return
  for (const [res, amt] of Object.entries(UNIT_COSTS.colony_ship.cost)) {
    playerResources.value[res] -= amt
  }
  colonyShipBuild.value = { endsAt: Date.now() + colonyShipBuildTime.value * 1000 }
}

const canSendColonyShip = (planetId) => {
  const planet = HOME_SYSTEM?.planets.find(p => p.id === planetId)
  return (
    colonyShipInventory.value > 0 &&
    !!planet &&
    !planet.isHome &&
    planet.state === 'uncolonized' &&
    playerScannedPlanets.value.includes(planetId) &&
    !playerColonizedPlanets.value.includes(planetId) &&
    !activeColonyMissions.value.find(m => m.planetId === planetId) &&
    activeColonyMissions.value.length < Math.max(1, colonyShipLevel.value)
  )
}

const sendColonyShip = (planetId) => {
  if (!canSendColonyShip(planetId)) return
  colonyShipInventory.value -= 1
  activeColonyMissions.value.push({ planetId, endsAt: Date.now() + colonyFlightTime(planetId) * 1000 })
}

const remainingColonySec = (planetId) => {
  const m = activeColonyMissions.value.find(m => m.planetId === planetId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

const colonyProgressStyle = (planetId) => {
  const m = activeColonyMissions.value.find(m => m.planetId === planetId)
  if (!m) return {}
  const ft      = colonyFlightTime(planetId)
  const elapsed = Math.max(0, (Date.now() - (m.endsAt - ft * 1000)) / 1000)
  return { animationDuration: `${ft}s`, animationDelay: `-${elapsed}s` }
}

const colonyShipBuildProgressStyle = computed(() => {
  if (!colonyShipBuild.value) return {}
  const bt      = colonyShipBuildTime.value
  const elapsed = Math.max(0, (Date.now() - (colonyShipBuild.value.endsAt - bt * 1000)) / 1000)
  return { animationDuration: `${bt}s`, animationDelay: `-${elapsed}s` }
})

// ── Crops (Agriculture tile) ───────────────────────────────
const cropInventory = ref(Object.fromEntries(Object.keys(CROP_DEFS).map(id => [id, 0])))
const cropQueue     = ref(null)  // { cropId, endsAt } | null

const cropGrowTime = (cropId) => {
  const crop = CROP_DEFS[cropId]
  if (!crop) return 0
  const lvl = effectiveLevel(playerBuildings.value[crop.requiresBuilding] ?? { level: 0, buildEndsAt: null })
  return Math.ceil(crop.growTimeBase / Math.max(1, lvl))
}

const canGrowCrop = (cropId) => {
  const crop = CROP_DEFS[cropId]
  if (!crop) return false
  const lvl = effectiveLevel(playerBuildings.value[crop.requiresBuilding] ?? { level: 0, buildEndsAt: null })
  return !cropQueue.value && lvl >= crop.requiresLevel && canAfford(crop.cost)
}

const startCropGrow = (cropId) => {
  if (!canGrowCrop(cropId)) return
  const crop = CROP_DEFS[cropId]
  for (const [res, amt] of Object.entries(crop.cost)) {
    playerResources.value[res] -= amt
  }
  cropQueue.value = { cropId, endsAt: Date.now() + cropGrowTime(cropId) * 1000 }
}

const remainingCropSec = computed(() =>
  cropQueue.value ? Math.max(0, Math.ceil((cropQueue.value.endsAt - now.value) / 1000)) : 0
)

const cropQueueProgressStyle = computed(() => {
  if (!cropQueue.value) return {}
  const gt      = cropGrowTime(cropQueue.value.cropId)
  const elapsed = Math.max(0, (Date.now() - (cropQueue.value.endsAt - gt * 1000)) / 1000)
  return { animationDuration: `${gt}s`, animationDelay: `-${elapsed}s` }
})

// ── LocalStorage persistence ───────────────────────────────
const SAVE_KEY     = 'hawk-star-save'
const SAVE_VERSION = 4

const saveGame = () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version:               SAVE_VERSION,
    playerName:            playerName.value,
    planetName:            planetName.value,
    systemName:            systemName.value,
    playerResources:       playerResources.value,
    playerSlots:           playerSlots.value.map(s => ({ slot: s.slot, unlocked: s.unlocked })),
    playerBuildings:       playerBuildings.value,
    playerScannedPlanets:  playerScannedPlanets.value,
    reconDroneInventory:   reconDroneInventory.value,
    reconDroneBuild:       reconDroneBuild.value,
    activeDroneMissions:   activeDroneMissions.value,
    playerProbedSystems:   playerProbedSystems.value,
    galaxyProbeInventory:  galaxyProbeInventory.value,
    galaxyProbeBuild:      galaxyProbeBuild.value,
    activeGalaxyProbes:    activeGalaxyProbes.value,
    playerColonizedPlanets: playerColonizedPlanets.value,
    colonyShipInventory:   colonyShipInventory.value,
    colonyShipBuild:       colonyShipBuild.value,
    activeColonyMissions:  activeColonyMissions.value,
    cropInventory:         cropInventory.value,
    cropQueue:             cropQueue.value,
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
    if (data.playerName)      playerName.value  = data.playerName
    if (data.planetName)      planetName.value  = data.planetName
    if (data.systemName)      systemName.value  = data.systemName
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
    if (Array.isArray(data.playerScannedPlanets))   playerScannedPlanets.value   = data.playerScannedPlanets
    if (typeof data.reconDroneInventory === 'number') reconDroneInventory.value   = data.reconDroneInventory
    if (data.reconDroneBuild)                        reconDroneBuild.value        = data.reconDroneBuild
    if (Array.isArray(data.activeDroneMissions))     activeDroneMissions.value    = data.activeDroneMissions
    if (Array.isArray(data.playerProbedSystems))     playerProbedSystems.value    = data.playerProbedSystems
    if (typeof data.galaxyProbeInventory === 'number') galaxyProbeInventory.value = data.galaxyProbeInventory
    if (data.galaxyProbeBuild)                       galaxyProbeBuild.value       = data.galaxyProbeBuild
    if (Array.isArray(data.activeGalaxyProbes))      activeGalaxyProbes.value     = data.activeGalaxyProbes
    if (Array.isArray(data.playerColonizedPlanets))  playerColonizedPlanets.value = data.playerColonizedPlanets
    if (typeof data.colonyShipInventory === 'number') colonyShipInventory.value   = data.colonyShipInventory
    if (data.colonyShipBuild)                        colonyShipBuild.value        = data.colonyShipBuild
    if (Array.isArray(data.activeColonyMissions))    activeColonyMissions.value   = data.activeColonyMissions
    if (data.cropInventory) {
      for (const [id, count] of Object.entries(data.cropInventory)) {
        if (id in cropInventory.value) cropInventory.value[id] = count
      }
    }
    if (data.cropQueue) cropQueue.value = data.cropQueue
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

// ── Tick ───────────────────────────────────────────────────
const tick = () => {
  now.value = Date.now()

  // Complete drone build
  if (reconDroneBuild.value && reconDroneBuild.value.endsAt <= now.value) {
    reconDroneInventory.value += 1
    reconDroneBuild.value = null
  }

  // Complete drone missions → reveal planet
  for (let i = activeDroneMissions.value.length - 1; i >= 0; i--) {
    const m = activeDroneMissions.value[i]
    if (m.endsAt <= now.value) {
      if (!playerScannedPlanets.value.includes(m.planetId)) {
        playerScannedPlanets.value.push(m.planetId)
      }
      activeDroneMissions.value.splice(i, 1)
    }
  }

  // Complete galaxy probe build
  if (galaxyProbeBuild.value && galaxyProbeBuild.value.endsAt <= now.value) {
    galaxyProbeInventory.value += 1
    galaxyProbeBuild.value = null
  }

  // Complete galaxy probes → reveal system
  for (let i = activeGalaxyProbes.value.length - 1; i >= 0; i--) {
    const probe = activeGalaxyProbes.value[i]
    if (probe.endsAt <= now.value) {
      if (!playerProbedSystems.value.includes(probe.systemId)) {
        playerProbedSystems.value.push(probe.systemId)
      }
      activeGalaxyProbes.value.splice(i, 1)
    }
  }

  // Complete colony ship build
  if (colonyShipBuild.value && colonyShipBuild.value.endsAt <= now.value) {
    colonyShipInventory.value += 1
    colonyShipBuild.value = null
  }

  // Complete colony missions → colonize planet
  for (let i = activeColonyMissions.value.length - 1; i >= 0; i--) {
    const m = activeColonyMissions.value[i]
    if (m.endsAt <= now.value) {
      if (!playerColonizedPlanets.value.includes(m.planetId)) {
        playerColonizedPlanets.value.push(m.planetId)
      }
      activeColonyMissions.value.splice(i, 1)
    }
  }

  // Complete crop growth
  if (cropQueue.value && cropQueue.value.endsAt <= now.value) {
    const { cropId } = cropQueue.value
    cropInventory.value[cropId] = (cropInventory.value[cropId] ?? 0) + 1
    const popBonus = CROP_DEFS[cropId]?.popBonus ?? 0
    if (popBonus > 0) playerResources.value.population += popBonus
    cropQueue.value = null
  }

  // Complete building upgrades
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

  // Resource production
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
    playerName,
    planetName,
    systemName,
    isFirstRun,
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
    // navigation
    starMapLevel,
    // space tech
    spaceTechLevel,
    reconDroneLevel,
    galaxyProbeLevel,
    colonyShipLevel,
    // recon drones
    playerScannedPlanets,
    reconDroneInventory,
    reconDroneBuild,
    activeDroneMissions,
    droneBuildTime,
    canBuildDrone,
    buildReconDrone,
    canSendDrone,
    sendReconDrone,
    remainingDroneSec,
    droneProgressStyle,
    droneBuildProgressStyle,
    // galaxy probes
    playerProbedSystems,
    galaxyProbeInventory,
    galaxyProbeBuild,
    activeGalaxyProbes,
    probeBuildTime,
    canBuildProbe,
    buildGalaxyProbe,
    canSendProbe,
    sendGalaxyProbe,
    remainingProbeSec,
    probeProgressStyle,
    probeBuildProgressStyle,
    // colony ships
    playerColonizedPlanets,
    colonyShipInventory,
    colonyShipBuild,
    activeColonyMissions,
    colonyShipBuildTime,
    canBuildColonyShip,
    buildColonyShip,
    canSendColonyShip,
    sendColonyShip,
    remainingColonySec,
    colonyProgressStyle,
    colonyShipBuildProgressStyle,
    // grid
    unlockRequirement,
    slotsOnSlot,
    // time
    remainingSec,
    formatTime,
    buildProgressStyle,
    // unit costs (for UI display)
    UNIT_COSTS,
    // crops
    cropInventory,
    cropQueue,
    cropGrowTime,
    canGrowCrop,
    startCropGrow,
    remainingCropSec,
    cropQueueProgressStyle,
    CROP_DEFS,
  }
}
