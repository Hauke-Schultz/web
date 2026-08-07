<script setup>
import { computed } from 'vue'
import { RESOURCES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const {
  playerResources,
  production,
  grossProduction,
  freeWorkers,
  maxStorage,
  energyDeficit,
  planetType,
  tickProgress,
} = useHawkStar()

const BAR_IDS = ['population', 'metal', 'crystal', 'alloy', 'cryo', 'obsidian', 'biomass', 'energy']

// High-Tech output — shown as a compact icon+count row, always visible so the
// stock of a planet is readable at a glance. These are not produced per minute,
// so they get no rate or storage line.
const REFINED_IDS = ['power_cell', 'pure_crystal', 'super_alloy', 'quantum_shard', 'nano_alloy']

const visibleResources = computed(() =>
  Object.values(RESOURCES).filter(r =>
    BAR_IDS.includes(r.id) &&
    (!r.planetTypes || r.planetTypes.includes(planetType.value))
  )
)

const refinedResources = computed(() =>
  REFINED_IDS.map(id => RESOURCES[id]).filter(Boolean)
)
</script>

<template>
  <div class="hs-res-wrap">
    <div class="hs-resources" :style="{ gridTemplateColumns: `repeat(${visibleResources.length}, 1fr)` }">
      <div
        v-for="res in visibleResources"
        :key="res.id"
        class="hs-res-card"
        :class="{
          'hs-res-card--deficit': (res.id === 'energy' && energyDeficit) || (res.id === 'population' && freeWorkers < 0)
        }"
      >
        <span class="hs-res-icon">{{ res.icon }}</span>
        <span class="hs-res-label">{{ res.name }}</span>
        <span
          class="hs-res-value"
          :class="{
            'hs-res-value--deficit': (res.id === 'energy' && energyDeficit) || (res.id === 'population' && freeWorkers < 0)
          }"
        >
          <template v-if="res.id === 'energy'">{{ production.energy > 0 ? `+${production.energy}` : production.energy }}</template>
          <template v-else-if="res.id === 'population'">{{ freeWorkers > 0 ? `+${freeWorkers}` : freeWorkers }}</template>
          <template v-else>{{ Math.floor(playerResources[res.id] + tickProgress * (production[res.id] || 0)) }}</template>
        </span>
        <span
          v-if="res.id === 'energy'"
          class="hs-res-prod"
          :class="energyDeficit ? 'hs-res-prod--neg' : 'hs-res-prod--pos'"
        >{{ production.energy }}/{{ grossProduction.energy ?? 0 }}</span>
        <span
          v-else-if="res.id === 'population'"
          class="hs-res-prod"
          :class="freeWorkers < 0 ? 'hs-res-prod--neg' : ''"
        >{{ freeWorkers }}/{{ playerResources[res.id] }}</span>
        <span
          v-else
          class="hs-res-prod"
          :class="production[res.id] > 0 ? 'hs-res-prod--pos' : ''"
        >
          {{ production[res.id] ? `+${production[res.id]}/m` : '' }}
          <template v-if="maxStorage[res.id]"> · /{{ maxStorage[res.id] }}</template>
        </span>
      </div>
    </div>

    <!-- High-Tech stock: symbol + count only -->
    <div class="hs-res-refined">
      <div
        v-for="res in refinedResources"
        :key="res.id"
        class="hs-res-card hs-res-card--mini"
        :class="{ 'hs-res-card--empty': !Math.floor(playerResources[res.id] ?? 0) }"
        :title="res.name"
      >
        <span class="hs-res-icon">{{ res.icon }}</span>
        <span class="hs-res-value">{{ Math.floor(playerResources[res.id] ?? 0) }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-res-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;
  max-width: 34rem;

  @media (min-width: 640px) {
    gap: 0.5rem;
  }
}

.hs-resources {
  display: grid;
  gap: 0.375rem;
  width: 100%;

  @media (min-width: 640px) {
    gap: 0.5rem;
  }
}

// High-Tech stock row — one slot per refined resource, fixed layout so the
// row never reflows when a stock goes from 0 to 1.
.hs-res-refined {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.375rem;

  @media (min-width: 640px) {
    gap: 0.5rem;
  }
}

.hs-res-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: var(--hs-glass-md);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);
  padding: 0.375rem 0.15rem 0.3rem;
  overflow: hidden;

  @media (min-width: 640px) {
    padding: 0.5rem 0.25rem 0.4rem;
  }

  &--deficit {
    border-color: var(--hs-danger-border-card);
    background: var(--hs-danger-bg-card);
  }

  // Compact variant: icon and count on one line, nothing else
  &--mini {
    flex-direction: row;
    justify-content: center;
    gap: 0.3rem;
    padding: 0.2rem 0.15rem;

    @media (min-width: 640px) {
      padding: 0.25rem 0.2rem;
    }

    .hs-res-icon  { font-size: 0.9rem;  @media (min-width: 640px) { font-size: 1rem; } }
    .hs-res-value { font-size: 0.75rem; @media (min-width: 640px) { font-size: 0.85rem; } }
  }

  // Nothing in stock — dimmed so a non-zero count stands out
  &--empty { opacity: 0.3; }
}

.hs-res-icon  { font-size: 1.1rem; line-height: 1; @media (min-width: 640px) { font-size: 1.25rem; } }
.hs-res-label { font-size: 0.55rem; text-transform: capitalize; opacity: 0.5; @media (min-width: 640px) { font-size: 0.6rem; } }

.hs-res-value {
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  @media (min-width: 640px) { font-size: 1rem; }

  &--deficit { color: var(--hs-danger); }
}

.hs-res-prod {
  font-size: 0.55rem;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.35);

  @media (min-width: 640px) { font-size: 0.6rem; }

  &--pos { color: var(--hs-ok); }
  &--neg { color: var(--hs-danger); }
}
</style>
