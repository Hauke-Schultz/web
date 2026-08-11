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
  canBuildDrone,
  buildReconDrone,
  reconDroneBuild,
  reconDroneInventory,
  droneBuildTime,
  droneBuildProgressStyle,
  canBuildColonyShip,
  colonyShipCrew,
  hasColonyCrew,
  buildColonyShip,
  colonyShipBuild,
  colonyShipInventory,
  colonyShipBuildTime,
  colonyShipBuildProgressStyle,
  // cargo drone — shares the drone hangar with the recon drone
  cargoDroneLevel,
  canBuildCargoDrone,
  buildCargoDrone,
  cargoDroneBuild,
  cargoDroneInventory,
  cargoDroneReady,
  hasCargoDrone,
  cargoLoaded,
  cargoCapacity,
  cargoBuildTime,
  cargoBuildProgressStyle,
  activeCargoMissions,
  remainingCargoSec,
  cargoProgressStyle,
  returningCargoMission,
  remainingCargoReturnSec,
  cargoReturnProgressStyle,
} = useHawkStar()

const { t } = useI18n()

const getPlanetLabel = (planetId) => {
  const p = homeSystem.value?.planets.find(pl => pl.id === planetId)
  return p?.name ?? getPlanetName(planetId) ?? planetId
}

const hasMissions = computed(() =>
  activeDroneMissions.value.length ||
  activeColonyMissions.value.length ||
  activeCargoMissions.value.length ||
  !!returningCargoMission.value
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
        <div class="hs-building-ident">
          <div class="hs-building-icon-wrap">
            <span class="hs-building-icon">🛸</span>
            <span v-if="reconDroneInventory > 0" class="hs-building-badge">{{ reconDroneInventory }}</span>
          </div>
          <div class="hs-building-info">
            <div class="hs-building-name">{{ t('hawkStar.dock.reconDrone') }}</div>
            <div class="hs-building-desc">{{ t('hawkStar.dock.reconDroneDesc') }}</div>
          </div>
        </div>

        <div class="hs-building-action">
          <span v-if="reconDroneLevel === 0" class="hs-status-locked">{{ t('hawkStar.tile.lockedGeneric') }}</span>
          <template v-else-if="reconDroneBuild">
            <span class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
            <div class="hs-progress-row">
              <div class="hs-progress-track">
                <div class="hs-progress-fill hs-progress-fill--unit" :style="droneBuildProgressStyle" />
              </div>
              <span class="hs-progress-time">{{ formatTime(Math.ceil((reconDroneBuild.endsAt - Date.now()) / 1000)) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="hs-cost-row">
              <span
                v-for="(amt, resId) in UNIT_COSTS.recon_drone.cost"
                :key="resId"
                class="hs-cost-tag"
                :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
              >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
            </div>
            <button
              class="hs-btn-build"
              :class="{ 'hs-btn-build--disabled': !canBuildDrone }"
              :disabled="!canBuildDrone"
              @click="buildReconDrone"
            >{{ t('hawkStar.tile.btnBuild') }}</button>
            <div class="hs-building-meta"><span class="hs-build-time">⏱ {{ formatTime(droneBuildTime) }}</span></div>
          </template>
        </div>
      </div>

      <!-- Cargo Drone — same facility as the recon drone, but limited to one per
           planet in existence, so there is no build button once one is around. -->
      <div class="hs-building-row">
        <div class="hs-building-ident">
          <div class="hs-building-icon-wrap">
            <span class="hs-building-icon">📦</span>
            <span v-if="cargoDroneInventory > 0" class="hs-building-badge hs-building-badge--cargo">{{ cargoDroneInventory }}</span>
          </div>
          <div class="hs-building-info">
            <div class="hs-building-name">{{ t('hawkStar.dock.cargoDrone') }}</div>
            <div class="hs-building-desc">{{ t('hawkStar.dock.cargoDroneDesc') }}</div>
          </div>
        </div>

        <div class="hs-building-action">
          <span v-if="cargoDroneLevel === 0" class="hs-status-locked">{{ t('hawkStar.tile.lockedGeneric') }}</span>
          <template v-else-if="cargoDroneBuild">
            <span class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
            <div class="hs-progress-row">
              <div class="hs-progress-track">
                <div class="hs-progress-fill hs-progress-fill--cargo" :style="cargoBuildProgressStyle" />
              </div>
              <span class="hs-progress-time">{{ formatTime(Math.ceil((cargoDroneBuild.endsAt - Date.now()) / 1000)) }}</span>
            </div>
          </template>
          <!-- One drone per planet: an existing one is a status, never a build offer -->
          <template v-else-if="hasCargoDrone">
            <span class="hs-status-ready">{{ t('hawkStar.dock.unitReady') }}</span>
            <div v-if="cargoDroneReady" class="hs-cargo-hold">
              {{ t('hawkStar.solar.cargoHold') }} {{ cargoLoaded }} / {{ cargoCapacity }} ·
              {{ t('hawkStar.dock.launchFromSystemMap') }}
            </div>
            <div v-else class="hs-cargo-hold">{{ t('hawkStar.solar.cargoOnePerPlanet') }}</div>
          </template>
          <template v-else>
            <div class="hs-cost-row">
              <span
                v-for="(amt, resId) in UNIT_COSTS.cargo_drone.cost"
                :key="resId"
                class="hs-cost-tag"
                :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
              >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
            </div>
            <button
              class="hs-btn-build"
              :class="{ 'hs-btn-build--disabled': !canBuildCargoDrone }"
              :disabled="!canBuildCargoDrone"
              @click="buildCargoDrone"
            >{{ t('hawkStar.tile.btnBuild') }}</button>
            <div class="hs-building-meta"><span class="hs-build-time">⏱ {{ formatTime(cargoBuildTime) }}</span></div>
          </template>
        </div>
      </div>

      <!-- Colony Ship -->
      <div class="hs-building-row">
        <div class="hs-building-ident">
          <div class="hs-building-icon-wrap">
            <span class="hs-building-icon">🚀</span>
            <span v-if="colonyShipInventory > 0" class="hs-building-badge hs-building-badge--colony">{{ colonyShipInventory }}</span>
          </div>
          <div class="hs-building-info">
            <div class="hs-building-name">{{ t('hawkStar.dock.colonyShip') }}</div>
            <div class="hs-building-desc">{{ t('hawkStar.dock.colonyShipDesc') }}</div>
          </div>
        </div>

        <div class="hs-building-action">
          <span v-if="colonyShipLevel === 0" class="hs-status-locked">{{ t('hawkStar.tile.lockedGeneric') }}</span>
          <template v-else-if="colonyShipBuild">
            <span class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
            <div class="hs-progress-row">
              <div class="hs-progress-track">
                <div class="hs-progress-fill hs-progress-fill--colony" :style="colonyShipBuildProgressStyle" />
              </div>
              <span class="hs-progress-time">{{ formatTime(Math.ceil((colonyShipBuild.endsAt - Date.now()) / 1000)) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="hs-cost-row">
              <span
                v-for="(amt, resId) in UNIT_COSTS.colony_ship.cost"
                :key="resId"
                class="hs-cost-tag"
                :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
              >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
              <span
                class="hs-cost-tag"
                :class="hasColonyCrew ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
                :title="t('hawkStar.dock.crewHint', { crew: colonyShipCrew })"
              >👥 {{ colonyShipCrew }}</span>
            </div>
            <button
              class="hs-btn-build"
              :class="{ 'hs-btn-build--disabled': !canBuildColonyShip }"
              :disabled="!canBuildColonyShip"
              @click="buildColonyShip"
            >{{ t('hawkStar.tile.btnBuild') }}</button>
            <div class="hs-building-meta"><span class="hs-build-time">⏱ {{ formatTime(colonyShipBuildTime) }}</span></div>
            <div v-if="!hasColonyCrew" class="hs-crew-warning">{{ t('hawkStar.dock.noCrew') }}</div>
          </template>
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
      <!-- Outbound delivery -->
      <div v-for="m in activeCargoMissions" :key="`cargo-${m.planetId}`" class="hs-dock-mission-row">
        <span class="hs-dock-mission-icon">📦</span>
        <div class="hs-dock-mission-info">
          <span class="hs-dock-mission-label">Cargo → {{ getPlanetLabel(m.planetId) }}</span>
          <div class="hs-progress-row">
            <div class="hs-progress-track">
              <div class="hs-progress-fill hs-progress-fill--cargo" :key="m.endsAt" :style="cargoProgressStyle(m.planetId)" />
            </div>
            <span class="hs-progress-time">{{ formatTime(remainingCargoSec(m.planetId)) }}</span>
          </div>
        </div>
      </div>
      <!-- Empty return flight -->
      <div v-if="returningCargoMission" class="hs-dock-mission-row">
        <span class="hs-dock-mission-icon">📦</span>
        <div class="hs-dock-mission-info">
          <span class="hs-dock-mission-label">Cargo ← {{ getPlanetLabel(returningCargoMission.planetId) }}</span>
          <div class="hs-progress-row">
            <div class="hs-progress-track">
              <div class="hs-progress-fill hs-progress-fill--cargo" :key="returningCargoMission.endsAt" :style="cargoReturnProgressStyle" />
            </div>
            <span class="hs-progress-time">{{ formatTime(remainingCargoReturnSec) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty missions hint -->
    <p v-else-if="reconDroneLevel > 0 || colonyShipLevel > 0 || cargoDroneLevel > 0" class="hs-dock-hint">
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

// Same two-column split as the building rows in HsTilePanel: left is what the
// unit is, right is what it costs and how long it takes.
.hs-building-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.6rem;
  transition: background 0.3s, border-color 0.3s;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: stretch;
    gap: 0.75rem;
    padding: 0.75rem;
  }
}

.hs-building-ident {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;

  @media (min-width: 640px) { gap: 0.75rem; }
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

.hs-building-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 1rem;
  height: 1rem;
  padding: 0 3px;
  border-radius: 9999px;
  background: #f59e0b;
  color: #000;
  font-size: 0.55rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;

  &--colony { background: #60a5fa; }
  &--cargo  { background: #fbbf24; }
}
.hs-building-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-building-name   { font-size: 0.825rem; font-weight: 600; display: flex; align-items: baseline; gap: 0.35rem; flex-wrap: wrap; }
.hs-building-desc   { font-size: 0.68rem; opacity: 0.45; line-height: 1.35; }

.hs-building-action {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: stretch;

  @media (min-width: 640px) {
    width: 12.5rem;
    align-items: flex-end;
    padding-left: 0.75rem;
    border-left: 1px solid var(--hs-line-sm);
  }
}

.hs-building-meta {
  font-size: 0.62rem;
  line-height: 1.4;
  opacity: 0.55;

  @media (min-width: 640px) { text-align: right; }
}

.hs-cost-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;

  @media (min-width: 640px) { justify-content: flex-end; }
}

.hs-crew-warning {
  font-size: 0.62rem;
  color: var(--hs-danger-muted);

  @media (min-width: 640px) { text-align: right; }
}

.hs-cost-tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;
  &--ok { background: var(--hs-ok-bg);          color: var(--hs-ok-muted); }
  &--no { background: var(--hs-danger-bg-cost);  color: var(--hs-danger-muted); }
}

.hs-status-locked   { font-size: 0.62rem; font-weight: 600; color: rgba(255,255,255,0.25); white-space: nowrap; text-align: right; }
.hs-status-ready    { font-size: 0.68rem; font-weight: 700; color: rgba(251,191,36,0.9);  white-space: nowrap; text-align: right; }
.hs-status-building { font-size: 0.7rem;  font-weight: 600; color: var(--hs-warn);        white-space: nowrap; }

.hs-cargo-hold {
  font-size: 0.62rem;
  color: rgba(251,191,36,0.6);
  line-height: 1.4;

  @media (min-width: 640px) { text-align: right; }
}

.hs-btn-build {
  width: 100%;
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

.hs-build-time {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.hs-progress-row   { display: flex; align-items: center; gap: 0.5rem; margin-top: 6px; }

// In the action column the bar is its own row, so the mission-row spacing does not apply
.hs-building-action .hs-progress-row { width: 100%; margin-top: 0; }

.hs-progress-track { flex: 1; height: 4px; background: var(--hs-glass-3xl); border-radius: 9999px; overflow: hidden; }
.hs-progress-fill  { height: 100%; border-radius: 9999px; }
.hs-progress-time  { font-size: 0.65rem; color: var(--hs-warn-text); font-variant-numeric: tabular-nums; width: 3.5rem; text-align: right; flex-shrink: 0; }

.hs-progress-fill--unit   { background: #f59e0b; }
.hs-progress-fill--colony { background: #60a5fa; }
.hs-progress-fill--cargo  { background: #fbbf24; }

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
