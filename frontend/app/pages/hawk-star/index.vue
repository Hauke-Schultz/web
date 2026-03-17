<script setup>
import { ref, watchEffect } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { startTick, stopTick, useHawkStar } from './useHawkStar.js'
import HsResourceBar from './components/HsResourceBar.vue'
import HsPlanetGrid from './components/HsPlanetGrid.vue'
import HsTilePanel from './components/HsTilePanel.vue'
import HsNavBar from './components/HsNavBar.vue'
import HsGalaxyMap from './components/HsGalaxyMap.vue'

definePageMeta({ hideHeader: true })

onMounted(startTick)
onUnmounted(stopTick)

const { starMapLevel } = useHawkStar()

const currentView = ref('planet')

// Fall back to planet view if star map is removed (e.g. game reset)
watchEffect(() => {
  if (currentView.value === 'galaxy' && starMapLevel.value === 0) {
    currentView.value = 'planet'
  }
})
</script>

<template>
  <div class="hs-page">
    <HsResourceBar />
    <HsNavBar v-model:currentView="currentView" />

    <div class="hs-main">
      <template v-if="currentView === 'planet'">
        <HsPlanetGrid />
        <HsTilePanel />
      </template>
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
