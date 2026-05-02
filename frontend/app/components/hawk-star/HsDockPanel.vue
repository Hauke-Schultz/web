<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES, UNIT_COSTS } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const {
  playerResources,
  formatTime,
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
  // freighters
  freighterBayLevel,
  freighter,
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
  // active missions
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

const { t } = useI18n()

// ── Freighter cargo ───────────────────────────────────────────────────────────
const CARGO_EXCLUDED = ['population', 'energy']

const freighterCargoRef = ref({})

const loadableResources = computed(() =>
  Object.values(RESOURCES).filter(r =>
    !CARGO_EXCLUDED.includes(r.id) && (playerResources.value[r.id] ?? 0) > 0
  )
)

const freighterCargoTotal = computed(() =>
  Object.values(freighterCargoRef.value).reduce((s, v) => s + (Number(v) || 0), 0)
)

const cargoMax  = (resId) => Math.min(Math.floor(playerResources.value[resId] ?? 0), freighterCargoCapacity.value)
const cargoStep = (resId) => cargoMax(resId) >= 20 ? 10 : 1
const stepCargo = (resId, delta) => {
  const cur       = freighterCargoRef.value[resId] ?? 0
  const remaining = freighterCargoCapacity.value - freighterCargoTotal.value
  const step      = delta > 0 ? Math.min(cargoStep(resId), remaining) : cargoStep(resId)
  freighterCargoRef.value[resId] = Math.min(Math.max(0, cur + delta * step), cargoMax(resId))
}

const getPlanetLabel = (planetId) => {
  const p = homeSystem.value?.planets.find(pl => pl.id === planetId)
  return p?.name ?? getPlanetName(planetId) ?? planetId
}

const hasMissions = computed(() =>
  activeDroneMissions.value.length ||
  activeGalaxyProbes.value.length ||
  activeColonyMissions.value.length ||
  activeFreighterMissions.value.length
)
</script>

<template>
  <div class="hs-panel">

    <!-- Header -->
    <div class="hs-panel-header">
      <span class="hs-panel-icon">🛸</span>
      <h2 class="hs-panel-title">{{ t('hawkStar.tiles.dock.name') }}</h2>
      <span class="hs-panel-desc">{{ t('hawkStar.tiles.dock.desc') }}</span>
    </div>

    <!-- Ship build list -->
    <div class="hs-building-list">

      <!-- Recon Drone -->
      <div class="hs-building-row">
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">🛸</span>
          <span v-if="reconDroneInventory > 0" class="hs-level-badge">{{ reconDroneInventory }}</span>
        </div>
        <div class="hs-building-info">
          <div class="hs-building-name">{{ t('hawkStar.dock.reconDrone') }}</div>
          <div class="hs-building-effect">{{ t('hawkStar.dock.reconDroneDesc') }}</div>
          <div v-if="reconDroneLevel > 0 && !reconDroneBuild" class="hs-cost-row">
            <span v-for="(amt, resId) in UNIT_COSTS.recon_drone.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>
          <div v-if="reconDroneBuild" class="hs-progress-row">
            <div class="hs-progress-track"><div :key="reconDroneBuild.endsAt" class="hs-progress-fill hs-progress-fill--unit" :style="droneBuildProgressStyle" /></div>
            <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((reconDroneBuild.endsAt - Date.now()) / 1000))) }}</span>
          </div>
        </div>
        <div class="hs-building-action">
          <span v-if="reconDroneBuild" class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
          <span v-else-if="reconDroneLevel === 0" class="hs-status-locked">{{ t('hawkStar.tile.lockedGeneric') }}</span>
          <div v-else class="hs-btn-wrap">
            <button class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildDrone }" :disabled="!canBuildDrone" @click.stop="buildReconDrone()">{{ t('hawkStar.dock.btnBuild') }}</button>
            <span class="hs-build-time">⏱ {{ formatTime(droneBuildTime) }}</span>
          </div>
        </div>
      </div>

      <!-- Galaxy Probe -->
      <div class="hs-building-row">
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">🔭</span>
          <span v-if="galaxyProbeInventory > 0" class="hs-level-badge">{{ galaxyProbeInventory }}</span>
        </div>
        <div class="hs-building-info">
          <div class="hs-building-name">{{ t('hawkStar.dock.galaxyProbe') }}</div>
          <div class="hs-building-effect">{{ t('hawkStar.dock.galaxyProbeDesc') }}</div>
          <div v-if="galaxyProbeLevel > 0 && !galaxyProbeBuild" class="hs-cost-row">
            <span v-for="(amt, resId) in UNIT_COSTS.galaxy_probe.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>
          <div v-if="galaxyProbeBuild" class="hs-progress-row">
            <div class="hs-progress-track"><div :key="galaxyProbeBuild.endsAt" class="hs-progress-fill hs-progress-fill--unit" :style="probeBuildProgressStyle" /></div>
            <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((galaxyProbeBuild.endsAt - Date.now()) / 1000))) }}</span>
          </div>
        </div>
        <div class="hs-building-action">
          <span v-if="galaxyProbeBuild" class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
          <span v-else-if="galaxyProbeLevel === 0" class="hs-status-locked">{{ t('hawkStar.tile.lockedGeneric') }}</span>
          <div v-else class="hs-btn-wrap">
            <button class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildProbe }" :disabled="!canBuildProbe" @click.stop="buildGalaxyProbe()">{{ t('hawkStar.dock.btnBuild') }}</button>
            <span class="hs-build-time">⏱ {{ formatTime(probeBuildTime) }}</span>
          </div>
        </div>
      </div>

      <!-- Colony Ship -->
      <div class="hs-building-row">
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">🚀</span>
          <span v-if="colonyShipInventory > 0" class="hs-level-badge hs-level-badge--colony">{{ colonyShipInventory }}</span>
        </div>
        <div class="hs-building-info">
          <div class="hs-building-name">{{ t('hawkStar.dock.colonyShip') }}</div>
          <div class="hs-building-effect">{{ t('hawkStar.dock.colonyShipDesc') }}</div>
          <div v-if="colonyShipLevel > 0 && !colonyShipBuild" class="hs-cost-row">
            <span v-for="(amt, resId) in UNIT_COSTS.colony_ship.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>
          <div v-if="colonyShipBuild" class="hs-progress-row">
            <div class="hs-progress-track"><div :key="colonyShipBuild.endsAt" class="hs-progress-fill hs-progress-fill--colony" :style="colonyShipBuildProgressStyle" /></div>
            <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((colonyShipBuild.endsAt - Date.now()) / 1000))) }}</span>
          </div>
        </div>
        <div class="hs-building-action">
          <span v-if="colonyShipBuild" class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
          <span v-else-if="colonyShipLevel === 0" class="hs-status-locked">{{ t('hawkStar.tile.lockedGeneric') }}</span>
          <div v-else class="hs-btn-wrap">
            <button class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildColonyShip }" :disabled="!canBuildColonyShip" @click.stop="buildColonyShip()">{{ t('hawkStar.dock.btnBuild') }}</button>
            <span class="hs-build-time">⏱ {{ formatTime(colonyShipBuildTime) }}</span>
          </div>
        </div>
      </div>

      <!-- Freighter -->
      <div class="hs-building-row">
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">🚢</span>
          <span v-if="freighter" class="hs-level-badge hs-level-badge--freighter">1</span>
        </div>
        <div class="hs-building-info">
          <div class="hs-building-name">{{ t('hawkStar.dock.freighter') }}</div>
          <div class="hs-building-effect">{{ t('hawkStar.dock.freighterDesc', { capacity: freighterCargoCapacity }) }}</div>
          <div v-if="freighterBayLevel > 0 && !freighterBuild" class="hs-cost-row">
            <span v-for="(amt, resId) in UNIT_COSTS.freighter.cost" :key="resId" class="hs-cost-tag" :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'">{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>
          <div v-if="freighterBuild" class="hs-progress-row">
            <div class="hs-progress-track"><div :key="freighterBuild.endsAt" class="hs-progress-fill hs-progress-fill--freighter" :style="freighterBuildProgressStyle" /></div>
            <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((freighterBuild.endsAt - Date.now()) / 1000))) }}</span>
          </div>
        </div>
        <div class="hs-building-action">
          <span v-if="freighterBuild" class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
          <span v-else-if="freighterBayLevel === 0" class="hs-status-locked">{{ t('hawkStar.tile.lockedGeneric') }}</span>
          <div v-else class="hs-btn-wrap">
            <button class="hs-btn-build" :class="{ 'hs-btn-build--disabled': !canBuildFreighter }" :disabled="!canBuildFreighter" @click.stop="buildFreighter()">{{ t('hawkStar.dock.btnBuild') }}</button>
            <span class="hs-build-time">⏱ {{ formatTime(freighterBuildTime) }}</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Active missions -->
    <div v-if="hasMissions" class="hs-dock-missions">
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
          <span class="hs-dock-mission-label">
            {{ m.phase === 'returning' ? '← ' + getPlanetLabel(m.toPlanetId) : getPlanetLabel(m.fromPlanetId) + ' → ' + getPlanetLabel(m.toPlanetId) }}
          </span>
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

    <!-- Freighter cargo -->
    <div v-if="freighter" class="hs-freighter-cargo-panel">
      <div class="hs-freighter-cargo-header">
        <span class="hs-freighter-cargo-title">🚢 {{ t('hawkStar.dock.loadFreighter') }}</span>
        <span class="hs-freighter-cargo-cap" :class="freighterCargoTotal > freighterCargoCapacity ? 'hs-freighter-cargo-cap--over' : ''">{{ freighterCargoTotal }} / {{ freighterCargoCapacity }}</span>
      </div>
      <div v-if="loadableResources.length === 0" class="hs-freighter-cargo-empty">{{ t('hawkStar.dock.noResources') }}</div>
      <div class="hs-freighter-cargo-grid">
        <div v-for="res in loadableResources" :key="res.id" class="hs-freighter-cargo-tile" :class="{ 'hs-freighter-cargo-tile--loaded': (freighterCargoRef[res.id] ?? 0) > 0 }">
          <span class="hs-freighter-cargo-tile__icon">{{ res.icon }}</span>
          <div class="hs-freighter-cargo-tile__info">
            <span class="hs-freighter-cargo-tile__name">{{ res.name }}</span>
            <span class="hs-freighter-cargo-tile__avail">{{ Math.floor(playerResources[res.id] ?? 0) }}</span>
          </div>
          <div class="hs-stepper hs-stepper--cargo">
            <button class="hs-stepper__btn" :disabled="(freighterCargoRef[res.id] ?? 0) <= 0" @click.stop="stepCargo(res.id, -1)">−</button>
            <span class="hs-stepper__val">{{ freighterCargoRef[res.id] ?? 0 }}</span>
            <button class="hs-stepper__btn" :disabled="(freighterCargoRef[res.id] ?? 0) >= cargoMax(res.id) || freighterCargoTotal >= freighterCargoCapacity" @click.stop="stepCargo(res.id, 1)">+</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>


<style lang="scss" scoped>
// ── Panel wrapper (matches HsTilePanel .hs-panel) ─────────────────────────────
.hs-panel {
  flex: 1;
  min-width: 0;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hs-panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--hs-line-sm);
}

.hs-panel-icon  { font-size: 1.25rem; }
.hs-panel-title { font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0; flex: 1; }
.hs-panel-desc  { font-size: 0.65rem; opacity: 0.4; }

// ── Building list (matches HsTilePanel) ───────────────────────────────────────
.hs-building-list { display: flex; flex-direction: column; gap: 0.5rem; }

.hs-building-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.6rem;
  transition: background 0.3s, border-color 0.3s;

  @media (min-width: 640px) { gap: 0.75rem; padding: 0.75rem; }
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
  background: #f59e0b;
  color: #000;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.4;

  &--colony   { background: #60a5fa; }

  &--freighter { background: #34d399; }
}

.hs-building-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-building-name   {
  font-size: 0.825rem;
  font-weight: 600;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  flex-wrap: wrap;
}
.hs-building-effect { font-size: 0.68rem; opacity: 0.5; }
.hs-building-action { flex-shrink: 0; }

.hs-cost-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }

.hs-btn-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.hs-build-time { font-size: 0.6rem; color: rgba(255,255,255,0.4); white-space: nowrap; }

// ── Shared utilities ──────────────────────────────────────────────────────────
.hs-cost-tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;
  &--ok { background: var(--hs-ok-bg);          color: var(--hs-ok-muted); }
  &--no { background: var(--hs-danger-bg-cost);  color: var(--hs-danger-muted); }
}

.hs-progress-row   { display: flex; align-items: center; gap: 0.5rem; margin-top: 6px; }
.hs-progress-track { flex: 1; height: 4px; background: var(--hs-glass-3xl); border-radius: 9999px; overflow: hidden; }
.hs-progress-fill  { height: 100%; border-radius: 9999px; background: var(--hs-warn); }
.hs-progress-time  { font-size: 0.65rem; color: var(--hs-warn-text); font-variant-numeric: tabular-nums; width: 3.5rem; text-align: right; flex-shrink: 0; }

.hs-progress-fill--unit      { background: #f59e0b; }
.hs-progress-fill--colony    { background: #60a5fa; }

.hs-progress-fill--freighter { background: #34d399; }

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
  &--disabled { background: var(--hs-glass-xl); color: rgba(255,255,255,0.3); cursor: not-allowed; }
}

.hs-status-building { font-size: 0.7rem; font-weight: 600; color: var(--hs-warn); white-space: nowrap; }
.hs-status-locked   { font-size: 0.62rem; font-weight: 600; color: rgba(255,255,255,0.25); white-space: nowrap; text-align: right; }

// ── Active missions ───────────────────────────────────────────────────────────
.hs-dock-missions {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 0.35rem;
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

// ── Freighter cargo ───────────────────────────────────────────────────────────
.hs-freighter-cargo-panel {
  background: var(--hs-glass-sm);
  border: 1px solid rgba(52,211,153,0.15);
  border-radius: var(--hs-r-md);
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-freighter-cargo-header { display: flex; align-items: center; justify-content: space-between; }
.hs-freighter-cargo-title  { font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.7); }
.hs-freighter-cargo-cap    { font-size: 0.65rem; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.35); &--over { color: var(--hs-danger); } }

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

  &--loaded { border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.07); }
}

.hs-freighter-cargo-tile__icon  { font-size: 1.05rem; line-height: 1; }
.hs-freighter-cargo-tile__info  { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.hs-freighter-cargo-tile__name  { font-size: 0.52rem; opacity: 0.45; text-transform: capitalize; line-height: 1; text-align: center; }
.hs-freighter-cargo-tile__avail { font-size: 0.68rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }

// ── Stepper ───────────────────────────────────────────────────────────────────
.hs-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--hs-line-sm);
  border-radius: 6px;
  overflow: hidden;

  &--cargo { width: 100%; margin-top: 2px; border-color: rgba(52,211,153,0.25); }
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
</style>
