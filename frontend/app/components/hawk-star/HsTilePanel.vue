<script setup>
import { computed, ref } from 'vue'
import { RESOURCES, BUILDINGS } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsDockPanel from '~/components/hawk-star/HsDockPanel.vue'

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
    <HsDockPanel v-if="isSpacebaseTile" />


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

// ── Stepper control (shared) ──────────────────────────────────────────────────
.hs-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--hs-line-sm);
  border-radius: 6px;
  overflow: hidden;

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
