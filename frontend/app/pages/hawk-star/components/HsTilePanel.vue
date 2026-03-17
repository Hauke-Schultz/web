<script setup>
import { RESOURCES, BUILDINGS } from '../hawkStarConfig.js'
import { useHawkStar } from '../useHawkStar.js'

const {
  playerResources,
  playerBuildings,
  activeTileType,
  buildingsForActiveSlot,
  getLevel,
  isBuildingInProgress,
  nextLevelDef,
  canBuild,
  startBuild,
  hasEnoughPower,
  hasEnoughStaff,
  staffDelta,
  isOffline,
  freeWorkers,
  remainingSec,
  formatTime,
} = useHawkStar()
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
                  class="hs-progress-fill"
                  :style="{
                    width: `${100 - (remainingSec(playerBuildings[bDef.id].buildEndsAt) / BUILDINGS[bDef.id].levels[getLevel(bDef.id)].buildTime) * 100}%`
                  }"
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
          <template v-else>
            <div class="hs-btn-wrap">
              <button
                class="hs-btn-build"
                :class="{ 'hs-btn-build--disabled': !canBuild(bDef.id) }"
                :disabled="!canBuild(bDef.id)"
                @click.stop="startBuild(bDef.id)"
              >{{ getLevel(bDef.id) === 0 ? 'Build' : 'Upgrade' }}</button>
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
  gap: 0.75rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.75rem;
  transition: background 0.3s, border-color 0.3s, opacity 0.3s;

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
  transition: width 1s linear;
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
.hs-no-power { font-size: 0.6rem; color: var(--hs-danger); white-space: nowrap; }
.hs-no-staff { font-size: 0.6rem; color: var(--hs-staff);  white-space: nowrap; }

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

.hs-empty { text-align: center; padding: 1.5rem; opacity: 0.25; font-size: 0.875rem; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
</style>
