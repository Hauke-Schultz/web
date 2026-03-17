<script setup>
import { RESOURCES } from '../hawkStarConfig.js'
import { useHawkStar } from '../useHawkStar.js'

const {
  playerResources,
  production,
  grossProduction,
  freeWorkers,
  maxStorage,
  energyDeficit,
} = useHawkStar()
</script>

<template>
  <div class="hs-resources">
    <div
      v-for="res in RESOURCES"
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

<style scoped>
.hs-resources {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  width: 100%;
  max-width: 28rem;
  margin-bottom: 1.5rem;
}
.hs-res-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.75rem;
  padding: 0.5rem 0.25rem;
}
.hs-res-icon  { font-size: 1.25rem; line-height: 1; }
.hs-res-label { font-size: 0.6rem; text-transform: capitalize; opacity: 0.5; }
.hs-res-value { font-size: 1rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.hs-res-value--deficit { color: #f87171; }
.hs-res-prod          { font-size: 0.6rem; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.35); }
.hs-res-prod--pos     { color: #4ade80; }
.hs-res-prod--neg     { color: #f87171; }
.hs-res-card--deficit { border-color: rgba(248,113,113,0.5); background: rgba(248,113,113,0.08); }
</style>
