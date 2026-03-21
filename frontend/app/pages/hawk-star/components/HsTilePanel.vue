<script setup>
import { computed } from 'vue'
import { RESOURCES, BUILDINGS, CROP_DEFS, UNIT_COSTS } from '../hawkStarConfig.js'
import { useHawkStar } from '../useHawkStar.js'

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
  // crops
  cropInventory,
  cropQueue,
  cropGrowTime,
  canGrowCrop,
  startCropGrow,
  remainingCropSec,
  cropQueueProgressStyle,
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
} = useHawkStar()

const isAgricultureTile = computed(() => activeTileType.value?.id === 'agriculture')
const isSpacebaseTile   = computed(() => activeTileType.value?.id === 'spacebase')

// Only the one crop matching this planet's type, annotated with unlock status
const allCropDefs = computed(() =>
  Object.values(CROP_DEFS)
    .filter(crop => !crop.planetType || crop.planetType === planetType.value)
    .map(crop => {
      const bState   = playerBuildings.value[crop.requiresBuilding]
      const builtLvl = bState ? (bState.buildEndsAt ? bState.level + 1 : bState.level) : 0
      return { ...crop, unlocked: builtLvl >= crop.requiresLevel, builtLvl }
    })
)

const hasCropsInInventory = computed(() =>
  Object.values(cropInventory.value).some(n => n > 0)
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
            v-if="nextLevelDef(bDef.id) && !isBuildingInProgress(bDef.id) && (Object.keys(nextLevelDef(bDef.id).cost).length || staffDelta(bDef.id) > 0)"
            class="hs-cost-row"
          >
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

    <div v-if="buildingsForActiveSlot.length === 0" class="hs-empty">
      Select an unlocked tile to manage buildings
    </div>

    <!-- ── Space Unit production (Space Base tile only) ── -->
    <div v-if="isSpacebaseTile" class="hs-unit-section">
      <div class="hs-unit-section-title">🛸 Space Units</div>

      <!-- Recon Drone -->
      <div v-if="reconDroneLevel > 0" class="hs-unit-row">
        <div class="hs-unit-icon-wrap">
          <span class="hs-unit-icon">🛸</span>
          <span v-if="reconDroneInventory > 0" class="hs-unit-count-badge">{{ reconDroneInventory }}</span>
        </div>
        <div class="hs-unit-info">
          <div class="hs-unit-name">Recon Drone <span class="hs-unit-stock">× {{ reconDroneInventory }}</span></div>
          <div class="hs-unit-desc">Scout planets in your home system</div>
          <div class="hs-unit-cost-row">
            <span
              v-for="(amt, resId) in UNIT_COSTS.recon_drone.cost"
              :key="resId"
              class="hs-cost-tag"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
            <span class="hs-unit-time-tag">⏱ {{ formatTime(droneBuildTime) }}</span>
          </div>
          <!-- Build progress -->
          <div v-if="reconDroneBuild" class="hs-progress-row">
            <div class="hs-progress-track">
              <div
                :key="reconDroneBuild.endsAt"
                class="hs-progress-fill hs-progress-fill--unit"
                :style="droneBuildProgressStyle"
              />
            </div>
            <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((reconDroneBuild.endsAt - Date.now()) / 1000))) }}</span>
          </div>
        </div>
        <div class="hs-unit-action">
          <span v-if="reconDroneBuild" class="hs-status-building">Building…</span>
          <button
            v-else
            class="hs-btn-build"
            :class="{ 'hs-btn-build--disabled': !canBuildDrone }"
            :disabled="!canBuildDrone"
            @click.stop="buildReconDrone()"
          >Build</button>
        </div>
      </div>

      <!-- Galaxy Probe -->
      <div v-if="galaxyProbeLevel > 0" class="hs-unit-row">
        <div class="hs-unit-icon-wrap">
          <span class="hs-unit-icon">🔭</span>
          <span v-if="galaxyProbeInventory > 0" class="hs-unit-count-badge">{{ galaxyProbeInventory }}</span>
        </div>
        <div class="hs-unit-info">
          <div class="hs-unit-name">Galaxy Probe <span class="hs-unit-stock">× {{ galaxyProbeInventory }}</span></div>
          <div class="hs-unit-desc">Scout distant star systems</div>
          <div class="hs-unit-cost-row">
            <span
              v-for="(amt, resId) in UNIT_COSTS.galaxy_probe.cost"
              :key="resId"
              class="hs-cost-tag"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
            <span class="hs-unit-time-tag">⏱ {{ formatTime(probeBuildTime) }}</span>
          </div>
          <div v-if="galaxyProbeBuild" class="hs-progress-row">
            <div class="hs-progress-track">
              <div
                :key="galaxyProbeBuild.endsAt"
                class="hs-progress-fill hs-progress-fill--unit"
                :style="probeBuildProgressStyle"
              />
            </div>
            <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((galaxyProbeBuild.endsAt - Date.now()) / 1000))) }}</span>
          </div>
        </div>
        <div class="hs-unit-action">
          <span v-if="galaxyProbeBuild" class="hs-status-building">Building…</span>
          <button
            v-else
            class="hs-btn-build"
            :class="{ 'hs-btn-build--disabled': !canBuildProbe }"
            :disabled="!canBuildProbe"
            @click.stop="buildGalaxyProbe()"
          >Build</button>
        </div>
      </div>

      <!-- Colony Ship -->
      <div v-if="colonyShipLevel > 0" class="hs-unit-row">
        <div class="hs-unit-icon-wrap">
          <span class="hs-unit-icon">🚀</span>
          <span v-if="colonyShipInventory > 0" class="hs-unit-count-badge hs-unit-count-badge--colony">{{ colonyShipInventory }}</span>
        </div>
        <div class="hs-unit-info">
          <div class="hs-unit-name">Colony Ship <span class="hs-unit-stock">× {{ colonyShipInventory }}</span></div>
          <div class="hs-unit-desc">Colonize unoccupied planets</div>
          <div class="hs-unit-cost-row">
            <span
              v-for="(amt, resId) in UNIT_COSTS.colony_ship.cost"
              :key="resId"
              class="hs-cost-tag"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
            <span class="hs-unit-time-tag">⏱ {{ formatTime(colonyShipBuildTime) }}</span>
          </div>
          <div v-if="colonyShipBuild" class="hs-progress-row">
            <div class="hs-progress-track">
              <div
                :key="colonyShipBuild.endsAt"
                class="hs-progress-fill hs-progress-fill--colony"
                :style="colonyShipBuildProgressStyle"
              />
            </div>
            <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((colonyShipBuild.endsAt - Date.now()) / 1000))) }}</span>
          </div>
        </div>
        <div class="hs-unit-action">
          <span v-if="colonyShipBuild" class="hs-status-building">Building…</span>
          <button
            v-else
            class="hs-btn-build"
            :class="{ 'hs-btn-build--disabled': !canBuildColonyShip }"
            :disabled="!canBuildColonyShip"
            @click.stop="buildColonyShip()"
          >Build</button>
        </div>
      </div>

      <div v-if="reconDroneLevel === 0 && galaxyProbeLevel === 0 && colonyShipLevel === 0" class="hs-unit-locked">
        Build Space Base facilities to produce units
      </div>
    </div>

    <!-- ── Crop cultivation section (Agriculture tile only) ── -->
    <div v-if="isAgricultureTile" class="hs-crop-section">
      <div class="hs-crop-section-title">🌱 Crop Cultivation</div>

      <!-- Active grow queue -->
      <div v-if="cropQueue" class="hs-crop-queue-row">
        <div class="hs-crop-queue-bar" :style="cropQueueProgressStyle" />
        <span class="hs-crop-queue-icon">{{ CROP_DEFS[cropQueue.cropId]?.icon }}</span>
        <span class="hs-crop-queue-name">{{ CROP_DEFS[cropQueue.cropId]?.name }}</span>
        <span class="hs-crop-queue-label">Growing…</span>
        <span class="hs-crop-queue-time">{{ formatTime(remainingCropSec) }}</span>
      </div>

      <!-- Inventory -->
      <div v-if="hasCropsInInventory" class="hs-crop-inventory">
        <span
          v-for="(count, cropId) in cropInventory"
          :key="cropId"
          v-show="count > 0"
          class="hs-crop-inv-tag"
          :title="CROP_DEFS[cropId]?.description"
        >{{ CROP_DEFS[cropId]?.icon }} {{ CROP_DEFS[cropId]?.name }} ×{{ count }}</span>
      </div>

      <!-- Crop list -->
      <div class="hs-crop-list">
        <div
          v-for="crop in allCropDefs"
          :key="crop.id"
          class="hs-crop-row"
          :class="{ 'hs-crop-row--locked': !crop.unlocked }"
        >
          <span class="hs-crop-icon">{{ crop.icon }}</span>
          <div class="hs-crop-info">
            <span class="hs-crop-name">{{ crop.name }}</span>
            <span class="hs-crop-desc">{{ crop.description }}</span>
            <div class="hs-crop-cost-row">
              <span
                v-for="(amt, resId) in crop.cost"
                :key="resId"
                class="hs-cost-tag"
                :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
              >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
              <span class="hs-crop-time-tag">⏱ {{ formatTime(cropGrowTime(crop.id)) }}</span>
            </div>
          </div>
          <div class="hs-crop-action">
            <template v-if="!crop.unlocked">
              <span class="hs-crop-lock-hint">
                Build Farm first
              </span>
            </template>
            <template v-else>
              <button
                class="hs-btn-cultivate"
                :class="{ 'hs-btn-cultivate--disabled': !canGrowCrop(crop.id) }"
                :disabled="!canGrowCrop(crop.id)"
                @click="startCropGrow(crop.id)"
              >Cultivate</button>
            </template>
          </div>
        </div>
      </div>
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
  animation: hs-build-fill linear forwards;
}

@keyframes hs-build-fill {
  from { width: 0 }
  to   { width: 100% }
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

// ── Space Unit section ────────────────────────────────────────────────────────
.hs-unit-section {
  margin-top: 0.875rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--hs-line-sm);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hs-unit-section-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hs-unit-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.5rem 0.6rem;
}

.hs-unit-icon-wrap {
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

.hs-unit-icon { font-size: 1.1rem; }

.hs-unit-count-badge {
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

  &--colony {
    background: #60a5fa;
    color: #000;
  }
}

.hs-unit-info    { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-unit-name    { font-size: 0.825rem; font-weight: 600; }
.hs-unit-stock   { font-size: 0.7rem; opacity: 0.5; font-weight: 400; }
.hs-unit-desc    { font-size: 0.62rem; opacity: 0.45; }
.hs-unit-cost-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }

.hs-unit-time-tag {
  font-size: 0.6rem;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--hs-glass-lg);
  color: rgba(255,255,255,0.35);
}

.hs-unit-action { flex-shrink: 0; }

.hs-progress-fill--unit   { background: #f59e0b; }
.hs-progress-fill--colony { background: #60a5fa; }

.hs-unit-locked {
  text-align: center;
  padding: 0.75rem;
  opacity: 0.25;
  font-size: 0.75rem;
  font-style: italic;
}

// ── Crop cultivation section ──────────────────────────────────────────────────
.hs-crop-section {
  margin-top: 0.875rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--hs-line-sm);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hs-crop-section-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

// ── Active grow queue ─────────────────────────────────────────────────────────
.hs-crop-queue-row {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: var(--hs-r-md);
  border: 1px solid rgba(52,211,153,0.25);
  background: rgba(52,211,153,0.05);
  font-size: 0.65rem;
}

.hs-crop-queue-bar {
  position: absolute;
  bottom: 0; left: 0;
  height: 2px; width: 100%;
  background: rgba(52,211,153,0.5);
  transform-origin: left;
  animation: hs-crop-fill linear forwards;
}

@keyframes hs-crop-fill {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.hs-crop-queue-icon  { font-size: 0.875rem; }
.hs-crop-queue-name  { font-weight: 600; color: rgba(52,211,153,0.9); flex: 1; }
.hs-crop-queue-label { color: rgba(52,211,153,0.6); font-style: italic; }
.hs-crop-queue-time  {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: rgba(52,211,153,0.9);
  flex-shrink: 0;
}

// ── Inventory tags ────────────────────────────────────────────────────────────
.hs-crop-inventory {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.hs-crop-inv-tag {
  font-size: 0.62rem;
  padding: 2px 8px;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(52,211,153,0.3);
  background: rgba(52,211,153,0.07);
  color: rgba(52,211,153,0.85);
  cursor: default;
}

// ── Crop list rows ────────────────────────────────────────────────────────────
.hs-crop-list { display: flex; flex-direction: column; gap: 0.375rem; }

.hs-crop-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.5rem 0.6rem;
  transition: opacity 0.2s;

  &--locked { opacity: 0.45; }
}

.hs-crop-icon { font-size: 1.1rem; flex-shrink: 0; }

.hs-crop-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-crop-name   { font-size: 0.8rem; font-weight: 600; }
.hs-crop-desc   { font-size: 0.62rem; opacity: 0.45; }

.hs-crop-cost-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }

.hs-crop-time-tag {
  font-size: 0.6rem;
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--hs-glass-lg);
  color: rgba(255,255,255,0.35);
}

.hs-crop-action { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }

.hs-crop-lock-hint {
  font-size: 0.58rem;
  color: rgba(255,255,255,0.2);
  font-style: italic;
  white-space: nowrap;
}

.hs-btn-cultivate {
  padding: 0.3rem 0.65rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid rgba(52,211,153,0.4);
  background: rgba(52,211,153,0.1);
  color: rgba(52,211,153,0.9);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: rgba(52,211,153,0.2);
    border-color: rgba(52,211,153,0.65);
  }

  &--disabled, &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
</style>
