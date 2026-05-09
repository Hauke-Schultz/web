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
  // colony ships
  colonyShipLevel,
  colonyShipInventory,
  colonyShipBuild,
  colonyShipBuildTime,
  canBuildColonyShip,
  buildColonyShip,
  colonyShipBuildProgressStyle,
  getPlanetName,
  homeSystem,
  // active missions
  activeDroneMissions,
  remainingDroneSec,
  droneProgressStyle,
  activeColonyMissions,
  remainingColonySec,
  colonyProgressStyle,
} = useHawkStar()

const { t } = useI18n()

const getPlanetLabel = (planetId) => {
  const p = homeSystem.value?.planets.find(pl => pl.id === planetId)
  return p?.name ?? getPlanetName(planetId) ?? planetId
}

const hasMissions = computed(() =>
  activeDroneMissions.value.length ||
  activeColonyMissions.value.length
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

</style>
