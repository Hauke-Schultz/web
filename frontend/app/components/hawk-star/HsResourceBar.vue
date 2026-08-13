<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES, BUILDINGS, PLANET_TYPES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { t } = useI18n()

const {
  playerResources,
  production,
  grossProduction,
  freeWorkers,
  maxStorage,
  isStorageFull,
  resourceDisplay,
  energyDeficit,
  planetType,
} = useHawkStar()

const BAR_IDS = ['population', 'metal', 'crystal', 'alloy', 'cryo', 'obsidian', 'biomass', 'energy']

// High-Tech output — shown as a compact icon+count row, always visible so the
// stock of a planet is readable at a glance. These are not produced per minute,
// so they get no rate or storage line.
const REFINED_IDS = ['power_cell', 'duraplate', 'plasma_core', 'superconductor', 'vital_gel']

const visibleResources = computed(() =>
  Object.values(RESOURCES).filter(r =>
    BAR_IDS.includes(r.id) &&
    (!r.planetTypes || r.planetTypes.includes(planetType.value))
  )
)

const refinedResources = computed(() =>
  REFINED_IDS.map(id => RESOURCES[id]).filter(Boolean)
)

// ── Which planet type makes what ─────────────────────────────────────────────
// Derived from the buildings, never written down twice: a refined good is made
// by whichever building lists it as a conversion output, and that building's
// `planetTypes` is the answer. An unrestricted producer (power_cell_lab) means
// the good is universal, so one `null` beats any list.
const producerTypes = (resId) => {
  const types = new Set()
  for (const b of Object.values(BUILDINGS)) {
    if (!b.conversions?.some(c => c.output?.[resId])) continue
    if (!b.planetTypes) return null          // buildable anywhere
    for (const p of b.planetTypes) types.add(p)
  }
  return types.size ? [...types] : null
}

// The whole point of the marker: on this planet, these are the ones you can
// actually refine. The four domain goods are planet-type exclusive and this is
// the fact that is easy to lose track of.
const canProduceHere = (resId) => {
  const types = producerTypes(resId)
  return !types || types.includes(planetType.value)
}

// Hovering ANY card answers "where does this come from" — that is what turns the
// row into the lookup table, rather than only marking the local one.
const originLabel = (res) => {
  const types = producerTypes(res.id)
  if (!types) return `${res.icon} ${res.name} · ${t('hawkStar.resourceBar.madeAnywhere')}`
  const names = types.map(p => `${PLANET_TYPES[p]?.icon ?? ''} ${t(`hawkStar.planetTypes.${p}.name`)}`).join(', ')
  const key = canProduceHere(res.id) ? 'madeHere' : 'madeOn'
  return `${res.icon} ${res.name} · ${t(`hawkStar.resourceBar.${key}`, { type: names })}`
}
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
          <template v-else>{{ Math.floor(resourceDisplay(res.id)) }}</template>
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
        <!-- A full store produces nothing, so the rate is struck through rather
             than left standing next to a number that has stopped moving -->
        <span
          v-else
          class="hs-res-prod"
          :class="{
            'hs-res-prod--pos':  production[res.id] > 0 && !isStorageFull(res.id),
            'hs-res-prod--full': isStorageFull(res.id),
          }"
        >
          <span v-if="production[res.id]" class="hs-res-rate">+{{ production[res.id] }}/m</span>
          <template v-if="maxStorage[res.id]"> · /{{ maxStorage[res.id] }}</template>
        </span>
      </div>
    </div>

    <!-- High-Tech stock: symbol + count only. The ones this planet can refine
         carry a border in the resource's own colour — the four domain goods are
         planet-type exclusive, and that is the mapping that is easy to lose. -->
    <div class="hs-res-refined">
      <div
        v-for="res in refinedResources"
        :key="res.id"
        class="hs-res-card hs-res-card--mini"
        :class="{
          'hs-res-card--empty': !Math.floor(playerResources[res.id] ?? 0),
          'hs-res-card--local': canProduceHere(res.id),
        }"
        :style="canProduceHere(res.id) ? { borderColor: res.color } : null"
        :title="originLabel(res)"
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

  // Refinable on this planet. The border colour is the resource's own, set
  // inline from the config, so the marker also teaches which icon is which.
  &--local {
    background: var(--hs-glass-lg);

    // "You can make this here" has to stay readable at a stock of zero — that
    // is exactly the moment the hint is worth something.
    &.hs-res-card--empty { opacity: 0.65; }
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

  /* Storage at the cap: production is paused until something is spent */
  &--full {
    color: #fbbf24;
    .hs-res-rate { text-decoration: line-through; opacity: 0.7; }
  }
}
</style>
