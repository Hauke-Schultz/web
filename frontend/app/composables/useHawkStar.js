import { ref, computed, watch } from 'vue'
import { TILE_TYPES, PLANET_GRID, BUILDINGS, RESOURCES, UNIT_COSTS, PLANET_TYPES, COMM_EMOJIS, SIGNAL_SPEED_BASE, POWER_BATTERY, SHIELD, CARGO, SPY } from '~/utils/hawkStarConfig.js'
import { useHawkStarAuth } from './useHawkStarAuth.js'
import { useHawkStarApi } from './useHawkStarApi.js'

// ── Galaxy state (loaded from API on init) ────────────────────────────────────
const galaxySystems = ref([])

// ── Singleton state ────────────────────────────────────────
const playerName        = ref('')
const playerPortrait    = ref('👨‍🚀')
const playerDisposition = ref('neutral')
const homeSystemId = ref(null)
const homePlanetId = ref(null)

// ── Dev tuning ─────────────────────────────────────────────
const tickRateMs      = ref(5000)
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

// ── API error feedback ─────────────────────────────────────
const buildError = ref('')

// ── Game ready flag (false until initFromApi succeeds) ─────────
const gameLoaded = ref(false)
const initError  = ref('')

// ── Communication ─────────────────────────────────────────
// systemContacts: per-system scan state
// commLog: all sent/received messages (newest first)
const systemContacts  = ref({})
const commLog         = ref([])
const unreadSystems   = ref({}) // { '<sysId>': true } for systems with new received messages

const LAST_READ_KEY = 'hs-comm-last-read'
let _lastReadTimes = {}
try { _lastReadTimes = JSON.parse(localStorage.getItem(LAST_READ_KEY) ?? '{}') } catch {}

const recomputeUnread = () => {
  const u = {}
  for (const entry of commLog.value) {
    if (entry.direction !== 'received') continue
    const key = String(entry.systemId)
    if ((entry.timestamp ?? 0) > (_lastReadTimes[key] ?? 0)) u[key] = true
  }
  unreadSystems.value = u
}

const markSystemRead = (sysId) => {
  const key = String(sysId)
  if (unreadSystems.value[key]) {
    const u = { ...unreadSystems.value }
    delete u[key]
    unreadSystems.value = u
  }
  _lastReadTimes[key] = Date.now()
  try { localStorage.setItem(LAST_READ_KEY, JSON.stringify(_lastReadTimes)) } catch {}
}

const dismissNotification = (id) => {
  const idx = notifications.value.findIndex(n => n.id === id)
  if (idx !== -1) notifications.value.splice(idx, 1)
}

const dismissAllNotifications = () => { notifications.value = [] }

const HOME_START_RESOURCES   = { population: 1, metal: 400, crystal: 180, alloy: 0, cryo: 0, obsidian: 0, biomass: 0, energy: 0, duraplate: 0, plasma_core: 0, superconductor: 0, vital_gel: 0, power_cell: 0 }
const COLONY_START_RESOURCES = { population: 6,  metal: 200,  crystal: 80, alloy: 0, cryo: 0, obsidian: 0, biomass: 0, energy: 0, duraplate: 0, plasma_core: 0, superconductor: 0, vital_gel: 0, power_cell: 0 }

const freshDock = () => ({
  reconDroneInventory:    0,
  reconDroneBuild:        null,
  activeDroneMissions:    [],
  colonyShipInventory:    0,
  colonyShipBuild:        null,
  activeColonyMissions:   [],
  cargoDroneInventory:    0,
  cargoDroneBuild:        null,
  activeCargoMissions:    [],   // outbound legs — one entry per target planet
  returningCargoMissions: [],   // empty return legs — target is this planet
  spyDroneInventory:      0,
  spyDroneBuild:          null,
  spySatelliteInventory:  0,
  spySatelliteBuild:      null,
  activeSpyMissions:      [],   // one-way — neither unit comes back
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

const activePlanetId = ref(null)

const setActivePlanet = (planetId) => {
  if (!allPlanetStates.value[planetId]) return
  activePlanetId.value    = planetId
  activeSlot.value        = 5
  lastResourceSyncMs.value = Date.now()
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
const homeSystem = computed(() => galaxySystems.value.find(s => s.id === homeSystemId.value))

// Which system a planet sits in — the galaxy is the only place that knows, and
// spy missions need it because their target is outside the home system.
const planetSystemId = (planetId) =>
  galaxySystems.value.find(s => s.planets.some(p => p.id === planetId))?.id ?? null

// Per-planet resource aliases
const playerResources = computed(() => allPlanetStates.value[activePlanetId.value]?.resources ?? {})
const homeResources   = computed(() => allPlanetStates.value[homePlanetId.value]?.resources ?? {})


const activeSlot = ref(5)
const now = ref(Date.now())
let tickInterval = null
const lastResourceSync   = ref(0)            // stores Math.floor(timestamp / 60000) — minute number
const lastResourceSyncMs = ref(Date.now())   // ms timestamp of last actual server resource response
const lastCommLogSync  = ref(0) // stores Math.floor(timestamp / 1000) — second number

// ── Power battery (grid uptime) ────────────────────────────
// Server sends { charge, drainPerHour, powerPlantLevel, gridDown, hoursToEmpty }.
// We anchor it with syncedAt on load and decay it client-side for a live bar.
const battery = computed(() => allPlanetStates.value[activePlanetId.value]?.battery ?? null)

// Live charge of any planet, not only the active one — the solar map draws the
// battery on every colony tile. Null while that planet has no power plant, and
// also while its state has never been loaded this session.
const batteryChargeOf = (planetId) => {
  const b = allPlanetStates.value[planetId]?.battery
  if (!b) return null
  const hours = (now.value - b.syncedAt) / 3600000
  return Math.max(0, b.charge - b.drainPerHour * hours)
}

const batteryCharge = computed(() => batteryChargeOf(activePlanetId.value))

// A planet without a power plant has no grid to lose — that is not a blackout.
const gridDownOn = (planetId) => {
  const b = allPlanetStates.value[planetId]?.battery
  return !!b && b.powerPlantLevel > 0 && (batteryChargeOf(planetId) ?? 0) <= 0
}

const gridDown = computed(() => gridDownOn(activePlanetId.value))

const batteryHoursToEmpty = computed(() => {
  const b = battery.value
  if (!b || !b.drainPerHour) return null
  return (batteryCharge.value ?? 0) / b.drainPerHour
})

// ── Planetary shield (defense tile) ────────────────────────
// Same anchor-and-decay trick as the battery: the server sends the charge at
// sync time, we subtract the drain since then so the bar moves live. Null while
// there is no shield generator on the planet.
const shield = computed(() => allPlanetStates.value[activePlanetId.value]?.shield ?? null)

// Live charge of any planet, not only the active one — the solar map draws the
// shield on every colony tile. Null when that planet has no finished generator,
// and also while its state has never been loaded this session.
const shieldChargeOf = (planetId) => {
  const s = allPlanetStates.value[planetId]?.shield
  if (!s) return null
  const hours = (now.value - s.syncedAt) / 3600000
  return Math.max(0, s.charge - s.drainPerHour * hours)
}

const shieldCharge = computed(() => shieldChargeOf(activePlanetId.value))

const shieldDown = computed(() => !!shield.value && (shieldCharge.value ?? 0) <= 0)

const shieldHoursToEmpty = computed(() => {
  const s = shield.value
  if (!s || !s.drainPerHour) return null
  return (shieldCharge.value ?? 0) / s.drainPerHour
})

// A click that cannot be paid for, or one at full strength, is refused by the
// server — the button mirrors both so it never spends crystal for nothing.
const shieldFull = computed(() => (shieldCharge.value ?? 0) >= SHIELD.max)

const canChargeShield = computed(() =>
  !!shield.value && !shieldFull.value && canAfford(SHIELD.clickCost)
)

// ── Population recruit pool (base tile) ────────────────────
// Server sends { pool, poolMax, growthPerHour }; we anchor with syncedAt and let
// the pool grow client-side up to poolMax for a live counter.
const recruitState = computed(() => allPlanetStates.value[activePlanetId.value]?.recruit ?? null)

const recruitPool = computed(() => {
  const r = recruitState.value
  if (!r) return 0
  const hours = (now.value - r.syncedAt) / 3600000
  return Math.min(r.poolMax, r.pool + r.growthPerHour * hours)
})

const recruitPoolMax = computed(() => recruitState.value?.poolMax ?? 0)
const canRecruit     = computed(() => Math.floor(recruitPool.value) >= 1)
// For the UI hint — server-driven so it can't drift from RECRUIT_GROWTH_PER_DAY.
const recruitGrowthPerDay = computed(() => Math.round((recruitState.value?.growthPerHour ?? 0) * 24))

// ── Anomaly (planet event) ─────────────────────────────────
// The server ships the offer fully materialised — concrete resource deltas per
// choice — so nothing here recomputes amounts, it only renders what it was given.
const anomaly = computed(() => allPlanetStates.value[activePlanetId.value]?.anomaly ?? null)

const hasAnomaly = computed(() =>
  !!anomaly.value && (anomaly.value.expiresAt ?? 0) > now.value
)

const anomalySecondsLeft = computed(() => {
  if (!anomaly.value) return 0
  return Math.max(0, Math.floor((anomaly.value.expiresAt - now.value) / 1000))
})

// Any planet with something waiting — drives the badge on the planet switcher.
const planetsWithAnomaly = computed(() =>
  Object.entries(allPlanetStates.value)
    .filter(([, st]) => (st.anomaly?.expiresAt ?? 0) > now.value)
    .map(([pid]) => Number(pid))
)

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
  if (gridDown.value) return {}   // blackout: nothing produces
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
  if (gridDown.value) return 0   // blackout: nothing running
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

// 0 → 1 measured from the last server resource sync — avoids the visual drop when % 60000 resets
const tickProgress = computed(() => Math.min((now.value - lastResourceSyncMs.value) / 60000, 1))

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
// The cap is the summed storageCapacity of the finished buildings and nothing
// else — same rule as storage_caps_from_levels() on the server, which is the
// side that actually clamps. There used to be a free base amount added here;
// it existed only in the frontend, so a metal mine Lv4 advertised 2100 while
// the server enforced 2000. A resource with no capacity building has no entry
// at all — both display sites skip the "/max" then, matching the server, where
// such a resource is simply not clamped.
const maxStorage = computed(() => {
  const caps = {}
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    if (state.level === 0) continue
    const storage = BUILDINGS[id]?.levels[state.level - 1]?.storageCapacity ?? {}
    for (const [res, cap] of Object.entries(storage)) {
      caps[res] = (caps[res] ?? 0) + cap
    }
  }
  return caps
})

// A full store produces nothing — the server stops at the cap on every tick.
const isStorageFull = (id) => {
  const cap = maxStorage.value[id]
  return cap != null && (playerResources.value[id] ?? 0) >= cap
}

// What a resource reads *right now*: the last synced server value plus the part
// of this minute's production that has already elapsed. Every display goes
// through here so they can never disagree.
//
// The cap is what makes it honest. The server clamps at the cap on each tick,
// so a mine sitting at its 2000 limit produces nothing — but the raw preview
// kept counting and showed 2001, 2002 … until the next sync snapped it back.
// A stock somehow above its cap is held where it is rather than pulled down,
// mirroring credit_resources() on the server.
const resourceDisplay = (id) => {
  const base = playerResources.value[id] ?? 0
  const live = base + tickProgress.value * (production.value[id] ?? 0)
  const cap  = maxStorage.value[id]
  return cap == null ? live : Math.min(live, Math.max(base, cap))
}

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
const starMapLevel = computed(() => globalResearch.value.star_map?.level ?? 0)
const spaceTechLevel = computed(() => {
  const state = homeBuilding('space_tech')
  return state ? effectiveLevel(state) : 0
})
// Facility levels — the hangar gates every drone, the shipyard every ship
const reconDroneLevel = computed(() => {
  const state = playerBuildings.value['drone_hangar']
  return state?.level ?? 0
})
const colonyShipLevel = computed(() => {
  const state = playerBuildings.value['shipyard']
  return state?.level ?? 0
})
const isBuildingLocked = (id) => {
  const bReq = BUILDINGS[id]?.requiresBuilding
  if (bReq && getLevel(bReq) < (BUILDINGS[id]?.requiresLevel ?? 1)) return true
  const lReq = nextLevelDef(id)?.requiresBuilding
  if (lReq && getLevel(lReq) < (nextLevelDef(id)?.requiresLevel ?? 1)) return true
  return false
}

const lockedRequirementInfo = (id) => {
  const bReq = BUILDINGS[id]?.requiresBuilding
  if (bReq && getLevel(bReq) < (BUILDINGS[id]?.requiresLevel ?? 1))
    return { building: bReq, level: BUILDINGS[id]?.requiresLevel ?? 1 }
  const lReq = nextLevelDef(id)?.requiresBuilding
  if (lReq && getLevel(lReq) < (nextLevelDef(id)?.requiresLevel ?? 1))
    return { building: lReq, level: nextLevelDef(id)?.requiresLevel ?? 1 }
  return null
}

const canBuild = (id) =>
  !isBuildingLocked(id) &&
  canAfford(nextLevelDef(id)?.cost ?? {}) &&
  hasEnoughPower(id) &&
  hasEnoughStaff(id)

const startBuild = async (id) => {
  if (!gameLoaded.value) {
    buildError.value = 'Game loading — please wait a moment'
    return
  }
  const next = nextLevelDef(id)
  if (!next || isBuildingInProgress(id) || !canBuild(id)) return

  buildError.value = ''
  const planetId = activePlanetId.value
  const { postBuild, postResearch } = useHawkStarApi()

  // Optimistic cost deduction
  const res = allPlanetStates.value[planetId]?.resources
  if (res) {
    for (const [r, amt] of Object.entries(next.cost ?? {})) {
      res[r] = Math.max(0, (res[r] ?? 0) - amt)
    }
  }

  // Optimistic timer (placeholder until server responds)
  const placeholderEndsAt = Date.now() + next.buildTime * 1000
  if (BUILDINGS[id]?.global) {
    globalResearch.value[id].buildEndsAt = placeholderEndsAt
  } else {
    allPlanetStates.value[planetId].buildings[id].buildEndsAt = placeholderEndsAt
  }

  try {
    const result = BUILDINGS[id]?.global
      ? await postResearch(id)
      : await postBuild(planetId, id)

    // Correct with server timestamp
    if (BUILDINGS[id]?.global) {
      globalResearch.value[id].buildEndsAt = result.endsAt
    } else {
      allPlanetStates.value[planetId].buildings[id].buildEndsAt = result.endsAt
    }
  } catch (e) {
    // Rollback
    if (res) {
      for (const [r, amt] of Object.entries(next.cost ?? {})) {
        res[r] = (res[r] ?? 0) + amt
      }
    }
    if (BUILDINGS[id]?.global) {
      globalResearch.value[id].buildEndsAt = null
    } else {
      allPlanetStates.value[planetId].buildings[id].buildEndsAt = null
    }
    buildError.value = e.message
  }
}

const currentLevelDef = (id) => {
  const lvl = getLevel(id)
  return lvl > 0 ? (BUILDINGS[id]?.levels[lvl - 1] ?? null) : null
}

// ── Power battery: recharge (+clickPercent) ────────────────
const chargeBattery = async () => {
  const planetId = activePlanetId.value
  const st = allPlanetStates.value[planetId]?.battery
  if (!st) return
  const { chargeBattery: chargeApi } = useHawkStarApi()

  // Optimistic: bump the live charge by one click right away
  const liveNow = Math.max(0, st.charge - st.drainPerHour * (Date.now() - st.syncedAt) / 3600000)
  st.charge   = Math.min(POWER_BATTERY.max, liveNow + POWER_BATTERY.clickPercent)
  st.syncedAt = Date.now()

  try {
    const result = await chargeApi(planetId)
    allPlanetStates.value[planetId].battery = { ...result, syncedAt: Date.now() }
    // Grid may have come back up → mark a fresh resource sync so the tick preview restarts
    lastResourceSyncMs.value = Date.now()
  } catch (e) {
    await refreshPlanetState(planetId)   // reconcile with server on failure
  }
}

// ── Planetary shield: recharge (+clickPercent, paid in crystal) ────────────
// Unlike the battery this one spends resources, so the server sends the fresh
// resource row back with the new charge — otherwise the crystal count would sit
// stale until the next sync.
const shieldError = ref(null)

const chargeShield = async () => {
  const planetId = activePlanetId.value
  const st = allPlanetStates.value[planetId]?.shield
  if (!st || !canChargeShield.value) return
  shieldError.value = null

  // Optimistic: bump the live charge, so the bar reacts to the click at once.
  const liveNow = Math.max(0, st.charge - st.drainPerHour * (Date.now() - st.syncedAt) / 3600000)
  st.charge   = Math.min(SHIELD.max, liveNow + SHIELD.clickPercent)
  st.syncedAt = Date.now()

  try {
    const { chargeShield: chargeApi } = useHawkStarApi()
    const result = await chargeApi(planetId)
    const pstate = allPlanetStates.value[planetId]
    if (pstate) {
      pstate.shield = { ...result.shield, syncedAt: Date.now() }
      if (result.resources) pstate.resources = result.resources
    }
    // The cost was taken server-side at this instant — restart the tick preview
    // from here so it does not replay production over the new stock.
    lastResourceSyncMs.value = Date.now()
  } catch (e) {
    shieldError.value = e.message
    await refreshPlanetState(planetId)   // reconcile with server on failure
  }
}

// ── Orbital defense: shoot a foreign satellite down ───────────
// A spy satellite has no lifetime — it transmits until the planet it watches
// destroys it. Detection is the building itself: the list is empty without an
// `orbital_defense`, so an undefended colony never learns that it is watched.
const interceptError = ref(null)
// The last kill, kept so the panel can name the culprit after the row is gone.
const lastIntercepted = ref(null)

const hasOrbitalDefense = computed(() => getLevel('orbital_defense') > 0)

const foreignSatellites = computed(() =>
  allPlanetStates.value[activePlanetId.value]?.foreignSatellites ?? []
)

const canIntercept = computed(() =>
  hasOrbitalDefense.value &&
  foreignSatellites.value.length > 0 &&
  canAfford(SPY.interceptCost)
)

const interceptSatellite = async (targetPlayerId) => {
  const planetId = activePlanetId.value
  if (!canIntercept.value) return
  interceptError.value = null

  try {
    const { interceptSatellite: interceptApi } = useHawkStarApi()
    const result = await interceptApi(planetId, targetPlayerId)
    const pstate = allPlanetStates.value[planetId]
    if (pstate) {
      pstate.foreignSatellites = result.satellites ?? []
      if (result.resources) pstate.resources = result.resources
    }
    lastIntercepted.value = result.destroyed ?? null
    // The shot was paid for at this instant — restart the tick preview here so
    // it does not replay production over the new stock.
    lastResourceSyncMs.value = Date.now()
    notifications.value.push({
      id: `notif_${Date.now()}_intercept_${planetId}_${targetPlayerId}`,
      type: 'satellite_destroyed', icon: '🎯',
      planetId, planetName: allPlanetStates.value[planetId]?.planetName,
      labelKey: 'hawkStar.notifications.satelliteDestroyed',
      details: result.destroyed?.username ?? '',
      timestamp: Date.now(),
    })
  } catch (e) {
    interceptError.value = e.message
    await refreshPlanetState(planetId)   // reconcile with server on failure
  }
}

// ── Population: recruit +1 (move one from the pool into population) ─────────
const recruit = async () => {
  const planetId = activePlanetId.value
  const r = allPlanetStates.value[planetId]?.recruit
  if (!r) return
  const live = Math.min(r.poolMax, r.pool + r.growthPerHour * (Date.now() - r.syncedAt) / 3600000)
  if (Math.floor(live) < 1) return

  // Optimistic: pool −1, population +1
  r.pool = live - 1
  r.syncedAt = Date.now()
  const st = allPlanetStates.value[planetId]
  if (st?.resources) st.resources.population = (st.resources.population ?? 0) + 1

  const { recruit: recruitApi } = useHawkStarApi()
  try {
    const result = await recruitApi(planetId)
    st.recruit = { pool: result.pool, poolMax: result.poolMax, growthPerHour: result.growthPerHour, syncedAt: Date.now() }
    if (st.resources) st.resources.population = result.population
  } catch (e) {
    await refreshPlanetState(planetId)
  }
}

// ── Anomaly: take one of the two offers ────────────────────
// No optimistic update here: the payout can touch resources, population and the
// battery at once, and the server is the only thing that knows whether the cost
// was affordable. A full planet refresh right after keeps all three honest.
const anomalyError = ref(null)
const anomalyBusy  = ref(false)

const resolveAnomaly = async (choiceKey) => {
  const planetId = activePlanetId.value
  if (anomalyBusy.value || !hasAnomaly.value) return
  anomalyBusy.value  = true
  anomalyError.value = null

  const { resolveAnomaly: resolveApi } = useHawkStarApi()
  try {
    const result = await resolveApi(planetId, choiceKey)
    const st = allPlanetStates.value[planetId]
    if (st) {
      st.resources = result.resources
      st.anomaly   = result.anomaly ?? null
      if (result.battery) st.battery = { ...result.battery, syncedAt: Date.now() }
    }
    // Production restarts from this moment — the tick preview must not replay it
    lastResourceSyncMs.value = Date.now()
  } catch (e) {
    anomalyError.value = e.message
    await refreshPlanetState(planetId)
  } finally {
    anomalyBusy.value = false
  }
}

// ── Offline status ─────────────────────────────────────────
const isOffline = (id) => {
  if (getLevel(id) === 0) return false
  if (gridDown.value) return true   // blackout: every built building is offline
  if (!energyDeficit.value) return false
  return (BUILDINGS[id]?.levels[getLevel(id) - 1]?.energyDrain ?? 0) > 0
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

const formatTime = (sec) => {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) {
    const m = Math.floor(sec / 60), s = sec % 60
    return s ? `${m}m ${s}s` : `${m}m`
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
    return m ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600),
        m = Math.floor((sec % 3600) / 60), s = sec % 60
  return [`${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ')
}

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
const playerScannedPlanets = ref([])
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
  return Math.ceil(3600 * (idx + 1))
}

const droneFlightTimeBetween = (fromId, toId) => {
  const ps = homeSystem.value?.planets ?? []
  const fi = ps.findIndex(p => p.id === fromId)
  const ti = ps.findIndex(p => p.id === toId)
  const dist = Math.max(1, Math.abs(fi - ti))
  return Math.ceil(3600 * dist)
}

const canBuildDrone = computed(() =>
  reconDroneLevel.value > 0 &&
  !reconDroneBuild.value &&
  canAfford(UNIT_COSTS.recon_drone.cost)
)

const buildReconDrone = async () => {
  if (!canBuildDrone.value) return
  const planetId = activePlanetId.value
  const dock = allPlanetStates.value[planetId]?.dock
  if (!dock) return
  buildError.value = ''
  const { postUnitBuild } = useHawkStarApi()
  try {
    const result = await postUnitBuild(planetId, 'recon_drone')
    const res = allPlanetStates.value[planetId].resources
    for (const [r, amt] of Object.entries(UNIT_COSTS.recon_drone.cost)) {
      res[r] = Math.max(0, (res[r] ?? 0) - amt)
    }
    dock.reconDroneBuild = { endsAt: result.endsAt, startedAt: result.buildStartedAt ?? Date.now() }
  } catch (e) {
    buildError.value = e.message
  }
}

// Everything about the target that makes it worth a drone — the unit itself
// is checked separately so the UI can show "no drone available" instead of
// silently hiding the button.
const isDroneTarget = (planetId) =>
  reconDroneLevel.value > 0 &&
  !playerScannedPlanets.value.includes(planetId) &&
  !activeDroneMissions.value.find(m => m.planetId === planetId) &&
  activeDroneMissions.value.length < 1

// A drone has to be finished and parked in the dock — having built the
// recon_drone facility is not enough to launch a mission.
const canSendDrone = (planetId) =>
  reconDroneInventory.value > 0 && isDroneTarget(planetId)

const sendReconDrone = async (planetId, fromPlanetId) => {
  if (!canSendDrone(planetId)) return
  const fromId = fromPlanetId ?? activePlanetId.value
  buildError.value = ''
  const { postDroneMission } = useHawkStarApi()
  try {
    const result = await postDroneMission(fromId, planetId)
    const dock = allPlanetStates.value[fromId]?.dock
    if (dock) {
      dock.activeDroneMissions.push({ planetId, endsAt: result.endsAt })
      dock.reconDroneInventory = Math.max(0, dock.reconDroneInventory - 1)
    }
  } catch (e) {
    buildError.value = e.message
  }
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
const playerColonizedPlanets = ref([])
// Completed cargo deliveries across all planets — server-side count, survives a reload
const cargoDeliveries = ref(0)
// Per-planet dock aliases
const colonyShipInventory  = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.colonyShipInventory ?? 0)
const colonyShipBuild      = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.colonyShipBuild ?? null)
const activeColonyMissions    = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeColonyMissions ?? [])
const allActiveColonyMissions = computed(() => Object.values(allPlanetStates.value).flatMap(s => s.dock?.activeColonyMissions ?? []))

const colonyShipBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.colony_ship.buildTimeBase * buildTimeFactor.value)
)

const colonyFlightTime = (planetId) => {
  const idx = homeSystem.value?.planets.findIndex(p => p.id === planetId) ?? 0
  return Math.ceil(7200 * (idx + 1))
}

const colonyFlightTimeBetween = (fromId, toId) => {
  const ps = homeSystem.value?.planets ?? []
  const fi = ps.findIndex(p => p.id === fromId)
  const ti = ps.findIndex(p => p.id === toId)
  const dist = Math.max(1, Math.abs(fi - ti))
  return Math.ceil(7200 * dist)
}

const colonyShipCrew = UNIT_COSTS.colony_ship.crew ?? 0

// The settlers have to be on the planet — they board the ship at build time
const hasColonyCrew = computed(() => freeWorkers.value >= colonyShipCrew)

const canBuildColonyShip = computed(() =>
  colonyShipLevel.value > 0 &&
  !colonyShipBuild.value &&
  hasColonyCrew.value &&
  canAfford(UNIT_COSTS.colony_ship.cost)
)

const buildColonyShip = async () => {
  if (!canBuildColonyShip.value) return
  const planetId = activePlanetId.value
  const dock = allPlanetStates.value[planetId]?.dock
  if (!dock) return
  buildError.value = ''
  const { postUnitBuild } = useHawkStarApi()
  try {
    const result = await postUnitBuild(planetId, 'colony_ship')
    const res = allPlanetStates.value[planetId].resources
    for (const [r, amt] of Object.entries(UNIT_COSTS.colony_ship.cost)) {
      res[r] = Math.max(0, (res[r] ?? 0) - amt)
    }
    // Crew boards the ship and leaves the planet
    res.population = Math.max(0, (res.population ?? 0) - (result.crew ?? colonyShipCrew))
    dock.colonyShipBuild = { endsAt: result.endsAt, startedAt: result.buildStartedAt ?? Date.now() }
  } catch (e) {
    buildError.value = e.message
  }
}

// Target-side conditions only (see isDroneTarget)
const isColonyTarget = (planetId) => {
  const planet = homeSystem.value?.planets.find(p => p.id === planetId)
  return (
    colonyShipLevel.value > 0 &&
    !!planet &&
    planet.type !== 'uninhabitable' &&
    planetId !== homePlanetId.value &&
    planet.state === 'uncolonized' &&
    playerScannedPlanets.value.includes(planetId) &&
    !playerColonizedPlanets.value.includes(planetId) &&
    !activeColonyMissions.value.find(m => m.planetId === planetId) &&
    activeColonyMissions.value.length < 1
  )
}

// Same rule as the drone: only a finished ship in the dock can be launched.
const canSendColonyShip = (planetId) =>
  colonyShipInventory.value > 0 && isColonyTarget(planetId)

const sendColonyShip = async (planetId, fromPlanetId) => {
  if (!canSendColonyShip(planetId)) return
  const fromId = fromPlanetId ?? activePlanetId.value
  buildError.value = ''
  const { postColonyMission } = useHawkStarApi()
  try {
    const result = await postColonyMission(fromId, planetId)
    const dock = allPlanetStates.value[fromId]?.dock
    if (dock) {
      dock.activeColonyMissions.push({ planetId, endsAt: result.endsAt })
      dock.colonyShipInventory = Math.max(0, dock.colonyShipInventory - 1)
    }
  } catch (e) {
    buildError.value = e.message
  }
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

// ── Cargo Drone (goods transfer between planets) ───────────
// Resources are stored per planet and the refined goods are planet-type
// exclusive, so a frozen colony can never make Duraplate itself. The cargo drone
// is the first way to move goods — one per planet, four items per run, one-way
// delivery followed by an automatic empty return flight.

// Shares the drone hangar with the recon drone
const cargoDroneLevel = computed(() => playerBuildings.value['drone_hangar']?.level ?? 0)

const cargoDroneInventory = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.cargoDroneInventory ?? 0)
const cargoDroneBuild     = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.cargoDroneBuild ?? null)
const activeCargoMissions    = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeCargoMissions ?? [])
const allActiveCargoMissions = computed(() => Object.values(allPlanetStates.value).flatMap(s => s.dock?.activeCargoMissions ?? []))
const returningCargoMission  = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.returningCargoMissions?.[0] ?? null)

// null when this planet has no cargo drone at all — that is what the UI uses to
// decide between showing a build button and showing the loading picker.
const cargoState = computed(() => allPlanetStates.value[activePlanetId.value]?.cargo ?? null)

const cargoManifest = computed(() => cargoState.value?.cargo ?? {})
const cargoLoaded   = computed(() => Object.values(cargoManifest.value).reduce((a, b) => a + b, 0))
const cargoCapacity = CARGO.capacity
const cargoLoadable = CARGO.loadable

// A drone exists once it is in production — the planet's slot is taken from then
// on, so no second one can be queued.
const hasCargoDrone = computed(() => !!cargoState.value || !!cargoDroneBuild.value)

// Loadable only with the hold record actually in hand — right after a build
// completes the inventory is already 1 locally while the manifest is still being
// fetched, and the picker must not open on a hold it cannot write to.
const cargoDroneReady = computed(() =>
  cargoDroneInventory.value > 0 && !!cargoState.value && !cargoState.value.missionId
)

const cargoBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.cargo_drone.buildTimeBase * buildTimeFactor.value)
)

const cargoFlightTimeBetween = (fromId, toId) => {
  const ps = homeSystem.value?.planets ?? []
  const fi = ps.findIndex(p => p.id === fromId)
  const ti = ps.findIndex(p => p.id === toId)
  return Math.ceil(3600 * Math.max(1, Math.abs(fi - ti)))
}

const canBuildCargoDrone = computed(() =>
  cargoDroneLevel.value > 0 &&
  !hasCargoDrone.value &&
  canAfford(UNIT_COSTS.cargo_drone.cost)
)

const buildCargoDrone = async () => {
  if (!canBuildCargoDrone.value) return
  const planetId = activePlanetId.value
  const dock = allPlanetStates.value[planetId]?.dock
  if (!dock) return
  buildError.value = ''
  const { postUnitBuild } = useHawkStarApi()
  try {
    const result = await postUnitBuild(planetId, 'cargo_drone')
    const res = allPlanetStates.value[planetId].resources
    for (const [r, amt] of Object.entries(UNIT_COSTS.cargo_drone.cost)) {
      res[r] = Math.max(0, (res[r] ?? 0) - amt)
    }
    dock.cargoDroneBuild = { endsAt: result.endsAt, startedAt: result.buildStartedAt ?? Date.now() }
  } catch (e) {
    buildError.value = e.message
  }
}

const cargoBuildProgressStyle = computed(() => {
  const build = cargoDroneBuild.value
  if (!build) return {}
  const pct = Math.min(100, Math.max(0, (now.value - build.startedAt) / (build.endsAt - build.startedAt) * 100))
  return { width: `${pct}%` }
})

// A `+` is blocked by a full hold or by an empty stock on the planet — the goods
// leave the planet the moment they go aboard.
const canLoadMore = (res) =>
  cargoDroneReady.value &&
  cargoLoaded.value < cargoCapacity &&
  (playerResources.value[res] ?? 0) >= 1

// Writes the whole manifest, so this covers +1, −1 and "unload all" alike.
// Optimistic: the item moves between planet and hold right away, the server
// response is the correction.
const setCargo = async (manifest) => {
  const planetId = activePlanetId.value
  const st = allPlanetStates.value[planetId]
  if (!st?.cargo) return

  const before = { ...(st.cargo.cargo ?? {}) }
  const target = Object.fromEntries(Object.entries(manifest).filter(([, n]) => n > 0))
  if (Object.values(target).reduce((a, b) => a + b, 0) > cargoCapacity) return

  for (const res of cargoLoadable) {
    const diff = (target[res] ?? 0) - (before[res] ?? 0)
    if (diff) st.resources[res] = Math.max(0, (st.resources[res] ?? 0) - diff)
  }
  st.cargo = { ...st.cargo, cargo: target, total: Object.values(target).reduce((a, b) => a + b, 0) }

  buildError.value = ''
  const { postCargoLoad } = useHawkStarApi()
  try {
    const result = await postCargoLoad(planetId, target)
    st.cargo = { ...st.cargo, cargo: result.cargo ?? {}, total: result.total ?? 0 }
  } catch (e) {
    buildError.value = e.message
    await refreshPlanetState(planetId)   // reconcile with the server on failure
  }
}

const loadCargo   = (res) => canLoadMore(res)
  ? setCargo({ ...cargoManifest.value, [res]: (cargoManifest.value[res] ?? 0) + 1 })
  : undefined
const unloadCargo = (res) => (cargoManifest.value[res] ?? 0) > 0
  ? setCargo({ ...cargoManifest.value, [res]: cargoManifest.value[res] - 1 })
  : undefined
const unloadAllCargo = () => cargoLoaded.value > 0 ? setCargo({}) : undefined

// Ownership is deliberately not a condition — foreign and uncolonized planets are
// valid destinations. The only gate is that the planet is known: scanned by a
// recon drone, or owned (your own home planet is never scanned by your drones).
const isCargoTarget = (planetId) =>
  cargoDroneLevel.value > 0 &&
  planetId !== activePlanetId.value &&
  (playerScannedPlanets.value.includes(planetId) || playerColonizedPlanets.value.includes(planetId)) &&
  !activeCargoMissions.value.length &&
  !returningCargoMission.value

const canSendCargo = (planetId) =>
  cargoDroneReady.value && cargoLoaded.value > 0 && isCargoTarget(planetId)

const sendCargoDrone = async (planetId, fromPlanetId) => {
  if (!canSendCargo(planetId)) return
  const fromId = fromPlanetId ?? activePlanetId.value
  buildError.value = ''
  const { postCargoMission } = useHawkStarApi()
  try {
    const result = await postCargoMission(fromId, planetId)
    const st   = allPlanetStates.value[fromId]
    const dock = st?.dock
    if (dock) {
      dock.activeCargoMissions.push({ planetId, endsAt: result.endsAt })
      dock.cargoDroneInventory = Math.max(0, dock.cargoDroneInventory - 1)
    }
    if (st?.cargo) st.cargo = { ...st.cargo, missionId: result.missionId }
  } catch (e) {
    buildError.value = e.message
  }
}

const remainingCargoSec = (planetId) => {
  const m = allActiveCargoMissions.value.find(m => m.planetId === planetId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

const remainingCargoReturnSec = computed(() => {
  const m = returningCargoMission.value
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
})

const cargoProgressStyle = (planetId) => {
  const m = allActiveCargoMissions.value.find(m => m.planetId === planetId)
  if (!m) return {}
  return { animationDuration: `${cargoFlightTimeBetween(activePlanetId.value, planetId)}s` }
}

// The return leg flies the same distance back — its mission entry carries the
// planet it is coming FROM, so the duration is measured against that.
const cargoReturnProgressStyle = computed(() => {
  const m = returningCargoMission.value
  if (!m) return {}
  return { animationDuration: `${cargoFlightTimeBetween(activePlanetId.value, m.planetId)}s` }
})

// ── Espionage: spy drone + spy satellite ───────────────────
// Foreign planet ownership is a server-side secret, and what comes back is not a
// permission but a REPORT: `planet.intel` says when it was taken and whether a
// satellite is still transmitting. A drone's report ages from the moment it
// lands; a satellite's stays current until its lifetime runs out.
const spiedPlanets = ref([])
// Satellites ever placed — server-side count, survives a reload and never drops
// back when one expires. The onboarding checklist reads it.
const satelliteDeployments = ref(0)

const spyDroneLevel     = computed(() => playerBuildings.value['drone_hangar']?.level ?? 0)
const spyDroneInventory = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.spyDroneInventory ?? 0)
const spyDroneBuild     = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.spyDroneBuild ?? null)
const spySatelliteInventory = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.spySatelliteInventory ?? 0)
const spySatelliteBuild     = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.spySatelliteBuild ?? null)
const activeSpyMissions    = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeSpyMissions ?? [])
const allActiveSpyMissions = computed(() => Object.values(allPlanetStates.value).flatMap(s => s.dock?.activeSpyMissions ?? []))

// The two units differ only in which dock slot their timer lands in
const SPY_DOCK = {
  spy_drone:     { inventory: 'spyDroneInventory',     build: 'spyDroneBuild' },
  spy_satellite: { inventory: 'spySatelliteInventory', build: 'spySatelliteBuild' },
}

const spyBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.spy_drone.buildTimeBase * buildTimeFactor.value)
)

const satelliteBuildTime = computed(() =>
  Math.ceil(UNIT_COSTS.spy_satellite.buildTimeBase * buildTimeFactor.value)
)

// Same curve as a deep-space scan — the drone travels at signal speed, and the
// distance that matters is between systems, not between planets.
const spyFlightTime = (targetSystemId) => {
  const home   = galaxySystems.value.find(s => s.id === homeSystemId.value)
  const target = galaxySystems.value.find(s => s.id === targetSystemId)
  if (!home || !target) return Math.round(SPY.flightMin * buildTimeFactor.value)
  const dist = Math.sqrt(Math.pow(target.x - home.x, 2) + Math.pow(target.y - home.y, 2))
  return Math.round(Math.max(SPY.flightMin, Math.round(dist * SPY.flightPerDist)) * buildTimeFactor.value)
}

const canBuildSpyDrone = computed(() =>
  spyDroneLevel.value > 0 &&
  !spyDroneBuild.value &&
  canAfford(UNIT_COSTS.spy_drone.cost)
)

const canBuildSpySatellite = computed(() =>
  spyDroneLevel.value > 0 &&
  !spySatelliteBuild.value &&
  canAfford(UNIT_COSTS.spy_satellite.cost)
)

// One builder for both — same hangar, same flow, different dock slot
const buildSpyUnit = async (unitKey) => {
  const planetId = activePlanetId.value
  const dock = allPlanetStates.value[planetId]?.dock
  if (!dock) return
  buildError.value = ''
  const { postUnitBuild } = useHawkStarApi()
  try {
    const result = await postUnitBuild(planetId, unitKey)
    const res = allPlanetStates.value[planetId].resources
    for (const [r, amt] of Object.entries(UNIT_COSTS[unitKey].cost)) {
      res[r] = Math.max(0, (res[r] ?? 0) - amt)
    }
    dock[SPY_DOCK[unitKey].build] = { endsAt: result.endsAt, startedAt: result.buildStartedAt ?? Date.now() }
  } catch (e) {
    buildError.value = e.message
  }
}

const buildSpyDrone     = () => canBuildSpyDrone.value     ? buildSpyUnit('spy_drone')     : undefined
const buildSpySatellite = () => canBuildSpySatellite.value ? buildSpyUnit('spy_satellite') : undefined

// ── Reading a report ──────────────────────────────────────
// `intel` rides along on the galaxy planet. Null for your own space (which needs
// no espionage) and for anything never looked at.
const planetIntel = (planetId) => {
  for (const sys of galaxySystems.value) {
    const p = sys.planets.find(pl => pl.id === planetId)
    if (p) return p.intel ?? null
  }
  return null
}

const hasLiveSatellite = (planetId) => !!planetIntel(planetId)?.live

const intelAgeHours = (planetId) => {
  const i = planetIntel(planetId)
  return i ? Math.max(0, (now.value - i.observedAt) / 3600000) : null
}

// A report older than SPY.staleHours is drawn as stale: still the best you have,
// but old enough that the galaxy may well have moved on without you.
const isIntelStale = (planetId) => {
  const h = intelAgeHours(planetId)
  return h != null && h >= SPY.staleHours
}

// How long this satellite has been in orbit. There is no countdown any more —
// it transmits until the planet below shoots it down — so the only honest
// number is how long it has been watching.
const satelliteAgeHours = (planetId) => {
  const i = planetIntel(planetId)
  if (!i?.live || !i.satelliteSince) return null
  return Math.max(0, (now.value - i.satelliteSince) / 3600000)
}

const isPlanetSpied = (planetId) => spiedPlanets.value.includes(planetId)

const isSpyingPlanet = (planetId) => !!allActiveSpyMissions.value.find(m => m.planetId === planetId)

// Everything about the target that makes it worth sending something. The unit
// itself is checked separately, so the UI can say "nothing in the dock" instead
// of hiding the button. The system must be scanned — you cannot spy on a place
// you have not found — and one flight at a time leaves the planet.
//
// A stale report is deliberately NOT a blocker: refreshing it is the drone's
// standing job. Only a live satellite makes another unit pointless.
const isSpyTarget = (planetId, systemId) =>
  spyDroneLevel.value > 0 &&
  systemId !== homeSystemId.value &&
  systemContacts.value[systemId]?.scanState === 'scanned' &&
  !hasLiveSatellite(planetId) &&
  !isSpyingPlanet(planetId) &&
  activeSpyMissions.value.length < 1

const canSendSpyDrone = (planetId, systemId) =>
  spyDroneInventory.value > 0 && isSpyTarget(planetId, systemId)

// A satellite is placed, not sent looking: it needs a planet that has been
// surveyed once, so a drone always goes first. The server re-checks this.
const canSendSpySatellite = (planetId, systemId) =>
  spySatelliteInventory.value > 0 &&
  !!planetIntel(planetId) &&
  isSpyTarget(planetId, systemId)

const sendSpyUnit = async (planetId, systemId, unitKey, fromPlanetId) => {
  const check = unitKey === 'spy_satellite' ? canSendSpySatellite : canSendSpyDrone
  if (!check(planetId, systemId)) return
  const fromId = fromPlanetId ?? activePlanetId.value
  buildError.value = ''
  const { postSpyMission } = useHawkStarApi()
  try {
    const result = await postSpyMission(fromId, planetId, unitKey)
    const dock = allPlanetStates.value[fromId]?.dock
    if (dock) {
      dock.activeSpyMissions.push({ planetId, systemId, unit: unitKey, endsAt: result.endsAt })
      const inv = SPY_DOCK[unitKey].inventory
      dock[inv] = Math.max(0, dock[inv] - 1)
    }
  } catch (e) {
    buildError.value = e.message
  }
}

const sendSpyDrone     = (planetId, systemId, fromPlanetId) => sendSpyUnit(planetId, systemId, 'spy_drone', fromPlanetId)
const sendSpySatellite = (planetId, systemId, fromPlanetId) => sendSpyUnit(planetId, systemId, 'spy_satellite', fromPlanetId)

const remainingSpySec = (planetId) => {
  const m = allActiveSpyMissions.value.find(m => m.planetId === planetId)
  return m ? Math.max(0, Math.ceil((m.endsAt - now.value) / 1000)) : 0
}

// Width-based, unlike the in-system flights: the dock panel has no keyframes, so
// an animationDuration would leave the bar empty. Start time is derived from the
// flight length, which is fixed per system pair.
const spyProgressStyle = (planetId) => {
  const m = allActiveSpyMissions.value.find(m => m.planetId === planetId)
  if (!m) return {}
  const total = spyFlightTime(m.systemId ?? planetSystemId(planetId)) * 1000
  if (!total) return {}
  const pct = Math.min(100, Math.max(0, (1 - (m.endsAt - now.value) / total) * 100))
  return { width: `${pct}%` }
}

const buildBarStyle = (build) => {
  if (!build) return {}
  const pct = Math.min(100, Math.max(0, (now.value - build.startedAt) / (build.endsAt - build.startedAt) * 100))
  return { width: `${pct}%` }
}

const spyBuildProgressStyle       = computed(() => buildBarStyle(spyDroneBuild.value))
const satelliteBuildProgressStyle = computed(() => buildBarStyle(spySatelliteBuild.value))

// Helper: storage caps for any planet (used when delivering cargo)
const maxStorageForPlanet = (planetId) => {
  const pb = allPlanetStates.value[planetId]?.buildings ?? {}
  const caps = {}
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
  const home = galaxySystems.value.find(s => s.id === homeSystemId.value)
  const target = galaxySystems.value.find(s => s.id === targetSystemId)
  if (!home || !target) return SIGNAL_SPEED_BASE
  const dist = Math.sqrt(Math.pow(target.x - home.x, 2) + Math.pow(target.y - home.y, 2))
  const factor = interstellarCommLevel.value >= 2 ? 0.5 : 1
  return Math.max(10, Math.round(dist * factor * buildTimeFactor.value))
}

const activeScan = computed(() =>
  Object.entries(systemContacts.value).find(([, c]) => c.scanState === 'scanning')?.[0] ?? null
)

const scanDuration = (targetSystemId) => {
  const home   = galaxySystems.value.find(s => s.id === homeSystemId.value)
  const target = galaxySystems.value.find(s => s.id === targetSystemId)
  if (!home || !target) return Math.round(7200 * buildTimeFactor.value)
  const dist    = Math.sqrt(Math.pow(target.x - home.x, 2) + Math.pow(target.y - home.y, 2))
  const baseSec = Math.max(7200, Math.round(dist * 180))
  return Math.round(baseSec * buildTimeFactor.value)
}

const canScanSystem = (systemId) => {
  if (starMapLevel.value < 3) return false
  if (activeScan.value !== null) return false
  const contact = systemContacts.value[systemId]
  return contact?.scanState === 'unscanned'
}

const scanSystem = async (systemId) => {
  if (!canScanSystem(systemId)) return
  // Optimistic update while API call is in flight
  systemContacts.value[systemId] = {
    scanState:  'scanning',
    scanEndsAt: Date.now() + scanDuration(systemId) * 1000,
  }
  try {
    const { postScanSystem } = useHawkStarApi()
    const data = await postScanSystem(systemId)
    systemContacts.value[systemId] = {
      scanState:  'scanning',
      scanEndsAt: data.scanEndsAt,
    }
  } catch (e) {
    // Rollback optimistic update
    systemContacts.value[systemId] = { scanState: 'unscanned', scanEndsAt: null }
    console.error('[hawk-star] Scan failed:', e)
  }
}

const canMessageSystem = (systemId) =>
  interstellarCommLevel.value >= 1 &&
  systemContacts.value[systemId]?.scanState === 'scanned'

const sendMessage = async (systemId, messageKeys) => {
  if (!canMessageSystem(systemId)) return
  if (!Array.isArray(messageKeys) || messageKeys.length === 0) return
  const sysId = typeof systemId === 'string' ? parseInt(systemId, 10) : systemId
  const sys = galaxySystems.value.find(s => s.id === sysId)
  if (!sys) return
  try {
    const { postSendMessage } = useHawkStarApi()
    const data = await postSendMessage(sysId, messageKeys)
    // The scan roll-up, not the planet owners — those are hidden until a spy
    // drone has been there, and the log bubble still needs a name and portrait.
    const owners = sys.inhabitants ?? []
    commLog.value.push({
      id:           data.messageId,
      direction:    'sent',
      systemId:     sysId,
      systemName:   sys.name,
      owners,
      messageKey:   messageKeys.join(' '),
      timestamp:    Date.now(),
      travelEndsAt: data.travelEndsAt,
    })
  } catch (e) {
    console.error('[hawk-star] Send message failed:', e)
  }
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

// canConvert: checks level/lock/affordability for starting a new job
const canConvert = (buildingId, recipeIndex) => {
  const recipe = BUILDINGS[buildingId]?.conversions?.[recipeIndex]
  if (!recipe) return false
  const lvl = getLevel(buildingId)
  if (lvl === 0) return false
  if (recipe.requiresLevel && lvl < recipe.requiresLevel) return false
  return canAfford(recipe.input)
}

// count: total runs to queue.
const startConversion = async (buildingId, recipeIndex, count = 1) => {
  if (!canConvert(buildingId, recipeIndex)) return
  const planetId = activePlanetId.value
  const queues   = allPlanetStates.value[planetId]?.conversionQueues
  if (!queues) return

  buildError.value = ''
  const { postConvert } = useHawkStarApi()

  try {
    const result = await postConvert(planetId, buildingId, recipeIndex, count)
    // Optimistic cost deduction
    const recipe = BUILDINGS[buildingId]?.conversions?.[recipeIndex]
    const res    = allPlanetStates.value[planetId]?.resources
    if (recipe && res) {
      for (const [r, amt] of Object.entries(recipe.input)) {
        res[r] = Math.max(0, (res[r] ?? 0) - amt * count)
      }
    }
    queues.push({
      buildingId,
      recipeIndex,
      planetId,
      endsAt:    result.endsAt,
      remaining: Math.max(0, count - 1),
    })
  } catch (e) {
    buildError.value = e.message
  }
}

const remainingConversionSec = (q) =>
  Math.max(0, Math.ceil((q.endsAt - now.value) / 1000))

const conversionProgressStyle = (q) => {
  const ct = conversionTimeForPlanet(q.buildingId, q.recipeIndex, q.planetId)
  const startedAt = q.endsAt - ct * 1000
  const pct = Math.min(100, Math.max(0, (now.value - startedAt) / (ct * 1000) * 100))
  return { width: `${pct}%` }
}

// ── LocalStorage persistence (dev settings only) ──────────────────────────────
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

export const resetGame = () => {
  location.reload()
}

// ── Tick ───────────────────────────────────────────────────
const tick = () => {
  now.value = Date.now()

  // Sync resources at each wall-clock minute boundary
  const currentMinute = Math.floor(now.value / 60000)
  if (gameLoaded.value && activePlanetId.value && lastResourceSync.value > 0 && currentMinute > lastResourceSync.value) {
    lastResourceSync.value = currentMinute
    const { fetchGameState } = useHawkStarApi()
    fetchGameState(activePlanetId.value).then(state => {
      const ps = allPlanetStates.value[activePlanetId.value]
      if (ps && state?.resources) {
        Object.assign(ps.resources, state.resources)
        lastResourceSyncMs.value = Date.now()
      }
    }).catch(() => {})
  }

  // Refresh comm log every 20 seconds so incoming messages appear without a page reload
  const currentSec = Math.floor(now.value / 1000)
  if (gameLoaded.value && lastCommLogSync.value > 0 && currentSec - lastCommLogSync.value >= 20) {
    lastCommLogSync.value = currentSec
    const { fetchCommLog } = useHawkStarApi()
    fetchCommLog().then(log => { commLog.value = log.slice(); recomputeUnread() }).catch(() => {})
  }

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
      // No per-batch input deduction — backend deducts all batches (input × count) upfront.
      if (q.remaining > 0) {
        q.endsAt = now.value + conversionTimeForPlanet(q.buildingId, q.recipeIndex, pid) * 1000
        q.remaining -= 1
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
              // Pull the server's starting state (population, empty recruit pool)
              refreshPlanetState(m.planetId).catch(() => {})
            }
          }
          const tgt = homeSystem.value?.planets.find(p => p.id === m.planetId)?.name ?? m.planetId
          notifications.value.push({ id: `notif_${Date.now()}_msn_${pid}_colony_${m.planetId}`, type: 'mission_done', icon: '🌍', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.colonyLanded', details: `→ ${tgt}`, timestamp: Date.now() })
          dock.activeColonyMissions.splice(i, 1)
        }
      }
      // Cargo drone build
      if (dock.cargoDroneBuild && dock.cargoDroneBuild.endsAt <= now.value) {
        dock.cargoDroneInventory += 1
        dock.cargoDroneBuild = null
        // The hold only exists once the drone does — pull it in from the server
        if (!pstate.cargo) refreshPlanetState(pid).catch(() => {})
        notifications.value.push({ id: `notif_${Date.now()}_unit_${pid}_cargo`, type: 'unit_done', icon: '📦', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.cargoReady', timestamp: Date.now() })
      }
      // Cargo delivery arrived → the server unloads and starts the return leg,
      // so pull the truth in rather than guessing at it locally.
      for (let i = dock.activeCargoMissions.length - 1; i >= 0; i--) {
        const m = dock.activeCargoMissions[i]
        if (m.endsAt <= now.value) {
          const tgt = homeSystem.value?.planets.find(p => p.id === m.planetId)?.name ?? m.planetId
          notifications.value.push({ id: `notif_${Date.now()}_msn_${pid}_cargo_${m.planetId}`, type: 'mission_done', icon: '📦', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.cargoDelivered', details: `→ ${tgt}`, timestamp: Date.now() })
          dock.activeCargoMissions.splice(i, 1)
          refreshPlanetState(pid).catch(() => {})
          // The goods landed on the target planet — refresh it too if we hold it
          if (allPlanetStates.value[m.planetId]) refreshPlanetState(m.planetId).catch(() => {})
        }
      }
      // Spy drone build
      if (dock.spyDroneBuild && dock.spyDroneBuild.endsAt <= now.value) {
        dock.spyDroneInventory += 1
        dock.spyDroneBuild = null
        notifications.value.push({ id: `notif_${Date.now()}_unit_${pid}_spy`, type: 'unit_done', icon: '🕵️', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.spyReady', timestamp: Date.now() })
      }
      // Spy satellite build
      if (dock.spySatelliteBuild && dock.spySatelliteBuild.endsAt <= now.value) {
        dock.spySatelliteInventory += 1
        dock.spySatelliteBuild = null
        notifications.value.push({ id: `notif_${Date.now()}_unit_${pid}_sat`, type: 'unit_done', icon: '📡', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.satelliteReady', timestamp: Date.now() })
      }
      // An espionage flight landed → the server wrote down what it saw, so the
      // galaxy has to be pulled again. Neither unit comes back.
      for (let i = dock.activeSpyMissions.length - 1; i >= 0; i--) {
        const m = dock.activeSpyMissions[i]
        if (m.endsAt <= now.value) {
          if (!spiedPlanets.value.includes(m.planetId)) spiedPlanets.value.push(m.planetId)
          const sat = m.unit === 'spy_satellite'
          // Counted locally too, so the onboarding step ticks on arrival rather
          // than waiting for the next state sync.
          if (sat) satelliteDeployments.value += 1
          const sys = galaxySystems.value.find(s => s.id === m.systemId)
          const tgt = sys?.planets.find(p => p.id === m.planetId)?.name ?? m.planetId
          notifications.value.push({
            id: `notif_${Date.now()}_msn_${pid}_spy_${m.planetId}`, type: 'mission_done',
            icon: sat ? '📡' : '🕵️', planetId: pid, planetName: pstate.planetName,
            labelKey: sat ? 'hawkStar.notifications.satelliteOnline' : 'hawkStar.notifications.spyDone',
            details: `→ ${tgt}`, timestamp: Date.now(),
          })
          dock.activeSpyMissions.splice(i, 1)
          reloadGalaxy().catch(() => {})
        }
      }
      // Empty return leg landed → the drone is back in the dock
      for (let i = dock.returningCargoMissions.length - 1; i >= 0; i--) {
        const m = dock.returningCargoMissions[i]
        if (m.endsAt <= now.value) {
          notifications.value.push({ id: `notif_${Date.now()}_msn_${pid}_cargo_back`, type: 'mission_done', icon: '📦', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.cargoReturned', timestamp: Date.now() })
          dock.returningCargoMissions.splice(i, 1)
          refreshPlanetState(pid).catch(() => {})
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
      if (levelDef?.popBonus) {
        pr.population += levelDef.popBonus
      }
      // Power plant just built/upgraded: ensure a battery object exists locally so
      // the grid-uptime blackout applies immediately (no reload). A fresh plant's
      // battery starts empty — mirrors the server → instant blackout until charged.
      if (id === 'power_plant') {
        const drain = POWER_BATTERY.drainPerHour[Math.min(state.level, 6)] ?? POWER_BATTERY.drainPerHour[6]
        if (!pstate.battery) {
          pstate.battery = { charge: 0, drainPerHour: drain, powerPlantLevel: state.level, syncedAt: Date.now() }
        } else {
          pstate.battery.powerPlantLevel = state.level
          pstate.battery.drainPerHour    = drain
        }
      }
      // Same for the shield: the generator is installed uncharged, so the panel
      // has to appear right away with an empty bar asking to be filled.
      if (id === 'shield_generator' && !pstate.shield) {
        pstate.shield = {
          charge:       0,
          drainPerHour: SHIELD.drainPerHour,
          clickPercent: SHIELD.clickPercent,
          clickCost:    SHIELD.clickCost,
          syncedAt:     Date.now(),
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
      const sys = galaxySystems.value.find(s => s.id === sysId)
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
}

// ── API init ───────────────────────────────────────────────

const applyGameState = (planetId, state) => {
  const apiSlots = Object.fromEntries(state.slots.map(s => [s.slot, s.unlocked]))
  const slots = PLANET_GRID.map(s => ({ ...s, unlocked: apiSlots[s.slot] ?? s.startsUnlocked }))

  const freshBuildings = Object.fromEntries(
    Object.keys(BUILDINGS).map(id => [id, { level: 0, buildEndsAt: null }])
  )
  const buildings = { ...freshBuildings, ...state.buildings }

  // Dock inventory lives on the server — units survive a reload, and a mission
  // can only be launched with a finished unit parked in the dock.
  const unitState = (key) => {
    const u = state.units?.[key]
    return {
      quantity: u?.quantity ?? 0,
      build:    u?.buildEndsAt
        ? { endsAt: u.buildEndsAt, startedAt: u.buildStartedAt ?? Date.now() }
        : null,
    }
  }
  const drone  = unitState('recon_drone')
  const colony = unitState('colony_ship')
  const cargo  = unitState('cargo_drone')
  const spy    = unitState('spy_drone')
  const spySat = unitState('spy_satellite')

  const droneMissions  = (state.missions ?? []).filter(m => m.type === 'recon_drone')
    .map(m => ({ planetId: m.toPlanetId, endsAt: m.endsAt }))
  const colonyMissions = (state.missions ?? []).filter(m => m.type === 'colony_ship')
    .map(m => ({ planetId: m.toPlanetId, endsAt: m.endsAt }))
  // The target sits in another system, so the mission carries the system id for
  // the countdown — planetSystemId() resolves it from the galaxy. Both espionage
  // units share the list; `unit` is what the icon and the arrival handler read.
  const spyMissions    = (state.missions ?? [])
    .filter(m => (m.type === 'spy_drone' || m.type === 'spy_satellite') && m.fromPlanetId === planetId)
    .map(m => ({ planetId: m.toPlanetId, systemId: planetSystemId(m.toPlanetId), unit: m.type, endsAt: m.endsAt }))

  // A cargo run is two mission rows: the loaded outbound leg and the empty return
  // leg created on arrival. Only the outbound one points at a destination.
  const cargoOut = (state.missions ?? [])
    .filter(m => m.type === 'cargo_drone' && m.leg !== 'back' && m.fromPlanetId === planetId)
    .map(m => ({ planetId: m.toPlanetId, endsAt: m.endsAt }))
  const cargoBack = (state.missions ?? [])
    .filter(m => m.type === 'cargo_drone' && m.leg === 'back' && m.toPlanetId === planetId)
    .map(m => ({ planetId: m.fromPlanetId, endsAt: m.endsAt }))

  const convQueues = (state.conversionQueues ?? []).map(q => ({
    buildingId: q.buildingKey, recipeIndex: q.recipeIndex,
    planetId,  endsAt: q.endsAt,  remaining: q.remaining,
  }))

  allPlanetStates.value[planetId] = {
    planetType:       state.planet.type,
    planetName:       state.planet.name,
    resources:        state.resources,
    slots,
    buildings,
    dock: {
      reconDroneInventory:  drone.quantity,
      reconDroneBuild:      drone.build,
      activeDroneMissions:  droneMissions,
      colonyShipInventory:  colony.quantity,
      colonyShipBuild:      colony.build,
      activeColonyMissions: colonyMissions,
      cargoDroneInventory:  cargo.quantity,
      cargoDroneBuild:      cargo.build,
      activeCargoMissions:  cargoOut,
      returningCargoMissions: cargoBack,
      spyDroneInventory:    spy.quantity,
      spyDroneBuild:        spy.build,
      spySatelliteInventory: spySat.quantity,
      spySatelliteBuild:    spySat.build,
      activeSpyMissions:    spyMissions,
    },
    conversionQueues: convQueues,
    battery: state.battery ? { ...state.battery, syncedAt: Date.now() } : null,
    // null while the planet has no finished shield generator
    shield:  state.shield  ? { ...state.shield,  syncedAt: Date.now() } : null,
    // Foreign satellites in this orbit. Always empty without an orbital_defense
    // — the building is the sensor, so an empty list means "nothing detected",
    // not "nothing there".
    foreignSatellites: state.foreignSatellites ?? [],
    recruit: state.recruit ? { ...state.recruit, syncedAt: Date.now() } : null,
    // null when the planet has never built a cargo drone
    cargo: state.cargo ? { ...state.cargo, cargo: { ...(state.cargo.cargo ?? {}) } } : null,
    // null while the anomaly tile is locked or the next roll is not due yet
    anomaly: state.anomaly ?? null,
  }

  globalResearch.value = { ...globalResearch.value, ...state.globalResearch }

  // Seed planets revealed by completed drone missions (survive page reload)
  for (const pid of (state.droneScannedPlanets ?? [])) {
    if (!playerScannedPlanets.value.includes(pid)) playerScannedPlanets.value.push(pid)
  }

  // Player-wide like the list above: every planet a spy drone has uncovered
  for (const pid of (state.spiedPlanets ?? [])) {
    if (!spiedPlanets.value.includes(pid)) spiedPlanets.value.push(pid)
  }

  // Player-wide, not per planet — every state load reports the same total
  cargoDeliveries.value      = state.cargoDeliveries ?? 0
  satelliteDeployments.value = state.satelliteDeployments ?? 0

  // Our own satellites that were shot down. The server hands each loss over
  // exactly once, so this list is the notification — losing one is an event, not
  // something to discover weeks later by missing a chip on the map.
  for (const lost of (state.satellitesLost ?? [])) {
    // Several planets can load their state at once (the solar view pulls them
    // all), so two responses may carry the same loss before the server has
    // cleared it. The id is derived from the event, not from the moment we saw
    // it, which makes the guard below reliable.
    const id = `notif_${lost.lostAt}_satlost_${lost.planetId}`
    if (notifications.value.some(n => n.id === id)) continue
    notifications.value.push({
      id,
      type: 'satellite_lost', icon: '💥',
      planetId: lost.planetId, planetName: lost.systemName,
      labelKey: 'hawkStar.notifications.satelliteLost',
      details: lost.planetName,
      timestamp: lost.lostAt,
    })
  }
}

// The galaxy response is filtered per player: `owner` is only filled in for
// planets you are allowed to see, and `known: false` marks the ones a spy drone
// has yet to uncover. Everything else about a system stays public.
const mapGalaxy = (galaxy, myId) => galaxy.map(sys => ({
  id: sys.id, name: sys.name, x: sys.x, y: sys.y, starClass: sys.starClass,
  inhabited:   !!sys.inhabited,
  // Residents with their planet counts — only sent for a scanned system, and
  // deliberately without naming which planets are theirs.
  inhabitants: sys.inhabitants ?? [],
  planets: sys.planets.map(p => ({
    id: p.id, name: p.name,
    // null until something has flown past: the type is part of the survey, not
    // free with the star chart. Home-system planets always carry it.
    type: p.type ?? null,
    state: p.owner
      ? (p.owner.playerId === myId ? 'own' : 'colonized')
      : (p.known === false ? 'unknown' : 'uncolonized'),
    owner: p.owner ?? null,
    known: p.known !== false,
    // { observedAt, live, satelliteSince, shield } — null for your own space and
    // for anything never looked at. This is the report, not a live reading.
    // `shield` is the satellite's extra finding and carries its own date.
    intel: p.intel ?? null,
  })),
}))

// A landed spy drone changes what the server is willing to tell us, so the
// galaxy has to be pulled again — the response, not the client, holds the secret.
export const reloadGalaxy = async () => {
  const { player } = useHawkStarAuth()
  const { fetchGalaxy } = useHawkStarApi()
  galaxySystems.value = mapGalaxy(await fetchGalaxy(), player.value?.id)
}

export const refreshPlanetState = async (planetId) => {
  const { fetchGameState } = useHawkStarApi()
  const state = await fetchGameState(planetId)
  applyGameState(planetId, state)
}

export const initFromApi = async () => {
  gameLoaded.value = false
  initError.value  = ''

  const { player, homePlanetId: authHomePlanetId } = useHawkStarAuth()
  const { fetchGalaxy, fetchGameState, fetchContacts, fetchCommLog } = useHawkStarApi()
  const myId = player.value?.id

  // Load galaxy
  try {
    galaxySystems.value = mapGalaxy(await fetchGalaxy(), myId)
  } catch (e) {
    console.error('[hawk-star] Galaxy load failed:', e)
    initError.value = `Failed to load galaxy: ${e.message}`
    return
  }

  const hpId = authHomePlanetId.value
  if (!hpId) {
    initError.value = 'No home planet assigned — please re-login'
    return
  }

  // Reset state
  allPlanetStates.value        = {}
  playerScannedPlanets.value   = [hpId]
  spiedPlanets.value           = []
  lastIntercepted.value        = null
  interceptError.value         = null
  playerColonizedPlanets.value = galaxySystems.value
    .flatMap(s => s.planets).filter(p => p.owner?.playerId === myId).map(p => p.id)

  homePlanetId.value   = hpId
  activePlanetId.value = hpId

  // Derive home system (needed before contacts load)
  systemContacts.value = Object.fromEntries(
    galaxySystems.value.map(s => [s.id, { scanState: 'unscanned', scanEndsAt: null }])
  )
  for (const sys of galaxySystems.value) {
    if (sys.planets.some(p => p.id === hpId)) {
      homeSystemId.value = sys.id
      systemContacts.value[sys.id] = { scanState: 'scanned', scanEndsAt: null }
      break
    }
  }

  // Load scan contacts from API (merges over defaults above)
  try {
    const { contacts: contactMap, theyScannedMe: theyScannedMeList } = await fetchContacts()
    for (const [sysId, contact] of Object.entries(contactMap ?? {})) {
      systemContacts.value[sysId] = {
        scanState:    contact.scanState,
        scanEndsAt:   contact.scanEndsAt,
        mutualScan:   contact.mutualScan ?? false,
        theyScannedMe: false,
      }
    }
    // Mark systems whose owners have already scanned us (but we haven't scanned them)
    for (const sysId of (theyScannedMeList ?? [])) {
      const key = String(sysId)
      if (systemContacts.value[key]) {
        systemContacts.value[key].theyScannedMe = true
      } else {
        systemContacts.value[key] = { scanState: 'unscanned', scanEndsAt: null, mutualScan: false, theyScannedMe: true }
      }
    }
    // Home system is always scanned regardless
    if (homeSystemId.value) {
      systemContacts.value[homeSystemId.value] = { scanState: 'scanned', scanEndsAt: null, mutualScan: false, theyScannedMe: false }
    }
  } catch (e) {
    console.error('[hawk-star] Contacts load failed (non-fatal):', e)
  }

  // Load comm log from API (API returns ASC, unshift-based display expects newest first)
  try {
    const log = await fetchCommLog()
    commLog.value = log.slice()
    lastCommLogSync.value = Math.floor(Date.now() / 1000)
    recomputeUnread()
  } catch (e) {
    console.error('[hawk-star] CommLog load failed (non-fatal):', e)
  }

  // Load home planet game state
  try {
    const state = await fetchGameState(hpId)
    applyGameState(hpId, state)
    playerName.value        = player.value?.username    ?? ''
    playerPortrait.value    = player.value?.portrait    ?? '👨‍🚀'
    playerDisposition.value = player.value?.disposition ?? 'neutral'
    lastResourceSync.value   = Math.floor(Date.now() / 60000)
    lastResourceSyncMs.value = Date.now()
    // Always open on the base tile so new players see the onboarding panel
    activeSlot.value = 5
    gameLoaded.value = true
  } catch (e) {
    console.error('[hawk-star] Game state load failed:', e)
    initError.value = `Failed to load planet data: ${e.message}`
  }
}

export const startTick = () => {
  if (tickInterval) return
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
    playerPortrait,
    playerDisposition,
    planetName,
    planetType,
    homeSystemId,
    homePlanetId,
    homeSystem,
    galaxySystems,
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
    lockedRequirementInfo,
    nextLevelDef,
    canBuild,
    startBuild,
    hasEnoughPower,
    hasEnoughStaff,
    staffDelta,
    isOffline,
    // power battery
    battery,
    batteryCharge,
    batteryChargeOf,
    batteryHoursToEmpty,
    gridDown,
    gridDownOn,
    chargeBattery,
    // planetary shield
    shield,
    shieldCharge,
    shieldChargeOf,
    shieldHoursToEmpty,
    shieldDown,
    shieldFull,
    canChargeShield,
    shieldError,
    chargeShield,
    // orbital defense — the thing that ends a spy satellite
    hasOrbitalDefense,
    foreignSatellites,
    canIntercept,
    interceptSatellite,
    interceptError,
    lastIntercepted,
    // population recruitment
    recruitPool,
    recruitPoolMax,
    recruitGrowthPerDay,
    canRecruit,
    recruit,
    // anomalies
    anomaly,
    hasAnomaly,
    anomalySecondsLeft,
    planetsWithAnomaly,
    anomalyBusy,
    anomalyError,
    resolveAnomaly,
    // production
    grossProduction,
    totalEnergyDrain,
    production,
    energyDeficit,
    tickProgress,
    // staff
    totalStaffDrain,
    freeWorkers,
    // storage
    maxStorage,
    isStorageFull,
    resourceDisplay,
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
    isDroneTarget,
    canSendDrone,
    sendReconDrone,
    droneFlightTime,
    remainingDroneSec,
    droneProgressStyle,
    droneBuildProgressStyle,
    droneFlightTimeBetween,
    // colony ships
    playerColonizedPlanets,
    cargoDeliveries,
    colonyShipInventory,
    colonyShipBuild,
    activeColonyMissions,
    allActiveColonyMissions,
    colonyShipBuildTime,
    colonyShipCrew,
    hasColonyCrew,
    canBuildColonyShip,
    buildColonyShip,
    isColonyTarget,
    canSendColonyShip,
    sendColonyShip,
    colonyFlightTime,
    remainingColonySec,
    colonyProgressStyle,
    colonyShipBuildProgressStyle,
    colonyFlightTimeBetween,
    // cargo drone
    cargoDroneLevel,
    cargoDroneInventory,
    cargoDroneBuild,
    cargoDroneReady,
    hasCargoDrone,
    cargoState,
    cargoManifest,
    cargoLoaded,
    cargoCapacity,
    cargoLoadable,
    cargoBuildTime,
    canBuildCargoDrone,
    buildCargoDrone,
    cargoBuildProgressStyle,
    canLoadMore,
    loadCargo,
    unloadCargo,
    unloadAllCargo,
    isCargoTarget,
    canSendCargo,
    sendCargoDrone,
    activeCargoMissions,
    allActiveCargoMissions,
    returningCargoMission,
    remainingCargoSec,
    remainingCargoReturnSec,
    cargoProgressStyle,
    cargoReturnProgressStyle,
    cargoFlightTimeBetween,
    // espionage
    spiedPlanets,
    satelliteDeployments,
    spyDroneLevel,
    spyDroneInventory,
    spyDroneBuild,
    spySatelliteInventory,
    spySatelliteBuild,
    spyBuildTime,
    satelliteBuildTime,
    spyFlightTime,
    canBuildSpyDrone,
    canBuildSpySatellite,
    buildSpyDrone,
    buildSpySatellite,
    spyBuildProgressStyle,
    satelliteBuildProgressStyle,
    spyProgressStyle,
    planetIntel,
    hasLiveSatellite,
    intelAgeHours,
    isIntelStale,
    satelliteAgeHours,
    isPlanetSpied,
    isSpyingPlanet,
    isSpyTarget,
    canSendSpyDrone,
    canSendSpySatellite,
    sendSpyDrone,
    sendSpySatellite,
    remainingSpySec,
    activeSpyMissions,
    allActiveSpyMissions,
    planetSystemId,
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
    canConvert,
    startConversion,
    remainingConversionSec,
    conversionProgressStyle,
    // api feedback
    buildError,
    gameLoaded,
    initError,
    // notifications
    allPlanetStates,
    notifications,
    dismissNotification,
    dismissAllNotifications,
    // communication
    interstellarCommLevel,
    activeScan,
    systemContacts,
    commLog,
    unreadSystems,
    markSystemRead,
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
