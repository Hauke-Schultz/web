<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES, UNIT_COSTS } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const {
  playerResources,
  formatTime,
  reconDroneLevel,
  colonyShipLevel,
  getPlanetName,
  homeSystem,
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

const canAffordDrone  = computed(() =>
  Object.entries(UNIT_COSTS.recon_drone.cost).every(([r, a]) => (playerResources.value[r] ?? 0) >= a)
)
const canAffordColony = computed(() =>
  Object.entries(UNIT_COSTS.colony_ship.cost).every(([r, a]) => (playerResources.value[r] ?? 0) >= a)
)

const hasMissions = computed(() =>
  activeDroneMissions.value.length || activeColonyMissions.value.length
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

    <!-- Unit status list -->
    <div class="hs-building-list">

      <!-- Recon Drone -->
      <div class="hs-building-row">
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">🛸</span>
        </div>
        <div class="hs-building-info">
          <div class="hs-building-name">{{ t('hawkStar.dock.reconDrone') }}</div>
          <div class="hs-building-effect">{{ t('hawkStar.dock.reconDroneDesc') }}</div>
          <div v-if="reconDroneLevel > 0" class="hs-cost-row">
            <span
              v-for="(amt, resId) in UNIT_COSTS.recon_drone.cost"
              :key="resId"
              class="hs-cost-tag"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>
        </div>
        <div class="hs-building-action">
          <span v-if="reconDroneLevel === 0" class="hs-status-locked">{{ t('hawkStar.tile.lockedGeneric') }}</span>
          <span v-else-if="!canAffordDrone" class="hs-status-low">{{ t('hawkStar.dock.insufficientResources') }}</span>
          <span v-else class="hs-status-ready">{{ t('hawkStar.dock.unitReady') }}</span>
        </div>
      </div>

      <!-- Colony Ship -->
      <div class="hs-building-row">
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">🚀</span>
        </div>
        <div class="hs-building-info">
          <div class="hs-building-name">{{ t('hawkStar.dock.colonyShip') }}</div>
          <div class="hs-building-effect">{{ t('hawkStar.dock.colonyShipDesc') }}</div>
          <div v-if="colonyShipLevel > 0" class="hs-cost-row">
            <span
              v-for="(amt, resId) in UNIT_COSTS.colony_ship.cost"
              :key="resId"
              class="hs-cost-tag"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>
        </div>
        <div class="hs-building-action">
          <span v-if="colonyShipLevel === 0" class="hs-status-locked">{{ t('hawkStar.tile.lockedGeneric') }}</span>
          <span v-else-if="!canAffordColony" class="hs-status-low">{{ t('hawkStar.dock.insufficientResources') }}</span>
          <span v-else class="hs-status-ready">{{ t('hawkStar.dock.unitReady') }}</span>
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
            <div class="hs-progress-track">
              <div class="hs-progress-fill hs-progress-fill--unit" :key="m.endsAt" :style="droneProgressStyle(m.planetId)" />
            </div>
            <span class="hs-progress-time">{{ formatTime(remainingDroneSec(m.planetId)) }}</span>
          </div>
        </div>
      </div>
      <div v-for="m in activeColonyMissions" :key="m.planetId" class="hs-dock-mission-row">
        <span class="hs-dock-mission-icon">🚀</span>
        <div class="hs-dock-mission-info">
          <span class="hs-dock-mission-label">Colonize → {{ getPlanetLabel(m.planetId) }}</span>
          <div class="hs-progress-row">
            <div class="hs-progress-track">
              <div class="hs-progress-fill hs-progress-fill--colony" :key="m.endsAt" :style="colonyProgressStyle(m.planetId)" />
            </div>
            <span class="hs-progress-time">{{ formatTime(remainingColonySec(m.planetId)) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty missions hint -->
    <p v-else-if="reconDroneLevel > 0 || colonyShipLevel > 0" class="hs-dock-hint">
      {{ t('hawkStar.dock.launchFromSystemMap') }}
    </p>

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

.hs-building-icon   { font-size: 1.1rem; }
.hs-building-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-building-name   { font-size: 0.825rem; font-weight: 600; display: flex; align-items: baseline; gap: 0.35rem; flex-wrap: wrap; }
.hs-building-effect { font-size: 0.68rem; opacity: 0.5; }
.hs-building-action { flex-shrink: 0; }

.hs-cost-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }

.hs-cost-tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;
  &--ok { background: var(--hs-ok-bg);          color: var(--hs-ok-muted); }
  &--no { background: var(--hs-danger-bg-cost);  color: var(--hs-danger-muted); }
}

.hs-status-locked { font-size: 0.62rem; font-weight: 600; color: rgba(255,255,255,0.25); white-space: nowrap; text-align: right; }
.hs-status-ready  { font-size: 0.65rem; font-weight: 700; color: #34d399; white-space: nowrap; }
.hs-status-low    { font-size: 0.62rem; font-weight: 600; color: #f87171; white-space: nowrap; text-align: right; }

.hs-progress-row   { display: flex; align-items: center; gap: 0.5rem; margin-top: 6px; }
.hs-progress-track { flex: 1; height: 4px; background: var(--hs-glass-3xl); border-radius: 9999px; overflow: hidden; }
.hs-progress-fill  { height: 100%; border-radius: 9999px; }
.hs-progress-time  { font-size: 0.65rem; color: var(--hs-warn-text); font-variant-numeric: tabular-nums; width: 3.5rem; text-align: right; flex-shrink: 0; }

.hs-progress-fill--unit   { background: #f59e0b; }
.hs-progress-fill--colony { background: #60a5fa; }

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

.hs-dock-hint {
  font-size: 0.65rem;
  opacity: 0.3;
  margin: 0.25rem 0 0;
  text-align: center;
}
</style>
