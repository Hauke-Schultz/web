<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PLANET_TYPES, RESOURCES, UNIT_COSTS } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsAllResourcePanel from '~/components/hawk-star/HsAllResourcePanel.vue'

const {
	playerName,
	reconDroneLevel, colonyShipLevel, galaxyProbeLevel,
  playerScannedPlanets, playerColonizedPlanets,
  reconDroneInventory, colonyShipInventory, galaxyProbeInventory,
  allActiveDroneMissions,
  canSendDrone, sendReconDrone,
  remainingDroneSec, droneProgressStyle,
  droneFlightTimeBetween,
  allActiveColonyMissions,
  canSendColonyShip, sendColonyShip,
  remainingColonySec, colonyProgressStyle,
  colonyFlightTimeBetween,
  homeSystem, homePlanetId,
  activePlanetId, setActivePlanet,
  formatTime,
  playerResources,
  // freighters
  freighter,
  allActiveFreighterMissions,
  freighterCargoCapacity,
  sendFreighter,
  freighterFlightTimeBetween,
  remainingFreighterSec,
  freighterProgressStyle,
  planetHasDock,
  // build
  reconDroneBuild, droneBuildTime, canBuildDrone, buildReconDrone, droneBuildProgressStyle,
  colonyShipBuild, colonyShipBuildTime, canBuildColonyShip, buildColonyShip, colonyShipBuildProgressStyle,
  freighterBayLevel, freighterBuild, freighterBuildTime, canBuildFreighter, buildFreighter, freighterBuildProgressStyle,
} = useHawkStar()

const { t } = useI18n()

const expandedBuildRow = ref(null)
const resOpen = ref(false)

const toggleBuildRow = (row) => {
  expandedBuildRow.value = expandedBuildRow.value === row ? null : row
}
const closeBuildRow = () => { expandedBuildRow.value = null }

const planets = computed(() => homeSystem.value?.planets ?? [])

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

const toggleSelect = (planet) => {
  selectedPlanetId.value = planet.id
  if (effectivePlanetState(planet) === 'own') {
    setActivePlanet(planet.id)
    closeBuildRow()
  }
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

const tileClass = (planet) => [
  `hs-solar-tile--${effectivePlanetState(planet)}`,
  selectedPlanetId.value === planet.id ? 'hs-solar-tile--selected' : '',
  planet.id === activePlanetId.value ? 'hs-solar-tile--active' : '',
]


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

// ── Freighter helpers ────────────────────────────────────────────────────────
const freighterCargo = ref({})

const isFreighterEnRoute = (planetId) =>
  allActiveFreighterMissions.value.some(m => m.toPlanetId === planetId || m.fromPlanetId === planetId)

const sendFreighterTo = (planetId) => {
  const cargo = Object.fromEntries(
    Object.entries(freighterCargo.value).filter(([, v]) => v > 0)
  )
  sendFreighter(activePlanetId.value, planetId, cargo)
  freighterCargo.value = {}
  expandedBuildRow.value = null
}

const cargoableResources = computed(() =>
  Object.entries(RESOURCES).filter(([resId, res]) =>
    resId !== 'population' && resId !== 'energy' &&
    ((playerResources.value[resId] ?? 0) > 0 || (freighterCargo.value[resId] ?? 0) > 0)
  )
)

const cargoTotalLoaded = computed(() =>
  Object.values(freighterCargo.value).reduce((sum, v) => sum + v, 0)
)

const adjustCargo = (resId, delta) => {
  const current = freighterCargo.value[resId] ?? 0
  const avail = playerResources.value[resId] ?? 0
  if (delta > 0) {
    if (cargoTotalLoaded.value >= freighterCargoCapacity.value || current >= avail) return
    freighterCargo.value = { ...freighterCargo.value, [resId]: current + 1 }
  } else {
    if (current <= 0) return
    freighterCargo.value = { ...freighterCargo.value, [resId]: current - 1 }
  }
}
</script>

<template>
  <div class="hs-solar">
    <div v-if="expandedBuildRow" class="hs-solar-expand-backdrop" @click="closeBuildRow()" />
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

        <!-- Freighter en-route indicator -->
        <div
          v-else-if="isFreighterEnRoute(planet.id)"
          class="hs-solar-progress-bar hs-solar-progress-bar--freighter"
        />

        <!-- Icon -->
        <span class="hs-solar-tile-icon">{{ planetIcon(planet) }}</span>

        <!-- Name -->
        <span class="hs-solar-tile-name">
          {{ planet.name }}
        </span>

        <!-- Own / colonized -->
        <template v-if="effectivePlanetState(planet) === 'own'">
          <span class="hs-solar-tile-state" :style="{ color: STATE_COLOR.own }">
            {{ playerName }}
          </span>
          <!-- Incoming freighter missions -->
          <div
            v-for="fm in allActiveFreighterMissions.filter(m => m.toPlanetId === planet.id)"
            :key="fm.id"
            class="hs-solar-tile-freighter-mission"
          >
            <div class="hs-solar-tile-freighter-bar">
              <div class="hs-solar-tile-freighter-bar-fill" :style="freighterProgressStyle(fm.id)" />
            </div>
            <span class="hs-solar-tile-freighter-timer">🚢 {{ formatTime(remainingFreighterSec(fm.id)) }}</span>
          </div>
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
              <span v-if="galaxyProbeLevel > 0" class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--unit">🔭 {{ galaxyProbeInventory }}</span>
              <span v-if="colonyShipLevel > 0" class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--unit">🚀 {{ colonyShipInventory }}</span>
              <span v-if="freighterBayLevel > 0" class="hs-solar-planet-panel__tag hs-solar-planet-panel__tag--unit">🚢 {{ freighter ? 1 : 0 }}</span>
            </template>
          </div>
        </div>
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
    <div v-if="reconDroneLevel > 0 && planetHasDock(activePlanetId)" class="hs-solar-drone-row" :class="{ 'hs-solar-row--expanded': expandedBuildRow === 'drone' }">
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
          'hs-solar-unit-cell--build': planet.id === activePlanetId && planetHasDock(planet.id),
        }"
      >
        <template v-if="planet.id === activePlanetId && planetHasDock(planet.id)">
          <button class="hs-solar-unit-build-trigger" @click.stop="toggleBuildRow('drone')">
            <span class="hs-solar-unit-build-trigger__name">{{ reconDroneBuild ? t('hawkStar.dock.statusBuilding') : t('hawkStar.dock.reconDrone') }}</span>
            <span class="hs-solar-unit-build-trigger__btn">{{ t('hawkStar.dock.btnBuild') }}</span>
          </button>
          <div v-if="expandedBuildRow === 'drone'" class="hs-solar-unit-build-expanded" @click.stop>
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
      </div>
    </div>

    <!-- ── Colony Ship row ──────────────────────────────────────────────────── -->
    <div v-if="colonyShipLevel > 0 && planetHasDock(activePlanetId)" class="hs-solar-colony-row" :class="{ 'hs-solar-row--expanded': expandedBuildRow === 'colony' }">
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
          'hs-solar-unit-cell--build': planet.id === activePlanetId && planetHasDock(planet.id),
        }"
      >
        <template v-if="planet.id === activePlanetId && planetHasDock(planet.id)">
          <button class="hs-solar-unit-build-trigger" @click.stop="toggleBuildRow('colony')">
            <span class="hs-solar-unit-build-trigger__name">{{ colonyShipBuild ? t('hawkStar.dock.statusBuilding') : t('hawkStar.dock.colonyShip') }}</span>
            <span class="hs-solar-unit-build-trigger__btn">{{ t('hawkStar.dock.btnBuild') }}</span>
          </button>
          <div v-if="expandedBuildRow === 'colony'" class="hs-solar-unit-build-expanded" @click.stop>
            <div class="hs-dock-row">
              <div class="hs-dock-icon-wrap">
                <span class="hs-dock-icon">🚀</span>
                <span v-if="colonyShipInventory > 0" class="hs-dock-badge hs-dock-badge--colony">{{ colonyShipInventory }}</span>
              </div>
              <div class="hs-dock-info">
                <div class="hs-dock-name">{{ t('hawkStar.dock.colonyShip') }}</div>
                <div class="hs-dock-cost-row">
                  <span v-for="(amt, resId) in UNIT_COSTS.colony_ship.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
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
      </div>
    </div>

    <!-- ── Freighter row ────────────────────────────────────────────────────── -->
    <div v-if="freighterBayLevel > 0 && planetHasDock(activePlanetId)" class="hs-solar-freighter-row" :class="{ 'hs-solar-row--expanded': expandedBuildRow === 'freighter' || expandedBuildRow === 'freighter-cargo' }">
      <div class="hs-solar-freighter-label">
        <div class="hs-solar-unit-label__icon-wrap">
          <span class="hs-solar-unit-label__icon">🚢</span>
          <span v-if="freighter" class="hs-solar-unit-label__badge hs-solar-unit-label__badge--freighter">1</span>
        </div>
        <span class="hs-solar-unit-label__name">{{ t('hawkStar.dock.freighter') }}</span>
      </div>
      <div class="hs-solar-connector hs-solar-connector--phantom" aria-hidden="true" />
      <div
        v-for="planet in planets"
        :key="planet.id"
        class="hs-solar-unit-cell hs-solar-freighter-cell"
        :class="{
          'hs-solar-freighter-cell--active': planet.id === activePlanetId,
          'hs-solar-unit-cell--selected': planet.id === selectedPlanetId,
          'hs-solar-unit-cell--build': planet.id === activePlanetId && planetHasDock(planet.id),
        }"
      >
        <template v-if="planet.id === activePlanetId && planetHasDock(planet.id)">
          <template v-if="!freighter">
            <button class="hs-solar-unit-build-trigger" @click.stop="toggleBuildRow('freighter')">
              <span class="hs-solar-unit-build-trigger__name">{{ freighterBuild ? t('hawkStar.dock.statusBuilding') : t('hawkStar.dock.freighter') }}</span>
              <span class="hs-solar-unit-build-trigger__btn">{{ t('hawkStar.dock.btnBuild') }}</span>
            </button>
            <div v-if="expandedBuildRow === 'freighter'" class="hs-solar-unit-build-expanded" @click.stop>
              <div class="hs-dock-row hs-dock-row--freighter">
                <div class="hs-dock-icon-wrap">
                  <span class="hs-dock-icon">🚢</span>
                </div>
                <div class="hs-dock-info">
                  <div class="hs-dock-name">{{ t('hawkStar.dock.freighter') }}</div>
                  <div class="hs-dock-cost-row">
                    <span v-for="(amt, resId) in UNIT_COSTS.freighter.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
                    <span class="hs-unit-time-tag">⏱ {{ formatTime(freighterBuildTime) }}</span>
                  </div>
                  <div v-if="freighterBuild" class="hs-progress-row">
                    <div class="hs-progress-track"><div :key="freighterBuild.endsAt" class="hs-progress-fill hs-progress-fill--freighter" :style="freighterBuildProgressStyle" /></div>
                    <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((freighterBuild.endsAt - Date.now()) / 1000))) }}</span>
                  </div>
                </div>
                <div class="hs-dock-action">
                  <span v-if="freighterBuild" class="hs-status-building">{{ t('hawkStar.dock.statusBuilding') }}</span>
                  <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildFreighter }" :disabled="!canBuildFreighter" @click.stop="buildFreighter()">{{ t('hawkStar.dock.btnBuild') }}</button>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <button class="hs-solar-unit-build-trigger" @click.stop="toggleBuildRow('freighter-cargo')">
              <span class="hs-solar-unit-build-trigger__name">
                {{ cargoTotalLoaded > 0 ? `${cargoTotalLoaded}/${freighterCargoCapacity}` : t('hawkStar.dock.freighter') }}
              </span>
              <span class="hs-solar-unit-build-trigger__btn">📦</span>
            </button>
            <div v-if="expandedBuildRow === 'freighter-cargo'" class="hs-solar-unit-build-expanded hs-freighter-cargo-panel" @click.stop>
              <div class="hs-freighter-cargo-header">
                <span class="hs-freighter-cargo-title">📦 Cargo</span>
                <span class="hs-freighter-cargo-cap" :class="{ 'hs-freighter-cargo-cap--over': cargoTotalLoaded > freighterCargoCapacity }">
                  {{ cargoTotalLoaded }} / {{ freighterCargoCapacity }}
                </span>
              </div>
              <div v-if="cargoableResources.length === 0" class="hs-freighter-cargo-empty">No resources available</div>
              <div v-else class="hs-freighter-cargo-grid">
                <div
                  v-for="[resId, res] in cargoableResources"
                  :key="resId"
                  class="hs-freighter-cargo-tile"
                  :class="{ 'hs-freighter-cargo-tile--loaded': (freighterCargo[resId] ?? 0) > 0 }"
                >
                  <span class="hs-freighter-cargo-tile__icon">{{ res.icon }}</span>
                  <div class="hs-freighter-cargo-tile__info">
                    <span class="hs-freighter-cargo-tile__name">{{ res.name }}</span>
                    <span class="hs-freighter-cargo-tile__avail">{{ playerResources[resId] ?? 0 }}</span>
                  </div>
                  <div class="hs-stepper hs-stepper--cargo">
                    <button
                      class="hs-stepper__btn"
                      :disabled="(freighterCargo[resId] ?? 0) <= 0"
                      @click.stop="adjustCargo(resId, -1)"
                    >−</button>
                    <span class="hs-stepper__val">{{ freighterCargo[resId] ?? 0 }}</span>
                    <button
                      class="hs-stepper__btn"
                      :disabled="cargoTotalLoaded >= freighterCargoCapacity || (freighterCargo[resId] ?? 0) >= (playerResources[resId] ?? 0)"
                      @click.stop="adjustCargo(resId, 1)"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </template>
        <template v-else-if="isFreighterEnRoute(planet.id)">
          <div
            v-for="fm in allActiveFreighterMissions.filter(m => m.toPlanetId === planet.id || (m.fromPlanetId === planet.id && m.phase === 'returning'))"
            :key="fm.id"
            class="hs-solar-freighter-mission-mini"
          >
            <div class="hs-solar-tile-freighter-bar">
              <div class="hs-solar-tile-freighter-bar-fill" :style="freighterProgressStyle(fm.id)" />
            </div>
            <span class="hs-solar-tile-freighter-timer">{{ formatTime(remainingFreighterSec(fm.id)) }}</span>
          </div>
        </template>
        <template v-else-if="freighter && effectivePlanetState(planet) === 'own' && planetHasDock(planet.id)">
          <button
            class="hs-freighter-send-btn hs-freighter-send-btn--tile"
            @click.stop="sendFreighterTo(planet.id)"
          >🚢 Send</button>
          <span class="hs-solar-unit-flight-time hs-solar-unit-flight-time--freighter">{{ formatTime(freighterFlightTimeBetween(activePlanetId, planet.id)) }}</span>
        </template>
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
    flex: 1;
    width: auto;
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
    .hs-solar-tile-freighter-mission,
    .hs-solar-tile-scanning-label,
    .hs-solar-tile-timer,
    .hs-solar-tile-hint,
    .hs-solar-tile-flight-time,
    .hs-solar-tile-unknown-label,
    .hs-solar-action-btn,
    .hs-freighter-dest-btn,
    .hs-freighter-send-btn { display: none; }
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

  &--drone     { background: rgba(251,191,36,0.5); }
  &--colony   { background: rgba(96,165,250,0.5); }
  &--freighter { background: rgba(52,211,153,0.4); }
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

.hs-solar-tile-freighter-mission {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.hs-solar-tile-freighter-bar {
  position: relative;
  width: 100%;
  height: 2px;
  background: rgba(255,255,255,0.08);
  border-radius: 1px;
  overflow: hidden;
}

.hs-solar-tile-freighter-bar-fill {
  position: absolute;
  inset: 0;
  background: rgba(52,211,153,0.5);
  transform-origin: left;
  animation: hs-bar-fill linear forwards;
}

.hs-solar-tile-freighter-timer {
  font-size: 0.48rem;
  color: rgba(52,211,153,0.85);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
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

  &--drone     { color: rgba(251,191,36,0.85); }
  &--probe     { color: rgba(167,139,250,0.85); }
  &--colony    { color: rgba(96,165,250,0.85); }
  &--freighter { color: rgba(52,211,153,0.85); }
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

// ── Freighter cargo ────────────────────────────────────────────────────────────

.hs-freighter-cargo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hs-freighter-cargo-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
}

.hs-freighter-cargo-cap {
  font-size: 0.65rem;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.35);

  &--over { color: var(--hs-danger); }
}

.hs-freighter-cargo-empty {
  font-size: 0.68rem;
  opacity: 0.3;
  font-style: italic;
  text-align: center;
  padding: 0.4rem 0;
}

.hs-freighter-cargo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.375rem;
}

.hs-freighter-cargo-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0.4rem 0.3rem 0.35rem;
  background: var(--hs-glass-lg);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-sm);
  transition: border-color 0.15s, background 0.15s;

  &--loaded {
    border-color: rgba(52,211,153,0.4);
    background: rgba(52,211,153,0.07);
  }
}

.hs-freighter-cargo-tile__icon { font-size: 1.05rem; line-height: 1; }

.hs-freighter-cargo-tile__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.hs-freighter-cargo-tile__name {
  font-size: 0.52rem;
  opacity: 0.45;
  text-transform: capitalize;
  line-height: 1;
  text-align: center;
}

.hs-freighter-cargo-tile__avail {
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

// ── Stepper control ───────────────────────────────────────────────────────────
.hs-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--hs-line-sm);
  border-radius: 6px;
  overflow: hidden;

  &--cargo {
    width: 100%;
    margin-top: 2px;
    border-color: rgba(52,211,153,0.25);
  }
}

.hs-stepper__btn {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hs-glass-lg);
  border: none;
  color: rgba(255,255,255,0.7);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  user-select: none;

  &:hover:not(:disabled) { background: var(--hs-glass-xl); color: #fff; }
  &:disabled { opacity: 0.25; cursor: not-allowed; }
}

.hs-stepper__val {
  flex: 1;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--hs-glass-sm);
  padding: 0 2px;
  line-height: 1.5rem;
  min-width: 1.5rem;
}

// ── Freighter dest row + send ─────────────────────────────────────────────────
.hs-freighter-dest-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.hs-freighter-dest-btn {
  padding: 2px 8px;
  border-radius: var(--hs-r-sm);
  font-size: 0.52rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.55);
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.25); }

  &--active {
    border-color: rgba(52,211,153,0.5);
    background: rgba(52,211,153,0.1);
    color: rgba(52,211,153,0.95);
  }
}

.hs-freighter-send-btn {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: var(--hs-r-sm);
  font-size: 0.52rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(52,211,153,0.4);
  background: rgba(52,211,153,0.1);
  color: rgba(52,211,153,0.95);
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(52,211,153,0.2); border-color: rgba(52,211,153,0.7); }

  &--tile {
    align-self: center;
    padding: 2px 6px;
    font-size: 0.48rem;
    white-space: nowrap;
  }
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

  &--freighter { border-color: rgba(52,211,153,0.2); background: rgba(52,211,153,0.03); }
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

  &--colony    { background: #60a5fa; color: #000; }
  &--freighter { background: #34d399; color: #000; }
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

  &--unit      { background: #f59e0b; }
  &--colony    { background: #60a5fa; }
  &--freighter { background: #34d399; }
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

// ── Unit rows (drone / colony / freighter) ───────────────────────────────────

.hs-solar-drone-row,
.hs-solar-colony-row,
.hs-solar-freighter-row {
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
.hs-solar-freighter-label {
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

.hs-solar-drone-label     { border: 1px solid rgba(251,191,36,0.15); }
.hs-solar-colony-label    { border: 1px solid rgba(96,165,250,0.15); }
.hs-solar-freighter-label { border: 1px solid rgba(52,211,153,0.15); }

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

  &--colony    { background: #60a5fa; }
  &--freighter { background: #34d399; }
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

  &--build {
    padding: 0;
    overflow: visible;
  }
}

@media (max-width: 639px) {
  .hs-solar-unit-cell--selected {
    flex: 1;
    width: auto;
  }
}

.hs-solar-row--expanded {
  @media (min-width: 640px) { overflow: visible; }
}

// ── Per-type active cell color ────────────────────────────────────────────────

.hs-solar-drone-cell--active     { border-color: rgba(52,211,153,0.4);   background: rgba(52,211,153,0.04); }
.hs-solar-colony-cell--active    { border-color: rgba(96,165,250,0.4);   background: rgba(96,165,250,0.04); }
.hs-solar-freighter-cell--active { border-color: rgba(52,211,153,0.4);   background: rgba(52,211,153,0.04); }

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

.hs-solar-unit-build-expanded {
  position: absolute;
  z-index: 20;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 18.5rem;
  background: #13141f;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: var(--hs-r-md);
  padding: 0.45rem 0.5rem;
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);

  @media (max-width: 639px) {
    width: min(90vw, 20rem);
    left: 0;
    transform: none;
  }
}

// ── Flight time labels ────────────────────────────────────────────────────────

.hs-solar-unit-flight-time {
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;

  &--drone     { color: rgba(251,191,36,0.75); }
  &--colony    { color: rgba(96,165,250,0.75); }
  &--freighter { color: rgba(52,211,153,0.75); }
}

// ── Freighter mission mini (en-route display in row) ──────────────────────────

.hs-solar-freighter-mission-mini {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.hs-solar-expand-backdrop {
  position: fixed;
  inset: 0;
  z-index: 19;
}

</style>
