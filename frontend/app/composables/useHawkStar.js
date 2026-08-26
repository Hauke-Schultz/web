import { ref, computed, watch } from 'vue'
import { TILE_TYPES, PLANET_GRID, BUILDINGS, RESOURCES, UNIT_COSTS, PLANET_TYPES, COMM_EMOJIS, SIGNAL_SPEED_BASE, POWER_BATTERY, SHIELD, CARGO, SPY, CONVERSION_MAX_QUEUE, FLEET_PER_WEAPONS_LEVEL, RAID, SALVAGE_FINDS } from '~/utils/hawkStarConfig.js'
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
// What actually went wrong, for the error screen: endpoint, HTTP status and the
// first lines the server printed. A 500 with an empty body is otherwise
// indistinguishable from a network hiccup, and the two need different answers.
const initErrorDetail = ref(null)

const captureInitError = (e, endpoint) => {
  initErrorDetail.value = {
    endpoint: e?.endpoint ?? endpoint,
    status:   e?.status ?? null,
    body:     (e?.body ?? '').toString().slice(0, 600),
    at:       new Date().toISOString(),
  }
}

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
  corvetteInventory:      0,
  // A warship build is a batch: { endsAt, startedAt, count } — the whole
  // squadron lands at once, so `count` is what the timer will deliver.
  corvetteBuild:          null,
  activeRaids:            [],   // outbound strikes — one entry per target planet
  returningRaids:         [],   // survivors on the way home, loot aboard
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

const isHomePlanet = computed(() => !!homePlanetId.value && activePlanetId.value === homePlanetId.value)

// One place decides whether a tile can be used on a given planet. `unlocked` is
// the server's fact about the slot; `homeOnly` is a rule about the planet, and
// everything that walks a planet's slots — the grid, the empire warnings, the
// jump-to-tile — asks this instead of reading `unlocked` on its own. Three
// copies of the same condition is how a locked tile ends up still raising an
// "empty build slot" warning somewhere else.
const slotUsable = (slot, planetId) =>
  !!slot?.unlocked && (!slot.homeOnly || planetId === homePlanetId.value)

// Computed aliases — Vue tracks nested mutations through these
//
// The stored state stays truthful — the server's flag is untouched; what is
// closed here is the view of it, because `unlocked` is what the grid, the panel
// and `selectSlot` all key off.
const playerSlots = computed(() => {
  const pid = activePlanetId.value
  return (allPlanetStates.value[pid]?.slots ?? [])
    .map(s => (s.unlocked && !slotUsable(s, pid) ? { ...s, unlocked: false } : s))
})
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

// Per-planet twin of production.energy — the board has to judge colonies the
// active-planet computeds never look at.
//
// Production counts finished levels, drain counts the level a building is
// UPGRADING to. That asymmetry is deliberate and matches the planet view: the
// upgrade's appetite arrives the moment it is queued, its output only when it
// lands, which is exactly the window in which a planet quietly runs dry.
//
// Null during a blackout: nothing produces and nothing draws, and the blackout
// alarm already says everything there is to say.
const energyBalanceOf = (planetId) => {
  const st = allPlanetStates.value[planetId]
  if (!st || gridDownOn(planetId)) return null
  let produced = 0
  let drain    = 0
  for (const [id, bs] of Object.entries(st.buildings ?? {})) {
    if ((bs.level ?? 0) > 0) produced += BUILDINGS[id]?.levels[bs.level - 1]?.production?.energy ?? 0
    const lvl = bs.buildEndsAt ? (bs.level ?? 0) + 1 : (bs.level ?? 0)
    if (lvl > 0) drain += BUILDINGS[id]?.levels[lvl - 1]?.energyDrain ?? 0
  }
  return { produced, drain, free: produced - drain }
}

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

// ── Meter bands ───────────────────────────────────────────
// Every meter in the game is coloured by the same three bands, and four places
// now ask for them: the orbit marker's ring, the planet list's chips, the strip
// over the planet grid, and the tile status bars. Written once so a battery at
// 19 % is "low" everywhere or nowhere.
const meterLevel = (pct) => (pct <= 0 ? 'empty' : pct < 20 ? 'low' : 'ok')

// The blackout is the one state worth shouting about: an empty battery stops the
// whole planet, while an empty shield costs nothing today. So the battery gets a
// fourth band the shield has no use for.
const batteryLevelOf = (planetId) =>
  gridDownOn(planetId) ? 'down' : meterLevel(Math.round(batteryChargeOf(planetId) ?? 0))

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
// The unrounded rate. The panel counts down to the next whole recruit with it,
// and dividing the rounded per-day figure back down would put that countdown out
// by however much the rounding threw away.
const recruitGrowthPerHour = computed(() => recruitState.value?.growthPerHour ?? 0)

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

// A locked tile has no type as far as the panel is concerned — every
// `isXTile` in `HsTilePanel` hangs off this, so one guard here is what keeps a
// stale selection (say, slot 12 still active when the view moves to a colony)
// from rendering a game the planet does not have.
const activeTileType = computed(() => {
  const s = activeSlotDef.value
  return s?.unlocked && s.tileType ? TILE_TYPES[s.tileType] : null
})

const selectSlot = (slot) => {
  if (!slot.unlocked) return
  activeSlot.value = slot.slot
}

// ── Building helpers ───────────────────────────────────────
const buildingsForActiveSlot = computed(() => {
  if (!activeTileType.value) return []
  return Object.values(BUILDINGS).filter(b =>
    b.tileType === activeTileType.value.id &&
    // `planetTypes` decides what you may BUILD here, not what already stands.
    // A building the planet has is kept in the list whatever the gate says —
    // the four refineries were ungated for a while, and a bio lab put up on a
    // terrestrial world in that window would otherwise vanish from this panel
    // while going on drawing its 6 energy and 3 workers: a ghost you can feel
    // but not find. Its recipe section, its level and its batch all hang off
    // this list.
    (!b.planetTypes || b.planetTypes.includes(planetType.value) || getLevel(b.id) > 0) &&
    // A homeOnly building is left out of a colony's list entirely rather than
    // shown as locked — everything it produces is homeOnly too, so there is
    // nothing a colony could ever unlock there.
    (!b.homeOnly || isHomePlanet.value)
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

// Below this much spare energy a planet is one upgrade away from browning out.
// Absolute rather than a share of production: what decides whether the next
// building can be switched on is the number of units left over, not the
// percentage — six spare is six spare on a starter colony and on a full one.
const ENERGY_LOW_FREE = 6

// Active planet, for the resource bar. The board computes the same thing per
// planet in planetStatus() off energyBalanceOf().
const energyLow = computed(() =>
  !energyDeficit.value && (production.value.energy ?? 0) < ENERGY_LOW_FREE
)

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

// ── Salvage fishing (slot 12) ──────────────────────────────
// Player-wide, not per planet: scrap is a currency and the hold is what caps it,
// so one purse serves the whole empire. The timing game itself never comes here
// — the panel plays it and reports only the outcome.
const salvageState = ref(null)

const salvageScrap = computed(() => salvageState.value?.scrap ?? 0)
const salvageFinds = computed(() => salvageState.value?.finds ?? [])
const salvageHoldMax = computed(() => salvageState.value?.holdMax ?? 0)

// `hold` is the room LEFT, not the load — it drains as you catch and refills with
// time. Recomputed against `now` for the same reason the recruit pool is: the
// panel is looked at for minutes at a stretch and must not show a stale number.
const salvageHold = computed(() => {
  const s = salvageState.value
  if (!s) return 0
  const hours = (now.value - s.syncedAt) / 3600000
  return Math.min(s.holdMax, s.hold + s.holdPerHour * hours)
})

// Room gone. Casting stays allowed — that is the whole point of capping the
// catch instead of the cast — but the scrap goes back over the side.
const salvageHoldEmpty = computed(() => salvageHold.value < 1)

// The cabinet, in catalogue order and with the locked entries still in it: the
// panel draws all sixteen either way, and a slot that is not yet found is the
// part that makes it a collection rather than a list. `found` is the only thing
// the server has a say in.
const salvageCabinet = computed(() =>
  Object.entries(SALVAGE_FINDS).map(([key, def]) => ({
    key,
    icon:   def.icon,
    effect: def.effect,
    found:  salvageFinds.value.includes(key),
  }))
)

// Avatars that artefacts unlocked. The profile picker appends them to its own
// fixed list — the one reward track the server does nothing about beyond
// recording that the find is owned.
const salvagePortraits = computed(() =>
  salvageCabinet.value.filter(f => f.found && f.effect.type === 'portrait').map(f => f.effect.portrait)
)

// No optimistic update anywhere here: what bites is rolled server-side on
// purpose, so there is nothing to guess, and a refused report (too fast) must
// not leave a phantom gain on screen. A failure is reported as a plain miss.
// `zone` is 'perfect' | 'good' — how tight the click was. It only ever picks
// which weight column the server rolls on, never the payout itself, so claiming
// 'perfect' every time buys a better table and nothing more: the hold still caps
// the day. Skill buys time, exactly as everywhere else in this feature.
// The planet goes along only so an artefact that pays in planet stock has
// somewhere to land; scrap and the hold are player-wide and ignore it.
const reportSalvageCatch = async (hit, zone = null) => {
  const { postSalvageCatch } = useHawkStarApi()
  try {
    const r = await postSalvageCatch(!!hit, zone, activePlanetId.value)
    if (r.salvage) salvageState.value = { ...r.salvage, syncedAt: Date.now() }
    // An artefact that pays in planet stock has just changed this planet's
    // resources behind the composable's back — the same reload every other
    // payout endpoint triggers.
    if (r.find?.grant?.type === 'resources') await refreshPlanetState(activePlanetId.value)
    return r
  } catch (e) {
    console.error('[hawk-star] salvage catch failed:', e)
    return { hit: false, catch: null, gained: 0, find: null, failed: true }
  }
}

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
// One lookup for "how much of this do I have". Almost everything is a stock on
// the active planet; salvage scrap is the exception — player-wide, its own
// table, no column in hs_planet_resources. Every affordability check goes
// through here so that exception is written down exactly once.
const stockOf = (res) =>
  res === 'scrap' ? salvageScrap.value : (playerResources.value[res] ?? 0)

const canAfford = (cost) => {
  for (const [res, amt] of Object.entries(cost)) {
    if (stockOf(res) < amt) return false
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

// What an upgrade adds to the grid, not what the finished level draws in
// total. metal_mine Lv3 already pays 9; going to Lv4 (drain 12) costs 3 more,
// and the row said 12 — a number that appears in no cost anywhere. Mirrors
// staffDelta below, and matches what hasEnoughPower() has always checked.
const energyDelta = (id) => {
  const next = nextLevelDef(id)
  if (!next?.energyDrain) return 0
  const current = getLevel(id) > 0 ? (BUILDINGS[id]?.levels[getLevel(id) - 1]?.energyDrain ?? 0) : 0
  return next.energyDrain - current
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
// Facility levels — the hangar gates every drone, the shipyard every ship.
//
// These read as "what can this planet produce", not "what is built here", so
// the homeOnly rule lives in them: a colony's hangar exists (the cargo drone
// needs it) but produces no recon drones, and one gate here reaches the build
// UI, the send buttons and the mission targeting at once.
const reconDroneLevel = computed(() =>
  isHomePlanet.value ? (playerBuildings.value['drone_hangar']?.level ?? 0) : 0
)
const colonyShipLevel = computed(() =>
  isHomePlanet.value ? (playerBuildings.value['shipyard']?.level ?? 0) : 0
)
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

// A flight's progress is a width driven by `now`, not a CSS animation.
//
// These used to hand out `animationDuration` alone, which only ever worked on a
// bar mounted at the exact moment of launch: the keyframes start at scaleX(0),
// so after a reload a flight two hours in still drew an empty bar. Worse, where
// the receiving CSS carried no keyframes at all (the dock panel's mission rows)
// the duration was ignored and the bar sat permanently full.
//
// Elapsed time is derivable — total flight time minus what is left — so the
// honest form is the one the build bars have always used: compute the
// percentage and set a width.
const flightProgressStyle = (endsAt, totalSec) => {
  if (!endsAt || !totalSec) return {}
  const remaining = Math.max(0, (endsAt - now.value) / 1000)
  return { width: `${Math.min(100, Math.max(0, (1 - remaining / totalSec) * 100))}%` }
}

const droneProgressStyle = (planetId) => {
  const m = allActiveDroneMissions.value.find(m => m.planetId === planetId)
  return m ? flightProgressStyle(m.endsAt, droneFlightTime(planetId)) : {}
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
  return m ? flightProgressStyle(m.endsAt, colonyFlightTime(planetId)) : {}
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
// A constant, not a ref — read it without `.value` in script code.
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
  return m ? flightProgressStyle(m.endsAt, cargoFlightTimeBetween(activePlanetId.value, planetId)) : {}
}

// The return leg flies the same distance back — its mission entry carries the
// planet it is coming FROM, so the duration is measured against that.
const cargoReturnProgressStyle = computed(() => {
  const m = returningCargoMission.value
  return m ? flightProgressStyle(m.endsAt, cargoFlightTimeBetween(activePlanetId.value, m.planetId)) : {}
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

// Home only, like every other drone — see `reconDroneLevel`.
const spyDroneLevel     = computed(() =>
  isHomePlanet.value ? (playerBuildings.value['drone_hangar']?.level ?? 0) : 0
)
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

// ── Fleet (corvettes) ──────────────────────────────────────
// Warships are the first unit that is ordered several at a time. The batch is
// one timer over the whole order and lands as a squadron — ordering four saves
// three clicks, never a minute. The berth count comes from the planet's
// weapons_building, which is a gate as much as a cap: no building, no fleet.

const corvetteInventory = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.corvetteInventory ?? 0)
const corvetteBuild     = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.corvetteBuild ?? null)
const shipyardLevel     = computed(() => playerBuildings.value['shipyard']?.level ?? 0)

const fleetCap = computed(() =>
  (playerBuildings.value['weapons_building']?.level ?? 0) * FLEET_PER_WEAPONS_LEVEL
)

// Hulls in the air rather than in the dock. A raid removes them from the dock
// at launch, so without counting them here the berths of a fleet in flight read
// as free and the cap leaks — mirror of fleet_away() on the server, which is
// the side that enforces it. The outbound leg carries what launched, the return
// leg what survived, so the reservation shrinks as soon as the battle resolves.
const fleetAway = computed(() => {
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return 0
  return [...(dock.activeRaids ?? []), ...(dock.returningRaids ?? [])]
    .reduce((n, m) => n + (m.ships ?? 1), 0)
})

// Hulls that already hold a berth: docked, in the running batch, or out on a
// raid and coming back to this dock.
const fleetSize = computed(() =>
  corvetteInventory.value + (corvetteBuild.value?.count ?? 0) + fleetAway.value
)

const fleetFree = computed(() => Math.max(0, fleetCap.value - fleetSize.value))

const corvetteBuildTime = (count = 1) =>
  Math.ceil(UNIT_COSTS.corvette.buildTimeBase * count * buildTimeFactor.value)

// The ceiling for the ×N picker: berths, stock and crew, whichever runs out
// first. The server re-checks all three.
const maxCorvetteBatch = computed(() => {
  if (shipyardLevel.value === 0 || fleetCap.value === 0) return 0
  const byCost = Object.entries(UNIT_COSTS.corvette.cost).map(
    ([res, amt]) => Math.floor((playerResources.value[res] ?? 0) / amt)
  )
  const byCrew = Math.floor(freeWorkers.value / UNIT_COSTS.corvette.crew)
  return Math.max(0, Math.min(fleetFree.value, byCrew, ...byCost))
})

const canBuildCorvette = computed(() =>
  isHomePlanet.value && !corvetteBuild.value && maxCorvetteBatch.value > 0
)

// ── Raids ──────────────────────────────────────────────────
// Battle reports arrive through state.php exactly once — the server clears the
// flag as it hands them over — so they are accumulated here rather than re-read.
const battleReports = ref([])
// { [foePlayerId]: { count, lastAt, outCount, outLastAt, log[] } } — the record
// between us and that commander. `count`/`lastAt` are their raids on us,
// `outCount`/`outLastAt` ours on them, `log` the last few battles from either
// direction, newest first.
const raidHistory   = ref({})
// { [planetId]: { attacker, portrait, won, plundered, foughtAt, loot } } — the
// last attack on each of our planets. Player-wide and NOT an outbox, so unlike
// `battleReports` it survives a reload and still reads a week later.
const lastRaids     = ref({})

const activeRaids = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.activeRaids ?? [])
const returningRaids = computed(() => allPlanetStates.value[activePlanetId.value]?.dock?.returningRaids ?? [])
const allActiveRaids = computed(() => Object.values(allPlanetStates.value).flatMap(s => s.dock?.activeRaids ?? []))

// Both directions return null when there is nothing to show, so a badge can be
// hung straight off them: a player we have raided but who never raided back has
// a history entry with count 0, and that must not draw an incoming badge.
const raidsAgainstMe = (playerId) => {
  const rec = raidHistory.value[playerId]
  return rec?.count ? rec : null
}

const raidsByMe = (playerId) => {
  const rec = raidHistory.value[playerId]
  return rec?.outCount ? { count: rec.outCount, lastAt: rec.outLastAt } : null
}

// The interleaved list of battles with one commander, newest first.
const raidLog = (playerId) => raidHistory.value[playerId]?.log ?? []

// Same distance curve as everything else that crosses systems, but warships are
// heavy — a bigger floor and a slower rate than a spy drone's signal-speed run.
const raidFlightTime = (targetSystemId) => {
  const home   = galaxySystems.value.find(s => s.id === homeSystemId.value)
  const target = galaxySystems.value.find(s => s.id === targetSystemId)
  if (!home || !target) return Math.round(RAID.flightMin * buildTimeFactor.value)
  const dist = Math.sqrt(Math.pow(target.x - home.x, 2) + Math.pow(target.y - home.y, 2))
  return Math.round(Math.max(RAID.flightMin, Math.round(dist * RAID.flightPerDist)) * buildTimeFactor.value)
}

// A sortie burns one power cell per hull, on top of the ships themselves.
const raidFuelCost = (ships) => ships

const canRaid = computed(() =>
  corvetteInventory.value > 0 &&
  activeRaids.value.length === 0 &&
  returningRaids.value.length === 0
)

// A raid needs a target that belongs to somebody else and that we have looked
// at: inside the home system ownership is public, elsewhere a spy drone has to
// have been there. Mirrors the server's check, which is the real boundary.
const isRaidTarget = (planet, systemId) => {
  if (!planet?.owner) return false
  if (playerColonizedPlanets.value.includes(planet.id)) return false
  if (systemId === homeSystemId.value) return true
  return spiedPlanets.value.includes(planet.id)
}

const startRaid = async (targetPlanetId, targetSystemId, ships, order, fromPlanetId = null) => {
  const planetId = fromPlanetId ?? activePlanetId.value
  const dock = allPlanetStates.value[planetId]?.dock
  if (!dock) return

  buildError.value = ''
  const { postRaidMission } = useHawkStarApi()

  try {
    const result = await postRaidMission(planetId, targetPlanetId, ships, order)
    const sent = result.ships ?? ships
    dock.corvetteInventory = Math.max(0, dock.corvetteInventory - sent)
    const res = allPlanetStates.value[planetId].resources
    res.power_cell = Math.max(0, (res.power_cell ?? 0) - (result.fuel ?? sent))
    dock.activeRaids.push({
      planetId: targetPlanetId,
      systemId: targetSystemId,
      ships:    sent,
      order:    result.order ?? order,
      endsAt:   result.endsAt,
    })
  } catch (e) {
    buildError.value = e.message
  }
}

const dismissBattleReport = (id) => {
  battleReports.value = battleReports.value.filter(r => r.id !== id)
}

const buildCorvette = async (count = 1) => {
  if (!canBuildCorvette.value) return
  const planetId = activePlanetId.value
  const dock = allPlanetStates.value[planetId]?.dock
  if (!dock) return

  const runs = Math.max(1, Math.min(count, maxCorvetteBatch.value))
  buildError.value = ''
  const { postUnitBuild } = useHawkStarApi()

  try {
    const result = await postUnitBuild(planetId, 'corvette', runs)
    // The server clamps to the free berths, so trust its number over ours.
    const built = result.count ?? runs
    const res   = allPlanetStates.value[planetId].resources
    for (const [r, amt] of Object.entries(UNIT_COSTS.corvette.cost)) {
      res[r] = Math.max(0, (res[r] ?? 0) - amt * built)
    }
    // The crew boards at build time and is gone from the workforce right away.
    res.population = Math.max(0, (res.population ?? 0) - UNIT_COSTS.corvette.crew * built)
    dock.corvetteBuild = {
      endsAt:    result.endsAt,
      startedAt: result.buildStartedAt ?? Date.now(),
      count:     built,
    }
  } catch (e) {
    buildError.value = e.message
  }
}

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
const corvetteBuildProgressStyle  = computed(() => buildBarStyle(corvetteBuild.value))

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

// ── What a planet looks like from here ────────────────────────────────────────
// "Own, or free, or a question mark" is not a property of the planet — it is a
// property of what *we* know about it, and three views ask it: the orbit map's
// marker, the planet list beside it, and the switcher strip over the grid. It
// lived in HsSolarSystem while only that screen drew planets; the strip made it
// the second caller, and two copies of this is how a colony ends up owned on one
// screen and unknown on the other.
const effectivePlanetState = (planet) => {
  if (!planet) return 'unknown'
  if (planet.id === homePlanetId.value || playerColonizedPlanets.value.includes(planet.id)) return 'own'
  if (allActiveColonyMissions.value.some(m => m.planetId === planet.id)) return 'colonizing'
  if (playerScannedPlanets.value.includes(planet.id)) return planet.state
  if (allActiveDroneMissions.value.some(m => m.planetId === planet.id)) return 'scanning'
  return 'unknown'
}

// The glyph follows the same rule: a planet in the middle of being reached shows
// what is on its way there rather than what it is, because that is the fact that
// changes next.
const planetIcon = (planet) => {
  const state = effectivePlanetState(planet)
  if (state === 'colonizing') return '🚀'
  if (state === 'scanning')   return '🛸'
  if (state === 'unknown')    return '❓'
  return PLANET_TYPES[planet?.type]?.icon ?? '🪐'
}

const getPlanetName      = (planetId) => allPlanetStates.value[planetId]?.planetName ?? '?'
const getPlanetResources = (planetId) => allPlanetStates.value[planetId]?.resources ?? {}

const planetHasDock = (planetId) =>
  (allPlanetStates.value[planetId]?.slots ?? []).some(s => s.tileType === 'dock' && s.unlocked)

// The dock is a *tile* (slot 10) and says nothing about production: `space_building`
// unlocks it together with the spacebase tile, long before anything stands on
// either. What gates a drone is the hangar *building*, so anything that offers
// a drone asks this instead.
const planetHasHangar = (planetId) =>
  ((allPlanetStates.value[planetId]?.buildings?.drone_hangar?.level) ?? 0) > 0


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


// ── Conversion batches (High-Tech / Refinery) ──────────────
// Per-planet array of running batches.
// Each batch: { buildingId, recipeIndex, planetId, endsAt, runs }
// Different recipes run in parallel; the same recipe is LOCKED while its batch
// runs — a ×4 order takes 4 × durationBase and delivers all 4 units at the end.

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

// The batch running for this recipe on the active planet, if any.
const conversionBatch = (buildingId, recipeIndex) =>
  conversionQueues.value.find(q => q.buildingId === buildingId && q.recipeIndex === recipeIndex) ?? null

// canConvert: checks level/lock/affordability for starting a new batch.
// A running batch blocks its recipe outright — that lock is what caps output at
// CONVERSION_MAX_QUEUE units per CONVERSION_MAX_QUEUE durations.
const canConvert = (buildingId, recipeIndex) => {
  const recipe = BUILDINGS[buildingId]?.conversions?.[recipeIndex]
  if (!recipe) return false
  const lvl = getLevel(buildingId)
  if (lvl === 0) return false
  if (recipe.requiresLevel && lvl < recipe.requiresLevel) return false
  if (conversionBatch(buildingId, recipeIndex)) return false
  return canAfford(recipe.input)
}

// How many runs the stock pays for right now, capped so the stepper stays a
// stepper. This is the ceiling for the ×N picker — the server re-checks it.
const maxConversionRuns = (buildingId, recipeIndex) => {
  const recipe = BUILDINGS[buildingId]?.conversions?.[recipeIndex]
  if (!recipe) return 0
  const runs = Object.entries(recipe.input).map(
    ([res, amt]) => Math.floor(stockOf(res) / amt)
  )
  return Math.max(0, Math.min(CONVERSION_MAX_QUEUE, ...runs))
}

// count: units in this batch. All costs are paid now, the batch runs
// count × durationBase and delivers count × output in one go. While it runs the
// recipe is locked, so this is the only order in flight for it.
const startConversion = async (buildingId, recipeIndex, count = 1) => {
  if (!canConvert(buildingId, recipeIndex)) return
  const planetId = activePlanetId.value
  const queues   = allPlanetStates.value[planetId]?.conversionQueues
  if (!queues) return

  // Never order more than the stock covers, however the caller got its number.
  const runs = Math.max(1, Math.min(count, maxConversionRuns(buildingId, recipeIndex)))

  buildError.value = ''
  const { postConvert } = useHawkStarApi()

  try {
    const result = await postConvert(planetId, buildingId, recipeIndex, runs)
    // Optimistic cost deduction — the whole order is paid for up front
    const recipe = BUILDINGS[buildingId]?.conversions?.[recipeIndex]
    const res    = allPlanetStates.value[planetId]?.resources
    if (recipe && res) {
      for (const [r, amt] of Object.entries(recipe.input)) {
        // Scrap is not in the planet's resources object at all — it comes back
        // authoritative in the response below, this only stops the number
        // sitting stale for one round trip.
        if (r === 'scrap') {
          if (salvageState.value) {
            salvageState.value = {
              ...salvageState.value,
              scrap: Math.max(0, salvageState.value.scrap - amt * runs),
              syncedAt: Date.now(),
            }
          }
          continue
        }
        res[r] = Math.max(0, (res[r] ?? 0) - amt * runs)
      }
    }
    // The server sends the purse back whenever a recipe spent from it.
    if (result.salvage) salvageState.value = { ...result.salvage, syncedAt: Date.now() }

    queues.push({
      buildingId,
      recipeIndex,
      planetId,
      endsAt: result.endsAt,
      runs,
    })
  } catch (e) {
    buildError.value = e.message
  }
}

const remainingConversionSec = (q) =>
  Math.max(0, Math.ceil((q.endsAt - now.value) / 1000))

const conversionProgressStyle = (q) => {
  // The bar spans the WHOLE batch — a ×4 order fills over four durations and
  // pays out once at the end, so there is no per-run reset to show.
  const ct = conversionTimeForPlanet(q.buildingId, q.recipeIndex, q.planetId) * Math.max(1, q.runs ?? 1)
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

  // Process all per-planet conversion batches
  for (const [, pstate] of Object.entries(allPlanetStates.value)) {
    const cqs = pstate.conversionQueues
    if (!cqs?.length) continue
    for (let i = cqs.length - 1; i >= 0; i--) {
      const q = cqs[i]
      if (q.endsAt > now.value) continue
      const recipe = BUILDINGS[q.buildingId]?.conversions?.[q.recipeIndex]
      if (!recipe) { cqs.splice(i, 1); continue }
      // The whole batch lands at once, then the recipe unlocks.
      const res  = pstate.resources
      const runs = Math.max(1, q.runs ?? 1)
      for (const [r, amt] of Object.entries(recipe.output)) {
        res[r] = (res[r] ?? 0) + amt * runs
      }
      // No input deduction here — the backend took the whole batch upfront.
      cqs.splice(i, 1)
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
      // A raid arriving is the one flight the client cannot resolve itself: the
      // battle is fought server-side against the defender's meters. So the tick
      // only clears the countdown and pulls the real outcome from the server,
      // which answers with the battle report.
      for (let i = dock.activeRaids.length - 1; i >= 0; i--) {
        if (dock.activeRaids[i].endsAt > now.value) continue
        dock.activeRaids.splice(i, 1)
        refreshPlanetState(pid).catch(() => {})
      }
      // Survivors home: same reason — the loot lands in the silo server-side.
      for (let i = dock.returningRaids.length - 1; i >= 0; i--) {
        if (dock.returningRaids[i].endsAt > now.value) continue
        dock.returningRaids.splice(i, 1)
        refreshPlanetState(pid).catch(() => {})
      }

      // Corvette batch — the whole squadron lands at once, never one per tick.
      if (dock.corvetteBuild && dock.corvetteBuild.endsAt <= now.value) {
        const built = dock.corvetteBuild.count ?? 1
        dock.corvetteInventory += built
        dock.corvetteBuild = null
        notifications.value.push({ id: `notif_${Date.now()}_unit_${pid}_corvette`, type: 'unit_done', icon: '⚔️', planetId: pid, planetName: pstate.planetName, labelKey: 'hawkStar.notifications.corvetteReady', labelParams: { n: built }, timestamp: Date.now() })
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
      // `count` is the batch size the running build will deliver — 1 for every
      // unit that is not ordered in batches.
      build:    u?.buildEndsAt
        ? { endsAt: u.buildEndsAt, startedAt: u.buildStartedAt ?? Date.now(), count: u.buildCount ?? 1 }
        : null,
    }
  }
  const drone  = unitState('recon_drone')
  const colony = unitState('colony_ship')
  const cargo  = unitState('cargo_drone')
  const spy    = unitState('spy_drone')
  const spySat = unitState('spy_satellite')
  const warship = unitState('corvette')

  const droneMissions  = (state.missions ?? []).filter(m => m.type === 'recon_drone')
    .map(m => ({ planetId: m.toPlanetId, fromPlanetId: m.fromPlanetId, endsAt: m.endsAt }))
  const colonyMissions = (state.missions ?? []).filter(m => m.type === 'colony_ship')
    .map(m => ({ planetId: m.toPlanetId, fromPlanetId: m.fromPlanetId, endsAt: m.endsAt }))
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
    .map(m => ({ planetId: m.toPlanetId, fromPlanetId: m.fromPlanetId, endsAt: m.endsAt }))
  const cargoBack = (state.missions ?? [])
    .filter(m => m.type === 'cargo_drone' && m.leg === 'back' && m.toPlanetId === planetId)
    .map(m => ({ planetId: m.fromPlanetId, endsAt: m.endsAt }))

  // A raid is two legs like a cargo run: the strike out, and the survivors home.
  // Only the outbound leg carries the order — the way back is just a flight.
  const raidsOut = (state.missions ?? [])
    .filter(m => m.type === 'raid' && m.leg !== 'back' && m.fromPlanetId === planetId)
    .map(m => ({
      planetId: m.toPlanetId, systemId: planetSystemId(m.toPlanetId),
      ships: m.ships ?? 1, order: m.raidOrder ?? 'disable', endsAt: m.endsAt,
    }))
  const raidsBack = (state.missions ?? [])
    .filter(m => m.type === 'raid' && m.leg === 'back' && m.toPlanetId === planetId)
    .map(m => ({
      planetId: m.fromPlanetId, systemId: planetSystemId(m.fromPlanetId),
      ships: m.ships ?? 1, endsAt: m.endsAt,
    }))

  const convQueues = (state.conversionQueues ?? []).map(q => ({
    buildingId: q.buildingKey, recipeIndex: q.recipeIndex,
    planetId,  endsAt: q.endsAt,  runs: q.runs ?? 1,
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
      corvetteInventory:    warship.quantity,
      corvetteBuild:        warship.build,
      activeRaids:          raidsOut,
      returningRaids:       raidsBack,
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

  // Player-wide too: the scrap purse and the salvage hold belong to the
  // commander, so every planet's state carries the same block.
  if (state.salvage) salvageState.value = { ...state.salvage, syncedAt: Date.now() }

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

  // Who has raided us, how often, last when. Player-wide, so the last response
  // wins — every planet's state carries the same figure.
  if (state.raidHistory) raidHistory.value = state.raidHistory
  if (state.lastRaids)   lastRaids.value   = state.lastRaids

  // Battles, from either side, handed over exactly once. Same duplicate guard as
  // the satellite losses: several planets may load at the same moment.
  for (const report of (state.battleReports ?? [])) {
    if (battleReports.value.some(r => r.id === report.id)) continue
    battleReports.value.push(report)

    const won   = report.won
    const mine  = report.role === 'attacker'
    // Four outcomes, and the icon carries the news before the text does.
    const icon  = mine ? (won ? '💥' : '🛡️') : (won ? '🔥' : '🛡️')
    const key   = mine
      ? (won ? 'raidWon'      : 'raidRepelled')
      : (won ? 'raidedByFoe'  : 'raidDefended')

    const id = `notif_${report.foughtAt}_battle_${report.id}`
    if (notifications.value.some(n => n.id === id)) continue
    notifications.value.push({
      id,
      type: 'battle', icon,
      planetId: report.planetId, planetName: report.planetName,
      labelKey: `hawkStar.notifications.${key}`,
      labelParams: { foe: report.foeName ?? '?', planet: report.planetName },
      details: report.plundered ? '💰' : '',
      timestamp: report.foughtAt,
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
  initErrorDetail.value = null

  const { player, homePlanetId: authHomePlanetId } = useHawkStarAuth()
  const { fetchGalaxy, fetchGameState, fetchContacts, fetchCommLog } = useHawkStarApi()
  const myId = player.value?.id

  // Load galaxy
  try {
    galaxySystems.value = mapGalaxy(await fetchGalaxy(), myId)
  } catch (e) {
    console.error('[hawk-star] Galaxy load failed:', e)
    initError.value = `Failed to load galaxy: ${e.message}`
    captureInitError(e, '/galaxy/')
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
    // The planet view always opens on the base tile — it is the one tile every
    // planet has, so it is the safe default whenever nothing picked a tile.
    activeSlot.value = 5
    gameLoaded.value = true
    // The empire board and the planet strip need every colony, not just home.
    // Fired after gameLoaded on purpose: the game must not wait on the colonies,
    // and each card appears as its planet arrives.
    loadOwnPlanetStates()
  } catch (e) {
    console.error('[hawk-star] Game state load failed:', e)
    initError.value = `Failed to load planet data: ${e.message}`
    captureInitError(e, '/game/state')
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

// ── Empire overview ────────────────────────────────────────
// One board that answers "what is going on everywhere" without visiting each
// planet first. Everything below takes a planet id instead of reading the
// active planet — that is the whole point of it.
//
// The list is short by construction: colonisation is same-system only
// (`mission/colony.php` refuses any other target) and a system holds exactly
// four habitable planets, so an empire is at most four cards. This is a board,
// not a table, and it is sized for that.

const TILE_SLOT = Object.fromEntries(PLANET_GRID.map(g => [g.tileType, g.slot]))

// Where the line between "worth a warning" and "fine" sits. The shield is the
// cheap one to let slide — an empty shield costs nothing today — so it only
// warns near zero. The battery is not: empty means the planet stops.
const EMPIRE_SHIELD_LOW_PCT    = 20
const EMPIRE_BATTERY_LOW_HOURS = 12
// A battle stays news for a day; after that the galaxy card's log is the place.
const EMPIRE_BATTLE_NEWS_HOURS = 24
// The card lists every alarm, but a busy planet can have a dozen timers running
// and the card must stay readable — the Activity feed is the complete list.
const EMPIRE_RUNNING_MAX = 4

// Home first, then the colonies in the order they were founded — the board's
// order is by urgency, but this is the fallback and the strip's order.
const ownPlanetIds = computed(() => {
  const rest = playerColonizedPlanets.value.filter(id => id !== homePlanetId.value)
  return homePlanetId.value ? [homePlanetId.value, ...rest] : rest
})

// `initFromApi` loads the home planet only. The board needs every colony, so it
// pulls the missing ones in once. A failed fetch simply leaves that planet off
// the board — it must never take the game load down with it.
const loadOwnPlanetStates = () => {
  for (const id of ownPlanetIds.value) {
    if (!allPlanetStates.value[id]) refreshPlanetState(id).catch(() => {})
  }
}

// Same rule as maxStorage, for any planet: the cap is the summed
// storageCapacity of the finished buildings and nothing else.
const storageCapsOf = (planetId) => {
  const caps = {}
  for (const [id, st] of Object.entries(allPlanetStates.value[planetId]?.buildings ?? {})) {
    if (st.level === 0) continue
    for (const [res, cap] of Object.entries(BUILDINGS[id]?.levels[st.level - 1]?.storageCapacity ?? {})) {
      caps[res] = (caps[res] ?? 0) + cap
    }
  }
  return caps
}

// An orbit tile is not "unused", it has nothing to build — a tile with no
// buildable building on this planet type has no empty-slot finding to report.
// Global research lives in `globalResearch`, not in the planet's buildings, so
// the comm center would always read as empty; it is excluded for that reason.
const tileHasBuildings = (tileType, planetType) =>
  Object.values(BUILDINGS).some(b =>
    b.tileType === tileType && !b.global &&
    (!b.planetTypes || b.planetTypes.includes(planetType))
  )

// `hs_buildings` and `hs_global_research` store only `build_ends_at` — there is
// no `build_started_at` column, so a build's start has to be derived from the
// level's configured duration. Same formula `buildProgressStyle()` uses for the
// tile, which is the point: the two bars must never disagree.
const buildStartOf = (buildingId, level, endsAt) => {
  const secs = BUILDINGS[buildingId]?.levels[level]?.buildTime
  return secs ? endsAt - secs * buildTimeFactor.value * 1000 : null
}

// A mission target may be a planet whose state was never loaded — the galaxy
// knows every name, the state object only the ones we have visited.
const anyPlanetName = (planetId) =>
  allPlanetStates.value[planetId]?.planetName
  ?? galaxySystems.value.flatMap(s => s.planets).find(p => p.id === planetId)?.name
  ?? `#${planetId}`

// Rank decides both the row order inside a card and which card floats to the
// top. Alarm is something broken, warn is something idle or about to lapse,
// running is just a timer. A battle is none of the three — it is history, so it
// lives at the foot of the card rather than in this list.
const EMPIRE_RANK = { alarm: 0, warn: 1, running: 2 }

// Everything worth knowing about one planet, as rows. Each row carries the tile
// it belongs to, so the board can jump straight to the thing it is talking
// about — a finding you cannot act on from where it is displayed is only half
// an answer.
//
// Labels stay unresolved: `labelParams` holds plain values and `paramKeys` maps
// a parameter to an i18n key the component translates first. `useI18n()` cannot
// be called at module scope, which is the same reason notifications carry a
// `labelKey` rather than a finished string.
const planetStatus = (planetId) => {
  const st = allPlanetStates.value[planetId]
  if (!st) return null

  const rows    = []
  const running = []

  const makeRow = (kind, key, icon, labelKey, opts = {}) => ({
    id:          `${planetId}_${key}`,
    kind, icon, labelKey,
    labelParams: opts.params    ?? {},
    paramKeys:   opts.paramKeys ?? null,
    titleKey:    opts.titleKey  ?? null,
    slot:        opts.tile ? (TILE_SLOT[opts.tile] ?? null) : (opts.slot ?? null),
    endsAt:      opts.endsAt    ?? null,
    startedAt:   opts.startedAt ?? null,
  })

  const add        = (kind, key, icon, labelKey, opts) => rows.push(makeRow(kind, key, icon, labelKey, opts))
  const addRunning = (key, icon, labelKey, opts) => running.push(makeRow('running', key, icon, labelKey, opts))

  const bat = batteryChargeOf(planetId)
  const shd = shieldChargeOf(planetId)
  const batHours = st.battery?.drainPerHour ? (bat ?? 0) / st.battery.drainPerHour : null
  const shdHours = st.shield?.drainPerHour  ? (shd ?? 0) / st.shield.drainPerHour  : null
  const dark = gridDownOn(planetId)
  // Same guard gridDownOn() uses: a planet without a power plant has no grid to
  // lose, so its battery is not a meter that means anything yet.
  const hasBattery = !!st.battery && (st.battery.powerPlantLevel ?? 0) > 0

  // ── Alarms — something is broken right now ──
  if (dark) add('alarm', 'blackout', '⏹', 'hawkStar.empire.rowBlackout', { tile: 'energy' })

  if (st.shield && (shd ?? 0) <= 0)
    add('alarm', 'shieldEmpty', '🛡️', 'hawkStar.empire.rowShieldEmpty', { tile: 'defense' })

  // Always empty without an orbital_defense — the building is the sensor, so a
  // planet without one never raises this and that is intended.
  if (st.foreignSatellites?.length)
    add('alarm', 'bogey', '📡', 'hawkStar.empire.rowBogey',
        { params: { n: st.foreignSatellites.length }, tile: 'defense' })

  // A grid that cannot cover its own buildings is broken, not tight: the server
  // takes buildings offline for it. Only raised once something actually draws —
  // a bare planet with no plant and no consumers is not in deficit, it is empty.
  const energy = energyBalanceOf(planetId)
  if (energy && energy.drain > 0 && energy.free < 0)
    add('alarm', 'energyDeficit', '⚡', 'hawkStar.empire.rowEnergyDeficit',
        { params: { n: Math.abs(energy.free) }, tile: 'energy' })

  // ── Warnings — nothing broken, but something is idling or about to lapse ──
  if (st.shield && (shd ?? 0) > 0 && shd < EMPIRE_SHIELD_LOW_PCT)
    add('warn', 'shieldLow', '🛡️', 'hawkStar.empire.rowShieldLow',
        { params: { pct: Math.round(shd), h: Math.max(1, Math.round(shdHours ?? 0)) }, tile: 'defense' })

  // Still covered, but the next upgrade will not be. This is the one finding
  // that is cheapest to act on *before* it becomes the alarm above, and it uses
  // the very same ENERGY_LOW_FREE the resource bar turns orange on.
  if (energy && energy.drain > 0 && energy.free >= 0 && energy.free < ENERGY_LOW_FREE)
    add('warn', 'energyLow', '⚡', 'hawkStar.empire.rowEnergyLow',
        { params: { n: energy.free, produced: energy.produced }, tile: 'energy' })

  if (hasBattery && !dark && batHours != null && batHours < EMPIRE_BATTERY_LOW_HOURS)
    add('warn', 'batteryLow', '🔋', 'hawkStar.empire.rowBatteryLow',
        { params: { h: Math.max(1, Math.round(batHours)) }, tile: 'energy' })

  // An anomaly expires whether or not anyone looked at it, so it carries its
  // deadline rather than a progress bar.
  const ano = st.anomaly
  if (ano && (ano.expiresAt ?? 0) > now.value)
    add('warn', 'anomaly', ano.icon ?? '☄️', 'hawkStar.empire.rowAnomaly',
        { titleKey: `hawkStar.anomaly.types.${ano.type}.name`, tile: 'anomaly', endsAt: ano.expiresAt })

  // A full store produces nothing — the server clamps at the cap on every tick.
  // This is the finding a returning player never spots on their own.
  for (const [res, cap] of Object.entries(storageCapsOf(planetId))) {
    if ((st.resources?.[res] ?? 0) < cap) continue
    add('warn', `full_${res}`, RESOURCES[res]?.icon ?? '📦', 'hawkStar.empire.rowStorageFull',
        { paramKeys: { res: `hawkStar.res.${res}` },
          tile: (res === 'metal' || res === 'crystal') ? 'mining' : 'hightech' })
  }

  // A refinery with no batch running is the other silent loss: one refinery
  // feeds exactly one converter, so an idle one stalls a whole chain.
  //
  // Scrap-fed converters are exempt. The rule assumes the input piles up by
  // itself, so standing idle means throwing away production; salvage scrap only
  // arrives when the player goes fishing, and an idle smelter is the normal,
  // correct state. Warning about it would nag forever and teach the player to
  // stop reading the warn tier.
  for (const [bid, bst] of Object.entries(st.buildings ?? {})) {
    const def = BUILDINGS[bid]
    if (!def?.conversions?.length || bst.level === 0 || bst.buildEndsAt) continue
    if (def.conversions.some(c => "scrap" in (c.input ?? {}))) continue
    if ((st.conversionQueues ?? []).some(q => q.buildingId === bid)) continue
    add('warn', `idle_${bid}`, def.icon ?? '⚗️', 'hawkStar.empire.rowConverterIdle',
        { params: { name: def.name }, tile: def.tileType })
  }

  // A pool at its cap stops growing — every hour past that is a lost recruit.
  const rec = st.recruit
  if (rec?.poolMax > 0) {
    const pool = Math.min(rec.poolMax, rec.pool + rec.growthPerHour * (now.value - rec.syncedAt) / 3600000)
    if (pool >= rec.poolMax)
      add('warn', 'recruitFull', '👥', 'hawkStar.empire.rowRecruitFull',
          { params: { n: Math.floor(pool) }, tile: 'base' })
  }

  for (const s of st.slots ?? []) {
    if (!slotUsable(s, planetId) || !tileHasBuildings(s.tileType, st.planetType)) continue
    const used = Object.entries(st.buildings ?? {}).some(([bid, bs]) =>
      BUILDINGS[bid]?.tileType === s.tileType && (bs.level > 0 || bs.buildEndsAt))
    if (used) continue
    add('warn', `empty_${s.slot}`, '🏗️', 'hawkStar.empire.rowSlotEmpty',
        { paramKeys: { tile: `hawkStar.tiles.${s.tileType}.name` }, slot: s.slot })
  }

  // ── Running — timers, so the card also says what is already under way ──
  // Buildings under construction go straight into `rows`, not through the
  // capped `running` list: "what am I building right now" is the first thing
  // anyone looks for on a card, and it must never be pushed out by four cargo
  // flights. Only one building per tile can be under construction, so this list
  // is short by itself.
  for (const [bid, bst] of Object.entries(st.buildings ?? {})) {
    if (!bst.buildEndsAt) continue
    const def = BUILDINGS[bid]
    if (!def) continue
    add('running', `build_${bid}`, '🏗️', 'hawkStar.empire.rowBuilding',
      { params: { name: def.name, level: bst.level + 1 }, tile: def.tileType,
        endsAt: bst.buildEndsAt, startedAt: buildStartOf(bid, bst.level, bst.buildEndsAt) })
  }

  for (const q of st.conversionQueues ?? []) {
    const def = BUILDINGS[q.buildingId]
    if (!def) continue
    addRunning(`conv_${q.buildingId}_${q.recipeIndex}`, '⚗️', 'hawkStar.empire.rowConversion',
      { params: { name: def.name, n: q.runs ?? 1 }, tile: def.tileType, endsAt: q.endsAt })
  }

  const dock = st.dock ?? {}
  for (const [key, unit, icon] of [
    ['reconDroneBuild',   'reconDrone',   '🛸'], ['colonyShipBuild',  'colonyShip',   '🚀'],
    ['cargoDroneBuild',   'cargoDrone',   '📦'], ['spyDroneBuild',    'spyDrone',     '🕵️'],
    ['spySatelliteBuild', 'spySatellite', '📡'], ['corvetteBuild',    'corvette',     '⚔️'],
  ]) {
    const b = dock[key]
    if (!b) continue
    addRunning(`ship_${key}`, icon, 'hawkStar.empire.rowShipBuild',
      { params: { n: b.count ?? 1 }, paramKeys: { unit: `hawkStar.dock.${unit}` },
        tile: 'dock', endsAt: b.endsAt, startedAt: b.startedAt })
  }

  // A raid gets its own row with its target — it is the flight whose outcome
  // the player is waiting for. Everything else is aggregated, because the dock
  // and the Activity feed already list flights one by one.
  for (const m of dock.activeRaids ?? [])
    addRunning(`raid_${m.planetId}`, '⚔️', 'hawkStar.empire.rowRaidOut',
      { params: { planet: anyPlanetName(m.planetId), n: m.ships ?? 1 }, tile: 'dock', endsAt: m.endsAt })
  for (const m of dock.returningRaids ?? [])
    addRunning(`raidback_${m.planetId}`, '⚔️', 'hawkStar.empire.rowRaidBack',
      { params: { n: m.ships ?? 1 }, tile: 'dock', endsAt: m.endsAt })

  const flights = [
    ...(dock.activeDroneMissions ?? []), ...(dock.activeColonyMissions ?? []),
    ...(dock.activeCargoMissions ?? []), ...(dock.returningCargoMissions ?? []),
    ...(dock.activeSpyMissions ?? []),
  ]
  if (flights.length)
    addRunning('flights', '🛰️', 'hawkStar.empire.rowFlights',
      { params: { n: flights.length }, tile: 'dock',
        endsAt: Math.min(...flights.map(f => f.endsAt)) })

  running.sort((a, b) => (a.endsAt ?? 0) - (b.endsAt ?? 0))
  const shown = running.slice(0, EMPIRE_RUNNING_MAX)
  rows.push(...shown)

  rows.sort((a, b) => EMPIRE_RANK[a.kind] - EMPIRE_RANK[b.kind])

  // The last attack this planet took. It is history, not a task, so it is not a
  // row — it sits at the foot of the card, the way the galaxy card keeps its
  // battle log at the bottom. A fresh one still counts: it raises the card and
  // fires the nav badge without duplicating itself as a row.
  const raid = lastRaids.value[planetId] ?? null
  const fresh = !!raid && (now.value - raid.foughtAt) < EMPIRE_BATTLE_NEWS_HOURS * 3600000
  const lastRaid = raid ? { ...raid, fresh } : null

  // What the planet is DOING, as opposed to how it is doing. Read from the
  // planet state and not from `rows`, because `running` is capped at
  // EMPIRE_RUNNING_MAX — a conversion that got cut off the card is still a
  // conversion that is running, and the badge must not lie about that.
  // Ship builds are deliberately not counted: the dock rows already say that,
  // and "building" would stop meaning a building.
  const isBuilding   = Object.values(st.buildings ?? {}).some(b => b.buildEndsAt)
  const isConverting = (st.conversionQueues ?? []).length > 0
  // Construction outranks a batch — it is the longer commitment and the one
  // that changes what the planet can do next.
  const activity = isBuilding ? 'building' : isConverting ? 'converting' : null

  const rowSeverity = rows.length ? Math.min(...rows.map(r => EMPIRE_RANK[r.kind])) : 9

  return {
    planetId,
    name:      st.planetName,
    type:      st.planetType,
    isHome:    planetId === homePlanetId.value,
    battery:   hasBattery ? { pct: bat ?? 0, hours: batHours, down: dark } : null,
    shield:    st.shield  ? { pct: shd ?? 0, hours: shdHours } : null,
    rows,
    activity,
    lastRaid,
    moreRunning: running.length - shown.length,
    // The worst thing on the card decides where the card sits.
    severity:  fresh ? Math.min(rowSeverity, EMPIRE_RANK.alarm) : rowSeverity,
    // Everything that is not merely a timer — a recent raid counts, which is
    // why the badge is labelled "notices" and not "to do".
    alerts:    rows.filter(r => r.kind !== 'running').length + (fresh ? 1 : 0),
  }
}

// Sorted by urgency, not by planet id — the point of opening this is to be told
// where to look, and home is only the tiebreak.
const empireStatus = computed(() =>
  ownPlanetIds.value
    .map(planetStatus)
    .filter(Boolean)
    .sort((a, b) => a.severity - b.severity || (a.isHome === b.isHome ? 0 : a.isHome ? -1 : 1))
)

// Drives the badge on the nav tab: everything that is not just a timer.
const empireAlertCount = computed(() =>
  empireStatus.value.reduce((n, p) => n + p.alerts, 0)
)

// Research is player-wide — it belongs to the board's header, not to any one
// planet's card, because the server does not record which planet ordered it and
// the result applies everywhere anyway. It is also the one build the Activity
// feed misses entirely, since that walks `allPlanetStates` and research lives
// in `globalResearch`.
const empireResearch = computed(() =>
  Object.entries(globalResearch.value)
    .filter(([id, st]) => st?.buildEndsAt && BUILDINGS[id])
    .map(([id, st]) => ({
      id,
      icon:      BUILDINGS[id].icon ?? '🔬',
      name:      BUILDINGS[id].name,
      level:     (st.level ?? 0) + 1,
      endsAt:    st.buildEndsAt,
      startedAt: buildStartOf(id, st.level ?? 0, st.buildEndsAt),
    }))
    .sort((a, b) => a.endsAt - b.endsAt)
)

// Jumping to a finding is what makes the board more than a list. Unlike
// setActivePlanet() this keeps the caller's tile instead of forcing the base
// tile — the row knows which tile it is about.
const focusPlanetTile = (planetId, slot = null) => {
  const st = allPlanetStates.value[planetId]
  if (!st) return false
  activePlanetId.value     = planetId
  lastResourceSyncMs.value = Date.now()
  const target = st.slots?.find(s => s.slot === slot)
  activeSlot.value = slotUsable(target, planetId) ? slot : 5
  return true
}


// ── Onboarding checklist ───────────────────────────────────
// The early-game guide. Every step ticks itself off from real state, so it
// doubles as a progress overview once the early game is behind you. It lives
// here rather than in a component because two panels show it — the home base
// tile and the empire board — and they must never disagree.
// Home-planet scoped on purpose: the first steps are about the base you were
// given, and must not change meaning just because a colony is selected.
const homeLevel = (id) => allPlanetStates.value[homePlanetId.value]?.buildings?.[id]?.level ?? 0

// A foreign system counts once it is fully scanned — the home system is scanned
// from the start and must not tick this off.
const foreignSystemScanned = computed(() =>
  Object.entries(systemContacts.value).some(([sysId, c]) =>
    c?.scanState === 'scanned' && String(sysId) !== String(homeSystemId.value)
  )
)

const onboardingSteps = computed(() => [
  { key: 'step1', done: homeLevel('command_center') >= 1 },
  // The home planet starts at 1 population — anything above it came from recruiting.
  { key: 'step2', done: (homeResources.value.population ?? 0) >= 2 },
  { key: 'step3', done: homeLevel('power_plant') >= 1 && (batteryChargeOf(homePlanetId.value) ?? 0) > 0 },
  { key: 'step4', done: homeLevel('metal_mine') >= 1 && homeLevel('crystal_drill') >= 1 },
  { key: 'step5', done: starMapLevel.value >= 1 },
  // playerScannedPlanets is seeded with the home planet — only a foreign one counts
  { key: 'step6', done: playerScannedPlanets.value.some(id => id !== homePlanetId.value) },
  // You start with one settlement, so only the second one is an achievement.
  { key: 'step7', done: playerColonizedPlanets.value.length > 1 },
  { key: 'step8', done: cargoDeliveries.value > 0 },
  { key: 'step9', done: foreignSystemScanned.value },
  // Espionage, in the order it has to happen: a satellite can only be placed on
  // a planet a drone has already surveyed.
  { key: 'step10', done: spiedPlanets.value.length > 0 },
  // A count of satellites ever placed, not of live ones — an expiring satellite
  // must not un-tick a step that was achieved.
  { key: 'step11', done: satelliteDeployments.value > 0 },
])

const onboardingDoneCount = computed(() => onboardingSteps.value.filter(s => s.done).length)

// Once every step is ticked the checklist has nothing left to teach, so it
// retires itself from both panels instead of sitting there fully struck through.
const onboardingComplete = computed(() => onboardingDoneCount.value === onboardingSteps.value.length)

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
    isHomePlanet,
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
    energyDelta,
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
    recruitGrowthPerHour,
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
    // empire overview
    ownPlanetIds,
    loadOwnPlanetStates,
    empireStatus,
    empireAlertCount,
    empireResearch,
    focusPlanetTile,
    effectivePlanetState,
    planetIcon,
    meterLevel,
    batteryLevelOf,

    // salvage fishing
    salvageScrap,
    stockOf,
    salvageHold,
    salvageHoldMax,
    salvageHoldEmpty,
    salvageFinds,
    salvageCabinet,
    salvagePortraits,
    reportSalvageCatch,

    // onboarding
    onboardingSteps,
    onboardingDoneCount,
    onboardingComplete,

    // production
    grossProduction,
    totalEnergyDrain,
    production,
    energyDeficit,
    energyLow,
    ENERGY_LOW_FREE,
    energyBalanceOf,
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
    // fleet
    corvetteInventory,
    corvetteBuild,
    corvetteBuildTime,
    corvetteBuildProgressStyle,
    fleetCap,
    fleetSize,
    fleetFree,
    fleetAway,
    maxCorvetteBatch,
    canBuildCorvette,
    buildCorvette,
    // raids
    battleReports,
    raidHistory,
    lastRaids,
    raidsAgainstMe,
    raidsByMe,
    raidLog,
    activeRaids,
    returningRaids,
    allActiveRaids,
    raidFlightTime,
    raidFuelCost,
    canRaid,
    isRaidTarget,
    startRaid,
    dismissBattleReport,
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
    planetHasHangar,
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
    maxConversionRuns,
    startConversion,
    remainingConversionSec,
    conversionProgressStyle,
    // api feedback
    buildError,
    gameLoaded,
    initError,
    initErrorDetail,
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
