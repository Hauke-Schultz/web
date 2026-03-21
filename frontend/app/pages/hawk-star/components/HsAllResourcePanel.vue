<script setup>
import { computed } from 'vue'
import { RESOURCES } from '../hawkStarConfig.js'
import { useHawkStar } from '../useHawkStar.js'

const { playerResources, production, maxStorage, planetType } = useHawkStar()

const EXCLUDED_IDS = ['population', 'energy']

const allResources = computed(() =>
  Object.values(RESOURCES).filter(r => !EXCLUDED_IDS.includes(r.id))
)
</script>

<template>
  <div class="hs-res-panel">
    <div class="hs-res-panel__row">
      <div
        v-for="res in allResources"
        :key="res.id"
        class="hs-res-panel__item"
      >
        <span class="hs-res-panel__icon">{{ res.icon }}</span>
        <div class="hs-res-panel__info">
          <span class="hs-res-panel__name">{{ res.name }}</span>
          <span class="hs-res-panel__amount">{{ Math.floor(playerResources[res.id] ?? 0) }}</span>
          <span
            v-if="production[res.id]"
            class="hs-res-panel__rate"
          >+{{ production[res.id] }}/s</span>
          <span
            v-if="maxStorage[res.id]"
            class="hs-res-panel__cap"
          >/{{ maxStorage[res.id] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-res-panel {
  width: 100%;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-md);
  border-radius: var(--hs-r-md);
  padding: 0.5rem 0.75rem;
}

.hs-res-panel__row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.hs-res-panel__item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  position: relative;
}

.hs-res-panel__icon {
  font-size: 1rem;
  line-height: 1;
}

.hs-res-panel__info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.hs-res-panel__name {
  font-size: 0.55rem;
  text-transform: capitalize;
  opacity: 0.45;
  line-height: 1;
}

.hs-res-panel__amount {
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.hs-res-panel__rate {
  font-size: 0.5rem;
  color: var(--hs-ok);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.hs-res-panel__cap {
  font-size: 0.5rem;
  opacity: 0.35;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

</style>
