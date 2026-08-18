<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PLANET_TYPES, RESOURCES, UNIT_COSTS } from '~/utils/hawkStarConfig.js'
import { useHawkStar, refreshPlanetState } from '~/composables/useHawkStar.js'
import HsAllResourcePanel from '~/components/hawk-star/HsAllResourcePanel.vue'

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
  allActiveCargoMissions, activeCargoMissions,
  homeSystem, homePlanetId,
  shieldChargeOf, batteryChargeOf, gridDownOn,
  ownPlanetIds, loadOwnPlanetStates,
  activePlanetId, setActivePlanet,
  formatTime,
  playerResources,
  planetHasDock,
  // build
  reconDroneBuild, droneBuildTime, canBuildDrone, buildReconDrone, droneBuildProgressStyle,
  colonyShipBuild, colonyShipBuildTime, canBuildColonyShip, buildColonyShip, colonyShipBuildProgressStyle,
  colonyShipCrew, hasColonyCrew,
  // cargo drone
  cargoDroneLevel, cargoDroneInventory, cargoDroneBuild, cargoDroneReady, hasCargoDrone,
  cargoManifest, cargoLoaded, cargoCapacity, cargoLoadable,
  cargoBuildTime, canBuildCargoDrone, buildCargoDrone, cargoBuildProgressStyle,
  canLoadMore, loadCargo, unloadCargo, unloadAllCargo,
  isCargoTarget, canSendCargo, sendCargoDrone,
  remainingCargoSec, remainingCargoReturnSec, cargoProgressStyle, cargoReturnProgressStyle,
  returningCargoMission, cargoFlightTimeBetween,
} = useHawkStar()

const emit = defineEmits(['go-planet'])

const { t } = useI18n()

const expandedBuildRow = ref(null)
const resOpen = ref(false)

const toggleBuildRow = (row) => {
  expandedBuildRow.value = expandedBuildRow.value === row ? null : row
}
const closeBuildRow = () => { expandedBuildRow.value = null }

const planets           = computed(() => homeSystem.value?.planets ?? [])
const habitablePlanets  = computed(() => planets.value.filter(p => p.type !== 'uninhabitable'))

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

const toggleSelect = async (planet) => {
  selectedPlanetId.value = planet.id
  if (effectivePlanetState(planet) !== 'own') return
  // setActivePlanet bails out when the planet's state was never loaded (a colony
  // we have not visited this session) — pull it in first, like goToPlanet does.
  if (!allPlanetStates.value[planet.id]) await refreshPlanetState(planet.id)
  setActivePlanet(planet.id)
  closeBuildRow()
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

const tileClass = (planet) => [
  `hs-solar-tile--${effectivePlanetState(planet)}`,
  isHomePlanet(planet) ? 'hs-solar-tile--home' : '',
  selectedPlanetId.value === planet.id ? 'hs-solar-tile--selected' : '',
  planet.id === activePlanetId.value ? 'hs-solar-tile--active' : '',
]

// ── Meters on the tile ────────────────────────────────────
// Battery and shield of a planet, null when it has no power plant / no shield
// generator, and likewise while its state was never loaded. Both are drawn as a
// hairline on the top edge plus the number, so the map answers "which colony is
// running and which one is protected" without opening each one.
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

// A planet whose state is loaded shows both chips, even when the building is
// missing — a greyed-out 🛡️ says "no shield here", which is exactly the thing
// worth seeing on the map. Only an unloaded planet shows nothing at all, so a
// failed fetch never fakes a "not built".
const hasPlanetState = (planetId) => !!allPlanetStates.value[planetId]

const meterChips = (planetId) => {
  const bat = batteryPct(planetId)
  const shd = shieldPct(planetId)
  return [
    bat === null
      ? { key: 'battery', icon: '🔋', text: '–', cls: 'hs-solar-tile-meter--off' }
      : {
          key:  'battery',
          icon: gridDownOn(planetId) ? '⚠️' : '🔋',
          text: `${bat}%`,
          cls:  `hs-solar-tile-meter--battery-${batteryLevel(planetId)}`,
        },
    shd === null
      ? { key: 'shield', icon: '🛡️', text: '–', cls: 'hs-solar-tile-meter--off' }
      : { key: 'shield', icon: '🛡️', text: `${shd}%`, cls: `hs-solar-tile-meter--shield-${meterLevel(shd)}` },
  ]
}

// Every own planet draws its meters, so the map needs all their states on open —
// not just the one that happens to be selected. `loadOwnPlanetStates` lives in
// the composable now because the empire board needs exactly the same set; the
// game load already fires it once, this covers a colony founded since.
//
// The galaxy usually arrives after mount, so the watch is what actually fires on
// a cold open; onMounted covers a re-entry where it is already there.
onMounted(loadOwnPlanetStates)
watch(ownPlanetIds, loadOwnPlanetStates)


const hasCommandCenter = (planetId) =>
  (allPlanetStates.value[planetId]?.buildings?.command_center?.level ?? 0) >= 1

const planetTypeIcon = (type) => PLANET_TYPES[type]?.icon ?? '🪐'
const starClassLabel = (cls) => t(`hawkStar.starClass.${cls}`, cls)

const STATE_COLOR = {
  own: '#60a5fa', uncolonized: '#6b7280', enemy: '#f87171', ally: '#34d399', uninhabitable: '#4b4b4b',
}
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

</script>

<template>
  <div class="hs-solar">
    <div class="hs-solar-orbit">

      <!-- Sun tile -->
      <div class="hs-solar-tile hs-solar-tile--sun">
        <span class="hs-solar-tile-icon">☀️</span>
        <span class="hs-solar-tile-name">{{ homeSystem?.name }}</span>
        <span class="hs-solar-tile-sub">{{ starClassLabel(homeSystem?.starClass) }}</span>
      </div>

      <!-- Orbit connector (desktop only) -->
      <div class="hs-solar-connector" aria-hidden="true" />

      <!-- Planet tiles -->
      <div
        v-for="planet in planets"
        :key="planet.id"
        class="hs-solar-tile"
        :class="tileClass(planet)"
        @click="toggleSelect(planet)"
      >
        <!-- Drone flight progress bar -->
        <div
          v-if="isDroneEnRoute(planet.id)"
          class="hs-solar-progress-bar hs-solar-progress-bar--drone"
          :style="droneProgressStyle(planet.id)"
        />

        <!-- Colony ship flight progress bar -->
        <div
          v-else-if="isColonizing(planet.id)"
          class="hs-solar-progress-bar hs-solar-progress-bar--colony"
          :style="colonyProgressStyle(planet.id)"
        />

        <!-- Battery + shield (own planets) — stacked on the top edge, so they
             stay readable on the narrow mobile tiles where labels are hidden -->
        <div class="hs-solar-meter-bars">
          <div
            v-if="batteryPct(planet.id) !== null"
            class="hs-solar-meter-bar"
            :class="`hs-solar-meter-bar--battery-${batteryLevel(planet.id)}`"
          >
            <div class="hs-solar-meter-bar__fill" :style="{ width: batteryPct(planet.id) + '%' }" />
          </div>
          <div
            v-if="shieldPct(planet.id) !== null"
            class="hs-solar-meter-bar"
            :class="`hs-solar-meter-bar--shield-${meterLevel(shieldPct(planet.id))}`"
          >
            <div class="hs-solar-meter-bar__fill" :style="{ width: shieldPct(planet.id) + '%' }" />
          </div>
        </div>

        <!-- Home base marker — visible even on the collapsed mobile tile -->
        <span v-if="isHomePlanet(planet)" class="hs-solar-home-badge">🏠</span>

        <!-- Icon -->
        <span class="hs-solar-tile-icon">{{ planetIcon(planet) }}</span>

        <!-- Name -->
        <span class="hs-solar-tile-name">
          {{ planet.name }}
          <span v-if="isHomePlanet(planet)" class="hs-solar-home-tag">{{ t('hawkStar.solar.home') }}</span>
        </span>

        <!-- Own / colonized -->
        <template v-if="effectivePlanetState(planet) === 'own'">
          <span class="hs-solar-tile-state" :style="{ color: STATE_COLOR.own }">
            {{ playerName }}
          </span>
          <span v-if="hasPlanetState(planet.id)" class="hs-solar-tile-meters">
            <span
              v-for="m in meterChips(planet.id)"
              :key="m.key"
              class="hs-solar-tile-meter"
              :class="m.cls"
            ><span class="hs-solar-tile-meter__icon">{{ m.icon }}</span> {{ m.text }}</span>
          </span>
        </template>

        <!-- Colony ship en route -->
        <template v-else-if="isColonizing(planet.id)">
          <span class="hs-solar-tile-scanning-label" style="color: rgba(96,165,250,0.8)">{{ t('hawkStar.solar.colonizing') }}</span>
          <span class="hs-solar-tile-timer">{{ formatTime(remainingColonySec(planet.id)) }}</span>
        </template>

        <!-- Scanned but not (yet) own -->
        <template v-else-if="isScanned(planet.id)">
          <span class="hs-solar-tile-state" :style="{ color: STATE_COLOR[planet.state] }">
            {{ stateLabel(planet.state) }}
          </span>
          <span v-if="planet.owner" class="hs-solar-tile-owner">{{ planet.owner }}</span>
        </template>

        <!-- Drone en route -->
        <template v-else-if="isDroneEnRoute(planet.id)">
          <span class="hs-solar-tile-scanning-label">{{ t('hawkStar.solar.droneEnRoute') }}</span>
          <span class="hs-solar-tile-timer">{{ formatTime(remainingDroneSec(planet.id)) }}</span>
        </template>

        <!-- Unknown -->
        <template v-else>
          <span class="hs-solar-tile-unknown-label">{{ t('hawkStar.solar.unknown') }}</span>
        </template>

      </div>
    </div>

    <!-- ── Planet info panel ──────────────────────────────────────────────── -->
    <div v-if="selectedPlanet" class="hs-solar-planet-panel">
      <div class="hs-solar-planet-panel__top">
        <span class="hs-solar-planet-panel__icon">{{ planetIcon(selectedPlanet) }}</span>
        <div class="hs-solar-planet-panel__body">
          <span class="hs-solar-planet-panel__name">{{ selectedPlanet.name }}</span>
          <div class="hs-solar-planet-panel__tags">
            <span
              v-if="isScanned(selectedPlanet.id) || effectivePlanetState(selectedPlanet) === 'own'"
              class="hs-solar-planet-panel__tag"
            >{{ PLANET_TYPES[selectedPlanet.type]?.icon }} {{ selectedPlanet.type }}</span>
            <span
              class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--state"
              :style="{ color: stateColor(effectivePlanetState(selectedPlanet)), borderColor: stateColor(effectivePlanetState(selectedPlanet)) + '33' }"
            >{{ stateLabel(effectivePlanetState(selectedPlanet)) }}</span>
            <span
              v-if="effectivePlanetState(selectedPlanet) === 'own'"
              class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--owner"
            >{{ playerName }}</span>
            <span
              v-else-if="selectedPlanet.owner"
              class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--owner"
            >{{ selectedPlanet.owner }}</span>
            <span
              v-if="selectedPlanet.slots !== null && (isScanned(selectedPlanet.id) || effectivePlanetState(selectedPlanet) === 'own')"
              class="hs-solar-planet-panel__tag"
            >{{ selectedPlanet.slots }} {{ t('hawkStar.solar.slots') }}</span>
            <span
              v-if="planetHasDock(selectedPlanet.id) && effectivePlanetState(selectedPlanet) === 'own'"
              class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--dock"
            >🛠 Dock</span>
            <span v-if="isDroneEnRoute(selectedPlanet.id)" class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--timer">
              ⏱ {{ formatTime(remainingDroneSec(selectedPlanet.id)) }}
            </span>
            <span v-else-if="isColonizing(selectedPlanet.id)" class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--timer">
              ⏱ {{ formatTime(remainingColonySec(selectedPlanet.id)) }}
            </span>
            <template v-if="effectivePlanetState(selectedPlanet) === 'own'">
              <span v-if="reconDroneLevel > 0" class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--unit">🛸 {{ reconDroneInventory }}</span>
              <span v-if="colonyShipLevel > 0" class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--unit">🚀 {{ colonyShipInventory }}</span>
            </template>
          </div>
        </div>
      </div>
      <div
        v-if="effectivePlanetState(selectedPlanet) === 'own'"
        class="hs-solar-settle-bar"
      >
        <span v-if="!hasCommandCenter(selectedPlanet.id)" class="hs-solar-settle-hint">
          {{ t('hawkStar.solar.settleHint') }}
        </span>
        <button class="hs-solar-settle-btn" @click.stop="goToPlanet(selectedPlanet.id)">
          🏛️ {{ t('hawkStar.solar.settleBtn') }}
        </button>
      </div>

      <div
        v-else-if="canSendColonyShip(selectedPlanet.id)"
        class="hs-solar-settle-bar hs-solar-settle-bar--colony"
      >
        <span class="hs-solar-settle-hint">{{ t('hawkStar.solar.colonizeHint') }}</span>
        <button
          class="hs-solar-settle-btn hs-solar-settle-btn--colony"
          @click.stop="sendColonyShip(selectedPlanet.id, activePlanetId)"
        >
          🚀 {{ t('hawkStar.solar.colonize') }}
        </button>
      </div>

      <!-- Valid target, but no finished colony ship parked in the dock -->
      <div
        v-else-if="isColonyTarget(selectedPlanet.id)"
        class="hs-solar-settle-bar hs-solar-settle-bar--colony"
      >
        <span class="hs-solar-settle-hint">{{ t('hawkStar.solar.colonizeNeedsShip') }}</span>
        <button class="hs-solar-settle-btn hs-solar-settle-btn--colony" disabled>
          🚀 {{ t('hawkStar.solar.colonize') }}
        </button>
      </div>

      <template v-if="effectivePlanetState(selectedPlanet) === 'own'">
        <button class="hs-solar-planet-panel__res-toggle" @click.stop="resOpen = !resOpen">
          <span>📦 Resources</span>
          <span class="hs-solar-planet-panel__res-chevron">{{ resOpen ? '▲' : '▼' }}</span>
        </button>
        <div :class="['hs-solar-planet-panel__res', { 'hs-solar-planet-panel__res--open': resOpen }]">
          <HsAllResourcePanel />
        </div>
      </template>
    </div>

    <!-- ── Drone row ─────────────────────────────────────────────────────────── -->
    <div v-if="reconDroneLevel > 0 && planetHasDock(activePlanetId)" class="hs-solar-drone-row">
      <div class="hs-solar-drone-label">
        <div class="hs-solar-unit-label__icon-wrap">
          <span class="hs-solar-unit-label__icon">🛸</span>
          <span v-if="reconDroneInventory > 0" class="hs-solar-unit-label__badge">{{ reconDroneInventory }}</span>
        </div>
        <span class="hs-solar-unit-label__name">{{ t('hawkStar.dock.reconDrone') }}</span>
      </div>
      <div class="hs-solar-connector hs-solar-connector--phantom" aria-hidden="true" />
      <div
        v-for="planet in planets"
        :key="planet.id"
        class="hs-solar-unit-cell hs-solar-drone-cell"
        :class="{
          'hs-solar-drone-cell--active': planet.id === activePlanetId,
          'hs-solar-unit-cell--selected': planet.id === selectedPlanetId,
        }"
      >
        <template v-if="planet.id === activePlanetId && planetHasDock(planet.id)">
          <button class="hs-solar-unit-build-trigger" @click.stop="toggleBuildRow('drone')">
            <span class="hs-solar-unit-build-trigger__name">{{ reconDroneBuild ? t('hawkStar.dock.statusBuilding') : t('hawkStar.dock.reconDrone') }}</span>
            <span class="hs-solar-unit-build-trigger__btn">{{ t('hawkStar.dock.btnBuild') }}</span>
          </button>
        </template>
        <template v-else-if="canSendDrone(planet.id)">
          <button class="hs-solar-action-btn hs-solar-action-btn--drone" @click.stop="sendReconDrone(planet.id, activePlanetId)">
            <span class="hs-solar-action-btn__mobile">Send</span>
            <span class="hs-solar-action-btn__full">🛸 {{ t('hawkStar.solar.sendDrone') }}</span>
          </button>
          <span class="hs-solar-unit-flight-time hs-solar-unit-flight-time--drone">{{ formatTime(droneFlightTimeBetween(activePlanetId, planet.id)) }}</span>
        </template>
        <template v-else-if="isDroneEnRoute(planet.id)">
          <div class="hs-solar-progress-bar hs-solar-progress-bar--drone" :style="droneProgressStyle(planet.id)" />
          <span class="hs-solar-tile-timer">{{ formatTime(remainingDroneSec(planet.id)) }}</span>
        </template>
        <template v-else-if="isDroneTarget(planet.id)">
          <span class="hs-solar-unit-missing">{{ t('hawkStar.solar.noDroneReady') }}</span>
        </template>
      </div>
    </div>

    <!-- Drone build expanded row -->
    <div v-if="reconDroneLevel > 0 && planetHasDock(activePlanetId) && expandedBuildRow === 'drone'" class="hs-solar-build-expanded-row">
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

    <!-- ── Colony Ship row ──────────────────────────────────────────────────── -->
    <div v-if="colonyShipLevel > 0 && planetHasDock(activePlanetId)" class="hs-solar-colony-row">
      <div class="hs-solar-colony-label">
        <div class="hs-solar-unit-label__icon-wrap">
          <span class="hs-solar-unit-label__icon">🚀</span>
          <span v-if="colonyShipInventory > 0" class="hs-solar-unit-label__badge hs-solar-unit-label__badge--colony">{{ colonyShipInventory }}</span>
        </div>
        <span class="hs-solar-unit-label__name">{{ t('hawkStar.dock.colonyShip') }}</span>
      </div>
      <div class="hs-solar-connector hs-solar-connector--phantom" aria-hidden="true" />
      <div
        v-for="planet in planets"
        :key="planet.id"
        class="hs-solar-unit-cell hs-solar-colony-cell"
        :class="{
          'hs-solar-colony-cell--active': planet.id === activePlanetId,
          'hs-solar-unit-cell--selected': planet.id === selectedPlanetId,
        }"
      >
        <template v-if="planet.id === activePlanetId && planetHasDock(planet.id)">
          <button class="hs-solar-unit-build-trigger" @click.stop="toggleBuildRow('colony')">
            <span class="hs-solar-unit-build-trigger__name">{{ colonyShipBuild ? t('hawkStar.dock.statusBuilding') : t('hawkStar.dock.colonyShip') }}</span>
            <span class="hs-solar-unit-build-trigger__btn">{{ t('hawkStar.dock.btnBuild') }}</span>
          </button>
        </template>
        <template v-else-if="isColonizing(planet.id)">
          <div class="hs-solar-progress-bar hs-solar-progress-bar--colony" :style="colonyProgressStyle(planet.id)" />
          <span class="hs-solar-tile-timer" style="color:rgba(96,165,250,0.9)">{{ formatTime(remainingColonySec(planet.id)) }}</span>
        </template>
        <template v-else-if="canSendColonyShip(planet.id)">
          <button class="hs-solar-action-btn hs-solar-action-btn--colony" @click.stop="sendColonyShip(planet.id, activePlanetId)">
            <span class="hs-solar-action-btn__mobile">Send</span>
            <span class="hs-solar-action-btn__full">🚀 {{ t('hawkStar.solar.colonize') }}</span>
          </button>
          <span class="hs-solar-unit-flight-time hs-solar-unit-flight-time--colony">{{ formatTime(colonyFlightTimeBetween(activePlanetId, planet.id)) }}</span>
        </template>
        <template v-else-if="isColonyTarget(planet.id)">
          <span class="hs-solar-unit-missing">{{ t('hawkStar.solar.noColonyShipReady') }}</span>
        </template>
      </div>
    </div>

    <!-- Colony build expanded row -->
    <div v-if="colonyShipLevel > 0 && planetHasDock(activePlanetId) && expandedBuildRow === 'colony'" class="hs-solar-build-expanded-row">
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

    <!-- ── Cargo Drone row ──────────────────────────────────────────────────── -->
    <div v-if="cargoDroneLevel > 0 && planetHasDock(activePlanetId)" class="hs-solar-cargo-row">
      <div class="hs-solar-cargo-label">
        <div class="hs-solar-unit-label__icon-wrap">
          <span class="hs-solar-unit-label__icon">📦</span>
          <span v-if="cargoDroneInventory > 0" class="hs-solar-unit-label__badge hs-solar-unit-label__badge--cargo">{{ cargoLoaded }}</span>
        </div>
        <span class="hs-solar-unit-label__name">{{ t('hawkStar.dock.cargoDrone') }}</span>
      </div>
      <div class="hs-solar-connector hs-solar-connector--phantom" aria-hidden="true" />
      <div
        v-for="planet in planets"
        :key="planet.id"
        class="hs-solar-unit-cell hs-solar-cargo-cell"
        :class="{
          'hs-solar-cargo-cell--active': planet.id === activePlanetId,
          'hs-solar-unit-cell--selected': planet.id === selectedPlanetId,
        }"
      >
        <!-- The drone lives on the active planet: build it, load it, or watch it come home -->
        <template v-if="planet.id === activePlanetId && planetHasDock(planet.id)">
          <template v-if="returningCargoMission">
            <div class="hs-solar-progress-bar hs-solar-progress-bar--cargo" :style="cargoReturnProgressStyle" />
            <span class="hs-solar-tile-timer hs-solar-tile-timer--cargo">{{ formatTime(remainingCargoReturnSec) }}</span>
          </template>
          <!-- Outbound: the drone is gone, so no build trigger — the target cell has the timer -->
          <span v-else-if="activeCargoMissions.length" class="hs-solar-unit-missing hs-solar-unit-missing--cargo">
            {{ t('hawkStar.solar.cargoEnRoute') }}
          </span>
          <button v-else class="hs-solar-unit-build-trigger" @click.stop="toggleBuildRow('cargo')">
            <span class="hs-solar-unit-build-trigger__name">
              {{ cargoDroneBuild ? t('hawkStar.dock.statusBuilding') : t('hawkStar.dock.cargoDrone') }}
            </span>
            <span v-if="cargoDroneReady" class="hs-solar-unit-build-trigger__btn hs-solar-unit-build-trigger__btn--cargo">
              {{ cargoLoaded }} / {{ cargoCapacity }}
            </span>
            <span v-else-if="!cargoDroneBuild" class="hs-solar-unit-build-trigger__btn">{{ t('hawkStar.dock.btnBuild') }}</span>
          </button>
        </template>
        <template v-else-if="isCargoEnRoute(planet.id)">
          <div class="hs-solar-progress-bar hs-solar-progress-bar--cargo" :style="cargoProgressStyle(planet.id)" />
          <span class="hs-solar-tile-timer hs-solar-tile-timer--cargo">{{ formatTime(remainingCargoSec(planet.id)) }}</span>
        </template>
        <template v-else-if="canSendCargo(planet.id)">
          <button class="hs-solar-action-btn hs-solar-action-btn--cargo" @click.stop="sendCargoDrone(planet.id, activePlanetId)">
            <span class="hs-solar-action-btn__mobile">Send</span>
            <span class="hs-solar-action-btn__full">📦 {{ t('hawkStar.solar.sendCargo') }}</span>
          </button>
          <span class="hs-solar-unit-flight-time hs-solar-unit-flight-time--cargo">{{ formatTime(cargoFlightTimeBetween(activePlanetId, planet.id)) }}</span>
        </template>
        <!-- Reachable destination — the drone just has nothing aboard yet -->
        <template v-else-if="isCargoTarget(planet.id)">
          <span class="hs-solar-unit-missing">
            {{ hasCargoDrone ? t('hawkStar.solar.cargoEmpty') : t('hawkStar.solar.noCargoDrone') }}
          </span>
        </template>
      </div>
    </div>

    <!-- Cargo build / loading accordion -->
    <div v-if="cargoDroneLevel > 0 && planetHasDock(activePlanetId) && expandedBuildRow === 'cargo'" class="hs-solar-build-expanded-row">
      <!-- No drone yet → ordinary unit build row -->
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
</template>

<style lang="scss" scoped>
.hs-solar {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

// ── Orbit row ────────────────────────────────────────────────────────────────
.hs-solar-orbit {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.25rem;

  @media (min-width: 640px) {
    gap: 0;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}

// ── Orbit connector line ─────────────────────────────────────────────────────
.hs-solar-connector {
  display: none;

  @media (min-width: 640px) {
    display: block;
    flex-shrink: 0;
    width: 1.25rem;
    align-self: center;
    height: 1px;
    background: linear-gradient(to right, rgba(253,230,138,0.4), rgba(255,255,255,0.1));
  }
}

// ── Tiles ────────────────────────────────────────────────────────────────────
.hs-solar-tile {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);
  flex-shrink: 0;
  width: 2.25rem;
  padding: 0.4rem 0.1rem;
  transition: width 0.25s ease, flex 0.25s ease;
  cursor: pointer;

  @media (min-width: 640px) {
    width: 5.5rem;
    padding: 0.625rem 0.375rem;
  }

  &--sun         { border-color: rgba(253,230,138,0.5);  background: rgba(253,230,138,0.06); }
  &--own         { border-color: rgba(96,165,250,0.6);   background: rgba(96,165,250,0.07);  cursor: pointer; }
  &--enemy       { border-color: rgba(248,113,113,0.6);  background: rgba(248,113,113,0.07); }
  &--ally        { border-color: rgba(52,211,153,0.6);   background: rgba(52,211,153,0.06);  cursor: pointer; }
  &--uncolonized  { border-color: rgba(255,255,255,0.18); }
  &--unknown      { border-color: rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); }
  &--scanning     { border-color: rgba(251,191,36,0.6);   background: rgba(251,191,36,0.05);  }
  &--colonizing   { border-color: rgba(96,165,250,0.55);  background: rgba(96,165,250,0.06);  }
  &--uninhabitable{ border-color: rgba(75,75,75,0.35);    background: rgba(30,30,30,0.12);    opacity: 0.6; }

  // The home base is an "own" planet like every colony, so blue alone cannot
  // tell them apart — it gets the brighter border, a lit background and the
  // 🏠 corner badge on top of that.
  &--home {
    border-color: rgba(147,197,253,0.95);
    background: linear-gradient(180deg, rgba(96,165,250,0.2), rgba(96,165,250,0.05));
    box-shadow: inset 0 0 14px rgba(96,165,250,0.18);
  }

  &--selected {
    outline: 2px solid var(--hs-active-border) !important;
	  box-shadow: 0 0 20px var(--hs-active-glow) !important;
    outline-offset: -1px;
  }

  &--active {
    border-color: rgba(52,211,153,0.7);
    box-shadow: 0 0 0 1px rgba(52,211,153,0.25);
  }
}

// ── Mobile: aktive Tile expandiert, alle anderen bleiben schmal ───────────────
@media (max-width: 639px) {
  .hs-solar-tile--selected {
    width: 5rem;
    padding: 0.5rem 0.25rem;
  }

  .hs-solar-tile:not(.hs-solar-tile--selected) {
    .hs-solar-tile-icon { font-size: 1rem; }

    .hs-solar-tile-name,
    .hs-solar-tile-sub,
    .hs-solar-tile-state,
    .hs-solar-tile-slots,
    .hs-solar-tile-owner,
    .hs-solar-tile-units,
    .hs-solar-tile-dock,
    .hs-solar-tile-scanning-label,
    .hs-solar-tile-timer,
    .hs-solar-tile-hint,
    .hs-solar-tile-flight-time,
    .hs-solar-tile-unknown-label,
    .hs-solar-home-tag,
    .hs-solar-tile-meters,
    .hs-solar-action-btn { display: none; }
  }
}

// ── Progress bars ────────────────────────────────────────────────────────────
.hs-solar-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: 100%;
  transform-origin: left;
  animation: hs-bar-fill linear forwards;

  &--drone   { background: rgba(251,191,36,0.5); }
  &--colony  { background: rgba(96,165,250,0.5); }
  &--cargo   { background: rgba(251,191,36,0.65); }
}

@keyframes hs-bar-fill {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

// ── Tile content ─────────────────────────────────────────────────────────────
.hs-solar-tile-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.hs-solar-tile-name {
  font-size: 0.58rem;
  font-weight: 600;
  color: rgba(255,255,255,0.8);
  text-align: center;
  line-height: 1.3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hs-solar-home-tag {
  font-size: 0.48rem;
  background: var(--hs-accent);
  color: #fff;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

// Corner badge — the only home marker that survives the collapsed mobile tile,
// where every text line is hidden.
.hs-solar-home-badge {
  position: absolute;
  top: 6px;   // clears the two meter hairlines stacked on the top edge
  left: 3px;
  font-size: 0.5rem;
  line-height: 1;
  pointer-events: none;
}

// ── Meters on the tile (battery + shield) ────────────────────────────────────
// Stacked on the top edge, mirroring the planet-grid tiles. The flight progress
// bars sit on the bottom edge, so the two never collide.
.hs-solar-meter-bars {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  pointer-events: none;
}
.hs-solar-meter-bar {
  height: 2px;
  background: rgba(255,255,255,0.08);
}
.hs-solar-meter-bar__fill {
  height: 100%;
  transition: width 0.4s ease, background 0.3s ease;
}

.hs-solar-meter-bar--battery-ok    .hs-solar-meter-bar__fill { background: #10b981; }
.hs-solar-meter-bar--battery-low   .hs-solar-meter-bar__fill { background: #f59e0b; }
.hs-solar-meter-bar--battery-empty .hs-solar-meter-bar__fill { background: #f59e0b; }
.hs-solar-meter-bar--shield-ok     .hs-solar-meter-bar__fill { background: #38bdf8; }
.hs-solar-meter-bar--shield-low    .hs-solar-meter-bar__fill { background: #f59e0b; }

// Blackout: the fill is 0 %, so the empty track itself carries the alarm — and
// this is the one meter that pulses, because the planet has stopped producing.
.hs-solar-meter-bar--battery-down {
  background: rgba(239,68,68,0.55);
  animation: hs-meter-pulse 1.5s ease-in-out infinite;
}
// An empty shield is not an emergency (it has no side effect), so it stays still.
.hs-solar-meter-bar--shield-empty { background: rgba(239,68,68,0.35); }

@keyframes hs-meter-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}

.hs-solar-tile-meters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
}
.hs-solar-tile-meter {
  font-size: 0.5rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  &--battery-ok    { color: rgba(167,243,208,0.8); }
  &--battery-low   { color: rgba(253,230,138,0.9); }
  &--battery-empty { color: rgba(253,230,138,0.9); }
  &--battery-down  { color: rgba(252,165,165,0.95); }
  &--shield-ok     { color: rgba(186,230,253,0.85); }
  &--shield-low    { color: rgba(253,230,138,0.9); }
  &--shield-empty  { color: rgba(252,165,165,0.9); }

  // Nothing built yet. An emoji ignores `color`, so the icon is greyed with a
  // filter — the chip stays in place and reads as "possible here, not there".
  &--off {
    color: rgba(255,255,255,0.25);

    .hs-solar-tile-meter__icon { filter: grayscale(1); opacity: 0.5; }
  }
}


.hs-solar-tile-sub {
  font-size: 0.52rem;
  color: rgba(253,230,138,0.5);
  text-align: center;
}

.hs-solar-tile-state {
  font-size: 0.52rem;
  font-weight: 600;
  text-align: center;
}

.hs-solar-tile-owner,
.hs-solar-tile-slots {
  font-size: 0.5rem;
  color: rgba(255,255,255,0.28);
  text-align: center;
}

.hs-solar-tile-dock {
  font-size: 0.65rem;
  line-height: 1;
  opacity: 0.7;
}

.hs-solar-tile-unknown-label {
  font-size: 0.52rem;
  color: rgba(255,255,255,0.2);
  font-style: italic;
}

.hs-solar-tile-scanning-label {
  font-size: 0.52rem;
  color: rgba(251,191,36,0.7);
}

.hs-solar-tile-timer {
  font-size: 0.52rem;
  color: rgba(251,191,36,0.9);
  font-variant-numeric: tabular-nums;
  font-weight: 600;

  &--cargo { font-size: 0.6rem; }
}

.hs-solar-tile-hint {
  font-size: 0.48rem;
  color: rgba(255,255,255,0.15);
  font-style: italic;
}

.hs-solar-tile-units {
  display: flex;
  gap: 0.35rem;
  margin-top: 2px;
  font-size: 0.5rem;
  color: rgba(255,255,255,0.55);
  font-weight: 600;
}

.hs-solar-tile-flight-time {
  font-size: 0.48rem;
  color: rgba(251,191,36,0.65);
  font-variant-numeric: tabular-nums;
}

// ── Action buttons on tiles ───────────────────────────────────────────────────
.hs-solar-action-btn {
  margin-top: 1px;
  padding: 2px 6px;
  border-radius: var(--hs-r-sm);
  font-size: 0.5rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;

  &--drone {
    border: 1px solid rgba(251,191,36,0.35);
    background: rgba(251,191,36,0.08);
    color: rgba(251,191,36,0.85);
    &:hover { background: rgba(251,191,36,0.18); border-color: rgba(251,191,36,0.6); }
  }

  &--colony {
    border: 1px solid rgba(96,165,250,0.35);
    background: rgba(96,165,250,0.08);
    color: rgba(96,165,250,0.9);
    &:hover { background: rgba(96,165,250,0.18); border-color: rgba(96,165,250,0.6); }
  }

  &--cargo {
    border: 1px solid rgba(251,191,36,0.4);
    background: rgba(251,191,36,0.1);
    color: rgba(251,191,36,0.95);
    &:hover { background: rgba(251,191,36,0.2); border-color: rgba(251,191,36,0.65); }
  }
}

.hs-solar-action-btn__mobile { @media (min-width: 640px) { display: none; } }
.hs-solar-action-btn__full   { display: none; @media (min-width: 640px) { display: inline; } }

// ── Planet info panel ─────────────────────────────────────────────────────────
.hs-solar-planet-panel {
  display: flex;
  flex-direction: column;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);
  overflow: hidden;
}

.hs-solar-planet-panel__top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
}

.hs-solar-planet-panel__icon {
  font-size: 1.75rem;
  line-height: 1;
  flex-shrink: 0;
}

.hs-solar-planet-panel__body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
  flex: 1;
}

.hs-solar-planet-panel__name {
  font-size: 0.82rem;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-solar-planet-panel__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.hs-solar-planet-panel__tag {
  font-size: 0.56rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--hs-glass-lg);
  color: rgba(255,255,255,0.45);
  border: 1px solid rgba(255,255,255,0.07);
  white-space: nowrap;

  &--state { font-weight: 700; }
  &--owner { color: rgba(255,255,255,0.6); }
  &--dock  { color: rgba(255,255,255,0.5); }
  &--timer { color: rgba(251,191,36,0.85); border-color: rgba(251,191,36,0.15); }
  &--unit {
    color: rgba(255,255,255,0.7);
    border-color: rgba(255,255,255,0.12);
    font-variant-numeric: tabular-nums;
  }
}

.hs-solar-settle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-top: 1px solid rgba(96,165,250,0.15);
  background: rgba(96,165,250,0.04);

  &--colony {
    border-top-color: rgba(52,211,153,0.15);
    background: rgba(52,211,153,0.03);
  }
}

.hs-solar-settle-hint {
  font-size: 0.58rem;
  color: rgba(96,165,250,0.6);
  font-style: italic;

  .hs-solar-settle-bar--colony & { color: rgba(52,211,153,0.6); }
}

.hs-solar-settle-btn {
  flex-shrink: 0;
  padding: 0.3rem 0.7rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.65rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(96,165,250,0.4);
  background: rgba(96,165,250,0.1);
  color: rgba(96,165,250,0.95);
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;

  &:hover:not(:disabled) { background: rgba(96,165,250,0.2); border-color: rgba(96,165,250,0.65); }

  &--colony {
    border-color: rgba(52,211,153,0.4);
    background: rgba(52,211,153,0.08);
    color: rgba(52,211,153,0.95);
    &:hover:not(:disabled) { background: rgba(52,211,153,0.18); border-color: rgba(52,211,153,0.65); }
  }

  &--disabled, &:disabled { opacity: 0.35; cursor: not-allowed; }
}

.hs-solar-planet-panel__res-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.3rem 0.75rem;
  border: none;
  border-top: 1px solid var(--hs-line-lg);
  background: transparent;
  color: rgba(255,255,255,0.4);
  font-size: 0.6rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7); }
}

.hs-solar-planet-panel__res-chevron { font-size: 0.48rem; opacity: 0.7; }

.hs-solar-planet-panel__res {
  display: none;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--hs-line-lg);

  &--open { display: block; }
}

// ── Bottom row ────────────────────────────────────────────────────────────────
.hs-solar-bottom {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: flex-start;
  }
}

.hs-solar-res {
  flex: 1;
  min-width: 0;
}

// ── Dock / Hangar ─────────────────────────────────────────────────────────────
.hs-dock-panel {
  display: flex;
  flex-direction: column;
  background: var(--hs-glass-sm);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--hs-r-md);
  overflow: hidden;
  flex-shrink: 0;
}

.hs-dock-hangar {
  display: flex;
  flex-direction: row;
  gap: 0;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.hs-dock-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.5rem 0.7rem;
  flex-shrink: 0;
  border-right: 1px solid rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.5);

  &:last-child { border-right: none; }

  &--clickable {
    cursor: pointer;
    background: transparent;
    border-top: none;
    border-bottom: none;
    transition: background 0.15s, color 0.15s;
    &:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }
  }

  &--active {
    background: rgba(52,211,153,0.07);
    color: rgba(52,211,153,0.95);
    border-bottom: 2px solid rgba(52,211,153,0.4) !important;
  }
}

.hs-dock-slot__icon { font-size: 1.1rem; line-height: 1; }

.hs-dock-slot__count {
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.hs-dock-slot__name {
  font-size: 0.46rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}

.hs-dock-missions {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 0.3rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.hs-dock-mission-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 2px 0.25rem;
  border-radius: var(--hs-r-sm);

  &--drone   { color: rgba(251,191,36,0.85); }
  &--probe   { color: rgba(167,139,250,0.85); }
  &--colony  { color: rgba(96,165,250,0.85); }
}

.hs-dock-mission-icon { font-size: 0.75rem; line-height: 1; flex-shrink: 0; }

.hs-dock-mission-dest {
  flex: 1;
  font-size: 0.55rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-dock-mission-timer {
  font-size: 0.58rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.hs-dock-expand {
  border-top: 1px solid rgba(255,255,255,0.07);
  padding: 0.4rem 0.5rem;
}

.hs-dock-expand__empty {
  font-size: 0.58rem;
  opacity: 0.3;
  font-style: italic;
  text-align: center;
  padding: 0.2rem 0;
}

.hs-dock-dest-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.hs-dock-dest-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 3px 8px;
  border-radius: var(--hs-r-sm);
  font-size: 0.55rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.15s, border-color 0.15s;

  &--drone {
    border-color: rgba(251,191,36,0.3);
    background: rgba(251,191,36,0.06);
    color: rgba(251,191,36,0.85);
    &:hover { background: rgba(251,191,36,0.15); border-color: rgba(251,191,36,0.55); }
  }

  &--colony {
    border-color: rgba(96,165,250,0.3);
    background: rgba(96,165,250,0.06);
    color: rgba(96,165,250,0.9);
    &:hover { background: rgba(96,165,250,0.15); border-color: rgba(96,165,250,0.55); }
  }
}

.hs-dock-dest-btn__time {
  opacity: 0.6;
  font-size: 0.5rem;
  font-variant-numeric: tabular-nums;
}

.hs-dock-cargo {
  border-top: 1px solid rgba(255,255,255,0.07);
  padding: 0.5rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

// ── Dock build rows ────────────────────────────────────────────────────────────
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

.hs-dock-info    { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-dock-name    { font-size: 0.72rem; font-weight: 600; display: flex; align-items: baseline; gap: 0.3rem; flex-wrap: wrap; }
.hs-dock-count   { font-size: 0.62rem; opacity: 0.5; font-weight: 400; }
.hs-dock-cost-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }
.hs-dock-action  { flex-shrink: 0; }

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
.hs-status-ready    { font-size: 0.65rem; font-weight: 600; color: #34d399; white-space: nowrap; }

// ── Dock slot orbit badge ─────────────────────────────────────────────────────
.hs-dock-slot__orbit {
  font-size: 0.6rem;
  color: rgba(167,139,250,0.85);
  font-weight: 700;
}

// ── Orbit / Recall buttons ────────────────────────────────────────────────────
.hs-orbit-btn {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: var(--hs-r-sm);
  font-size: 0.55rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(167,139,250,0.35);
  background: rgba(167,139,250,0.08);
  color: rgba(167,139,250,0.9);
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;

  &:hover:not(:disabled) { background: rgba(167,139,250,0.18); border-color: rgba(167,139,250,0.6); }

  &--disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.hs-recall-btn {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: var(--hs-r-sm);
  font-size: 0.55rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(248,113,113,0.3);
  background: rgba(248,113,113,0.07);
  color: rgba(248,113,113,0.85);
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;

  &:hover { background: rgba(248,113,113,0.16); border-color: rgba(248,113,113,0.55); }
}

// ── Unit rows (drone / colony) ────────────────────────────────────────────────

.hs-solar-drone-row,
.hs-solar-colony-row,
.hs-solar-cargo-row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.25rem;

  @media (min-width: 640px) {
    gap: 0;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}

.hs-solar-connector--phantom {
  background: transparent !important;
}

// ── Unit label (leftmost cell, same width as sun tile) ────────────────────────

.hs-solar-drone-label,
.hs-solar-colony-label,
.hs-solar-cargo-label {
  flex-shrink: 0;
  width: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: var(--hs-glass-sm);
  border-radius: var(--hs-r-md);
  padding: 0.4rem 0.1rem;

  @media (min-width: 640px) { width: 5.5rem; padding: 0.4rem 0.25rem; }
}

.hs-solar-drone-label  { border: 1px solid rgba(251,191,36,0.15); }
.hs-solar-colony-label { border: 1px solid rgba(96,165,250,0.15); }
.hs-solar-cargo-label  { border: 1px solid rgba(251,191,36,0.22); }

// ── Shared label internals ────────────────────────────────────────────────────

.hs-solar-unit-label__icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
}

.hs-solar-unit-label__icon { font-size: 1rem; line-height: 1;
  @media (max-width: 639px) { font-size: 0.875rem; }
}

.hs-solar-unit-label__badge {
  position: absolute;
  bottom: -3px;
  right: -5px;
  font-size: 0.52rem;
  font-weight: 700;
  background: #f59e0b;
  color: #000;
  padding: 1px 3px;
  border-radius: 4px;
  line-height: 1.4;

  &--colony { background: #60a5fa; }
  &--cargo  { background: #fbbf24; }
}

.hs-solar-unit-label__name {
  font-size: 0.46rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.2;
  opacity: 0.55;

  @media (max-width: 639px) { display: none; }
}

// ── Shared planet cell ────────────────────────────────────────────────────────

.hs-solar-unit-cell {
  position: relative;
  flex-shrink: 0;
  width: 2.25rem;
  min-height: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0.2rem 0.05rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);
  overflow: hidden;

  @media (min-width: 640px) {
    width: 5.5rem;
    padding: 0.3rem 0.25rem;
  }

  // Mirrors the planet tile's selection highlight so the whole column — tile plus
  // its drone, colony and cargo cells — reads as one selected unit. Without this
  // the class is set but renders nothing outside the mobile width rule below.
  &--selected {
    outline: 2px solid var(--hs-active-border);
    outline-offset: -1px;
    box-shadow: 0 0 20px var(--hs-active-glow);
  }
}


@media (max-width: 639px) {
  .hs-solar-unit-cell--selected {
    width: 5rem;
  }
}

// ── Per-type active cell color ────────────────────────────────────────────────

.hs-solar-drone-cell--active  { border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.04); }
.hs-solar-colony-cell--active { border-color: rgba(96,165,250,0.4); background: rgba(96,165,250,0.04); }
.hs-solar-cargo-cell--active  { border-color: rgba(251,191,36,0.4); background: rgba(251,191,36,0.05); }

// ── Build accordion (shared) ─────────────────────────────────────────────────

.hs-solar-unit-build-trigger {
  width: 100%;
  height: 100%;
  min-height: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.35rem 0.25rem;
  color: inherit;
  border-radius: var(--hs-r-md);
  transition: background 0.15s;

  &:hover { background: rgba(255,255,255,0.05); }
}

.hs-solar-unit-build-trigger__name {
  font-size: 0.52rem;
  font-weight: 600;
  color: rgba(255,255,255,0.75);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.hs-solar-unit-build-trigger__btn {
  font-size: 0.52rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(52,211,153,0.35);
  background: rgba(52,211,153,0.08);
  color: rgba(52,211,153,0.9);
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.hs-solar-unit-build-trigger:hover .hs-solar-unit-build-trigger__btn {
  background: rgba(52,211,153,0.18);
  border-color: rgba(52,211,153,0.6);
}

// Loaded cargo drone: the trigger shows the hold instead of a build action
.hs-solar-unit-build-trigger__btn--cargo {
  border-color: rgba(251,191,36,0.4);
  background: rgba(251,191,36,0.1);
  color: rgba(251,191,36,0.95);
  font-variant-numeric: tabular-nums;

  .hs-solar-unit-build-trigger:hover & {
    background: rgba(251,191,36,0.2);
    border-color: rgba(251,191,36,0.65);
  }
}

.hs-solar-build-expanded-row {
  align-self: flex-start;
  background: var(--hs-glass-sm);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--hs-r-md);
  padding: 0.45rem 0.5rem;
}

// ── Flight time labels ────────────────────────────────────────────────────────

.hs-solar-unit-flight-time {
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;

  &--drone   { color: rgba(251,191,36,0.75); }
  &--colony  { color: rgba(96,165,250,0.75); }
  &--cargo   { color: rgba(251,191,36,0.85); }
}

// ── Cargo picker (hold loading) ───────────────────────────────────────────────

.hs-cargo-picker {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 15rem;
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

// Target would be reachable — the dock just has no finished unit for it
.hs-solar-unit-missing {
  font-size: 0.6rem;
  font-weight: 600;
  text-align: center;
  color: rgba(255,255,255,0.28);
  padding: 0 0.25rem;
}

// The drone is away, not missing — keep it in the cargo row's amber
.hs-solar-unit-missing--cargo { color: rgba(251, 191, 36, 0.65); }


</style>
