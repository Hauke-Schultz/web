<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PLANET_TYPES, RESOURCES, UNIT_COSTS } from '~/utils/hawkStarConfig.js'
import { GALAXY_SYSTEMS } from '~/utils/hawkStarGalaxyMock.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsAllResourcePanel from '~/components/hawk-star/HsAllResourcePanel.vue'

const {
	playerName,
	reconDroneLevel, colonyShipLevel,
  playerScannedPlanets, playerColonizedPlanets,
  reconDroneInventory, colonyShipInventory,
  activeDroneMissions, allActiveDroneMissions,
  canSendDrone, sendReconDrone,
  remainingDroneSec, droneProgressStyle,
  droneFlightTimeBetween,
  activeColonyMissions, allActiveColonyMissions,
  canSendColonyShip, sendColonyShip,
  remainingColonySec, colonyProgressStyle,
  colonyFlightTimeBetween,
  homeSystem, homePlanetId,
  activePlanetId, setActivePlanet,
  formatTime,
  playerResources,
  // warships
  warshipBayLevel,
  warshipInventory,
  warships,
  fleetInOrbit,
  shipHasPowerCell,
  deployToOrbit,
  recallFromOrbit,
  // galaxy probes
  galaxyProbeLevel,
  galaxyProbeInventory,
  activeGalaxyProbes,
  remainingProbeSec,
  // freighters
  freighterInventory,
  activeFreighterMissions, allActiveFreighterMissions,
  freighterCargoCapacity,
  sendFreighter,
  freighterFlightTimeBetween,
  remainingFreighterSec,
  freighterProgressStyle,
  planetHasDock,
  // build
  reconDroneBuild, droneBuildTime, canBuildDrone, buildReconDrone, droneBuildProgressStyle,
  galaxyProbeBuild, probeBuildTime, canBuildProbe, buildGalaxyProbe, probeBuildProgressStyle,
  colonyShipBuild, colonyShipBuildTime, canBuildColonyShip, buildColonyShip, colonyShipBuildProgressStyle,
  warshipBuild, warshipBuildTime, canBuildWarship, buildWarship, warshipBuildProgressStyle,
  freighterBayLevel, freighterBuild, freighterBuildTime, canBuildFreighter, buildFreighter, freighterBuildProgressStyle,
} = useHawkStar()

const { t } = useI18n()

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
const selectedPlanetId = ref(null)

const toggleSelect = (planet) => {
  if (effectivePlanetState(planet) !== 'own') return
  selectedPlanetId.value = selectedPlanetId.value === planet.id ? null : planet.id
  setActivePlanet(planet.id)
}

const selectedIsOwn = computed(() => selectedPlanetId.value !== null)

const tileClass = (planet) => [
  `hs-solar-tile--${effectivePlanetState(planet)}`,
  selectedPlanetId.value === planet.id ? 'hs-solar-tile--selected' : '',
]

const flightTime = (targetPlanetId) =>
  selectedPlanetId.value
    ? droneFlightTimeBetween(selectedPlanetId.value, targetPlanetId)
    : 0

const colonyTime = (targetPlanetId) =>
  selectedPlanetId.value
    ? colonyFlightTimeBetween(selectedPlanetId.value, targetPlanetId)
    : 0

const planetTypeIcon = (type) => PLANET_TYPES[type]?.icon ?? '🪐'
const starClassLabel = (cls) => t(`hawkStar.starClass.${cls}`, cls)

const STATE_COLOR = {
  own: '#60a5fa', uncolonized: '#6b7280', enemy: '#f87171', ally: '#34d399',
}
const stateLabel = (state) => ({
  own:         t('hawkStar.solar.stateOwn'),
  uncolonized: t('hawkStar.solar.stateFree'),
  enemy:       t('hawkStar.solar.stateEnemy'),
  ally:        t('hawkStar.solar.stateAllied'),
})[state] ?? state

const planetIcon = (planet) => {
  const state = effectivePlanetState(planet)
  if (state === 'colonizing') return '🚀'
  if (state === 'scanning')   return '🛸'
  if (state === 'unknown')    return '❓'
  return planetTypeIcon(planet.type)
}

// ── Galaxy system name lookup ─────────────────────────────────────────────────
const galaxySystemName = (systemId) =>
  GALAXY_SYSTEMS.find(s => s.id === systemId)?.name ?? systemId

// ── Freighter helpers ────────────────────────────────────────────────────────
const CARGO_EXCLUDED = ['population', 'energy']

const freighterCargo = ref({})

const loadableResources = computed(() =>
  Object.values(RESOURCES).filter(r =>
    !CARGO_EXCLUDED.includes(r.id) && (playerResources.value[r.id] ?? 0) > 0
  )
)

const freighterCargoTotal = computed(() =>
  Object.values(freighterCargo.value).reduce((s, v) => s + (Number(v) || 0), 0)
)

const cargoMax  = (resId) => Math.min(Math.floor(playerResources.value[resId] ?? 0), freighterCargoCapacity.value)
const cargoStep = (resId) => cargoMax(resId) >= 20 ? 10 : 1
const stepCargo = (resId, delta) => {
  const cur       = freighterCargo.value[resId] ?? 0
  const remaining = freighterCargoCapacity.value - freighterCargoTotal.value
  const step      = delta > 0 ? Math.min(cargoStep(resId), remaining) : cargoStep(resId)
  freighterCargo.value[resId] = Math.min(Math.max(0, cur + delta * step), cargoMax(resId))
}

const isFreighterEnRoute = (planetId) =>
  allActiveFreighterMissions.value.some(m => m.toPlanetId === planetId || m.fromPlanetId === planetId)

const ownedPlanets = computed(() =>
  (homeSystem.value?.planets ?? []).filter(p =>
    p.id === homePlanetId.value || playerColonizedPlanets.value.includes(p.id)
  )
)

const freighterDest = ref(null)

// ── Dock panel ───────────────────────────────────────────────────────────────
const dockTab = ref(null)

const droneDests = computed(() =>
  planets.value.filter(p => canSendDrone(p.id))
)
const colonyDests = computed(() =>
  planets.value.filter(p => canSendColonyShip(p.id))
)

const doSendFreighter = () => {
  if (!freighterDest.value) return
  const cargo = Object.fromEntries(
    Object.entries(freighterCargo.value).filter(([, v]) => v > 0)
  )
  sendFreighter(activePlanetId.value, freighterDest.value, cargo)
  freighterDest.value  = null
  freighterCargo.value = {}
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
	        <span v-if="planet.id === activePlanetId" class="hs-solar-active-tag">{{ t('hawkStar.solar.active') }}</span>
          <span v-if="planet.slots !== null" class="hs-solar-tile-slots">{{ planet.slots }} {{ t('hawkStar.solar.slots') }}</span>
          <!-- Unit counts when selected -->
          <div v-if="selectedPlanetId === planet.id" class="hs-solar-tile-units">
            <span v-if="reconDroneLevel > 0">🛸 {{ reconDroneInventory }}</span>
            <span v-if="colonyShipLevel > 0">🚀 {{ colonyShipInventory }}</span>
          </div>
          <!-- Dock indicator -->
          <span v-if="planetHasDock(planet.id)" class="hs-solar-tile-dock">🛠</span>
          <!-- Incoming freighter missions -->
          <div
            v-for="m in allActiveFreighterMissions.filter(m => m.toPlanetId === planet.id)"
            :key="m.id"
            class="hs-solar-tile-freighter-mission"
          >
            <div class="hs-solar-tile-freighter-bar">
              <div class="hs-solar-tile-freighter-bar-fill" :style="freighterProgressStyle(m.id)" />
            </div>
            <span class="hs-solar-tile-freighter-timer">🚢 {{ formatTime(remainingFreighterSec(m.id)) }}</span>
          </div>
          <!-- Freighter destination + send buttons -->
          <template v-if="freighterInventory > 0 && planet.id !== activePlanetId && planetHasDock(planet.id)">
            <button
              class="hs-freighter-dest-btn"
              :class="{ 'hs-freighter-dest-btn--active': freighterDest === planet.id }"
              @click.stop="freighterDest = freighterDest === planet.id ? null : planet.id"
            >{{ freighterDest === planet.id ? t('hawkStar.solar.destConfirmed') : t('hawkStar.solar.dest') }}</button>
            <button
              v-if="freighterDest === planet.id"
              class="hs-freighter-send-btn hs-freighter-send-btn--tile"
              @click.stop="doSendFreighter"
            >🚀 {{ formatTime(freighterFlightTimeBetween(activePlanetId, planet.id)) }}</button>
          </template>
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
          <!-- Colonize button: only visible when a base is selected -->
          <template v-if="selectedIsOwn && canSendColonyShip(planet.id)">
            <button
              class="hs-solar-action-btn hs-solar-action-btn--colony"
              @click.stop="sendColonyShip(planet.id, selectedPlanetId)"
            >🚀 {{ t('hawkStar.solar.colonize') }}</button>
            <span class="hs-solar-tile-flight-time">{{ formatTime(colonyTime(planet.id)) }}</span>
          </template>
          <span
            v-else-if="selectedIsOwn && planet.state === 'uncolonized' && colonyShipLevel > 0 && colonyShipInventory === 0"
            class="hs-solar-tile-hint"
          >{{ t('hawkStar.solar.buildColonyShip') }}</span>
        </template>

        <!-- Drone en route -->
        <template v-else-if="isDroneEnRoute(planet.id)">
          <span class="hs-solar-tile-scanning-label">{{ t('hawkStar.solar.droneEnRoute') }}</span>
          <span class="hs-solar-tile-timer">{{ formatTime(remainingDroneSec(planet.id)) }}</span>
        </template>

        <!-- Unknown: send drone button only visible when a base is selected -->
        <template v-else>
          <span class="hs-solar-tile-unknown-label">{{ t('hawkStar.solar.unknown') }}</span>
          <template v-if="selectedIsOwn && canSendDrone(planet.id)">
            <button
              class="hs-solar-action-btn hs-solar-action-btn--drone"
              @click.stop="sendReconDrone(planet.id, selectedPlanetId)"
            >🛸 {{ t('hawkStar.solar.sendDrone') }}</button>
            <span class="hs-solar-tile-flight-time">{{ formatTime(flightTime(planet.id)) }}</span>
          </template>
        </template>

      </div>
    </div>

    <!-- ── Bottom row: Dock + Resources ────────────────────────────────── -->
    <div class="hs-solar-bottom">

	    <!-- Resource panel -->
	    <HsAllResourcePanel class="hs-solar-res" />

    <!-- Dock / Hangar -->
    <div
      v-if="reconDroneLevel > 0 || galaxyProbeLevel > 0 || colonyShipLevel > 0 || warshipBayLevel > 0 || freighterBayLevel > 0"
      class="hs-dock-panel"
    >

      <!-- Hangar row: all ships visible at once -->
      <div class="hs-dock-hangar">
        <button
          v-if="reconDroneLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'drone' }"
          @click="dockTab = dockTab === 'drone' ? null : 'drone'"
        >
          <span class="hs-dock-slot__icon">🛸</span>
          <span class="hs-dock-slot__count">{{ reconDroneInventory }}</span>
          <span class="hs-dock-slot__name">{{ t('hawkStar.dock.reconDrone') }}</span>
        </button>
        <button
          v-if="galaxyProbeLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'probe' }"
          @click="dockTab = dockTab === 'probe' ? null : 'probe'"
        >
          <span class="hs-dock-slot__icon">🔭</span>
          <span class="hs-dock-slot__count">{{ galaxyProbeInventory }}</span>
          <span class="hs-dock-slot__name">{{ t('hawkStar.dock.galaxyProbe') }}</span>
        </button>
        <button
          v-if="colonyShipLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'colony' }"
          @click="dockTab = dockTab === 'colony' ? null : 'colony'"
        >
          <span class="hs-dock-slot__icon">🚀</span>
          <span class="hs-dock-slot__count">{{ colonyShipInventory }}</span>
          <span class="hs-dock-slot__name">{{ t('hawkStar.dock.colonyShip') }}</span>
        </button>
        <button
          v-if="freighterBayLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'freighter' }"
          @click="dockTab = dockTab === 'freighter' ? null : 'freighter'"
        >
          <span class="hs-dock-slot__icon">🚢</span>
          <span class="hs-dock-slot__count">{{ freighterInventory }}</span>
          <span class="hs-dock-slot__name">{{ t('hawkStar.dock.freighter') }}</span>
        </button>
        <button
          v-if="warshipBayLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'warship' }"
          @click="dockTab = dockTab === 'warship' ? null : 'warship'"
        >
          <span class="hs-dock-slot__icon">⚔️</span>
          <span class="hs-dock-slot__count">{{ warshipInventory }}<span v-if="fleetInOrbit.length" class="hs-dock-slot__orbit"> +{{ fleetInOrbit.length }}🛰</span></span>
          <span class="hs-dock-slot__name">{{ t('hawkStar.dock.warship') }}</span>
        </button>
      </div>

      <!-- Active missions -->
      <div
        v-if="allActiveDroneMissions.length || activeGalaxyProbes.length || allActiveColonyMissions.length || allActiveFreighterMissions.length"
        class="hs-dock-missions"
      >
        <div v-for="m in allActiveDroneMissions" :key="m.planetId" class="hs-dock-mission-row hs-dock-mission-row--drone">
          <span class="hs-dock-mission-icon">🛸</span>
          <span class="hs-dock-mission-dest">→ {{ planets.find(p => p.id === m.planetId)?.name ?? m.planetId }}</span>
          <span class="hs-dock-mission-timer">{{ formatTime(remainingDroneSec(m.planetId)) }}</span>
        </div>
        <div v-for="p in activeGalaxyProbes" :key="p.systemId" class="hs-dock-mission-row hs-dock-mission-row--probe">
          <span class="hs-dock-mission-icon">🔭</span>
          <span class="hs-dock-mission-dest">→ {{ galaxySystemName(p.systemId) }}</span>
          <span class="hs-dock-mission-timer">{{ formatTime(remainingProbeSec(p.systemId)) }}</span>
        </div>
        <div v-for="m in allActiveColonyMissions" :key="m.planetId" class="hs-dock-mission-row hs-dock-mission-row--colony">
          <span class="hs-dock-mission-icon">🚀</span>
          <span class="hs-dock-mission-dest">→ {{ planets.find(p => p.id === m.planetId)?.name ?? m.planetId }}</span>
          <span class="hs-dock-mission-timer">{{ formatTime(remainingColonySec(m.planetId)) }}</span>
        </div>
        <div v-for="m in allActiveFreighterMissions" :key="m.id" class="hs-dock-mission-row hs-dock-mission-row--freighter">
          <span class="hs-dock-mission-icon">🚢</span>
          <span class="hs-dock-mission-dest">→ {{ planets.find(p => p.id === m.toPlanetId)?.name ?? m.toPlanetId }}</span>
          <span class="hs-dock-mission-timer">{{ formatTime(remainingFreighterSec(m.id)) }}</span>
        </div>
      </div>

      <!-- Recon Drone destinations + build -->
      <div v-if="dockTab === 'drone'" class="hs-dock-expand">
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
        <div v-if="droneDests.length > 0" class="hs-dock-dest-grid" style="margin-top: 0.4rem">
          <button
            v-for="p in droneDests"
            :key="p.id"
            class="hs-dock-dest-btn hs-dock-dest-btn--drone"
            @click="sendReconDrone(p.id, activePlanetId)"
          >
            <span>{{ planetIcon(p) }} {{ p.name }}</span>
            <span class="hs-dock-dest-btn__time">{{ formatTime(droneFlightTimeBetween(activePlanetId, p.id)) }}</span>
          </button>
        </div>
      </div>

      <!-- Galaxy Probe build -->
      <div v-if="dockTab === 'probe'" class="hs-dock-expand">
        <div class="hs-dock-row">
          <div class="hs-dock-icon-wrap">
            <span class="hs-dock-icon">🔭</span>
            <span v-if="galaxyProbeInventory > 0" class="hs-dock-badge">{{ galaxyProbeInventory }}</span>
          </div>
          <div class="hs-dock-info">
            <div class="hs-dock-name">{{ t('hawkStar.dock.galaxyProbe') }}</div>
            <div class="hs-dock-cost-row">
              <span v-for="(amt, resId) in UNIT_COSTS.galaxy_probe.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
              <span class="hs-unit-time-tag">⏱ {{ formatTime(probeBuildTime) }}</span>
            </div>
            <div v-if="galaxyProbeBuild" class="hs-progress-row">
              <div class="hs-progress-track"><div :key="galaxyProbeBuild.endsAt" class="hs-progress-fill hs-progress-fill--unit" :style="probeBuildProgressStyle" /></div>
              <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((galaxyProbeBuild.endsAt - Date.now()) / 1000))) }}</span>
            </div>
          </div>
          <div class="hs-dock-action">
            <span v-if="galaxyProbeBuild" class="hs-status-building">{{ t('hawkStar.dock.statusBuilding') }}</span>
            <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildProbe }" :disabled="!canBuildProbe" @click.stop="buildGalaxyProbe()">{{ t('hawkStar.dock.btnBuild') }}</button>
          </div>
        </div>
      </div>

      <!-- Colony Ship destinations + build -->
      <div v-if="dockTab === 'colony'" class="hs-dock-expand">
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
        <div v-if="colonyDests.length > 0" class="hs-dock-dest-grid" style="margin-top: 0.4rem">
          <button
            v-for="p in colonyDests"
            :key="p.id"
            class="hs-dock-dest-btn hs-dock-dest-btn--colony"
            @click="sendColonyShip(p.id, activePlanetId)"
          >
            <span>{{ planetIcon(p) }} {{ p.name }}</span>
            <span class="hs-dock-dest-btn__time">{{ formatTime(colonyFlightTimeBetween(activePlanetId, p.id)) }}</span>
          </button>
        </div>
      </div>

      <!-- Warship build + hangar + orbit -->
      <div v-if="dockTab === 'warship'" class="hs-dock-expand">
        <!-- Build row -->
        <div class="hs-dock-row hs-dock-row--warship">
          <div class="hs-dock-icon-wrap">
            <span class="hs-dock-icon">⚔️</span>
            <span v-if="warshipInventory > 0" class="hs-dock-badge hs-dock-badge--warship">{{ warshipInventory }}</span>
          </div>
          <div class="hs-dock-info">
            <div class="hs-dock-name">Warship <span class="hs-dock-count">× {{ warshipInventory }} / {{ warshipBayLevel }}</span></div>
            <div class="hs-dock-cost-row">
              <span v-for="(amt, resId) in UNIT_COSTS.warship.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
              <span class="hs-unit-time-tag">⏱ {{ formatTime(warshipBuildTime) }}</span>
            </div>
            <div v-if="warshipBuild" class="hs-progress-row">
              <div class="hs-progress-track"><div :key="warshipBuild.endsAt" class="hs-progress-fill hs-progress-fill--warship" :style="warshipBuildProgressStyle" /></div>
              <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((warshipBuild.endsAt - Date.now()) / 1000))) }}</span>
            </div>
          </div>
          <div class="hs-dock-action">
            <span v-if="warshipBuild" class="hs-status-building">{{ t('hawkStar.dock.statusBuilding') }}</span>
            <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildWarship }" :disabled="!canBuildWarship" @click.stop="buildWarship()">{{ t('hawkStar.dock.btnBuild') }}</button>
          </div>
        </div>
        <!-- Hangar -->
        <div v-if="warships.length" class="hs-warship-section">
          <span class="hs-warship-section-label">🔧 {{ t('hawkStar.dock.sectionHangar') }}</span>
          <div v-for="ship in warships" :key="ship.id" class="hs-warship-card-mini">
            <span class="hs-warship-card-mini__icon">{{ ship.icon }}</span>
            <span class="hs-warship-card-mini__name">{{ ship.name }}</span>
            <span class="hs-warship-card-mini__slots">
              <span class="hs-warship-card-mini__slot hs-warship-card-mini__slot--drive" :class="ship.drive?.[0] ? 'hs-warship-card-mini__slot--filled' : ''">{{ ship.drive?.[0]?.icon ?? '🔋' }}</span>
              <span v-for="(w, idx) in ship.weapons" :key="idx" class="hs-warship-card-mini__slot" :class="w ? 'hs-warship-card-mini__slot--filled' : ''">{{ w ? w.icon : '·' }}</span>
            </span>
            <button
              class="hs-orbit-btn"
              :class="{ 'hs-orbit-btn--disabled': !shipHasPowerCell(ship) }"
              :disabled="!shipHasPowerCell(ship)"
              :title="shipHasPowerCell(ship) ? t('hawkStar.solar.toOrbit') : t('hawkStar.solar.needPowerCell')"
              @click.stop="deployToOrbit(ship.id)"
            >{{ t('hawkStar.solar.toOrbit') }}</button>
          </div>
        </div>
        <!-- Orbit -->
        <div v-if="fleetInOrbit.length" class="hs-warship-section hs-warship-section--orbit">
          <span class="hs-warship-section-label">🛰 Orbit</span>
          <div v-for="ship in fleetInOrbit" :key="ship.id" class="hs-warship-card-mini hs-warship-card-mini--orbit">
            <span class="hs-warship-card-mini__icon">{{ ship.icon }}</span>
            <span class="hs-warship-card-mini__name">{{ ship.name }}</span>
            <span class="hs-warship-card-mini__slots">
              <span class="hs-warship-card-mini__slot hs-warship-card-mini__slot--drive" :class="ship.drive?.[0] ? 'hs-warship-card-mini__slot--filled' : ''">{{ ship.drive?.[0]?.icon ?? '🔋' }}</span>
              <span v-for="(w, idx) in ship.weapons" :key="idx" class="hs-warship-card-mini__slot" :class="w ? 'hs-warship-card-mini__slot--filled' : ''">{{ w ? w.icon : '·' }}</span>
            </span>
            <button class="hs-recall-btn" @click.stop="recallFromOrbit(ship.id)">{{ t('hawkStar.solar.hangar') }}</button>
          </div>
        </div>
      </div>

      <!-- Freighter cargo panel (expands below hangar when freighter selected) -->
      <div v-if="dockTab === 'freighter'" class="hs-dock-expand">
        <div class="hs-dock-row hs-dock-row--freighter">
          <div class="hs-dock-icon-wrap">
            <span class="hs-dock-icon">🚢</span>
            <span v-if="freighterInventory > 0" class="hs-dock-badge hs-dock-badge--freighter">{{ freighterInventory }}</span>
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
      <div v-if="dockTab === 'freighter' && freighterInventory > 0" class="hs-dock-cargo">
        <div class="hs-freighter-cargo-header">
          <span class="hs-freighter-cargo-title">🚢 {{ t('hawkStar.solar.loadFreighter') }}</span>
          <span class="hs-freighter-cargo-cap" :class="freighterCargoTotal > freighterCargoCapacity ? 'hs-freighter-cargo-cap--over' : ''">{{ freighterCargoTotal }} / {{ freighterCargoCapacity }}</span>
        </div>
        <div v-if="loadableResources.length === 0" class="hs-freighter-cargo-empty">{{ t('hawkStar.solar.noResources') }}</div>
        <div class="hs-freighter-cargo-grid">
          <div v-for="res in loadableResources" :key="res.id" class="hs-freighter-cargo-tile" :class="{ 'hs-freighter-cargo-tile--loaded': (freighterCargo[res.id] ?? 0) > 0 }">
            <span class="hs-freighter-cargo-tile__icon">{{ res.icon }}</span>
            <div class="hs-freighter-cargo-tile__info">
              <span class="hs-freighter-cargo-tile__name">{{ res.name }}</span>
              <span class="hs-freighter-cargo-tile__avail">{{ Math.floor(playerResources[res.id] ?? 0) }}</span>
            </div>
            <div class="hs-stepper hs-stepper--cargo">
              <button class="hs-stepper__btn" :disabled="(freighterCargo[res.id] ?? 0) <= 0" @click.stop="stepCargo(res.id, -1)">−</button>
              <span class="hs-stepper__val">{{ freighterCargo[res.id] ?? 0 }}</span>
              <button class="hs-stepper__btn" :disabled="(freighterCargo[res.id] ?? 0) >= cargoMax(res.id) || freighterCargoTotal >= freighterCargoCapacity" @click.stop="stepCargo(res.id, 1)">+</button>
            </div>
          </div>
        </div>
        <div class="hs-freighter-dest-row">
          <button
            v-for="p in ownedPlanets.filter(op => op.id !== activePlanetId && planetHasDock(op.id))"
            :key="p.id"
            class="hs-freighter-dest-btn"
            :class="{ 'hs-freighter-dest-btn--active': freighterDest === p.id }"
            @click="freighterDest = freighterDest === p.id ? null : p.id"
          >{{ p.name }}</button>
        </div>
        <button v-if="freighterDest" class="hs-freighter-send-btn" @click="doSendFreighter">
          🚀 {{ t('hawkStar.solar.dispatch') }} {{ ownedPlanets.find(p => p.id === freighterDest)?.name }}
          ({{ formatTime(freighterFlightTimeBetween(activePlanetId, freighterDest)) }})
        </button>
      </div>

    </div>

    </div><!-- /.hs-solar-bottom -->

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
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.375rem;

  @media (min-width: 640px) {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 0;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}

// ── Orbit connector line (desktop only) ─────────────────────────────────────
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
  padding: 0.5rem 0.375rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);

  @media (min-width: 640px) {
    flex-shrink: 0;
    width: 5.5rem;
    padding: 0.625rem 0.375rem;
  }

  &--sun         { border-color: rgba(253,230,138,0.3); background: rgba(253,230,138,0.05); }
  &--own         { border-color: rgba(96,165,250,0.25); cursor: pointer; }
  &--enemy       { border-color: rgba(248,113,113,0.2); background: rgba(248,113,113,0.04); }
  &--ally        { border-color: rgba(52,211,153,0.2); }
  &--uncolonized { border-color: var(--hs-line-lg); }
  &--unknown     { border-color: rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
  &--scanning    { border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.04); }
  &--colonizing  { border-color: rgba(96,165,250,0.3); background: rgba(96,165,250,0.04); }

  &--selected {
    outline: 2px solid rgba(96,165,250,0.55);
    outline-offset: -1px;
    background: rgba(96,165,250,0.07);
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

.hs-solar-active-tag {
  font-size: 0.48rem;
  background: rgba(52,211,153,0.25);
  color: #34d399;
  border: 1px solid rgba(52,211,153,0.4);
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

  &--warship  { border-color: rgba(248,113,113,0.25); background: rgba(248,113,113,0.04); }
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

  &--colony   { background: #60a5fa; color: #000; }
  &--warship  { background: #f87171; color: #fff; }
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

  &--unit     { background: #f59e0b; }
  &--colony   { background: #60a5fa; }
  &--warship  { background: #f87171; }
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

// ── Dock slot orbit badge ─────────────────────────────────────────────────────
.hs-dock-slot__orbit {
  font-size: 0.6rem;
  color: rgba(167,139,250,0.85);
  font-weight: 700;
}

// ── Warship hangar / orbit sections ─────────────────────────────────────────
.hs-warship-section {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  &--orbit { margin-top: 0.35rem; }
}

.hs-warship-section-label {
  font-size: 0.55rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.3);
  padding-bottom: 0.15rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.hs-warship-card-mini {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  background: rgba(248,113,113,0.06);
  border: 1px solid rgba(248,113,113,0.2);
  border-radius: var(--hs-r-sm);

  &--orbit {
    background: rgba(167,139,250,0.06);
    border-color: rgba(167,139,250,0.25);
  }
}

.hs-warship-card-mini__icon { font-size: 0.9rem; line-height: 1; flex-shrink: 0; }

.hs-warship-card-mini__name {
  flex: 1;
  font-size: 0.6rem;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-warship-card-mini__slots {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.hs-warship-card-mini__slot {
  width: 1.2rem;
  height: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  border-radius: 3px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.25);

  &--filled {
    background: rgba(248,113,113,0.12);
    border-color: rgba(248,113,113,0.35);
    color: rgba(248,113,113,0.9);
  }

  &--drive {
    border-color: rgba(251,191,36,0.2);
    opacity: 0.45;

    &.hs-warship-card-mini__slot--filled {
      background: rgba(251,191,36,0.12);
      border-color: rgba(251,191,36,0.45);
      color: rgba(251,191,36,0.9);
      opacity: 1;
    }
  }
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

</style>
