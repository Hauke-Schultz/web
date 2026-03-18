<script setup>
import { ref, watchEffect } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { startTick, stopTick, useHawkStar } from './useHawkStar.js'
import HsResourceBar from './components/HsResourceBar.vue'
import HsPlanetGrid from './components/HsPlanetGrid.vue'
import HsTilePanel from './components/HsTilePanel.vue'
import HsNavBar from './components/HsNavBar.vue'
import HsGalaxyMap from './components/HsGalaxyMap.vue'
import HsSolarSystem from './components/HsSolarSystem.vue'

definePageMeta({ hideHeader: true })

onMounted(startTick)
onUnmounted(stopTick)

const { starMapLevel } = useHawkStar()

const currentView = ref('planet')

// Fall back if a view becomes locked again (e.g. game reset)
watchEffect(() => {
  if (currentView.value === 'solar-system' && starMapLevel.value < 1) {
    currentView.value = 'planet'
  }
  if (currentView.value === 'galaxy' && starMapLevel.value < 2) {
    currentView.value = starMapLevel.value >= 1 ? 'solar-system' : 'planet'
  }
})
</script>

<template>
  <div class="hs-page">
    <div class="hs-top">
      <HsNavBar v-model:currentView="currentView" />
      <HsResourceBar />
    </div>

    <div class="hs-main">
      <template v-if="currentView === 'planet'">
        <HsPlanetGrid />
        <HsTilePanel />
      </template>
      <HsSolarSystem v-else-if="currentView === 'solar-system'" />
      <HsGalaxyMap v-else-if="currentView === 'galaxy'" />
    </div>
  </div>
</template>

<style lang="scss">
@use './hawk-star' as *;
</style>

<style lang="scss" scoped>
.hs-page {
  min-height: 100dvh;
  background: linear-gradient(to bottom, #0a0a1a, #0d1a2e);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0.75rem;
  color: #fff;
  user-select: none;

  @media (min-width: 640px) {
    padding: 1.5rem 1rem;
  }
}

.hs-top {
  display: flex;
  gap: 0.375rem;
  width: 100%;
  max-width: calc(28rem + 0.375rem + calc((28rem - 3 * 0.375rem) / 4));
  align-items: stretch;
  margin-bottom: 1rem;

  @media (min-width: 640px) {
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
}

.hs-main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 52rem;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: flex-start;
  }
}
</style>
