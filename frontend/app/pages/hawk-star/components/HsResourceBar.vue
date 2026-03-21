<script setup>
import { computed } from 'vue'
import { RESOURCES } from '../hawkStarConfig.js'
import { useHawkStar } from '../useHawkStar.js'

const {
  playerResources,
  production,
  grossProduction,
  freeWorkers,
  maxStorage,
  energyDeficit,
  planetType,
} = useHawkStar()

const visibleResources = computed(() =>
  Object.values(RESOURCES).filter(r => !r.planetTypes || r.planetTypes.includes(planetType.value))
)
</script>

<template>
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
        <template v-else>{{ Math.floor(playerResources[res.id]) }}</template>
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
        {{ production[res.id] ? `+${production[res.id]}/s` : '' }}
        <template v-if="maxStorage[res.id]"> · /{{ maxStorage[res.id] }}</template>
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-resources {
  display: grid;
  gap: 0.375rem;
  width: 100%;
  max-width: 34rem;

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
  padding: 0.375rem 0.15rem;

  @media (min-width: 640px) {
    padding: 0.5rem 0.25rem;
  }

  &--deficit {
    border-color: var(--hs-danger-border-card);
    background: var(--hs-danger-bg-card);
  }
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
