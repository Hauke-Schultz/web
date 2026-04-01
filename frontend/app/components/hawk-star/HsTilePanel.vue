<script setup>
import { computed, ref } from 'vue'
import { RESOURCES, BUILDINGS, UNIT_COSTS, WARSHIP_CLASSES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const {
  playerResources,
  playerBuildings,
  activeTileType,
  buildingsForActiveSlot,
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
  freeWorkers,
  currentLevelDef,
  remainingSec,
  formatTime,
  buildProgressStyle,
  planetType,
  // conversions
  conversionQueues,
  conversionTime,
  conversionMaxBatch,
  isConversionRunning,
  canConvert,
  startConversion,
  remainingConversionSec,
  conversionProgressStyle,
  // recon drones
  reconDroneLevel,
  reconDroneInventory,
  reconDroneBuild,
  droneBuildTime,
  canBuildDrone,
  buildReconDrone,
  droneBuildProgressStyle,
  // galaxy probes
  galaxyProbeLevel,
  galaxyProbeInventory,
  galaxyProbeBuild,
  probeBuildTime,
  canBuildProbe,
  buildGalaxyProbe,
  probeBuildProgressStyle,
  // colony ships
  colonyShipLevel,
  colonyShipInventory,
  colonyShipBuild,
  colonyShipBuildTime,
  canBuildColonyShip,
  buildColonyShip,
  colonyShipBuildProgressStyle,
  // warships
  warshipBayLevel,
  warships,
  warshipInventory,
  warshipBuild,
  warshipBuildTime,
  canBuildWarship,
  buildWarship,
  warshipBuildProgressStyle,
  equipDrive,
  unequipDrive,
  equipWeapon,
  unequipWeapon,
  fleetInOrbit,
  shipHasPowerCell,
  deployToOrbit,
  recallFromOrbit,
  // freighters
  freighterBayLevel,
  freighterInventory,
  freighterBuild,
  activeFreighterMissions,
  freighterBuildTime,
  freighterCargoCapacity,
  canBuildFreighter,
  buildFreighter,
  getPlanetName,
  homeSystem,
  remainingFreighterSec,
  freighterProgressStyle,
  freighterBuildProgressStyle,
  // dock – active missions
  activeDroneMissions,
  remainingDroneSec,
  droneProgressStyle,
  activeGalaxyProbes,
  remainingProbeSec,
  probeProgressStyle,
  activeColonyMissions,
  remainingColonySec,
  colonyProgressStyle,
} = useHawkStar()

const isSpacebaseTile = computed(() => activeTileType.value?.id === 'spacebase')
const isHightechTile  = computed(() => activeTileType.value?.id === 'hightech')

const hightechBuildings = computed(() => {
  if (!isHightechTile.value) return []
  return buildingsForActiveSlot.value.filter(b => BUILDINGS[b.id]?.conversions?.length > 0)
})

const queueOutputResource = (q) => {
  const recipe = BUILDINGS[q.buildingId]?.conversions?.[q.recipeIndex]
  if (!recipe) return null
  const resId = Object.keys(recipe.output)[0]
  return RESOURCES[resId] ?? null
}

// Per-planet queues for all active hightech buildings in this slot
const activeConversionQueues = computed(() => {
  const ids = new Set(hightechBuildings.value.map(b => b.id))
  return conversionQueues.value.filter(q => ids.has(q.buildingId))
})

const availableConversions = computed(() =>
  hightechBuildings.value.flatMap(b => {
    const lvl = getLevel(b.id)
    return (BUILDINGS[b.id]?.conversions ?? []).map((recipe, index) => ({
      ...recipe,
      index,
      buildingId: b.id,
      unlocked: !recipe.requiresLevel || lvl >= recipe.requiresLevel,
    }))
  })
)

// Per-recipe batch count selection (keyed by "buildingId_recipeIndex")
const conversionCounts = ref({})
const getConversionCount = (bId, idx) => conversionCounts.value[`${bId}_${idx}`] ?? 1
const setConversionCount = (bId, idx, val) => {
  const max = conversionMaxBatch(bId)
  conversionCounts.value[`${bId}_${idx}`] = Math.min(Math.max(1, Math.floor(val)), max)
}

// ── Dock tabs ──────────────────────────────────────────────────────────────────
const dockTab = ref(null)

// ── Dock panel ─────────────────────────────────────────────────────────────────
const CARGO_EXCLUDED = ['population', 'energy']

const freighterCargo    = ref({})

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

const getPlanetLabel = (planetId) => {
  const p = homeSystem.value?.planets.find(pl => pl.id === planetId)
  return p?.name ?? getPlanetName(planetId) ?? planetId
}

const availableOrdnance = computed(() =>
  Object.values(RESOURCES).filter(r => r.weapon && !r.drive && (playerResources.value[r.id] ?? 0) > 0)
)

const availableDriveCells = computed(() =>
  Object.values(RESOURCES).filter(r => r.drive && (playerResources.value[r.id] ?? 0) > 0)
)
</script>

<template>
  <div class="hs-panel">
    <div class="hs-panel-header">
      <span class="hs-panel-icon">{{ activeTileType?.icon ?? '?' }}</span>
      <h2 class="hs-panel-title">{{ activeTileType?.name ?? 'Select a tile' }}</h2>
      <span class="hs-panel-desc">{{ activeTileType?.description ?? '' }}</span>
    </div>

    <div class="hs-building-list">
      <div
        v-for="bDef in buildingsForActiveSlot"
        :key="bDef.id"
        class="hs-building-row"
        :class="{ 'hs-building-row--offline': isOffline(bDef.id) }"
      >
        <!-- Icon + level badge -->
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">{{ bDef.icon }}</span>
          <span v-if="getLevel(bDef.id) > 0" class="hs-level-badge">Lv{{ getLevel(bDef.id) }}</span>
        </div>

        <!-- Info block -->
        <div class="hs-building-info">
          <div class="hs-building-name">{{ bDef.name }}</div>
          <div v-if="currentLevelDef(bDef.id)" class="hs-building-stats">
            <span v-for="(amt, resId) in currentLevelDef(bDef.id).production" :key="resId">{{ RESOURCES[resId]?.icon }} +{{ amt }}/s</span>
            <span v-if="currentLevelDef(bDef.id).energyDrain">⚡ -{{ currentLevelDef(bDef.id).energyDrain }}</span>
            <span v-if="currentLevelDef(bDef.id).staffDrain">👥 {{ currentLevelDef(bDef.id).staffDrain }}</span>
          </div>
          <div class="hs-building-effect">
            <template v-if="nextLevelDef(bDef.id)">
              {{ getLevel(bDef.id) === 0 ? '' : '→ ' }}{{ nextLevelDef(bDef.id).effect }}
            </template>
            <template v-else>Max level reached</template>
          </div>

          <!-- Cost row -->
          <div
            v-if="nextLevelDef(bDef.id) && !isBuildingInProgress(bDef.id) && (Object.keys(nextLevelDef(bDef.id).cost).length || staffDelta(bDef.id) > 0 || nextLevelDef(bDef.id).energyDrain > 0)"
            class="hs-cost-row"
          >
            <span
              v-if="nextLevelDef(bDef.id).energyDrain > 0"
              class="hs-cost-tag"
              :class="hasEnoughPower(bDef.id) ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >⚡ -{{ nextLevelDef(bDef.id).energyDrain }}</span>
            <span
              v-if="staffDelta(bDef.id) > 0"
              class="hs-cost-tag"
              :class="freeWorkers >= staffDelta(bDef.id) ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >👥 {{ staffDelta(bDef.id) }}</span>
            <span
              v-for="(amt, resId) in nextLevelDef(bDef.id).cost"
              :key="resId"
              class="hs-cost-tag"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>

          <!-- Progress bar -->
          <template v-if="isBuildingInProgress(bDef.id)">
            <div class="hs-progress-row">
              <div class="hs-progress-track">
                <div
                  :key="playerBuildings[bDef.id].buildEndsAt"
                  class="hs-progress-fill"
                  :style="buildProgressStyle(bDef.id)"
                />
              </div>
              <span class="hs-progress-time">{{ formatTime(remainingSec(playerBuildings[bDef.id].buildEndsAt)) }}</span>
            </div>
          </template>
        </div>

        <!-- Action button -->
        <div class="hs-building-action">
          <template v-if="isBuildingInProgress(bDef.id)">
            <span class="hs-status-building">Building…</span>
          </template>
          <template v-else-if="isOffline(bDef.id)">
            <span class="hs-status-offline">⚠ Offline</span>
          </template>
          <template v-else-if="!nextLevelDef(bDef.id)">
            <span class="hs-status-max">MAX</span>
          </template>
          <template v-else-if="isBuildingLocked(bDef.id)">
            <span class="hs-status-locked">
              {{ BUILDINGS[bDef.id].requiresBuilding ? `🔒 ${BUILDINGS[BUILDINGS[bDef.id].requiresBuilding]?.name ?? ''} Lv${BUILDINGS[bDef.id].requiresLevel}` : '🔒 Locked' }}
            </span>
          </template>
          <template v-else>
            <div class="hs-btn-wrap">
              <button
                class="hs-btn-build"
                :class="{ 'hs-btn-build--disabled': !canBuild(bDef.id) }"
                :disabled="!canBuild(bDef.id)"
                @click.stop="startBuild(bDef.id)"
              >{{ getLevel(bDef.id) === 0 ? 'Build' : 'Upgrade' }}</button>
              <span class="hs-build-time">⏱ {{ formatTime(nextLevelDef(bDef.id).buildTime) }}</span>
              <span v-if="!hasEnoughPower(bDef.id)" class="hs-no-power">⚡ Need power</span>
              <span v-if="!hasEnoughStaff(bDef.id)" class="hs-no-staff">👥 Need staff</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ── Dock (Space Base tile only) ── -->
    <div v-if="isSpacebaseTile" class="hs-dock-panel">

      <!-- Hangar row: all ships visible at once -->
      <div class="hs-dock-hangar">
        <button
          v-if="reconDroneLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'drone' }"
          @click.stop="dockTab = dockTab === 'drone' ? null : 'drone'"
        >
          <span class="hs-dock-slot__icon">🛸</span>
          <span class="hs-dock-slot__count">{{ reconDroneInventory }}</span>
          <span class="hs-dock-slot__name">Recon Drone</span>
        </button>
        <button
          v-if="galaxyProbeLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'probe' }"
          @click.stop="dockTab = dockTab === 'probe' ? null : 'probe'"
        >
          <span class="hs-dock-slot__icon">🔭</span>
          <span class="hs-dock-slot__count">{{ galaxyProbeInventory }}</span>
          <span class="hs-dock-slot__name">Galaxy Probe</span>
        </button>
        <button
          v-if="colonyShipLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'colony' }"
          @click.stop="dockTab = dockTab === 'colony' ? null : 'colony'"
        >
          <span class="hs-dock-slot__icon">🚀</span>
          <span class="hs-dock-slot__count">{{ colonyShipInventory }}</span>
          <span class="hs-dock-slot__name">Colony Ship</span>
        </button>
        <button
          v-if="freighterBayLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'freighter' }"
          @click.stop="dockTab = dockTab === 'freighter' ? null : 'freighter'"
        >
          <span class="hs-dock-slot__icon">🚢</span>
          <span class="hs-dock-slot__count">{{ freighterInventory }}</span>
          <span class="hs-dock-slot__name">Freighter</span>
        </button>
        <button
          v-if="warshipBayLevel > 0"
          class="hs-dock-slot hs-dock-slot--clickable"
          :class="{ 'hs-dock-slot--active': dockTab === 'warship' }"
          @click.stop="dockTab = dockTab === 'warship' ? null : 'warship'"
        >
          <span class="hs-dock-slot__icon">⚔️</span>
          <span class="hs-dock-slot__count">{{ warshipInventory }}<span v-if="fleetInOrbit.length" class="hs-dock-slot__orbit"> +{{ fleetInOrbit.length }}🛰</span></span>
          <span class="hs-dock-slot__name">Warship</span>
        </button>
      </div>

      <!-- Active missions (always visible) -->
      <div
        v-if="activeDroneMissions.length || activeGalaxyProbes.length || activeColonyMissions.length || activeFreighterMissions.length"
        class="hs-dock-missions"
      >
        <div v-for="m in activeDroneMissions" :key="m.planetId" class="hs-dock-mission-row">
          <span class="hs-dock-mission-icon">🛸</span>
          <div class="hs-dock-mission-info">
            <span class="hs-dock-mission-label">Recon → {{ getPlanetLabel(m.planetId) }}</span>
            <div class="hs-progress-row">
              <div class="hs-progress-track"><div class="hs-progress-fill hs-progress-fill--unit" :key="m.endsAt" :style="droneProgressStyle(m.planetId)" /></div>
              <span class="hs-progress-time">{{ formatTime(remainingDroneSec(m.planetId)) }}</span>
            </div>
          </div>
        </div>
        <div v-for="p in activeGalaxyProbes" :key="p.systemId" class="hs-dock-mission-row">
          <span class="hs-dock-mission-icon">🔭</span>
          <div class="hs-dock-mission-info">
            <span class="hs-dock-mission-label">Probe → {{ p.systemId }}</span>
            <div class="hs-progress-row">
              <div class="hs-progress-track"><div class="hs-progress-fill hs-progress-fill--unit" :key="p.endsAt" :style="probeProgressStyle(p.systemId)" /></div>
              <span class="hs-progress-time">{{ formatTime(remainingProbeSec(p.systemId)) }}</span>
            </div>
          </div>
        </div>
        <div v-for="m in activeColonyMissions" :key="m.planetId" class="hs-dock-mission-row">
          <span class="hs-dock-mission-icon">🚀</span>
          <div class="hs-dock-mission-info">
            <span class="hs-dock-mission-label">Colonize → {{ getPlanetLabel(m.planetId) }}</span>
            <div class="hs-progress-row">
              <div class="hs-progress-track"><div class="hs-progress-fill hs-progress-fill--colony" :key="m.endsAt" :style="colonyProgressStyle(m.planetId)" /></div>
              <span class="hs-progress-time">{{ formatTime(remainingColonySec(m.planetId)) }}</span>
            </div>
          </div>
        </div>
        <div v-for="m in activeFreighterMissions" :key="m.id" class="hs-dock-mission-row">
          <span class="hs-dock-mission-icon">🚢</span>
          <div class="hs-dock-mission-info">
            <span class="hs-dock-mission-label">{{ getPlanetLabel(m.fromPlanetId) }} → {{ getPlanetLabel(m.toPlanetId) }}</span>
            <div class="hs-dock-mission-cargo">
              <template v-for="(amt, resId) in m.cargo" :key="resId">
                <span v-if="amt > 0" class="hs-dock-cargo-tag">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
              </template>
            </div>
            <div class="hs-progress-row">
              <div class="hs-progress-track"><div class="hs-progress-fill hs-progress-fill--freighter" :key="m.endsAt" :style="freighterProgressStyle(m.id)" /></div>
              <span class="hs-progress-time">{{ formatTime(remainingFreighterSec(m.id)) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Expand: Recon Drone -->
      <div v-if="dockTab === 'drone'" class="hs-dock-expand">
        <div class="hs-dock-row">
          <div class="hs-dock-icon-wrap">
            <span class="hs-dock-icon">🛸</span>
            <span v-if="reconDroneInventory > 0" class="hs-dock-badge">{{ reconDroneInventory }}</span>
          </div>
          <div class="hs-dock-info">
            <div class="hs-dock-name">Recon Drone</div>
            <div class="hs-dock-desc">Scout planets in your home system</div>
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
            <span v-if="reconDroneBuild" class="hs-status-building">Building…</span>
            <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildDrone }" :disabled="!canBuildDrone" @click.stop="buildReconDrone()">Build</button>
          </div>
        </div>
      </div>

      <!-- Expand: Galaxy Probe -->
      <div v-if="dockTab === 'probe'" class="hs-dock-expand">
        <div class="hs-dock-row">
          <div class="hs-dock-icon-wrap">
            <span class="hs-dock-icon">🔭</span>
            <span v-if="galaxyProbeInventory > 0" class="hs-dock-badge">{{ galaxyProbeInventory }}</span>
          </div>
          <div class="hs-dock-info">
            <div class="hs-dock-name">Galaxy Probe</div>
            <div class="hs-dock-desc">Scout distant star systems</div>
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
            <span v-if="galaxyProbeBuild" class="hs-status-building">Building…</span>
            <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildProbe }" :disabled="!canBuildProbe" @click.stop="buildGalaxyProbe()">Build</button>
          </div>
        </div>
      </div>

      <!-- Expand: Colony Ship -->
      <div v-if="dockTab === 'colony'" class="hs-dock-expand">
        <div class="hs-dock-row">
          <div class="hs-dock-icon-wrap">
            <span class="hs-dock-icon">🚀</span>
            <span v-if="colonyShipInventory > 0" class="hs-dock-badge hs-dock-badge--colony">{{ colonyShipInventory }}</span>
          </div>
          <div class="hs-dock-info">
            <div class="hs-dock-name">Colony Ship</div>
            <div class="hs-dock-desc">Colonize unoccupied planets</div>
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
            <span v-if="colonyShipBuild" class="hs-status-building">Building…</span>
            <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildColonyShip }" :disabled="!canBuildColonyShip" @click.stop="buildColonyShip()">Build</button>
          </div>
        </div>
      </div>

      <!-- Expand: Warship (build + fleet) -->
      <div v-if="dockTab === 'warship'" class="hs-dock-expand">
        <div class="hs-dock-row hs-dock-row--warship">
          <div class="hs-dock-icon-wrap">
            <span class="hs-dock-icon">⚔️</span>
            <span v-if="warshipInventory > 0" class="hs-dock-badge hs-dock-badge--warship">{{ warshipInventory }}</span>
          </div>
          <div class="hs-dock-info">
            <div class="hs-dock-name">Warship <span class="hs-dock-count">× {{ warshipInventory }} / {{ warshipBayLevel }}</span></div>
            <div class="hs-dock-desc">Heavy combat vessel. Requires Super Alloy &amp; Pure Crystal.</div>
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
            <span v-if="warshipBuild" class="hs-status-building">Building…</span>
            <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildWarship }" :disabled="!canBuildWarship" @click.stop="buildWarship()">Build</button>
          </div>
        </div>
        <!-- Hangar -->
        <div v-if="warships.length" class="hs-warship-section">
          <span class="hs-warship-section-label">🔧 Hangar</span>
          <div class="hs-warship-fleet">
            <div v-for="ship in warships" :key="ship.id" class="hs-warship-card">
              <div class="hs-warship-card-header">
                <span class="hs-warship-card-icon">{{ ship.icon }}</span>
                <span class="hs-warship-card-name">{{ ship.name }}</span>
                <span class="hs-warship-card-class">{{ WARSHIP_CLASSES[ship.classId]?.description ?? '' }}</span>
                <button
                  class="hs-orbit-btn"
                  :class="{ 'hs-orbit-btn--disabled': !shipHasPowerCell(ship) }"
                  :disabled="!shipHasPowerCell(ship)"
                  :title="shipHasPowerCell(ship) ? 'In Orbit schicken' : 'Power Cell benötigt'"
                  @click.stop="deployToOrbit(ship.id)"
                >↑ Orbit</button>
              </div>
              <div class="hs-warship-card-stats">
                <span class="hs-warship-stat" title="Hull">🛡 {{ ship.hull }}/{{ ship.hullMax }}</span>
                <span class="hs-warship-stat" title="Shield">🔵 {{ ship.shield }}/{{ ship.shieldMax }}</span>
                <span class="hs-warship-stat" title="Speed">⚡ {{ ship.speed }}</span>
              </div>
              <!-- Drive slot -->
              <div class="hs-warship-weapons">
                <span class="hs-warship-weapons-label">🔋 Drive</span>
                <div class="hs-warship-weapon-slots">
                  <div
                    class="hs-warship-weapon-slot hs-warship-weapon-slot--drive"
                    :class="ship.drive?.[0] ? 'hs-warship-weapon-slot--equipped' : 'hs-warship-weapon-slot--empty'"
                  >
                    <template v-if="ship.drive?.[0]">
                      <span class="hs-warship-slot-item">{{ ship.drive[0].icon }} {{ ship.drive[0].name }}</span>
                      <button class="hs-warship-unequip-btn" @click.stop="unequipDrive(ship.id)">✕</button>
                    </template>
                    <template v-else>
                      <span class="hs-warship-weapon-slot-empty-label">— no drive —</span>
                      <div v-if="availableDriveCells.length" class="hs-warship-equip-row">
                        <button
                          v-for="cell in availableDriveCells"
                          :key="cell.id"
                          class="hs-warship-equip-btn hs-warship-equip-btn--drive"
                          @click.stop="equipDrive(ship.id, cell.id)"
                        >{{ cell.icon }} {{ cell.name }} <span class="hs-warship-equip-count">({{ Math.floor(playerResources[cell.id] ?? 0) }})</span></button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
              <!-- Weapon slots -->
              <div class="hs-warship-weapons">
                <span class="hs-warship-weapons-label">⚔️ Weapons</span>
                <div class="hs-warship-weapon-slots">
                  <div
                    v-for="(weapon, idx) in ship.weapons"
                    :key="idx"
                    class="hs-warship-weapon-slot"
                    :class="weapon ? 'hs-warship-weapon-slot--equipped' : 'hs-warship-weapon-slot--empty'"
                  >
                    <template v-if="weapon">
                      <span class="hs-warship-slot-item">{{ weapon.icon }} {{ weapon.name }}</span>
                      <button class="hs-warship-unequip-btn" @click.stop="unequipWeapon(ship.id, idx)">✕</button>
                    </template>
                    <template v-else>
                      <span class="hs-warship-weapon-slot-empty-label">— empty —</span>
                      <div v-if="availableOrdnance.length" class="hs-warship-equip-row">
                        <button
                          v-for="ord in availableOrdnance"
                          :key="ord.id"
                          class="hs-warship-equip-btn"
                          @click.stop="equipWeapon(ship.id, idx, ord.id)"
                        >{{ ord.icon }} {{ ord.name }} <span class="hs-warship-equip-count">({{ Math.floor(playerResources[ord.id] ?? 0) }})</span></button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Orbit -->
        <div v-if="fleetInOrbit.length" class="hs-warship-section hs-warship-section--orbit">
          <span class="hs-warship-section-label">🛰 Orbit</span>
          <div class="hs-warship-fleet">
            <div v-for="ship in fleetInOrbit" :key="ship.id" class="hs-warship-card hs-warship-card--orbit">
              <div class="hs-warship-card-header">
                <span class="hs-warship-card-icon">{{ ship.icon }}</span>
                <span class="hs-warship-card-name">{{ ship.name }}</span>
                <span class="hs-warship-card-class">{{ WARSHIP_CLASSES[ship.classId]?.description ?? '' }}</span>
                <button class="hs-recall-btn" @click.stop="recallFromOrbit(ship.id)">↓ Hangar</button>
              </div>
              <div class="hs-warship-card-stats">
                <span class="hs-warship-stat" title="Hull">🛡 {{ ship.hull }}/{{ ship.hullMax }}</span>
                <span class="hs-warship-stat" title="Shield">🔵 {{ ship.shield }}/{{ ship.shieldMax }}</span>
                <span class="hs-warship-stat" title="Speed">⚡ {{ ship.speed }}</span>
              </div>
              <!-- Drive slot (read-only in orbit) -->
              <div class="hs-warship-weapons">
                <span class="hs-warship-weapons-label">🔋 Drive</span>
                <div class="hs-warship-weapon-slots">
                  <div
                    class="hs-warship-weapon-slot hs-warship-weapon-slot--drive"
                    :class="ship.drive?.[0] ? 'hs-warship-weapon-slot--equipped' : 'hs-warship-weapon-slot--empty'"
                  >
                    <span v-if="ship.drive?.[0]" class="hs-warship-slot-item">{{ ship.drive[0].icon }} {{ ship.drive[0].name }}</span>
                    <span v-else class="hs-warship-weapon-slot-empty-label">— no drive —</span>
                  </div>
                </div>
              </div>
              <!-- Weapon slots (read-only in orbit) -->
              <div class="hs-warship-weapons">
                <span class="hs-warship-weapons-label">⚔️ Weapons</span>
                <div class="hs-warship-weapon-slots">
                  <div
                    v-for="(weapon, idx) in ship.weapons"
                    :key="idx"
                    class="hs-warship-weapon-slot"
                    :class="weapon ? 'hs-warship-weapon-slot--equipped' : 'hs-warship-weapon-slot--empty'"
                  >
                    <template v-if="weapon">
                      <span class="hs-warship-slot-item">{{ weapon.icon }} {{ weapon.name }}</span>
                    </template>
                    <template v-else>
                      <span class="hs-warship-weapon-slot-empty-label">— empty —</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Expand: Freighter (build + cargo) -->
      <div v-if="dockTab === 'freighter'" class="hs-dock-expand">
        <div class="hs-dock-row hs-dock-row--freighter">
          <div class="hs-dock-icon-wrap">
            <span class="hs-dock-icon">🚢</span>
            <span v-if="freighterInventory > 0" class="hs-dock-badge hs-dock-badge--freighter">{{ freighterInventory }}</span>
          </div>
          <div class="hs-dock-info">
            <div class="hs-dock-name">Freighter</div>
            <div class="hs-dock-desc">Transport resources between colonies · {{ freighterCargoCapacity }} cargo</div>
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
            <span v-if="freighterBuild" class="hs-status-building">Building…</span>
            <button v-else class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildFreighter }" :disabled="!canBuildFreighter" @click.stop="buildFreighter()">Build</button>
          </div>
        </div>
        <div v-if="freighterInventory > 0" class="hs-freighter-cargo-panel">
          <div class="hs-freighter-cargo-header">
            <span class="hs-freighter-cargo-title">🚢 Frachter beladen</span>
            <span class="hs-freighter-cargo-cap" :class="freighterCargoTotal > freighterCargoCapacity ? 'hs-freighter-cargo-cap--over' : ''">{{ freighterCargoTotal }} / {{ freighterCargoCapacity }}</span>
          </div>
          <div v-if="loadableResources.length === 0" class="hs-freighter-cargo-empty">Keine Ressourcen verfügbar</div>
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
        </div>
      </div>

    </div>

    <div v-if="buildingsForActiveSlot.length === 0 && !isSpacebaseTile" class="hs-empty">
      Select an unlocked tile to manage buildings
    </div>

    <!-- ── High-Tech conversion section ── -->
    <div v-if="isHightechTile && hightechBuildings.length" class="hs-conv-section">
      <div class="hs-conv-section-title">⚗️ Conversions</div>

      <!-- Active conversion queues (one row per running job) -->
      <div
        v-for="q in activeConversionQueues"
        :key="`${q.buildingId}_${q.recipeIndex}`"
        class="hs-conv-queue-row"
      >
        <div class="hs-conv-queue-bar" :style="conversionProgressStyle(q)" />
        <span class="hs-conv-queue-icon">{{ queueOutputResource(q)?.icon }}</span>
        <span class="hs-conv-queue-name">{{ queueOutputResource(q)?.name }}</span>
        <span class="hs-conv-queue-label">Converting…</span>
        <span class="hs-conv-queue-time">{{ formatTime(remainingConversionSec(q)) }}</span>
        <span v-if="q.remaining > 0" class="hs-conv-queue-remaining">+{{ q.remaining }} queued</span>
      </div>

      <div v-if="availableConversions.length === 0" class="hs-conv-empty">
        Build the refinery to unlock conversions
      </div>

      <div class="hs-conv-list">
        <div
          v-for="recipe in availableConversions"
          :key="recipe.index"
          class="hs-conv-row"
          :class="{ 'hs-conv-row--locked': !recipe.unlocked }"
        >
          <!-- Input → Output -->
          <div class="hs-conv-formula">
            <span
              v-for="(amt, resId) in recipe.input"
              :key="resId"
              class="hs-conv-res"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-conv-res--ok' : 'hs-conv-res--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
            <span class="hs-conv-arrow">→</span>
            <span
              v-for="(amt, resId) in recipe.output"
              :key="resId"
              class="hs-conv-res hs-conv-res--out"
            >{{ RESOURCES[resId]?.icon }} {{ RESOURCES[resId]?.name }}</span>
          </div>

          <!-- Duration + action -->
          <div class="hs-conv-action">
            <template v-if="!recipe.unlocked">
              <span class="hs-conv-locked">🔒 Lv{{ recipe.requiresLevel }}</span>
            </template>
            <template v-else>
              <span class="hs-conv-time">⏱ {{ formatTime(conversionTime(recipe.buildingId, recipe.index)) }}</span>
              <!-- Batch size stepper (only shown at Lv2+) -->
              <div v-if="conversionMaxBatch(recipe.buildingId) > 1" class="hs-stepper hs-stepper--conv">
                <button class="hs-stepper__btn" :disabled="getConversionCount(recipe.buildingId, recipe.index) <= 1" @click="setConversionCount(recipe.buildingId, recipe.index, getConversionCount(recipe.buildingId, recipe.index) - 1)">−</button>
                <span class="hs-stepper__val">{{ getConversionCount(recipe.buildingId, recipe.index) }}</span>
                <button class="hs-stepper__btn" :disabled="getConversionCount(recipe.buildingId, recipe.index) >= conversionMaxBatch(recipe.buildingId)" @click="setConversionCount(recipe.buildingId, recipe.index, getConversionCount(recipe.buildingId, recipe.index) + 1)">+</button>
              </div>
              <button
                class="hs-btn-convert"
                :class="{ 'hs-btn-convert--disabled': !isConversionRunning(recipe.buildingId, recipe.index) && !canConvert(recipe.buildingId, recipe.index) }"
                :disabled="!isConversionRunning(recipe.buildingId, recipe.index) && !canConvert(recipe.buildingId, recipe.index)"
                @click="startConversion(recipe.buildingId, recipe.index, getConversionCount(recipe.buildingId, recipe.index))"
              >{{ isConversionRunning(recipe.buildingId, recipe.index) ? '+' + getConversionCount(recipe.buildingId, recipe.index) : 'Convert' }}</button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="isHightechTile && !hightechBuildings.length" class="hs-conv-empty">
      Build a High-Tech facility to unlock conversions
    </div>

  </div>
</template>

<style lang="scss" scoped>
.hs-panel {
  flex: 1;
  min-width: 0;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.hs-panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--hs-line-sm);
}

.hs-panel-icon  { font-size: 1.25rem; }
.hs-panel-title { font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0; flex: 1; }
.hs-panel-desc  { font-size: 0.65rem; opacity: 0.4; }

.hs-building-list { display: flex; flex-direction: column; gap: 0.5rem; }

.hs-building-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.6rem;
  transition: background 0.3s, border-color 0.3s, opacity 0.3s;

  @media (min-width: 640px) {
    gap: 0.75rem;
    padding: 0.75rem;
  }

  &--offline {
    background: var(--hs-danger-bg);
    border-color: var(--hs-danger-border);
    opacity: 0.75;
  }
}

.hs-building-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hs-glass-lg);
  border-radius: var(--hs-r-sm);
}

.hs-building-icon { font-size: 1.1rem; }

.hs-level-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 0.55rem;
  font-weight: 700;
  background: var(--hs-accent);
  color: #fff;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.4;
}

.hs-building-info   { flex: 1; min-width: 0; }
.hs-building-name   { font-size: 0.825rem; font-weight: 600; }
.hs-building-stats  {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;

  span {
    font-size: 0.6rem;
    color: var(--hs-ok);
    background: var(--hs-ok-bg);
    padding: 1px 5px;
    border-radius: 4px;
  }
}
.hs-building-effect { font-size: 0.68rem; opacity: 0.5; margin-top: 2px; }

.hs-cost-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }

.hs-cost-tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;

  &--ok { background: var(--hs-ok-bg);        color: var(--hs-ok-muted); }
  &--no { background: var(--hs-danger-bg-cost); color: var(--hs-danger-muted); }
}

.hs-progress-row   { display: flex; align-items: center; gap: 0.5rem; margin-top: 6px; }
.hs-progress-track { flex: 1; height: 4px; background: var(--hs-glass-3xl); border-radius: 9999px; overflow: hidden; }

.hs-progress-fill {
  height: 100%;
  background: var(--hs-warn);
  border-radius: 9999px;
}

.hs-progress-time {
  font-size: 0.65rem;
  color: var(--hs-warn-text);
  font-variant-numeric: tabular-nums;
  width: 3.5rem;
  text-align: right;
  flex-shrink: 0;
}

.hs-building-action { flex-shrink: 0; }

.hs-btn-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.hs-build-time { font-size: 0.6rem; color: rgba(255,255,255,0.4); white-space: nowrap; }
.hs-no-power   { font-size: 0.6rem; color: var(--hs-danger); white-space: nowrap; }
.hs-no-staff   { font-size: 0.6rem; color: var(--hs-staff);  white-space: nowrap; }

.hs-btn-build {
  padding: 0.375rem 0.75rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--hs-accent);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;

  &:hover:not(:disabled) { background: var(--hs-accent-hover); }

  &--disabled {
    background: var(--hs-glass-xl);
    color: rgba(255, 255, 255, 0.3);
    cursor: not-allowed;
  }
}

.hs-status-building { font-size: 0.7rem; font-weight: 600; color: var(--hs-warn);         white-space: nowrap; }
.hs-status-max      { font-size: 0.7rem; font-weight: 700; color: var(--hs-accent-badge);  letter-spacing: 0.05em; }
.hs-status-offline  { font-size: 0.7rem; font-weight: 700; color: var(--hs-danger);        white-space: nowrap; animation: pulse 1.5s ease-in-out infinite; }
.hs-status-locked   { font-size: 0.62rem; font-weight: 600; color: rgba(255,255,255,0.25); white-space: nowrap; text-align: right; }

.hs-empty { text-align: center; padding: 1.5rem; opacity: 0.25; font-size: 0.875rem; }

// ── Dock panel ────────────────────────────────────────────────────────────────
.hs-dock-panel {
  order: -1;
  margin-bottom: 0.875rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--hs-line-sm);
  background: var(--hs-glass-sm);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--hs-r-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hs-dock-hangar {
  display: flex;
  flex-direction: row;
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

.hs-dock-slot__icon  { font-size: 1.1rem; line-height: 1; }
.hs-dock-slot__count { font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
.hs-dock-slot__name  { font-size: 0.46rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.55; }
.hs-dock-slot__orbit { font-size: 0.6rem; color: rgba(52,211,153,0.85); margin-left: 2px; }

.hs-dock-expand {
  border-top: 1px solid rgba(255,255,255,0.07);
  padding: 0.5rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-dock-expand__empty {
  font-size: 0.58rem;
  opacity: 0.3;
  font-style: italic;
  text-align: center;
  padding: 0.2rem 0;
}

// ── Dock unit rows ─────────────────────────────────────────────────────────────
.hs-dock-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.5rem 0.6rem;
  transition: border-color 0.15s, background 0.15s;

  &--warship {
    border-color: rgba(248, 113, 113, 0.25);
    background: rgba(248, 113, 113, 0.04);
  }

  &--freighter {
    border-color: rgba(52, 211, 153, 0.2);
    background: rgba(52, 211, 153, 0.03);
    cursor: default;
  }

  &--open {
    border-color: rgba(52, 211, 153, 0.4);
    background: rgba(52, 211, 153, 0.07);
  }
}

.hs-dock-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hs-glass-lg);
  border-radius: var(--hs-r-sm);
  cursor: pointer;
}

.hs-dock-icon { font-size: 1.1rem; }

.hs-dock-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 0.55rem;
  font-weight: 700;
  background: #f59e0b;
  color: #000;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.4;

  &--colony  { background: #60a5fa; color: #000; }
  &--warship { background: #f87171; color: #fff; }
  &--freighter { background: #34d399; color: #000; }
}

.hs-dock-info  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; cursor: pointer; }
.hs-dock-name  { font-size: 0.825rem; font-weight: 600; display: flex; align-items: baseline; gap: 0.35rem; flex-wrap: wrap; }
.hs-dock-count { font-size: 0.7rem; opacity: 0.5; font-weight: 400; }
.hs-dock-desc  { font-size: 0.62rem; opacity: 0.45; }
.hs-dock-cost-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }

.hs-dock-active-badge {
  font-size: 0.58rem;
  font-weight: 700;
  color: #f59e0b;
  background: rgba(245,158,11,0.12);
  border: 1px solid rgba(245,158,11,0.25);
  padding: 1px 5px;
  border-radius: 4px;
}

.hs-dock-toggle-hint {
  font-size: 0.58rem;
  color: rgba(52,211,153,0.7);
  font-weight: 600;
}

.hs-dock-action { flex-shrink: 0; }

.hs-dock-empty {
  text-align: center;
  padding: 0.75rem;
  opacity: 0.25;
  font-size: 0.75rem;
  font-style: italic;
}

.hs-unit-time-tag {
  font-size: 0.6rem;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--hs-glass-lg);
  color: rgba(255,255,255,0.35);
}

.hs-progress-fill--unit     { background: #f59e0b; }
.hs-progress-fill--colony   { background: #60a5fa; }
.hs-progress-fill--warship  { background: #f87171; }
.hs-progress-fill--freighter { background: #34d399; }

// ── Warship fleet ─────────────────────────────────────────────────────────────
.hs-warship-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.4rem;

  &--orbit .hs-warship-card { border-color: rgba(52,211,153,0.3); background: rgba(52,211,153,0.04); }
}

.hs-warship-section-label {
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.3);
}

.hs-warship-fleet {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-orbit-btn {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(52,211,153,0.35);
  background: rgba(52,211,153,0.08);
  color: rgba(52,211,153,0.9);
  font-size: 0.58rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
  &:hover:not(:disabled) { background: rgba(52,211,153,0.2); border-color: rgba(52,211,153,0.6); }
  &--disabled { opacity: 0.3; cursor: not-allowed; }
}

.hs-recall-btn {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.45);
  font-size: 0.58rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
  &:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }
}

.hs-warship-fleet-title {
  font-size: 0.62rem;
  font-weight: 700;
  color: rgba(248,113,113,0.7);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hs-warship-card {
  background: rgba(248,113,113,0.05);
  border: 1px solid rgba(248,113,113,0.2);
  border-radius: 6px;
  padding: 0.45rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hs-warship-card-header {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.hs-warship-card-icon { font-size: 0.9rem; line-height: 1; }

.hs-warship-card-name {
  font-size: 0.68rem;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
}

.hs-warship-card-class {
  flex: 1;
  font-size: 0.5rem;
  color: rgba(255,255,255,0.3);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-warship-card-stats {
  display: flex;
  gap: 0.5rem;
}

.hs-warship-stat {
  font-size: 0.58rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: rgba(255,255,255,0.55);
}

.hs-warship-weapons {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.hs-warship-weapons-label {
  font-size: 0.52rem;
  color: rgba(255,255,255,0.25);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hs-warship-weapon-slots {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.hs-warship-weapon-slot {
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 0.55rem;
  font-weight: 600;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 2px;

  &--empty {
    border: 1px dashed rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.02);
  }

  &--equipped {
    border: 1px solid rgba(248,113,113,0.35);
    background: rgba(248,113,113,0.08);
    flex-direction: row;
    align-items: center;
  }

  &--drive {
    &.hs-warship-weapon-slot--equipped {
      border-color: rgba(251,191,36,0.4);
      background: rgba(251,191,36,0.08);
    }
    &.hs-warship-weapon-slot--empty {
      border-color: rgba(251,191,36,0.2);
    }
  }
}

.hs-warship-weapon-slot-empty-label {
  color: rgba(255,255,255,0.18);
  font-style: italic;
}

.hs-warship-slot-item {
  flex: 1;
  font-size: 0.62rem;
  font-weight: 600;
  color: rgba(248,113,113,0.9);

  .hs-warship-weapon-slot--drive & {
    color: rgba(251,191,36,0.9);
  }
}

.hs-warship-unequip-btn {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  color: rgba(255,255,255,0.3);
  font-size: 0.55rem;
  cursor: pointer;
  line-height: 1;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  &:hover { background: rgba(248,113,113,0.15); border-color: rgba(248,113,113,0.4); color: #f87171; }
}

.hs-warship-equip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 3px;
}

.hs-warship-equip-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid rgba(52,211,153,0.3);
  background: rgba(52,211,153,0.07);
  color: rgba(52,211,153,0.85);
  font-size: 0.58rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  &:hover { background: rgba(52,211,153,0.18); border-color: rgba(52,211,153,0.55); }

  &--drive {
    border-color: rgba(251,191,36,0.35);
    background: rgba(251,191,36,0.07);
    color: rgba(251,191,36,0.85);
    &:hover { background: rgba(251,191,36,0.17); border-color: rgba(251,191,36,0.6); }
  }
}

.hs-warship-equip-count {
  font-size: 0.52rem;
  opacity: 0.6;
  font-weight: 400;
}

// ── Active missions ────────────────────────────────────────────────────────────
.hs-dock-missions {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 0.35rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.hs-dock-mission-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.375rem 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-sm);
}

.hs-dock-mission-icon  { font-size: 0.9rem; flex-shrink: 0; padding-top: 1px; }
.hs-dock-mission-info  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-dock-mission-label { font-size: 0.72rem; font-weight: 600; }
.hs-dock-mission-cargo { display: flex; flex-wrap: wrap; gap: 3px; }

.hs-dock-cargo-tag {
  font-size: 0.62rem;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(52,211,153,0.1);
  color: #34d399;
  border: 1px solid rgba(52,211,153,0.2);
}

// ── Freighter cargo grid ──────────────────────────────────────────────────────
.hs-dock-fleet-item--selected {
  border-color: rgba(52,211,153,0.35);
  background: rgba(52,211,153,0.06);
  cursor: pointer;
}

.hs-dock-fleet-hint {
  font-size: 0.6rem;
  opacity: 0.4;
  flex-shrink: 0;
}

.hs-freighter-cargo-panel {
  background: var(--hs-glass-sm);
  border: 1px solid rgba(52,211,153,0.15);
  border-radius: var(--hs-r-md);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.25rem;
}

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

// ── Stepper control (shared) ──────────────────────────────────────────────────
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

  &--conv {
    border-color: rgba(139,92,246,0.3);
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

  .hs-stepper--conv & { width: 1.4rem; height: 1.4rem; font-size: 0.8rem; }
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

  .hs-stepper--conv & {
    font-size: 0.6rem;
    line-height: 1.4rem;
    color: rgba(167,139,250,0.9);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

// ── High-Tech conversion section ──────────────────────────────────────────────
.hs-conv-section {
  margin-top: 0.875rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--hs-line-sm);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hs-conv-section-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hs-conv-queue-row {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: var(--hs-r-md);
  border: 1px solid rgba(139,92,246,0.3);
  background: rgba(139,92,246,0.07);
  font-size: 0.65rem;
}

.hs-conv-queue-bar {
  position: absolute;
  bottom: 0; left: 0;
  height: 2px;
  background: rgba(139,92,246,0.6);
}

.hs-conv-queue-icon  { font-size: 0.875rem; }
.hs-conv-queue-name  { font-weight: 600; color: rgba(167,139,250,0.95); flex: 1; }
.hs-conv-queue-label { color: rgba(167,139,250,0.6); font-style: italic; }
.hs-conv-queue-time  {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: rgba(167,139,250,0.95);
  flex-shrink: 0;
}
.hs-conv-queue-remaining {
  font-size: 0.55rem;
  color: rgba(167,139,250,0.6);
  white-space: nowrap;
  flex-shrink: 0;
}

.hs-conv-list { display: flex; flex-direction: column; gap: 0.375rem; }

.hs-conv-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.5rem 0.6rem;
  transition: opacity 0.2s;

  &--locked { opacity: 0.4; }
}

.hs-conv-formula {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.hs-conv-res {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;

  &--ok  { background: var(--hs-ok-bg);          color: var(--hs-ok-muted); }
  &--no  { background: var(--hs-danger-bg-cost);  color: var(--hs-danger-muted); }
  &--out { background: rgba(139,92,246,0.12);     color: rgba(167,139,250,0.9); }
}

.hs-conv-arrow { font-size: 0.7rem; opacity: 0.4; }

.hs-conv-action {
  flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
}

.hs-conv-time {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.35);
  white-space: nowrap;
}


.hs-conv-locked {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.2);
  white-space: nowrap;
}

.hs-conv-empty {
  text-align: center;
  padding: 0.75rem;
  opacity: 0.25;
  font-size: 0.75rem;
  font-style: italic;
}

.hs-btn-convert {
  padding: 0.3rem 0.65rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid rgba(139,92,246,0.45);
  background: rgba(139,92,246,0.12);
  color: rgba(167,139,250,0.95);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: rgba(139,92,246,0.25);
    border-color: rgba(139,92,246,0.7);
  }

  &--disabled, &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}
</style>
