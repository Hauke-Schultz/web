import { ref, computed } from 'vue'
import { TILE_TYPES, PLANET_GRID, BUILDINGS, UNIT_COSTS, PLANET_TYPES, MOCK_TYPE_TO_PLANET_TYPE, FREIGHTER_CARGO_CAPACITY, WARSHIP_CLASSES } from '~/utils/hawkStarConfig.js'
import { GALAXY_SYSTEMS } from '~/utils/hawkStarGalaxyMock.js'

// ── Starting planet pool — alle unkolonisierten Planeten aus dem Mock ─────────
const buildStartPool = () => {
  const pool = []
  for (const sys of GALAXY_SYSTEMS) {
    for (const planet of sys.planets) {
      if (planet.state === 'uncolonized') {
        pool.push({
          system:     sys.name,
          systemId:   sys.id,
          planet:     planet.name,
          planetId:   planet.id,
          planetType: MOCK_TYPE_TO_PLANET_TYPE[planet.type] ?? 'terrestrial',
        })
      }
    }
  }
  return pool
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

// ── Per-planet state (slots + buildings + resources) ───────
const allPlanetStates = ref({})

const HOME_START_RESOURCES   = { population: 20, metal: 400, crystal: 180, alloy: 0, cryo: 0, obsidian: 0, biomass: 0, energy: 0, pure_crystal: 0, super_alloy: 0, quantum_shard: 0, nano_alloy: 0, composite: 0, hardened_steel: 0, lava_gem: 0, bio_polymer: 0, coral_steel: 0, kinetic_round: 0, plasma_cell: 0, quantum_warhead: 0 }
const COLONY_START_RESOURCES = { population: 15,  metal: 200,  crystal: 80, alloy: 0, cryo: 0, obsidian: 0, biomass: 0, energy: 0, pure_crystal: 0, super_alloy: 0, quantum_shard: 0, nano_alloy: 0, composite: 0, hardened_steel: 0, lava_gem: 0, bio_polymer: 0, coral_steel: 0, kinetic_round: 0, plasma_cell: 0, quantum_warhead: 0 }

const freshDock = () => ({
  reconDroneInventory:    0,
  reconDroneBuild:        null,
  activeDroneMissions:    [],
  galaxyProbeInventory:   0,
  galaxyProbeBuild:       null,
  activeGalaxyProbes:     [],
  colonyShipInventory:    0,
  colonyShipBuild:        null,
  activeColonyMissions:   [],
  warships:               [],   // array of warship objects { id, classId, hull, hullMax, shield, shieldMax, weapons[] }
  warshipBuild:           null,
  freighterInventory:     0,
  freighterBuild:         null,
  activeFreighterMissions: [],
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
const playerBuildings = computed(() => allPlanetStates.value[activePlanetId.value]?.buildings ?? {})
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
const BASE_STORAGE = { metal: 100, crystal: 50, alloy: 50, cryo: 50, obsidian: 50, biomass: 50, pure_crystal: 50, super_alloy: 50, quantum_shard: 50, nano_alloy: 50, composite: 50, hardened_steel: 50, lava_gem: 50, bio_polymer: 50, coral_steel: 50 }

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

// Command center: active planet (each planet can build independently)
const commandCenterBuilt = computed(() => playerBuildings.value['command_center']?.level >= 1)

// Space facilities always read from home planet
const homeBuilding = (id) => allPlanetStates.value[homePlanetId.value]?.buildings[id]
const starMapLevel = computed(() => {
  const state = homeBuilding('star_map')
  return state ? effectiveLevel(state) : 0
})
const spaceTechLevel = computed(() => {
  const state = homeBuilding('space_tech')
  return state ? effectiveLevel(state) : 0
})
const reconDroneLevel = computed(() => {
  const state = playerBuildings.value['recon_drone']
  return state?.level ?? 0
})
const galaxyProbeLevel = computed(() => {
  const state = playerBuildings.value['galaxy_probe']
  return state?.level ?? 0
})
const colonyShipLevel = computed(() => {
  const state = playerBuildings.value['colony_ship']
  return state?.level ?? 0
})
const warshipBayLevel = computed(() => {
  const state = playerBuildings.value['warship_bay']
  return state?.level ?? 0
})
const freighterBayLevel = computed(() => {
  const state = playerBuildings.value['freighter_bay']
  return state?.level ?? 0
})

const isBuildingLocked = (id) => {
  const req = BUILDINGS[id]?.requiresBuilding
  if (!req) return false
  return getLevel(req) < (BUILDINGS[id]?.requiresLevel ?? 1)
}

const canBuild = (id) =>
  !isBuildingLocked(id) &&
  (id === 'command_center' || commandCenterBuilt.value) &&
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
  allPlanetStates.value[activePlanetId.value].buildings[id].buildEndsAt = Date.now() + next.buildTime * 1000
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
  const pct = Math.min(100, Math.max(0, (1 - (state.buildEndsAt - now.value) / (buildTime * 1000)) * 100))
  return { width: `${pct}%` }
}

// (homeSystem computed is declared near the top of the singleton state)

// ── Recon Drones (home system planet scouting) ────────────
// playerScannedPlanets: planets whose info has been revealed by a drone arriving
const playerScannedPlanets = ref([homePlanetId.value])
// Per-planet dock aliases (computed from active planet's dock)
const reconDroneInventory = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.reconDroneInventory ?? 0)
const reconDroneBuild     = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.reconDroneBuild ?? null)
const activeDroneMissions = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeDroneMissions ?? [])

const droneBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.recon_drone.buildTimeBase / Math.max(1, reconDroneLevel.value))
)

const droneFlightTime = (planetId) => {
  const idx = homeSystem.value?.planets.findIndex(p => p.id === planetId) ?? 0
  return Math.ceil(60 * (idx + 1) / Math.max(1, reconDroneLevel.value))
}

const droneFlightTimeBetween = (fromId, toId) => {
  const ps = homeSystem.value?.planets ?? []
  const fi = ps.findIndex(p => p.id === fromId)
  const ti = ps.findIndex(p => p.id === toId)
  const dist = Math.max(1, Math.abs(fi - ti))
  return Math.ceil(60 * dist / Math.max(1, reconDroneLevel.value))
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
  dock.reconDroneBuild = { endsAt: Date.now() + droneBuildTime.value * 1000 }
}

const canSendDrone = (planetId) =>
  reconDroneInventory.value > 0 &&
  !playerScannedPlanets.value.includes(planetId) &&
  !activeDroneMissions.value.find(m => m.planetId === planetId) &&
  activeDroneMissions.value.length < reconDroneLevel.value

const sendReconDrone = (planetId, fromPlanetId) => {
  if (!canSendDrone(planetId)) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  dock.reconDroneInventory -= 1
  const ft = fromPlanetId ? droneFlightTimeBetween(fromPlanetId, planetId) : droneFlightTime(planetId)
  dock.activeDroneMissions.push({ planetId, endsAt: Date.now() + ft * 1000 })
}

const remainingDroneSec = (planetId) => {
  const m = activeDroneMissions.value.find(m => m.planetId === planetId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

const droneProgressStyle = (planetId) => {
  const m = activeDroneMissions.value.find(m => m.planetId === planetId)
  if (!m) return {}
  const ft = droneFlightTime(planetId)
  return { animationDuration: `${ft}s` }
}

const droneBuildProgressStyle = computed(() => {
  if (!reconDroneBuild.value) return {}
  const bt = droneBuildTime.value
  return { animationDuration: `${bt}s` }
})

// ── Galaxy Probes (remote system scouting) ─────────────────
const PROBE_SPEED = 0.4 // map-units per second at level 1

const playerProbedSystems = ref([homeSystemId.value])
// Per-planet dock aliases
const galaxyProbeInventory = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.galaxyProbeInventory ?? 0)
const galaxyProbeBuild     = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.galaxyProbeBuild ?? null)
const activeGalaxyProbes   = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeGalaxyProbes ?? [])

const probeBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.galaxy_probe.buildTimeBase / Math.max(1, galaxyProbeLevel.value))
)

const probeFlightTime = (systemId) => {
  const sys = GALAXY_SYSTEMS.find(s => s.id === systemId)
  if (!sys || sys.id === homeSystemId.value) return 0
  const dx   = sys.x - (homeSystem.value?.x ?? 50)
  const dy   = sys.y - (homeSystem.value?.y ?? 50)
  const dist = Math.sqrt(dx * dx + dy * dy)
  return Math.ceil(dist / (PROBE_SPEED * Math.max(1, galaxyProbeLevel.value)))
}

const probeFlightTimeBetween = (fromId, toId) => {
  const from = GALAXY_SYSTEMS.find(s => s.id === fromId)
  const to   = GALAXY_SYSTEMS.find(s => s.id === toId)
  if (!from || !to || fromId === toId) return 0
  const dx   = to.x - from.x
  const dy   = to.y - from.y
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
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  const res = allPlanetStates.value[activePlanetId.value].resources
  for (const [r, amt] of Object.entries(UNIT_COSTS.galaxy_probe.cost)) {
    res[r] -= amt
  }
  dock.galaxyProbeBuild = { endsAt: Date.now() + probeBuildTime.value * 1000 }
}

const canSendProbe = (systemId) =>
  galaxyProbeInventory.value > 0 &&
  !playerProbedSystems.value.includes(systemId) &&
  !activeGalaxyProbes.value.find(p => p.systemId === systemId) &&
  activeGalaxyProbes.value.length < galaxyProbeLevel.value

const sendGalaxyProbe = (systemId, fromSystemId) => {
  if (!canSendProbe(systemId)) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  dock.galaxyProbeInventory -= 1
  const ft = fromSystemId ? probeFlightTimeBetween(fromSystemId, systemId) : probeFlightTime(systemId)
  dock.activeGalaxyProbes.push({ systemId, endsAt: Date.now() + ft * 1000 })
}

const remainingProbeSec = (systemId) => {
  const probe = activeGalaxyProbes.value.find(p => p.systemId === systemId)
  return probe ? Math.max(0, Math.ceil((probe.endsAt - now.value) / 1000)) : 0
}

const probeProgressStyle = (systemId) => {
  const probe = activeGalaxyProbes.value.find(p => p.systemId === systemId)
  if (!probe) return {}
  const ft      = probeFlightTime(systemId)
  return { animationDuration: `${ft}s` }
}

const probeBuildProgressStyle = computed(() => {
  if (!galaxyProbeBuild.value) return {}
  const bt      = probeBuildTime.value
  return { animationDuration: `${bt}s` }
})

// ── Colony Ships (home system colonization) ────────────────
const playerColonizedPlanets = ref([homePlanetId.value])
// Per-planet dock aliases
const colonyShipInventory  = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.colonyShipInventory ?? 0)
const colonyShipBuild      = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.colonyShipBuild ?? null)
const activeColonyMissions = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeColonyMissions ?? [])

const colonyShipBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.colony_ship.buildTimeBase / Math.max(1, colonyShipLevel.value))
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
  dock.colonyShipBuild = { endsAt: Date.now() + colonyShipBuildTime.value * 1000 }
}

const canSendColonyShip = (planetId) => {
  const planet = homeSystem.value?.planets.find(p => p.id === planetId)
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

const sendColonyShip = (planetId, fromPlanetId) => {
  if (!canSendColonyShip(planetId)) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  dock.colonyShipInventory -= 1
  const ft = fromPlanetId ? colonyFlightTimeBetween(fromPlanetId, planetId) : colonyFlightTime(planetId)
  dock.activeColonyMissions.push({ planetId, endsAt: Date.now() + ft * 1000 })
}

const remainingColonySec = (planetId) => {
  const m = activeColonyMissions.value.find(m => m.planetId === planetId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

const colonyProgressStyle = (planetId) => {
  const m = activeColonyMissions.value.find(m => m.planetId === planetId)
  if (!m) return {}
  const ft      = colonyFlightTime(planetId)
  return { animationDuration: `${ft}s` }
}

const colonyShipBuildProgressStyle = computed(() => {
  if (!colonyShipBuild.value) return {}
  const bt      = colonyShipBuildTime.value
  return { animationDuration: `${bt}s` }
})

// ── Warships ───────────────────────────────────────────────
// Per-planet dock aliases
const warships         = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.warships ?? [])
const warshipInventory = computed(() => warships.value.length)
const warshipBuild     = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.warshipBuild ?? null)

const warshipBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.warship.buildTimeBase / Math.max(1, warshipBayLevel.value))
)

const canBuildWarship = computed(() =>
  warshipBayLevel.value > 0 &&
  !warshipBuild.value &&
  warshipInventory.value < warshipBayLevel.value &&
  canAfford(UNIT_COSTS.warship.cost)
)

const buildWarship = () => {
  if (!canBuildWarship.value) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  const res = allPlanetStates.value[activePlanetId.value].resources
  for (const [r, amt] of Object.entries(UNIT_COSTS.warship.cost)) {
    res[r] -= amt
  }
  const cls = WARSHIP_CLASSES.frigate
  dock.warshipBuild = { endsAt: Date.now() + warshipBuildTime.value * 1000, classId: cls.id }
}

const warshipBuildProgressStyle = computed(() => {
  if (!warshipBuild.value) return {}
  const bt      = warshipBuildTime.value
  return { animationDuration: `${bt}s` }
})

// ── Freighters (resource transport between colonies) ────────
// Per-planet dock aliases
const freighterInventory      = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.freighterInventory ?? 0)
const freighterBuild          = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.freighterBuild ?? null)
const activeFreighterMissions = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeFreighterMissions ?? [])

const freighterBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.freighter.buildTimeBase / Math.max(1, freighterBayLevel.value))
)

const freighterCargoCapacity = computed(() =>
  FREIGHTER_CARGO_CAPACITY[freighterBayLevel.value] ?? 0
)

const canBuildFreighter = computed(() =>
  freighterBayLevel.value > 0 &&
  !freighterBuild.value &&
  canAfford(UNIT_COSTS.freighter.cost)
)

const buildFreighter = () => {
  if (!canBuildFreighter.value) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  const res = allPlanetStates.value[activePlanetId.value].resources
  for (const [r, amt] of Object.entries(UNIT_COSTS.freighter.cost)) {
    res[r] -= amt
  }
  dock.freighterBuild = { endsAt: Date.now() + freighterBuildTime.value * 1000 }
}

const freighterFlightTimeBetween = (fromId, toId) => {
  const ps = homeSystem.value?.planets ?? []
  const fi = ps.findIndex(p => p.id === fromId)
  const ti = ps.findIndex(p => p.id === toId)
  const dist = Math.max(1, Math.abs(fi - ti))
  return Math.ceil(120 * dist / Math.max(1, freighterBayLevel.value))
}

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
  (allPlanetStates.value[planetId]?.slots ?? []).some(s => s.tileType === 'spacebase' && s.unlocked)

const canSendFreighter = (fromPlanetId, toPlanetId, cargo) => {
  if (freighterInventory.value <= 0) return false
  if (!fromPlanetId || !toPlanetId || fromPlanetId === toPlanetId) return false
  if (!allPlanetStates.value[fromPlanetId] || !allPlanetStates.value[toPlanetId]) return false
  const total = Object.values(cargo).reduce((a, b) => a + b, 0)
  if (total > freighterCargoCapacity.value) return false
  const fromRes = allPlanetStates.value[fromPlanetId].resources
  for (const [r, amt] of Object.entries(cargo)) {
    if (amt > 0 && (fromRes[r] ?? 0) < amt) return false
  }
  return true
}

const sendFreighter = (fromPlanetId, toPlanetId, cargo) => {
  if (!canSendFreighter(fromPlanetId, toPlanetId, cargo)) return
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return
  const fromRes = allPlanetStates.value[fromPlanetId].resources
  for (const [r, amt] of Object.entries(cargo)) {
    if (amt > 0) fromRes[r] -= amt
  }
  dock.freighterInventory -= 1
  const ft = freighterFlightTimeBetween(fromPlanetId, toPlanetId)
  dock.activeFreighterMissions.push({
    id:           Date.now(),
    fromPlanetId,
    toPlanetId,
    cargo:        { ...cargo },
    endsAt:       Date.now() + ft * 1000,
    flightTime:   ft,
  })
}

const remainingFreighterSec = (missionId) => {
  const m = activeFreighterMissions.value.find(m => m.id === missionId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

const freighterProgressStyle = (missionId) => {
  const m = activeFreighterMissions.value.find(m => m.id === missionId)
  if (!m) return {}
  return { animationDuration: `${m.flightTime}s` }
}

const freighterBuildProgressStyle = computed(() => {
  if (!freighterBuild.value) return {}
  const bt      = freighterBuildTime.value
  return { animationDuration: `${bt}s` }
})

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
  return Math.ceil(recipe.durationBase / Math.max(1, throughput))
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
const SAVE_KEY     = 'hawk-star-save'
const SAVE_VERSION = 13

const saveGame = () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version:               SAVE_VERSION,
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
    playerProbedSystems:    playerProbedSystems.value,
    playerColonizedPlanets: playerColonizedPlanets.value,
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
            activeGalaxyProbes:     Array.isArray(savedDock.activeGalaxyProbes)     ? savedDock.activeGalaxyProbes     : [],
            activeColonyMissions:   Array.isArray(savedDock.activeColonyMissions)   ? savedDock.activeColonyMissions   : [],
            activeFreighterMissions: Array.isArray(savedDock.activeFreighterMissions) ? savedDock.activeFreighterMissions : [],
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
    if (Array.isArray(data.playerProbedSystems))     playerProbedSystems.value    = data.playerProbedSystems
    if (Array.isArray(data.playerColonizedPlanets))  playerColonizedPlanets.value = data.playerColonizedPlanets
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
  for (const [, pstate] of Object.entries(allPlanetStates.value)) {
    // ── Dock processing ───────────────────────────────────
    const dock = pstate.dock
    if (dock) {
      // Recon drone build
      if (dock.reconDroneBuild && dock.reconDroneBuild.endsAt <= now.value) {
        dock.reconDroneInventory += 1
        dock.reconDroneBuild = null
      }
      // Recon drone missions → reveal planet
      for (let i = dock.activeDroneMissions.length - 1; i >= 0; i--) {
        const m = dock.activeDroneMissions[i]
        if (m.endsAt <= now.value) {
          if (!playerScannedPlanets.value.includes(m.planetId)) playerScannedPlanets.value.push(m.planetId)
          dock.activeDroneMissions.splice(i, 1)
        }
      }
      // Galaxy probe build
      if (dock.galaxyProbeBuild && dock.galaxyProbeBuild.endsAt <= now.value) {
        dock.galaxyProbeInventory += 1
        dock.galaxyProbeBuild = null
      }
      // Galaxy probes → reveal system
      for (let i = dock.activeGalaxyProbes.length - 1; i >= 0; i--) {
        const probe = dock.activeGalaxyProbes[i]
        if (probe.endsAt <= now.value) {
          if (!playerProbedSystems.value.includes(probe.systemId)) playerProbedSystems.value.push(probe.systemId)
          dock.activeGalaxyProbes.splice(i, 1)
        }
      }
      // Colony ship build
      if (dock.colonyShipBuild && dock.colonyShipBuild.endsAt <= now.value) {
        dock.colonyShipInventory += 1
        dock.colonyShipBuild = null
      }
      // Colony missions → colonize planet
      for (let i = dock.activeColonyMissions.length - 1; i >= 0; i--) {
        const m = dock.activeColonyMissions[i]
        if (m.endsAt <= now.value) {
          if (!playerColonizedPlanets.value.includes(m.planetId)) {
            playerColonizedPlanets.value.push(m.planetId)
            const planet = homeSystem.value?.planets.find(p => p.id === m.planetId)
            if (planet) {
              const pType = MOCK_TYPE_TO_PLANET_TYPE[planet.type] ?? 'terrestrial'
              initializePlanetState(m.planetId, pType, planet.name)
            }
          }
          dock.activeColonyMissions.splice(i, 1)
        }
      }
      // Warship build
      if (dock.warshipBuild && dock.warshipBuild.endsAt <= now.value) {
        if (!dock.warships) dock.warships = []
        const cls = WARSHIP_CLASSES[dock.warshipBuild.classId] ?? WARSHIP_CLASSES.frigate
        dock.warships.push({
          id:        `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          classId:   cls.id,
          name:      cls.name,
          icon:      cls.icon,
          hull:      cls.hull,
          hullMax:   cls.hull,
          shield:    cls.shield,
          shieldMax: cls.shield,
          speed:     cls.speed,
          weapons:   Array(cls.weaponSlots).fill(null),
        })
        dock.warshipBuild = null
      }
      // Freighter build
      if (dock.freighterBuild && dock.freighterBuild.endsAt <= now.value) {
        dock.freighterInventory += 1
        dock.freighterBuild = null
      }
      // Freighter missions → deliver cargo
      for (let i = dock.activeFreighterMissions.length - 1; i >= 0; i--) {
        const m = dock.activeFreighterMissions[i]
        if (m.endsAt <= now.value) {
          const toPlanetState = allPlanetStates.value[m.toPlanetId]
          if (toPlanetState) {
            const caps = maxStorageForPlanet(m.toPlanetId)
            for (const [r, amt] of Object.entries(m.cargo)) {
              if (amt <= 0) continue
              const cap = caps[r]
              toPlanetState.resources[r] = cap !== undefined
                ? Math.min((toPlanetState.resources[r] ?? 0) + amt, cap)
                : (toPlanetState.resources[r] ?? 0) + amt
            }
            toPlanetState.dock.freighterInventory += 1
          }
          dock.activeFreighterMissions.splice(i, 1)
        }
      }
    }
    const pb = pstate.buildings
    const pr = pstate.resources

    // Complete builds
    for (const [id, state] of Object.entries(pb)) {
      if (!state.buildEndsAt || state.buildEndsAt > now.value) continue
      state.level += 1
      state.buildEndsAt = null
      const levelDef = BUILDINGS[id]?.levels[state.level - 1]
      if (levelDef?.unlocks) {
        for (const { slot } of levelDef.unlocks) {
          const s = pstate.slots.find(ps => ps.slot === slot)
          if (s) s.unlocked = true
        }
      }
      if (levelDef?.popBonus) {
        pr.population += levelDef.popBonus
      }
    }

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
    galaxyProbeLevel,
    colonyShipLevel,
    warshipBayLevel,
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
    droneFlightTime,
    remainingDroneSec,
    droneProgressStyle,
    droneBuildProgressStyle,
    droneFlightTimeBetween,
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
    probeFlightTimeBetween,
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
    colonyFlightTime,
    remainingColonySec,
    colonyProgressStyle,
    colonyShipBuildProgressStyle,
    colonyFlightTimeBetween,
    // warships
    warships,
    warshipInventory,
    warshipBuild,
    warshipBuildTime,
    canBuildWarship,
    buildWarship,
    warshipBuildProgressStyle,
    // freighters
    freighterBayLevel,
    freighterInventory,
    freighterBuild,
    activeFreighterMissions,
    freighterBuildTime,
    freighterCargoCapacity,
    canBuildFreighter,
    buildFreighter,
    canSendFreighter,
    sendFreighter,
    freighterFlightTimeBetween,
    remainingFreighterSec,
    freighterProgressStyle,
    freighterBuildProgressStyle,
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
  }
}
