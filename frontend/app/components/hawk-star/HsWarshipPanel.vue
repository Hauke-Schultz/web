<script setup>
import { useI18n } from 'vue-i18n'
import { RESOURCES, UNIT_COSTS } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const {
  playerResources,
  formatTime,
  warshipBayLevel,
  warship,
  warshipBuild,
  warshipBuildTime,
  canBuildWarship,
  buildWarship,
  warshipBuildProgressStyle,
} = useHawkStar()

const { t } = useI18n()
</script>

<template>
  <div class="hs-panel">

    <div class="hs-panel-header">
      <span class="hs-panel-icon">⚔️</span>
      <h2 class="hs-panel-title">{{ t('hawkStar.tiles.warship_bay.name') }}</h2>
      <span class="hs-panel-desc">{{ t('hawkStar.tiles.warship_bay.desc') }}</span>
    </div>

    <!-- Build row -->
    <div class="hs-building-list">
      <div class="hs-building-row">
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">⚔️</span>
        </div>
        <div class="hs-building-info">
          <div class="hs-building-name">{{ t('hawkStar.dock.warship') }}</div>
          <div class="hs-building-effect">{{ t('hawkStar.dock.warshipDesc') }}</div>
          <div v-if="!warshipBuild && !warship" class="hs-cost-row">
            <span
              v-for="(amt, resId) in UNIT_COSTS.warship.cost"
              :key="resId"
              class="hs-cost-tag"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>
          <div v-if="warshipBuild" class="hs-progress-row">
            <div class="hs-progress-track">
              <div :key="warshipBuild.endsAt" class="hs-progress-fill" :style="warshipBuildProgressStyle" />
            </div>
            <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((warshipBuild.endsAt - Date.now()) / 1000))) }}</span>
          </div>
        </div>
        <div class="hs-building-action">
          <span v-if="warshipBuild" class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
          <span v-else-if="warship" class="hs-status-ready">{{ t('hawkStar.dock.readyForDeployment') }}</span>
          <div v-else class="hs-btn-wrap">
            <button
              class="hs-btn-build"
              :class="{ 'hs-btn-build--disabled': !canBuildWarship }"
              :disabled="!canBuildWarship"
              @click.stop="buildWarship()"
            >{{ t('hawkStar.dock.btnBuild') }}</button>
            <span class="hs-build-time">⏱ {{ formatTime(warshipBuildTime) }}</span>
            <span v-if="warship" class="hs-build-time">{{ t('hawkStar.dock.slotsFull', { n: 1 }) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Hangar — single warship -->
    <div v-if="warship" class="hs-warship-section">
      <span class="hs-warship-section-label">🔧 {{ t('hawkStar.dock.sectionHangar') }}</span>
      <div class="hs-warship-card">
        <div class="hs-warship-card-header">
          <span class="hs-warship-card-icon">{{ warship.icon }}</span>
          <span class="hs-warship-card-name">{{ warship.name }}</span>
        </div>
        <div class="hs-warship-card-stats">
          <span class="hs-warship-stat" title="Hull">🛡 {{ warship.hull }}/{{ warship.hullMax }}</span>
          <span class="hs-warship-stat" title="Shield">🔵 {{ warship.shield }}/{{ warship.shieldMax }}</span>
          <span class="hs-warship-stat" title="Speed">⚡ {{ warship.speed }}</span>
        </div>
        <!-- Placeholder for future attack action -->
        <div class="hs-warship-deploy">
          <button class="hs-btn-deploy hs-btn-deploy--disabled" disabled>
            {{ t('hawkStar.dock.attackComingSoon') }}
          </button>
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
.hs-building-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-building-name   { font-size: 0.825rem; font-weight: 600; }
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

.hs-progress-row   { display: flex; align-items: center; gap: 0.5rem; margin-top: 6px; }
.hs-progress-track { flex: 1; height: 4px; background: var(--hs-glass-3xl); border-radius: 9999px; overflow: hidden; }
.hs-progress-fill  { height: 100%; border-radius: 9999px; background: #f87171; }
.hs-progress-time  { font-size: 0.65rem; color: var(--hs-warn-text); font-variant-numeric: tabular-nums; width: 3.5rem; text-align: right; flex-shrink: 0; }

.hs-btn-wrap    { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.hs-build-time  { font-size: 0.6rem; color: rgba(255,255,255,0.4); white-space: nowrap; }

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
.hs-status-ready    { font-size: 0.7rem; font-weight: 600; color: #34d399; white-space: nowrap; }

// ── Warship card ──────────────────────────────────────────────────────────────
.hs-warship-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 0.5rem;
}

.hs-warship-section-label {
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.3);
}

.hs-warship-card {
  background: rgba(248,113,113,0.05);
  border: 1px solid rgba(248,113,113,0.2);
  border-radius: 6px;
  padding: 0.5rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-warship-card-header { display: flex; align-items: center; gap: 0.4rem; }
.hs-warship-card-icon   { font-size: 1rem; }
.hs-warship-card-name   { font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.85); }

.hs-warship-card-stats  { display: flex; gap: 0.75rem; }
.hs-warship-stat {
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: rgba(255,255,255,0.55);
}

.hs-warship-deploy { margin-top: 0.15rem; }

.hs-btn-deploy {
  padding: 0.3rem 0.75rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.7rem;
  font-weight: 700;
  border: 1px solid rgba(248,113,113,0.3);
  background: rgba(248,113,113,0.08);
  color: rgba(248,113,113,0.5);
  cursor: not-allowed;
  white-space: nowrap;
  &--disabled { opacity: 0.5; }
}
</style>
