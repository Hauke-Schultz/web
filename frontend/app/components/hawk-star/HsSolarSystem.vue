<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PLANET_TYPES, RESOURCES, UNIT_COSTS } from '~/utils/hawkStarConfig.js'
import { useHawkStar, refreshPlanetState } from '~/composables/useHawkStar.js'

const {
	playerName,
	reconDroneLevel, colonyShipLevel,
  allPlanetStates,
  playerScannedPlanets, playerColonizedPlanets,
  reconDroneInventory, colonyShipInventory,
  allActiveDroneMissions,
  isDroneTarget, canSendDrone, sendReconDrone,
  remainingDroneSec, droneProgressStyle,
  droneFlightTimeBetween,
  allActiveColonyMissions,
  isColonyTarget, canSendColonyShip, sendColonyShip,
  remainingColonySec, colonyProgressStyle,
  colonyFlightTimeBetween,
  allActiveCargoMissions,
  homeSystem, homePlanetId,
  shieldChargeOf, batteryChargeOf, gridDownOn,
  ownPlanetIds, loadOwnPlanetStates,
  activePlanetId, setActivePlanet,
  formatTime,
  playerResources,
  planetHasDock, planetHasHangar,
  // build
  reconDroneBuild, droneBuildTime, canBuildDrone, buildReconDrone, droneBuildProgressStyle,
  colonyShipBuild, colonyShipBuildTime, canBuildColonyShip, buildColonyShip, colonyShipBuildProgressStyle,
  colonyShipCrew, hasColonyCrew,
  // cargo drone
  cargoDroneInventory, cargoDroneBuild, cargoDroneReady, hasCargoDrone,
  cargoManifest, cargoLoaded, cargoCapacity, cargoLoadable,
  cargoBuildTime, canBuildCargoDrone, buildCargoDrone, cargoBuildProgressStyle,
  canLoadMore, loadCargo, unloadCargo, unloadAllCargo,
  isCargoTarget, canSendCargo, sendCargoDrone,
  remainingCargoSec, remainingCargoReturnSec, cargoProgressStyle,
  returningCargoMission, cargoFlightTimeBetween,
} = useHawkStar()

const emit = defineEmits(['go-planet'])

const { t } = useI18n()

// Picking a unit in the hangar does two things at once: it opens that unit's
// build accordion, and it arms the unit for dispatch — every row in the list
// that can receive it grows a send button with its flight time. One state, so
// the two can never disagree about which unit you are working with.
const armedUnit = ref(null)

const armUnit   = (key) => { armedUnit.value = armedUnit.value === key ? null : key }
const disarmUnit = () => { armedUnit.value = null }

const planets = computed(() => homeSystem.value?.planets ?? [])

const goToPlanet = async (planetId) => {
  if (!allPlanetStates.value[planetId]) await refreshPlanetState(planetId)
  setActivePlanet(planetId)
  emit('go-planet')
}

const isCargoEnRoute = (id) => !!allActiveCargoMissions.value.find(m => m.planetId === id)

const isScanned      = (id) => playerScannedPlanets.value.includes(id)
const isColonized    = (id) => playerColonizedPlanets.value.includes(id)
const isDroneEnRoute = (id) => !!allActiveDroneMissions.value.find(m => m.planetId === id)
const isColonizing   = (id) => !!allActiveColonyMissions.value.find(m => m.planetId === id)

const effectivePlanetState = (planet) => {
  if (planet.id === homePlanetId.value || isColonized(planet.id)) return 'own'
  if (isColonizing(planet.id)) return 'colonizing'
  if (isScanned(planet.id)) return planet.state
  if (isDroneEnRoute(planet.id)) return 'scanning'
  return 'unknown'
}

// ── Selection ─────────────────────────────────────────────
const selectedPlanetId = ref(activePlanetId.value)

// The galaxy usually arrives after mount, so the active planet is often still
// null here — without this no row would be open until the first tap.
watch(activePlanetId, (id) => {
  if (id && !selectedPlanetId.value) selectedPlanetId.value = id
  // The hangar moved to a different planet, so whatever was armed is no longer
  // standing where the send buttons said it was.
  disarmUnit()
})

// A tap on the map has to bring the row it just opened into view — on a phone
// the list sits a whole map below the marker, so opening a row off-screen would
// look like nothing happened. One ref on the list and a data attribute, rather
// than a function ref per row: the component re-renders every tick, and that
// would churn a ref callback per planet per second for nothing.
const listEl = ref(null)

const toggleSelect = async (planet, { reveal = false } = {}) => {
  selectedPlanetId.value = planet.id
  if (reveal) {
    await nextTick()
    listEl.value
      ?.querySelector(`[data-planet="${planet.id}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  // While a unit is armed the list is a target picker. Tapping a colony's row
  // would otherwise make it the active planet and move the hangar out from
  // under the unit you were about to send — the one gesture most likely to
  // happen mid-dispatch, since a cargo run targets your own planets.
  if (armedUnit.value) return
  if (effectivePlanetState(planet) !== 'own') return
  // setActivePlanet bails out when the planet's state was never loaded (a colony
  // we have not visited this session) — pull it in first, like goToPlanet does.
  if (!allPlanetStates.value[planet.id]) await refreshPlanetState(planet.id)
  setActivePlanet(planet.id)
}

const selectedPlanet = computed(() => planets.value.find(p => p.id === selectedPlanetId.value) ?? null)

const stateColor = (state) => ({
  own:          'rgba(96,165,250,0.9)',
  uncolonized:  'rgba(107,114,128,0.85)',
  enemy:        'rgba(248,113,113,0.9)',
  ally:         'rgba(52,211,153,0.9)',
  scanning:     'rgba(251,191,36,0.85)',
  colonizing:   'rgba(96,165,250,0.8)',
  uninhabitable:'rgba(75,75,75,0.7)',
})[state] ?? 'rgba(255,255,255,0.3)'

const isHomePlanet = (planet) => planet.id === homePlanetId.value

// ── Orbit geometry ────────────────────────────────────────
// The map is a square box and every radius is a percentage of it, so the whole
// system scales with the viewport without a single pixel measurement — that is
// what makes the same rules work on a 360 px phone and on a wide desktop.
// Distance in this game is the index difference (see `droneFlightTimeBetween`),
// so ordering the rings by index is not decoration: the picture and the flight
// times agree.
const ORBIT_INNER = 16   // % of map size — first ring, clear of the sun's corona
const ORBIT_OUTER = 41   // % of map size — last ring: marker, shield bubble and
                         // label all still fit inside the clipped box

const orbitVars = (index) => {
  const n    = Math.max(1, planets.value.length)
  const step = n > 1 ? (ORBIT_OUTER - ORBIT_INNER) / (n - 1) : 0
  const r    = ORBIT_INNER + index * step
  // Outer planets travel slower (Kepler, roughly) and no two share a period, so
  // the constellation never repeats and the map keeps looking alive. The pace
  // is deliberately slow — a planet should drift while you read the list, not
  // pull your eye off it; the inner ring takes a minute and a half per lap.
  const period = 90 + index * 45
  // Golden-ratio phase spread: the planets start scattered instead of lined up
  // on one ray, and neighbouring rings drift apart instead of moving in lockstep.
  const phase  = (index * 0.618033) % 1
  return {
    '--r':      `${r}%`,
    '--period': `${period}s`,
    '--delay':  `-${(period * phase).toFixed(2)}s`,
  }
}

// Outer orbits draw over inner ones and the selected planet over everything —
// markers on neighbouring rings do cross each other, and this keeps the one you
// are looking at readable when they do.
const orbiterStyle = (planet, index) => ({
  ...orbitVars(index),
  zIndex: selectedPlanetId.value === planet.id ? 40 : 10 + index,
})

// The generated names are "Sirius III" — the last word alone identifies the
// planet on the map, and the full name is in the list beside it. Anything
// longer would collide with the neighbouring orbit.
const shortLabel = (planet) => {
  const parts = String(planet.name ?? '').trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? '').slice(0, 4)
}

// ── Meters on the marker ──────────────────────────────────
// Battery and shield of a planet, null when it has no power plant / no shield
// generator, and likewise while its state was never loaded. On the orbit map
// they are drawn as what they physically are: the battery as a charge ring
// around the planet, the shield as the bubble surrounding it.
const shieldPct = (planetId) => {
  const c = shieldChargeOf(planetId)
  return c == null ? null : Math.round(c)
}

const batteryPct = (planetId) => {
  const c = batteryChargeOf(planetId)
  return c == null ? null : Math.round(c)
}

const meterLevel = (pct) => (pct <= 0 ? 'empty' : pct < 20 ? 'low' : 'ok')

// The blackout is the one state worth shouting about: an empty battery stops the
// whole planet, while an empty shield costs nothing today.
const batteryLevel = (planetId) =>
  gridDownOn(planetId) ? 'down' : meterLevel(batteryPct(planetId) ?? 0)

const BATTERY_COLOR = { ok: '#10b981', low: '#f59e0b', empty: '#f59e0b', down: '#ef4444' }

const batteryRingStyle = (planetId) => {
  const pct = batteryPct(planetId)
  if (pct === null) return null
  const deg = Math.max(0, Math.min(100, pct)) * 3.6
  const col = BATTERY_COLOR[batteryLevel(planetId)]
  return {
    background: `conic-gradient(from -90deg, ${col} 0deg ${deg}deg, rgba(255,255,255,0.10) ${deg}deg 360deg)`,
  }
}

// A shield at 0 % draws nothing at all — an unshielded planet should look bare,
// not like it is wearing an empty bubble.
const shieldAuraStyle = (planetId) => {
  const pct = shieldPct(planetId)
  if (pct === null || pct <= 0) return null
  const f = pct / 100
  return {
    background:  `radial-gradient(circle, rgba(56,189,248,0) 54%, rgba(56,189,248,${(0.06 + f * 0.30).toFixed(3)}) 100%)`,
    borderColor: `rgba(56,189,248,${(0.12 + f * 0.48).toFixed(3)})`,
  }
}

const hasPlanetState = (planetId) => !!allPlanetStates.value[planetId]

// ── Missions ──────────────────────────────────────────────
// One badge above the marker for whichever unit is inbound. A planet is the
// target of at most one mission per class, and in practice the classes exclude
// each other — an unscanned planet cannot be colonized, a cargo run needs it
// scanned — so the first hit is the whole story.
const missionOn = (planetId) => {
  if (isDroneEnRoute(planetId)) return { key: 'drone',  icon: '🛸', time: remainingDroneSec(planetId) }
  if (isColonizing(planetId))   return { key: 'colony', icon: '🚀', time: remainingColonySec(planetId) }
  if (isCargoEnRoute(planetId)) return { key: 'cargo',  icon: '📦', time: remainingCargoSec(planetId) }
  return null
}

const planetTypeIcon = (type) => PLANET_TYPES[type]?.icon ?? '🪐'
const starClassLabel = (cls) => t(`hawkStar.starClass.${cls}`, cls)

const stateLabel = (state) => ({
  own:          t('hawkStar.solar.stateOwn'),
  uncolonized:  t('hawkStar.solar.stateFree'),
  enemy:        t('hawkStar.solar.stateEnemy'),
  ally:         t('hawkStar.solar.stateAllied'),
  scanning:     t('hawkStar.solar.droneEnRoute'),
  colonizing:   t('hawkStar.solar.colonizing'),
  unknown:      t('hawkStar.solar.unknown'),
  uninhabitable:t('hawkStar.solar.uninhabitable'),
})[state] ?? state

const planetIcon = (planet) => {
  const state = effectivePlanetState(planet)
  if (state === 'colonizing') return '🚀'
  if (state === 'scanning')   return '🛸'
  if (state === 'unknown')    return '❓'
  return planetTypeIcon(planet.type)
}

const markerClass = (planet) => [
  `hs-pl--${effectivePlanetState(planet)}`,
  isHomePlanet(planet) ? 'hs-pl--home' : '',
  selectedPlanetId.value === planet.id ? 'hs-pl--selected' : '',
  planet.id === activePlanetId.value ? 'hs-pl--active' : '',
]

const hasCommandCenter = (planetId) =>
  (allPlanetStates.value[planetId]?.buildings?.command_center?.level ?? 0) >= 1

// ── Actions toward the selected planet ────────────────────
// The three parallel unit rows collapsed into one list: every researched unit
// class contributes at most one row, and only for the planet currently
// selected. Everything still flies FROM the active planet — the same rule the
// rows followed, stated once now instead of once per column.
const targetOps = computed(() => {
  const planet = selectedPlanet.value
  if (!planet || planet.id === activePlanetId.value) return []
  const id  = planet.id
  const src = activePlanetId.value
  const ops = []

  if (reconDroneLevel.value > 0) {
    const base = { key: 'drone', icon: '🛸', label: t('hawkStar.dock.reconDrone') }
    if (isDroneEnRoute(id))
      ops.push({ ...base, state: 'enroute', progress: droneProgressStyle(id), remaining: remainingDroneSec(id) })
    else if (canSendDrone(id))
      ops.push({ ...base, state: 'ready', flight: droneFlightTimeBetween(src, id),
                 action: t('hawkStar.solar.sendDrone'), send: () => sendReconDrone(id, src) })
    else if (isDroneTarget(id))
      ops.push({ ...base, state: 'blocked', hint: t('hawkStar.solar.noDroneReady') })
  }

  if (colonyShipLevel.value > 0) {
    const base = { key: 'colony', icon: '🚀', label: t('hawkStar.dock.colonyShip') }
    if (isColonizing(id))
      ops.push({ ...base, state: 'enroute', progress: colonyProgressStyle(id), remaining: remainingColonySec(id) })
    else if (canSendColonyShip(id))
      ops.push({ ...base, state: 'ready', flight: colonyFlightTimeBetween(src, id),
                 action: t('hawkStar.solar.colonize'), send: () => sendColonyShip(id, src) })
    else if (isColonyTarget(id))
      ops.push({ ...base, state: 'blocked', hint: t('hawkStar.solar.colonizeNeedsShip') })
  }

  if (planetHasHangar(src)) {
    const base = { key: 'cargo', icon: '📦', label: t('hawkStar.dock.cargoDrone') }
    if (isCargoEnRoute(id))
      ops.push({ ...base, state: 'enroute', progress: cargoProgressStyle(id), remaining: remainingCargoSec(id) })
    else if (canSendCargo(id))
      ops.push({ ...base, state: 'ready', flight: cargoFlightTimeBetween(src, id),
                 action: t('hawkStar.solar.sendCargo'), send: () => sendCargoDrone(id, src) })
    else if (isCargoTarget(id))
      ops.push({ ...base, state: 'blocked',
                 hint: hasCargoDrone.value ? t('hawkStar.solar.cargoEmpty') : t('hawkStar.solar.noCargoDrone') })
  }

  return ops
})

// ── Dispatch ──────────────────────────────────────────────
// What the armed unit can do about one planet. The three classes differ only in
// which composable functions answer the same four questions, so they are a
// table rather than three branches.
//
// A mission already in flight needs no case here: every `isXTarget` goes false
// while one is running (one flight per class at a time), so arming a unit
// mid-flight simply offers no targets — which is the truth.
const DISPATCH = {
  drone: {
    icon:    '🛸',
    action:  () => t('hawkStar.solar.sendDrone'),
    target:  (id) => isDroneTarget(id),
    ready:   (id) => canSendDrone(id),
    flight:  (id) => droneFlightTimeBetween(activePlanetId.value, id),
    missing: () => t('hawkStar.solar.noDroneReady'),
    send:    (id) => sendReconDrone(id, activePlanetId.value),
  },
  colony: {
    icon:    '🚀',
    action:  () => t('hawkStar.solar.colonize'),
    target:  (id) => isColonyTarget(id),
    ready:   (id) => canSendColonyShip(id),
    flight:  (id) => colonyFlightTimeBetween(activePlanetId.value, id),
    missing: () => t('hawkStar.solar.colonizeNeedsShip'),
    send:    (id) => sendColonyShip(id, activePlanetId.value),
  },
  cargo: {
    icon:    '📦',
    action:  () => t('hawkStar.solar.sendCargo'),
    target:  (id) => isCargoTarget(id),
    ready:   (id) => canSendCargo(id),
    flight:  (id) => cargoFlightTimeBetween(activePlanetId.value, id),
    missing: () => hasCargoDrone.value ? t('hawkStar.solar.cargoEmpty') : t('hawkStar.solar.noCargoDrone'),
    send:    (id) => sendCargoDrone(id, activePlanetId.value),
  },
}

// Built once per tick instead of per row: the template would otherwise call the
// whole table three times for every planet on every re-render.
const dispatchByPlanet = computed(() => {
  const out = {}
  const d = DISPATCH[armedUnit.value]
  if (!d) return out
  for (const planet of planets.value) {
    const id = planet.id
    // The unit is standing on this planet — it cannot be its own destination.
    if (id === activePlanetId.value) continue
    if (d.ready(id))       out[id] = { state: 'ready', icon: d.icon, action: d.action(), flight: d.flight(id), send: () => d.send(id) }
    else if (d.target(id)) out[id] = { state: 'blocked', icon: d.icon, hint: d.missing() }
  }
  return out
})

// ── Hangar of the active planet ───────────────────────────
// Stays visible whichever planet is selected: building happens at home, and the
// moment you look at a target is exactly when you notice the dock is empty.
const activePlanetName = computed(() =>
  planets.value.find(p => p.id === activePlanetId.value)?.name ?? ''
)

const hangarUnits = computed(() => {
  const out = []
  if (reconDroneLevel.value > 0)
    out.push({ key: 'drone', icon: '🛸', name: t('hawkStar.dock.reconDrone'),
               count: String(reconDroneInventory.value), building: !!reconDroneBuild.value })
  if (colonyShipLevel.value > 0)
    out.push({ key: 'colony', icon: '🚀', name: t('hawkStar.dock.colonyShip'),
               count: String(colonyShipInventory.value), building: !!colonyShipBuild.value })
  if (planetHasHangar(activePlanetId.value))
    out.push({ key: 'cargo', icon: '📦', name: t('hawkStar.dock.cargoDrone'),
               count: cargoDroneReady.value ? `${cargoLoaded.value}/${cargoCapacity.value}`
                                            : String(cargoDroneInventory.value),
               building: !!cargoDroneBuild.value })
  return out
})

// The dock tile was the wrong gate: it unlocks with `space_building`, long
// before a hangar stands on the planet. Every entry in the strip already
// carries its own facility requirement — the drones need the hangar, the colony
// ship the shipyard — so an empty list means "nothing here can build anything"
// and the block disappears on its own. On a colony that is exactly "has a drone
// hangar", since the shipyard is homeOnly.
const hangarVisible = computed(() => hangarUnits.value.length > 0)

// Every own planet draws its meters, so the map needs all their states on open —
// not just the one that happens to be selected. `loadOwnPlanetStates` lives in
// the composable now because the empire board needs exactly the same set; the
// game load already fires it once, this covers a colony founded since.
//
// The galaxy usually arrives after mount, so the watch is what actually fires on
// a cold open; onMounted covers a re-entry where it is already there.
onMounted(loadOwnPlanetStates)
watch(ownPlanetIds, loadOwnPlanetStates)
</script>

<template>
  <div class="hs-solar">

    <!-- ── System header ───────────────────────────────────────────────────── -->
    <div class="hs-solar-head">
      <span class="hs-solar-head__star">☀️</span>
      <span class="hs-solar-head__name">{{ homeSystem?.name }}</span>
      <span class="hs-solar-head__class">{{ starClassLabel(homeSystem?.starClass) }}</span>
      <span class="hs-solar-head__count">{{ t('hawkStar.solar.planetCount', { num: planets.length }) }}</span>
    </div>

    <div class="hs-solar__body">
      <!-- ── Map column ────────────────────────────────────────────────────── -->
      <div class="hs-solar__left">
        <div class="hs-solar-map">
          <div class="hs-solar-sun" aria-hidden="true">☀️</div>

          <!-- Orbit rings, drawn once and static — only the planets move -->
          <div
            v-for="(planet, i) in planets"
            :key="`ring-${planet.id}`"
            class="hs-solar-ring"
            :class="{ 'hs-solar-ring--lit': planet.id === selectedPlanetId }"
            :style="orbitVars(i)"
            aria-hidden="true"
          />

          <!-- One rotating box per planet; the marker sits on its top edge and
               counter-rotates, so labels and badges stay upright -->
          <div
            v-for="(planet, i) in planets"
            :key="planet.id"
            class="hs-solar-orbiter"
            :style="orbiterStyle(planet, i)"
          >
            <div class="hs-solar-slot">
              <div class="hs-solar-counter">
                <button
                  class="hs-pl"
                  :class="markerClass(planet)"
                  :aria-label="planet.name"
                  @click="toggleSelect(planet, { reveal: true })"
                >
                  <span
                    v-if="hasPlanetState(planet.id) && shieldAuraStyle(planet.id)"
                    class="hs-pl__shield"
                    :style="shieldAuraStyle(planet.id)"
                  />
                  <span
                    v-if="hasPlanetState(planet.id) && batteryRingStyle(planet.id)"
                    class="hs-pl__battery"
                    :class="{ 'hs-pl__battery--down': gridDownOn(planet.id) }"
                    :style="batteryRingStyle(planet.id)"
                  />
                  <span class="hs-pl__glyph">{{ planetIcon(planet) }}</span>
                  <span v-if="isHomePlanet(planet)" class="hs-pl__home">🏠</span>
                </button>

                <span
                  class="hs-pl__label"
                  :class="{ 'hs-pl__label--on': planet.id === selectedPlanetId }"
                >{{ shortLabel(planet) }}</span>

                <span
                  v-if="missionOn(planet.id)"
                  class="hs-pl__mission"
                  :class="`hs-pl__mission--${missionOn(planet.id).key}`"
                >{{ missionOn(planet.id).icon }} {{ formatTime(missionOn(planet.id).time) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Planet list ───────────────────────────────────────────────────── -->
      <div class="hs-solar__right">
        <ul ref="listEl" class="hs-plist">
          <li
            v-for="planet in planets"
            :key="planet.id"
            :data-planet="planet.id"
            class="hs-plist__item"
            :class="[
              `hs-plist__item--${effectivePlanetState(planet)}`,
              { 'hs-plist__item--open': planet.id === selectedPlanetId },
            ]"
          >
            <button class="hs-plist__row" @click="toggleSelect(planet)">
              <span class="hs-plist__glyph">{{ planetIcon(planet) }}</span>
              <span class="hs-plist__id">
                <span class="hs-plist__name">{{ planet.name }}</span>
                <span
                  class="hs-plist__state"
                  :style="{ color: stateColor(effectivePlanetState(planet)) }"
                >{{ stateLabel(effectivePlanetState(planet)) }}</span>
              </span>
              <span v-if="isHomePlanet(planet)" class="hs-plist__flag" :title="t('hawkStar.solar.home')">🏠</span>
              <span
                v-else-if="planet.id === activePlanetId"
                class="hs-plist__flag"
                :title="t('hawkStar.solar.currentLocation')"
              >📍</span>
              <span
                v-if="missionOn(planet.id)"
                class="hs-plist__mission"
                :class="`hs-plist__mission--${missionOn(planet.id).key}`"
              >{{ missionOn(planet.id).icon }} {{ formatTime(missionOn(planet.id).time) }}</span>
              <span class="hs-plist__chevron" aria-hidden="true">▾</span>
            </button>

            <div
              v-if="dispatchByPlanet[planet.id]"
              class="hs-plist__send"
              :class="[
                `hs-plist__send--${armedUnit}`,
                { 'hs-plist__send--blocked': dispatchByPlanet[planet.id].state === 'blocked' },
              ]"
            >
              <template v-if="dispatchByPlanet[planet.id].state === 'ready'">
                <button class="hs-plist__send-btn" @click.stop="dispatchByPlanet[planet.id].send()">
                  {{ dispatchByPlanet[planet.id].icon }} {{ dispatchByPlanet[planet.id].action }}
                </button>
                <span class="hs-plist__send-time">⏱ {{ formatTime(dispatchByPlanet[planet.id].flight) }}</span>
              </template>
              <span v-else class="hs-plist__send-hint">
                {{ dispatchByPlanet[planet.id].icon }} {{ dispatchByPlanet[planet.id].hint }}
              </span>
            </div>

            <div v-if="planet.id === selectedPlanetId" class="hs-plist__body">
              <div class="hs-plist__chips">
                <span
                  v-if="isScanned(planet.id) || effectivePlanetState(planet) === 'own'"
                  class="hs-chip"
                >{{ PLANET_TYPES[planet.type]?.icon }} {{ planet.type }}</span>
                <span
                  v-if="planet.slots !== null && (isScanned(planet.id) || effectivePlanetState(planet) === 'own')"
                  class="hs-chip"
                >{{ planet.slots }} {{ t('hawkStar.solar.slots') }}</span>
                <span v-if="effectivePlanetState(planet) === 'own'" class="hs-chip">{{ playerName }}</span>
                <span v-else-if="planet.owner" class="hs-chip">{{ planet.owner }}</span>
                <span
                  v-if="planetHasDock(planet.id) && effectivePlanetState(planet) === 'own'"
                  class="hs-chip"
                >🛠 Dock</span>
                <template v-if="effectivePlanetState(planet) === 'own' && hasPlanetState(planet.id)">
                  <span
                    v-if="batteryPct(planet.id) !== null"
                    class="hs-chip hs-chip--meter"
                    :class="`hs-chip--battery-${batteryLevel(planet.id)}`"
                  >{{ gridDownOn(planet.id) ? '⚠️' : '🔋' }} {{ batteryPct(planet.id) }}%</span>
                  <span
                    v-if="shieldPct(planet.id) !== null"
                    class="hs-chip hs-chip--meter"
                    :class="`hs-chip--shield-${meterLevel(shieldPct(planet.id))}`"
                  >🛡️ {{ shieldPct(planet.id) }}%</span>
                </template>
              </div>

              <div
                v-if="effectivePlanetState(planet) === 'own' && !hasCommandCenter(planet.id)"
                class="hs-plist__hint"
              >{{ t('hawkStar.solar.settleHint') }}</div>
              <div
                v-else-if="isColonyTarget(planet.id) && !canSendColonyShip(planet.id)"
                class="hs-plist__hint"
              >{{ t('hawkStar.solar.colonizeHint') }}</div>

              <!-- One row per unit class that has something to say about this planet -->
              <div v-if="targetOps.length && !armedUnit" class="hs-plist__ops">
                <div class="hs-plist__from">{{ t('hawkStar.solar.fromPlanet', { planet: activePlanetName }) }}</div>
                <div
                  v-for="op in targetOps"
                  :key="op.key"
                  class="hs-op"
                  :class="`hs-op--${op.key}`"
                >
                  <span class="hs-op__icon">{{ op.icon }}</span>
                  <span class="hs-op__label">{{ op.label }}</span>
                  <template v-if="op.state === 'enroute'">
                    <div class="hs-op__track"><div class="hs-op__fill" :style="op.progress" /></div>
                    <span class="hs-op__time">{{ formatTime(op.remaining) }}</span>
                  </template>
                  <template v-else-if="op.state === 'ready'">
                    <span class="hs-op__time">⏱ {{ formatTime(op.flight) }}</span>
                    <button class="hs-op__btn" @click.stop="op.send()">{{ op.action }}</button>
                  </template>
                  <span v-else class="hs-op__missing">{{ op.hint }}</span>
                </div>
              </div>

              <!-- The active planet's own row is where its hangar belongs: sitting
                   under the map it read as a property of the system, not of a planet -->
              <div v-if="planet.id === activePlanetId && hangarVisible" class="hs-hangar">
                <div class="hs-hangar__head">
                  <span class="hs-hangar__title">🛠 {{ t('hawkStar.solar.hangarTitle') }}</span>
                  <span v-if="returningCargoMission" class="hs-hangar__return">
                    📦 {{ t('hawkStar.solar.cargoReturning') }} {{ formatTime(remainingCargoReturnSec) }}
                  </span>
                </div>

                <div v-if="armedUnit" class="hs-hangar__armed">
                  {{ DISPATCH[armedUnit].icon }} {{ t('hawkStar.solar.pickTarget') }}
                </div>

                <div class="hs-hangar__strip">
                  <button
                    v-for="u in hangarUnits"
                    :key="u.key"
                    class="hs-hu"
                    :class="[`hs-hu--${u.key}`, { 'hs-hu--open': armedUnit === u.key }]"
                    :title="u.name"
                    @click.stop="armUnit(u.key)"
                  >
                    <span class="hs-hu__icon">{{ u.icon }}</span>
                    <span class="hs-hu__count">{{ u.count }}</span>
                    <span class="hs-hu__name">{{ u.name }}</span>
                    <span v-if="u.building" class="hs-hu__building">⏱</span>
                  </button>
                </div>

                <!-- Recon drone -->
                <div v-if="armedUnit === 'drone'" class="hs-hangar__build">
                  <div class="hs-dock-row">
                    <div class="hs-dock-icon-wrap">
                      <span class="hs-dock-icon">🛸</span>
                      <span v-if="reconDroneInventory > 0" class="hs-dock-badge">{{ reconDroneInventory }}</span>
                    </div>
                    <div class="hs-dock-info">
                      <div class="hs-dock-name">{{ t('hawkStar.dock.reconDrone') }}</div>
                      <div class="hs-dock-cost-row">
                        <span v-for="(amt, resId) in UNIT_COSTS.recon_drone.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
                        <span class="hs-unit-time-tag">⏱ {{ formatTime(droneBuildTime) }}</span>
                      </div>
                      <div v-if="reconDroneBuild" class="hs-progress-row">
                        <div class="hs-progress-track"><div :key="reconDroneBuild.endsAt" class="hs-progress-fill hs-progress-fill--unit" :style="droneBuildProgressStyle" /></div>
                        <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((reconDroneBuild.endsAt - Date.now()) / 1000))) }}</span>
                      </div>
                    </div>
                    <div class="hs-dock-action">
                      <span v-if="reconDroneBuild" class="hs-status-building">{{ t('hawkStar.dock.statusBuilding') }}</span>
                      <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildDrone }" :disabled="!canBuildDrone" @click.stop="buildReconDrone()">{{ t('hawkStar.dock.btnBuild') }}</button>
                    </div>
                  </div>
                </div>

                <!-- Colony ship -->
                <div v-else-if="armedUnit === 'colony'" class="hs-hangar__build">
                  <div class="hs-dock-row">
                    <div class="hs-dock-icon-wrap">
                      <span class="hs-dock-icon">🚀</span>
                      <span v-if="colonyShipInventory > 0" class="hs-dock-badge hs-dock-badge--colony">{{ colonyShipInventory }}</span>
                    </div>
                    <div class="hs-dock-info">
                      <div class="hs-dock-name">{{ t('hawkStar.dock.colonyShip') }}</div>
                      <div class="hs-dock-cost-row">
                        <span v-for="(amt, resId) in UNIT_COSTS.colony_ship.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
                        <span class="hs-cost-tag" :class="hasColonyCrew ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'" :title="t('hawkStar.dock.crewHint', { crew: colonyShipCrew })">👥 {{ colonyShipCrew }}</span>
                        <span class="hs-unit-time-tag">⏱ {{ formatTime(colonyShipBuildTime) }}</span>
                      </div>
                      <div v-if="colonyShipBuild" class="hs-progress-row">
                        <div class="hs-progress-track"><div :key="colonyShipBuild.endsAt" class="hs-progress-fill hs-progress-fill--colony" :style="colonyShipBuildProgressStyle" /></div>
                        <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((colonyShipBuild.endsAt - Date.now()) / 1000))) }}</span>
                      </div>
                    </div>
                    <div class="hs-dock-action">
                      <span v-if="colonyShipBuild" class="hs-status-building">{{ t('hawkStar.dock.statusBuilding') }}</span>
                      <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildColonyShip }" :disabled="!canBuildColonyShip" @click.stop="buildColonyShip()">{{ t('hawkStar.dock.btnBuild') }}</button>
                    </div>
                  </div>
                </div>

                <!-- Cargo drone: build it, or load its hold -->
                <div v-else-if="armedUnit === 'cargo'" class="hs-hangar__build">
                  <div v-if="!cargoDroneReady" class="hs-dock-row">
                    <div class="hs-dock-icon-wrap">
                      <span class="hs-dock-icon">📦</span>
                    </div>
                    <div class="hs-dock-info">
                      <div class="hs-dock-name">{{ t('hawkStar.dock.cargoDrone') }}</div>
                      <div class="hs-dock-cost-row">
                        <span v-for="(amt, resId) in UNIT_COSTS.cargo_drone.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
                        <span class="hs-unit-time-tag">⏱ {{ formatTime(cargoBuildTime) }}</span>
                      </div>
                      <div v-if="cargoDroneBuild" class="hs-progress-row">
                        <div class="hs-progress-track"><div :key="cargoDroneBuild.endsAt" class="hs-progress-fill hs-progress-fill--cargo" :style="cargoBuildProgressStyle" /></div>
                        <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((cargoDroneBuild.endsAt - Date.now()) / 1000))) }}</span>
                      </div>
                      <div v-else-if="hasCargoDrone" class="hs-cargo-hint">{{ t('hawkStar.solar.cargoOnePerPlanet') }}</div>
                    </div>
                    <div class="hs-dock-action">
                      <span v-if="cargoDroneBuild" class="hs-status-building">{{ t('hawkStar.dock.statusBuilding') }}</span>
                      <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildCargoDrone }" :disabled="!canBuildCargoDrone" @click.stop="buildCargoDrone()">{{ t('hawkStar.dock.btnBuild') }}</button>
                    </div>
                  </div>

                  <!-- Drone in the dock → load the hold: four items total, freely mixed -->
                  <div v-else class="hs-cargo-picker">
                    <div v-for="resId in cargoLoadable" :key="resId" class="hs-cargo-picker__row">
                      <span class="hs-cargo-picker__icon">{{ RESOURCES[resId]?.icon }}</span>
                      <span class="hs-cargo-picker__name">{{ t(`hawkStar.res.${resId}`, RESOURCES[resId]?.name ?? resId) }}</span>
                      <span class="hs-cargo-picker__stock">{{ Math.floor(playerResources[resId] ?? 0) }}</span>
                      <div class="hs-cargo-picker__stepper">
                        <button
                          class="hs-cargo-picker__btn"
                          :disabled="(cargoManifest[resId] ?? 0) < 1"
                          @click.stop="unloadCargo(resId)"
                        >−</button>
                        <span class="hs-cargo-picker__count">{{ cargoManifest[resId] ?? 0 }}</span>
                        <button
                          class="hs-cargo-picker__btn"
                          :disabled="!canLoadMore(resId)"
                          @click.stop="loadCargo(resId)"
                        >+</button>
                      </div>
                    </div>
                    <div class="hs-cargo-picker__foot">
                      <span class="hs-cargo-picker__total" :class="{ 'hs-cargo-picker__total--full': cargoLoaded >= cargoCapacity }">
                        {{ t('hawkStar.solar.cargoHold') }} {{ cargoLoaded }} / {{ cargoCapacity }}
                      </span>
                      <button
                        class="hs-cargo-picker__unload"
                        :disabled="cargoLoaded < 1"
                        @click.stop="unloadAllCargo()"
                      >{{ t('hawkStar.solar.cargoUnloadAll') }}</button>
                    </div>
                    <div class="hs-cargo-hint">{{ t('hawkStar.solar.cargoSendHint') }}</div>
                  </div>
                </div>
              </div>

              <div
                v-if="planet.id === activePlanetId && !hangarVisible"
                class="hs-plist__hint hs-plist__hint--here"
              >📍 {{ t('hawkStar.solar.currentLocation') }}</div>

              <button
                v-if="effectivePlanetState(planet) === 'own'"
                class="hs-plist__go"
                @click.stop="goToPlanet(planet.id)"
              >🏛️ {{ t('hawkStar.solar.settleBtn') }}</button>
            </div>
          </li>
        </ul>
      </div>
    </div>

  </div>
</template>

<style lang="scss" scoped>
.hs-solar {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

// ── System header ────────────────────────────────────────────────────────────
.hs-solar-head {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  padding: 0.35rem 0.65rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);
}

.hs-solar-head__star  { font-size: 0.85rem; align-self: center; }
.hs-solar-head__name  { font-size: 0.78rem; font-weight: 700; color: rgba(255,255,255,0.9); }
.hs-solar-head__class { font-size: 0.56rem; color: rgba(253,230,138,0.55); }
.hs-solar-head__count {
  margin-left: auto;
  font-size: 0.55rem;
  color: rgba(255,255,255,0.3);
  white-space: nowrap;
}

// ── Two columns from 768 px: map + hangar left, planet list right ────────────
.hs-solar__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: flex-start;
    gap: 0.75rem;
  }
}

.hs-solar__left {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;

  @media (min-width: 768px) { flex: 1 1 20rem; max-width: 30rem; }
}

.hs-solar__right {
  min-width: 0;

  @media (min-width: 768px) { flex: 1 1 15rem; }
}

// ── Orbit map ────────────────────────────────────────────────────────────────
// A square box: every orbit radius is a percentage of it, so the whole system
// scales from a 360 px phone to a wide desktop with no media query and no
// measurement. `--marker` is the one pixel-ish value, and it only grows once.
.hs-solar-map {
  --marker: 1.85rem;

  position: relative;
  width: 100%;
  max-width: 30rem;
  margin: 0 auto;
  aspect-ratio: 1 / 1;
  border: 1px solid var(--hs-line-md);
  border-radius: var(--hs-r-lg);
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 50%, rgba(253,230,138,0.10), rgba(253,230,138,0.02) 24%, transparent 52%),
    radial-gradient(circle at 12% 22%, rgba(255,255,255,0.55) 0 1px, transparent 1.5px),
    radial-gradient(circle at 78% 12%, rgba(255,255,255,0.40) 0 1px, transparent 1.5px),
    radial-gradient(circle at 88% 62%, rgba(255,255,255,0.50) 0 1px, transparent 1.5px),
    radial-gradient(circle at 32% 88%, rgba(255,255,255,0.35) 0 1px, transparent 1.5px),
    radial-gradient(circle at 62% 92%, rgba(255,255,255,0.45) 0 1px, transparent 1.5px),
    radial-gradient(circle at 6%  68%, rgba(255,255,255,0.30) 0 1px, transparent 1.5px),
    radial-gradient(circle at 94% 34%, rgba(255,255,255,0.30) 0 1px, transparent 1.5px),
    radial-gradient(circle at 46% 6%,  rgba(255,255,255,0.35) 0 1px, transparent 1.5px),
    radial-gradient(circle at 20% 52%, rgba(255,255,255,0.22) 0 1px, transparent 1.5px),
    radial-gradient(circle at 70% 44%, rgba(255,255,255,0.22) 0 1px, transparent 1.5px),
    linear-gradient(180deg, rgba(10,12,24,0.6), rgba(6,8,18,0.85));

  @media (min-width: 640px) { --marker: 2.3rem; }
}

// ── Sun ──────────────────────────────────────────────────────────────────────
.hs-solar-sun {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3.1rem;
  height: 3.1rem;
  margin-left: -1.55rem;
  margin-top: -1.55rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  line-height: 1;
  border-radius: 50%;
  pointer-events: none;
  z-index: 5;
  background: radial-gradient(circle,
    rgba(253,230,138,0.85) 0%,
    rgba(251,191,36,0.45) 42%,
    rgba(251,146,60,0.14) 70%,
    transparent 100%);
  animation: hs-sun-pulse 7s ease-in-out infinite;

  @media (min-width: 640px) {
    width: 4rem; height: 4rem; margin-left: -2rem; margin-top: -2rem;
    font-size: 1.7rem;
  }
}

@keyframes hs-sun-pulse {
  0%, 100% { transform: scale(1);    filter: brightness(1); }
  50%      { transform: scale(1.07); filter: brightness(1.18); }
}

// ── Orbit rings ──────────────────────────────────────────────────────────────
// `--r` is a percentage, so `calc(50% - var(--r))` centres the ring and
// `calc(var(--r) * 2)` sizes it — the box is square, so the same value works
// for left/top and width/height.
.hs-solar-ring {
  position: absolute;
  left:   calc(50% - var(--r));
  top:    calc(50% - var(--r));
  width:  calc(var(--r) * 2);
  height: calc(var(--r) * 2);
  border: 1px solid rgba(255,255,255,0.055);
  border-radius: 50%;
  pointer-events: none;
  transition: border-color 0.25s ease;

  &--lit { border-color: rgba(129,140,248,0.4); }
}

// ── Orbiters ─────────────────────────────────────────────────────────────────
.hs-solar-orbiter {
  position: absolute;
  left:   calc(50% - var(--r));
  top:    calc(50% - var(--r));
  width:  calc(var(--r) * 2);
  height: calc(var(--r) * 2);
  pointer-events: none;
  animation: hs-orbit var(--period) linear infinite;
  animation-delay: var(--delay);
  will-change: transform;
}

// The marker rides the top edge of its orbiter…
.hs-solar-slot {
  position: absolute;
  left: 50%;
  top: 0;
  width:  var(--marker);
  height: var(--marker);
  margin-left: calc(var(--marker) / -2);
  margin-top:  calc(var(--marker) / -2);
}

// …and spins back at the same rate, so glyph, label and badge stay upright.
// Same duration and the same negative delay, `reverse` supplies the sign.
.hs-solar-counter {
  position: absolute;
  inset: 0;
  animation: hs-orbit var(--period) linear infinite reverse;
  animation-delay: var(--delay);
  will-change: transform;
}

@keyframes hs-orbit {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

// A paused animation still honours its negative delay, so the planets keep
// their scattered positions instead of collapsing onto one ray.
@media (prefers-reduced-motion: reduce) {
  .hs-solar-orbiter,
  .hs-solar-counter { animation-play-state: paused; }
  .hs-solar-sun     { animation: none; }
}

// ── Planet marker ────────────────────────────────────────────────────────────
.hs-pl {
  position: absolute;
  inset: 0;
  overflow: visible;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(10,12,24,0.92);
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

  &:hover { transform: scale(1.14); }

  &--own          { border-color: rgba(96,165,250,0.65);  box-shadow: 0 0 10px rgba(96,165,250,0.18); }
  &--enemy        { border-color: rgba(248,113,113,0.65); box-shadow: 0 0 10px rgba(248,113,113,0.15); }
  &--ally         { border-color: rgba(52,211,153,0.6); }
  &--uncolonized  { border-color: rgba(255,255,255,0.28); }
  &--unknown      { border-color: rgba(255,255,255,0.1);  background: rgba(10,12,24,0.7); }
  &--scanning     { border-color: rgba(251,191,36,0.7);   box-shadow: 0 0 10px rgba(251,191,36,0.2); }
  &--colonizing   { border-color: rgba(96,165,250,0.6); }
  &--uninhabitable{ border-color: rgba(75,75,75,0.5);     opacity: 0.55; }

  // The home base is an "own" planet like every colony, so blue alone cannot
  // tell them apart — it gets the brighter ring plus the 🏠 corner badge.
  &--home {
    border-color: rgba(147,197,253,0.95);
    box-shadow: 0 0 16px rgba(96,165,250,0.35);
  }

  &--selected {
    transform: scale(1.16);
    border-color: var(--hs-active-border);
    box-shadow: 0 0 0 2px var(--hs-active-border), 0 0 22px var(--hs-active-glow);

    &:hover { transform: scale(1.2); }
  }
}

.hs-pl__glyph {
  position: relative;
  z-index: 1;
  font-size: 0.95rem;
  line-height: 1;

  @media (min-width: 640px) { font-size: 1.2rem; }
}

.hs-pl__home {
  position: absolute;
  top: -3px;
  right: -5px;
  z-index: 2;
  font-size: 0.5rem;
  line-height: 1;
  pointer-events: none;
}

// The battery is drawn as what it is — a charge ring around the planet. The
// mask cuts the conic gradient down to a 3 px band at the outer edge.
.hs-pl__battery {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  pointer-events: none;
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
          mask: radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));

  // A blackout stops the whole planet — the one meter worth shouting about.
  &--down { animation: hs-meter-pulse 1.5s ease-in-out infinite; }
}

@keyframes hs-meter-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}

// The shield is the bubble around the planet; its opacity is the charge, so a
// planet without one simply looks bare instead of wearing an empty ring.
.hs-pl__shield {
  position: absolute;
  inset: -9px;
  border: 1px solid transparent;
  border-radius: 50%;
  pointer-events: none;
  transition: background 0.4s ease, border-color 0.4s ease;
}

// Roman numeral only — the full name is in the list beside the map, and
// anything longer would collide with the neighbouring orbit.
.hs-pl__label {
  position: absolute;
  top: calc(100% + 3px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.46rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.45);
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0,0,0,0.95);
  pointer-events: none;
  transition: color 0.2s ease;

  &--on { color: rgba(196,181,253,0.95); }
}

.hs-pl__mission {
  position: absolute;
  bottom: calc(100% + 3px);
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid;
  background: rgba(6,8,18,0.9);
  font-size: 0.45rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;

  &--drone  { color: rgba(251,191,36,0.95); border-color: rgba(251,191,36,0.4); }
  &--colony { color: rgba(96,165,250,0.95); border-color: rgba(96,165,250,0.4); }
  &--cargo  { color: rgba(251,191,36,0.95); border-color: rgba(251,191,36,0.5); }
}

// ── Planet list ──────────────────────────────────────────────────────────────
// Every planet at once, the selected one unfolded. The map answers "where",
// the list answers "what and what can I do with it" — and one row is open at a
// time because the map has exactly one selection.
.hs-plist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.hs-plist__item {
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &--own           { border-color: rgba(96,165,250,0.3); }
  &--enemy         { border-color: rgba(248,113,113,0.3); }
  &--ally          { border-color: rgba(52,211,153,0.28); }
  &--scanning      { border-color: rgba(251,191,36,0.3); }
  &--colonizing    { border-color: rgba(96,165,250,0.28); }
  &--uninhabitable { opacity: 0.6; }

  // Last, so the selection outranks every state colour above.
  &--open {
    border-color: var(--hs-active-border);
    box-shadow: 0 0 18px var(--hs-active-glow);
    opacity: 1;
  }
}

.hs-plist__row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.5rem;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;

  &:hover { background: rgba(255,255,255,0.04); }
}

.hs-plist__glyph { font-size: 1.05rem; line-height: 1; flex-shrink: 0; }

.hs-plist__id {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.hs-plist__name {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-plist__state { font-size: 0.55rem; font-weight: 600; }

.hs-plist__flag { font-size: 0.7rem; line-height: 1; flex-shrink: 0; }

.hs-plist__mission {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 0.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  &--drone  { color: rgba(251,191,36,0.95); border-color: rgba(251,191,36,0.35); }
  &--colony { color: rgba(96,165,250,0.95); border-color: rgba(96,165,250,0.35); }
  &--cargo  { color: rgba(251,191,36,0.95); border-color: rgba(251,191,36,0.45); }
}

.hs-plist__chevron {
  flex-shrink: 0;
  font-size: 0.55rem;
  opacity: 0.3;
  transition: transform 0.2s ease, opacity 0.2s ease;

  .hs-plist__item--open & { transform: rotate(180deg); opacity: 0.7; }
}

// Dispatch bar — shown on every row the armed unit can reach, so picking a
// target is one glance down the list instead of opening each planet in turn.
.hs-plist__send {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.5rem;
  border-top: 1px solid var(--hs-line-sm);

  &--drone  { background: rgba(251,191,36,0.07); }
  &--colony { background: rgba(96,165,250,0.07); }
  &--cargo  { background: rgba(251,191,36,0.09); }

  // Reachable, but the dock has nothing to put in it — keep the row calm.
  &--blocked { background: transparent; }
}

.hs-plist__send-btn {
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0.6rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.64rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid;
  transition: background 0.15s, border-color 0.15s;

  .hs-plist__send--drone & {
    border-color: rgba(251,191,36,0.45);
    background: rgba(251,191,36,0.14);
    color: rgba(253,230,138,0.95);
    &:hover { background: rgba(251,191,36,0.26); border-color: rgba(251,191,36,0.7); }
  }
  .hs-plist__send--colony & {
    border-color: rgba(96,165,250,0.45);
    background: rgba(96,165,250,0.14);
    color: rgba(191,219,254,0.95);
    &:hover { background: rgba(96,165,250,0.26); border-color: rgba(96,165,250,0.7); }
  }
  .hs-plist__send--cargo & {
    border-color: rgba(251,191,36,0.5);
    background: rgba(251,191,36,0.16);
    color: rgba(253,230,138,0.95);
    &:hover { background: rgba(251,191,36,0.28); border-color: rgba(251,191,36,0.75); }
  }
}

.hs-plist__send-time {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.55);
}

.hs-plist__send-hint {
  font-size: 0.58rem;
  font-weight: 600;
  color: rgba(255,255,255,0.28);
}

.hs-plist__body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.45rem 0.5rem 0.5rem;
  border-top: 1px solid var(--hs-line-sm);
  background: rgba(255,255,255,0.015);
}

.hs-plist__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.28rem;
}

.hs-chip {
  font-size: 0.55rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--hs-glass-lg);
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.45);
  white-space: nowrap;

  &--meter { font-variant-numeric: tabular-nums; }

  &--battery-ok    { color: rgba(167,243,208,0.85); }
  &--battery-low,
  &--battery-empty { color: rgba(253,230,138,0.9); }
  &--battery-down  { color: rgba(252,165,165,0.95); border-color: rgba(248,113,113,0.3); }
  &--shield-ok     { color: rgba(186,230,253,0.85); }
  &--shield-low    { color: rgba(253,230,138,0.9); }
  &--shield-empty  { color: rgba(255,255,255,0.3); }
}

.hs-plist__hint {
  font-size: 0.58rem;
  font-style: italic;
  color: rgba(255,255,255,0.35);

  &--here { color: rgba(52,211,153,0.6); font-style: normal; }
}

.hs-plist__go {
  align-self: flex-start;
  padding: 0.3rem 0.6rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.64rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid rgba(96,165,250,0.4);
  background: rgba(96,165,250,0.1);
  color: rgba(96,165,250,0.95);
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(96,165,250,0.2); border-color: rgba(96,165,250,0.65); }
}

// ── Action rows toward the open planet ───────────────────────────────────────
.hs-plist__ops {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.hs-plist__from {
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
}

.hs-op {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.45rem;
  border-radius: var(--hs-r-sm);
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);

  &--drone  { border-color: rgba(251,191,36,0.18); }
  &--colony { border-color: rgba(96,165,250,0.18); }
  &--cargo  { border-color: rgba(251,191,36,0.24); }
}

.hs-op__icon { font-size: 0.85rem; line-height: 1; flex-shrink: 0; }

.hs-op__label {
  flex: 1;
  min-width: 0;
  font-size: 0.62rem;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-op__track {
  flex: 1 1 3rem;
  min-width: 2rem;
  height: 3px;
  border-radius: 999px;
  background: var(--hs-glass-3xl);
  overflow: hidden;
}

.hs-op__fill {
  height: 100%;
  width: 100%;
  transform-origin: left;
  animation: hs-bar-fill linear forwards;
  background: rgba(255,255,255,0.5);

  .hs-op--drone  & { background: #f59e0b; }
  .hs-op--colony & { background: #60a5fa; }
  .hs-op--cargo  & { background: #fbbf24; }
}

@keyframes hs-bar-fill {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.hs-op__time {
  flex-shrink: 0;
  font-size: 0.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.4);

  .hs-op--drone  & { color: rgba(251,191,36,0.8); }
  .hs-op--colony & { color: rgba(96,165,250,0.8); }
  .hs-op--cargo  & { color: rgba(251,191,36,0.85); }
}

.hs-op__btn {
  flex-shrink: 0;
  padding: 0.25rem 0.6rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.6rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid;
  transition: background 0.15s, border-color 0.15s;

  .hs-op--drone & {
    border-color: rgba(251,191,36,0.35);
    background: rgba(251,191,36,0.1);
    color: rgba(251,191,36,0.9);
    &:hover { background: rgba(251,191,36,0.2); border-color: rgba(251,191,36,0.6); }
  }
  .hs-op--colony & {
    border-color: rgba(96,165,250,0.35);
    background: rgba(96,165,250,0.1);
    color: rgba(96,165,250,0.95);
    &:hover { background: rgba(96,165,250,0.2); border-color: rgba(96,165,250,0.6); }
  }
  .hs-op--cargo & {
    border-color: rgba(251,191,36,0.4);
    background: rgba(251,191,36,0.12);
    color: rgba(251,191,36,0.95);
    &:hover { background: rgba(251,191,36,0.22); border-color: rgba(251,191,36,0.65); }
  }
}

// Target would be reachable — the dock just has no finished unit for it
.hs-op__missing {
  flex-shrink: 0;
  font-size: 0.58rem;
  font-weight: 600;
  color: rgba(255,255,255,0.28);
  text-align: right;
}

// ── Hangar of the active planet ──────────────────────────────────────────────
// Lives inside the open planet's row: a card in a card would only add a second
// border around the same content, so it is a plain section with a hairline.
.hs-hangar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.45rem;
  border-top: 1px solid var(--hs-line-sm);
}

.hs-hangar__head {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.hs-hangar__title {
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

.hs-hangar__return {
  margin-left: auto;
  font-size: 0.55rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(251,191,36,0.8);
  white-space: nowrap;
}

// The armed state has to be legible from the hangar too, or a strip button
// lighting up is the only clue that the list just changed.
.hs-hangar__armed {
  font-size: 0.56rem;
  font-weight: 600;
  color: rgba(196,181,253,0.85);
}

.hs-hangar__strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.hs-hu {
  flex: 1 1 6rem;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.4rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid var(--hs-line-lg);
  background: var(--hs-glass-md);
  color: rgba(255,255,255,0.65);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: var(--hs-glass-2xl); }

  &--drone.hs-hu--open  { border-color: rgba(251,191,36,0.5); background: rgba(251,191,36,0.1); }
  &--colony.hs-hu--open { border-color: rgba(96,165,250,0.5); background: rgba(96,165,250,0.1); }
  &--cargo.hs-hu--open  { border-color: rgba(251,191,36,0.5); background: rgba(251,191,36,0.12); }
}

.hs-hu__icon  { font-size: 0.85rem; line-height: 1; flex-shrink: 0; }

.hs-hu__count {
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.85);
  flex-shrink: 0;
}

// The unit name is the first thing to go when three buttons share a phone row —
// icon and count already say which is which.
.hs-hu__name {
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 479px) { display: none; }
}

.hs-hu__building {
  margin-left: auto;
  font-size: 0.6rem;
  color: var(--hs-warn);
  flex-shrink: 0;
}

.hs-hangar__build {
  border-top: 1px solid var(--hs-line-sm);
  padding-top: 0.45rem;
}

// ── Build rows (shared with the dock panel) ──────────────────────────────────
.hs-dock-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.45rem 0.5rem;
}

.hs-dock-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hs-glass-lg);
  border-radius: var(--hs-r-sm);
}

.hs-dock-icon { font-size: 1rem; }

.hs-dock-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 0.52rem;
  font-weight: 700;
  background: #f59e0b;
  color: #000;
  padding: 1px 3px;
  border-radius: 4px;
  line-height: 1.4;

  &--colony { background: #60a5fa; color: #000; }
}

.hs-dock-info     { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-dock-name     { font-size: 0.72rem; font-weight: 600; display: flex; align-items: baseline; gap: 0.3rem; flex-wrap: wrap; }
.hs-dock-cost-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }
.hs-dock-action   { flex-shrink: 0; }

.hs-unit-time-tag {
  font-size: 0.58rem;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--hs-glass-lg);
  color: rgba(255,255,255,0.35);
}

.hs-cost-tag {
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--hs-glass-lg);
  border: 1px solid transparent;

  &--ok { color: rgba(255,255,255,0.65); }
  &--no { color: var(--hs-danger); border-color: rgba(248,113,113,0.2); }
}

.hs-progress-row   { display: flex; align-items: center; gap: 0.4rem; margin-top: 4px; }
.hs-progress-track { flex: 1; height: 3px; background: var(--hs-glass-3xl); border-radius: 9999px; overflow: hidden; }

.hs-progress-fill {
  height: 100%;
  background: var(--hs-warn);
  transform-origin: left;
  animation: hs-bar-fill linear forwards;

  &--unit   { background: #f59e0b; }
  &--colony { background: #60a5fa; }
  &--cargo  { background: #fbbf24; }
}

.hs-progress-time { font-size: 0.55rem; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.4); flex-shrink: 0; }

.hs-btn-build {
  padding: 0.3rem 0.6rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.65rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(52,211,153,0.35);
  background: rgba(52,211,153,0.08);
  color: rgba(52,211,153,0.9);
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;

  &:hover:not(:disabled) { background: rgba(52,211,153,0.18); border-color: rgba(52,211,153,0.6); }

  &--disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.hs-status-building { font-size: 0.65rem; font-weight: 600; color: var(--hs-warn); white-space: nowrap; }

// ── Cargo picker (hold loading) ──────────────────────────────────────────────
.hs-cargo-picker {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.hs-cargo-picker__row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 2px 0;
}

.hs-cargo-picker__icon { font-size: 0.8rem; line-height: 1; flex-shrink: 0; }

.hs-cargo-picker__name {
  flex: 1;
  min-width: 0;
  font-size: 0.6rem;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-cargo-picker__stock {
  font-size: 0.58rem;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.35);
  min-width: 1.75rem;
  text-align: right;
}

.hs-cargo-picker__stepper {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-shrink: 0;
}

.hs-cargo-picker__btn {
  width: 1.15rem;
  height: 1.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(251,191,36,0.3);
  background: rgba(251,191,36,0.07);
  color: rgba(251,191,36,0.9);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) { background: rgba(251,191,36,0.18); border-color: rgba(251,191,36,0.6); }
  &:disabled { opacity: 0.25; cursor: not-allowed; }
}

.hs-cargo-picker__count {
  min-width: 0.9rem;
  text-align: center;
  font-size: 0.62rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.75);
}

.hs-cargo-picker__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.2rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--hs-line-sm);
}

.hs-cargo-picker__total {
  font-size: 0.62rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.5);

  &--full { color: rgba(251,191,36,0.95); }
}

.hs-cargo-picker__unload {
  padding: 2px 7px;
  border-radius: var(--hs-r-sm);
  font-size: 0.55rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(248,113,113,0.3);
  background: rgba(248,113,113,0.07);
  color: rgba(248,113,113,0.85);
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) { background: rgba(248,113,113,0.16); border-color: rgba(248,113,113,0.55); }
  &:disabled { opacity: 0.25; cursor: not-allowed; }
}

.hs-cargo-hint {
  font-size: 0.55rem;
  font-style: italic;
  color: rgba(255,255,255,0.3);
  margin-top: 0.15rem;
}
</style>
