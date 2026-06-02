<script setup>
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES, BUILDINGS } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { useHawkStarApi } from '~/composables/useHawkStarApi.js'
import HsCropGrid from '~/components/hawk-star/HsCropGrid.vue'

const { t } = useI18n()

const {
  activePlanetId,
  playerResources,
  getLevel,
  isBuildingInProgress,
  isBuildingLocked,
  lockedRequirementInfo,
  nextLevelDef,
  currentLevelDef,
  canBuild,
  startBuild,
  hasEnoughPower,
  hasEnoughStaff,
  staffDelta,
  freeWorkers,
  remainingSec,
  formatTime,
  buildProgressStyle,
  playerBuildings,
  now,
} = useHawkStar()

const { fetchAgricultureState, postHarvest } = useHawkStarApi()

// ── Agriculture state ─────────────────────────────────────────────────────────
const cells     = ref(null)
const cropGridRef = ref(null)
const loadError   = ref('')

const loadState = async () => {
  loadError.value = ''
  try {
    const data = await fetchAgricultureState(activePlanetId.value)
    cells.value = data.cells ?? null
  } catch (e) {
    loadError.value = e.message
    console.error('[agriculture] state load failed:', e)
  }
}

const onHarvest = async (cellIndex) => {
  try {
    const result = await postHarvest(activePlanetId.value, cellIndex)
    cropGridRef.value?.updateCell(cellIndex, result.cell)
    if (cells.value) cells.value[cellIndex] = result.cell
  } catch { /* non-fatal */ }
}

onMounted(loadState)
watch(activePlanetId, () => { cells.value = null; loadState() })
watch(() => getLevel('farm'), (lvl) => { if (lvl > 0 && !cells.value) loadState() })
</script>

<template>
  <div class="hs-panel">

    <!-- Header -->
    <div class="hs-panel-header">
      <span class="hs-panel-icon">🌿</span>
      <h2 class="hs-panel-title">{{ t('hawkStar.tiles.agriculture.name') }}</h2>
      <span class="hs-panel-desc">{{ t('hawkStar.tiles.agriculture.desc') }}</span>
    </div>

    <!-- Farm building row -->
    <div class="hs-building-list">
      <div
        class="hs-building-row"
        :class="{ 'hs-building-row--offline': false }"
      >
        <!-- Icon + level -->
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">🚜</span>
          <span v-if="getLevel('farm') > 0" class="hs-level-badge">Lv{{ getLevel('farm') }}</span>
        </div>

        <!-- Info -->
        <div class="hs-building-info">
          <div class="hs-building-name">{{ t('hawkStar.buildings.farm.name') }}</div>
          <div v-if="currentLevelDef('farm')" class="hs-building-stats">
            <span v-if="currentLevelDef('farm').energyDrain">⚡ -{{ currentLevelDef('farm').energyDrain }}</span>
            <span v-if="currentLevelDef('farm').staffDrain">👥 {{ currentLevelDef('farm').staffDrain }}</span>
            <span v-if="currentLevelDef('farm').storageCapacity?.food">🌾 {{ currentLevelDef('farm').storageCapacity.food }}</span>
          </div>
          <div class="hs-building-effect">
            <template v-if="nextLevelDef('farm')">
              {{ getLevel('farm') === 0 ? '' : '→ ' }}{{ t('hawkStar.buildings.farm.lv' + nextLevelDef('farm').level) }}
            </template>
            <template v-else>{{ t('hawkStar.tile.maxLevel') }}</template>
          </div>

          <!-- Cost row -->
          <div
            v-if="nextLevelDef('farm') && !isBuildingInProgress('farm') && Object.keys(nextLevelDef('farm').cost ?? {}).length"
            class="hs-cost-row"
          >
            <span
              v-if="nextLevelDef('farm').energyDrain > 0"
              class="hs-cost-tag"
              :class="hasEnoughPower('farm') ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >⚡ -{{ nextLevelDef('farm').energyDrain }}</span>
            <span
              v-if="staffDelta('farm') > 0"
              class="hs-cost-tag"
              :class="freeWorkers >= staffDelta('farm') ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >👥 {{ staffDelta('farm') }}</span>
            <span
              v-for="(amt, resId) in nextLevelDef('farm').cost"
              :key="resId"
              class="hs-cost-tag"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>

          <!-- Build progress -->
          <template v-if="isBuildingInProgress('farm')">
            <div class="hs-progress-row">
              <div class="hs-progress-track">
                <div class="hs-progress-fill" :style="buildProgressStyle('farm')" />
              </div>
              <span class="hs-progress-time">{{ formatTime(remainingSec(playerBuildings['farm'].buildEndsAt)) }}</span>
            </div>
          </template>
        </div>

        <!-- Action -->
        <div class="hs-building-action">
          <template v-if="isBuildingInProgress('farm')">
            <span class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
          </template>
          <template v-else-if="!nextLevelDef('farm')">
            <span class="hs-status-max">{{ t('hawkStar.tile.statusMax') }}</span>
          </template>
          <template v-else-if="isBuildingLocked('farm')">
            <span class="hs-status-locked">
              {{ lockedRequirementInfo('farm')
                ? t('hawkStar.tile.lockedRequires', { name: t('hawkStar.buildings.' + lockedRequirementInfo('farm').building + '.name'), level: lockedRequirementInfo('farm').level })
                : t('hawkStar.tile.lockedGeneric') }}
            </span>
          </template>
          <template v-else>
            <div class="hs-btn-wrap">
              <button
                class="hs-btn-build"
                :class="{ 'hs-btn-build--disabled': !canBuild('farm') }"
                :disabled="!canBuild('farm')"
                @click.stop="startBuild('farm')"
              >{{ getLevel('farm') === 0 ? t('hawkStar.tile.btnBuild') : t('hawkStar.tile.btnUpgrade') }}</button>
              <span class="hs-build-time">⏱ {{ formatTime(nextLevelDef('farm').buildTime) }}</span>
              <span v-if="!hasEnoughPower('farm')" class="hs-no-power">{{ t('hawkStar.tile.needPower') }}</span>
              <span v-if="!hasEnoughStaff('farm')" class="hs-no-staff">{{ t('hawkStar.tile.needStaff') }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="loadError" class="hsa-error">
      <span>⚠ {{ loadError }}</span>
      <button class="hsa-dev-btn" @click="loadState">↺ Retry</button>
    </div>

    <!-- Crop grid (only when farm is built) -->
    <HsCropGrid
      v-if="getLevel('farm') > 0"
      ref="cropGridRef"
      :cells="cells"
      :now="now"
      @harvest="onHarvest"
    />

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
  bottom: -4px; right: -4px;
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
  display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px;
  span { font-size: 0.6rem; color: var(--hs-ok); background: var(--hs-ok-bg); padding: 1px 5px; border-radius: 4px; }
}
.hs-building-effect { font-size: 0.68rem; opacity: 0.5; margin-top: 2px; }

.hs-cost-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.hs-cost-tag {
  font-size: 0.65rem; padding: 2px 6px; border-radius: 5px;
  &--ok { background: var(--hs-ok-bg);          color: var(--hs-ok-muted); }
  &--no { background: var(--hs-danger-bg-cost);  color: var(--hs-danger-muted); }
}

.hs-progress-row   { display: flex; align-items: center; gap: 0.5rem; margin-top: 6px; }
.hs-progress-track { flex: 1; height: 4px; background: var(--hs-glass-3xl); border-radius: 9999px; overflow: hidden; }
.hs-progress-fill  { height: 100%; background: var(--hs-warn); border-radius: 9999px; }
.hs-progress-time  { font-size: 0.65rem; color: var(--hs-warn-text); font-variant-numeric: tabular-nums; width: 3.5rem; text-align: right; flex-shrink: 0; }

.hs-building-action { flex-shrink: 0; }
.hs-btn-wrap        { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.hs-build-time      { font-size: 0.6rem; color: rgba(255,255,255,0.4); white-space: nowrap; }
.hs-no-power        { font-size: 0.6rem; color: var(--hs-danger); white-space: nowrap; }
.hs-no-staff        { font-size: 0.6rem; color: var(--hs-staff);  white-space: nowrap; }

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
.hs-status-max      { font-size: 0.7rem; font-weight: 700; color: var(--hs-accent-badge); letter-spacing: 0.05em; }
.hs-status-locked   { font-size: 0.62rem; font-weight: 600; color: rgba(255,255,255,0.25); white-space: nowrap; text-align: right; }

// ── Error ─────────────────────────────────────────────────────────────────────
.hsa-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.7rem;
  border-radius: var(--hs-r-md);
  border: 1px solid var(--hs-danger-border);
  background: var(--hs-danger-bg);
  font-size: 0.7rem;
  color: var(--hs-danger);
}

</style>
