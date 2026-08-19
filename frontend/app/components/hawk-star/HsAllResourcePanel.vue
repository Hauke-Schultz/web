<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES, PLANET_TYPES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { production, maxStorage, isStorageFull, resourceDisplay, planetName, planetType } = useHawkStar()
const { t } = useI18n()

const currentPlanetType = computed(() => PLANET_TYPES[planetType.value])

// 'scrap' is player-wide and has no planet stock or cap, so it has no business
// in a per-planet breakdown — it lives in RESOURCES only for its icon and name.
const EXCLUDED_IDS = ['population', 'energy', 'scrap']

const allResources = computed(() =>
  Object.values(RESOURCES).filter(r => !EXCLUDED_IDS.includes(r.id))
)
</script>

<template>
  <div class="hs-panel">

    <!-- Planet info header -->
    <div class="hs-panel-header">
      <span class="hs-panel-icon">{{ currentPlanetType?.icon ?? '🪐' }}</span>
      <h2 class="hs-panel-title">{{ planetName }}</h2>
      <span v-if="currentPlanetType" class="hs-panel-desc hs-panel-planet-type" :class="`hs-panel-planet-type--${planetType}`">
        {{ t('hawkStar.planetTypes.' + planetType + '.name') }}
      </span>
    </div>

    <!-- Resources -->
    <div class="hs-res-row">
      <div
        v-for="res in allResources"
        :key="res.id"
        class="hs-res-item"
      >
        <span class="hs-res-icon">{{ res.icon }}</span>
        <div class="hs-res-info">
          <span class="hs-res-name">{{ t('hawkStar.res.' + res.id) }}</span>
          <span class="hs-res-amount">{{ Math.floor(resourceDisplay(res.id)) }}</span>
          <span
            v-if="production[res.id]"
            class="hs-res-rate"
            :class="{ 'hs-res-rate--paused': isStorageFull(res.id) }"
          >+{{ production[res.id] }}/m</span>
          <span
            v-if="maxStorage[res.id]"
            class="hs-res-cap"
            :class="{ 'hs-res-cap--full': isStorageFull(res.id) }"
          >/{{ maxStorage[res.id] }}</span>
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
  gap: 0.75rem;
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
.hs-panel-desc  { font-size: 0.65rem; opacity: 0.5; }

.hs-panel-planet-type {
  font-size: 0.65rem;
  font-weight: 600;
  opacity: 1;

  &--terrestrial { color: #86efac; }
  &--volcanic    { color: #fca5a5; }
  &--frozen      { color: #93c5fd; }
  &--ocean       { color: #67e8f9; }
}

// ── Resources grid ────────────────────────────────────────────────────────────
.hs-res-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.875rem;
}

.hs-res-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: 1;
  min-width: 5rem;
}

.hs-res-icon { font-size: 1rem; line-height: 1; }

.hs-res-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.hs-res-name   { font-size: 0.55rem; text-transform: capitalize; opacity: 0.45; line-height: 1; }
.hs-res-amount { font-size: 0.8rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
.hs-res-rate   { font-size: 0.5rem; color: var(--hs-ok); font-variant-numeric: tabular-nums; line-height: 1; }
.hs-res-cap    { font-size: 0.5rem; opacity: 0.35; font-variant-numeric: tabular-nums; line-height: 1; }

/* Store at the cap: production is paused until something is spent */
.hs-res-rate--paused { color: #fbbf24; text-decoration: line-through; opacity: 0.7; }
.hs-res-cap--full    { color: #fbbf24; opacity: 0.8; }
</style>
