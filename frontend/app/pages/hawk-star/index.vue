<script setup>
import { onMounted, onUnmounted } from 'vue'
import { startTick, stopTick } from './useHawkStar.js'
import HsResourceBar from './components/HsResourceBar.vue'
import HsPlanetGrid from './components/HsPlanetGrid.vue'
import HsTilePanel from './components/HsTilePanel.vue'

definePageMeta({ hideHeader: true })

onMounted(startTick)
onUnmounted(stopTick)
</script>

<template>
  <div class="hs-page">
    <HsResourceBar />
    <div class="hs-main">
      <HsPlanetGrid />
      <HsTilePanel />
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
