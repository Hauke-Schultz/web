<script setup>
import { ref, computed, watchEffect } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import { startTick, stopTick, completeSetup, useHawkStar } from './useHawkStar.js'
import HsResourceBar from './components/HsResourceBar.vue'
import HsPlanetGrid from './components/HsPlanetGrid.vue'
import HsTilePanel from './components/HsTilePanel.vue'
import HsNavBar from './components/HsNavBar.vue'
import HsGalaxyMap from './components/HsGalaxyMap.vue'
import HsSolarSystem from './components/HsSolarSystem.vue'
import HsAllResourcePanel from './components/HsAllResourcePanel.vue'

definePageMeta({ hideHeader: true })

onMounted(startTick)
onUnmounted(stopTick)

const { starMapLevel, isFirstRun, playerName, planetName, systemName, planetType, PLANET_TYPES } = useHawkStar()
const currentPlanetType = computed(() => PLANET_TYPES[planetType.value])

const currentView = ref('planet')
const setupName   = ref('')

const submitSetup = () => {
  const name = setupName.value.trim()
  if (!name) return
  completeSetup(name)
}

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

    <!-- ── Setup overlay (first run only) ── -->
    <Teleport to="body">
      <div v-if="isFirstRun" class="hs-setup-backdrop">
        <div class="hs-setup-modal">
          <div class="hs-setup-logo">🪐</div>
          <h1 class="hs-setup-title">Hawk-Star</h1>
          <p class="hs-setup-sub">Your colony has been assigned a starting planet.</p>
          <p class="hs-setup-label">Enter your commander name</p>
          <input
            v-model="setupName"
            class="hs-setup-input"
            type="text"
            placeholder="Commander…"
            maxlength="24"
            autofocus
            @keydown.enter="submitSetup"
          />
          <button
            class="hs-setup-btn"
            :class="{ 'hs-setup-btn--disabled': !setupName.trim() }"
            :disabled="!setupName.trim()"
            @click="submitSetup"
          >
            Begin Colony
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss">
@use './hawk-star' as *;
</style>

<style lang="scss">
// ── Setup overlay (not scoped — uses Teleport to body) ────────────────────────
.hs-setup-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(5, 5, 20, 0.88);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.hs-setup-modal {
  background: rgba(15, 20, 40, 0.95);
  border: 1px solid rgba(100, 130, 220, 0.25);
  border-radius: 1rem;
  padding: 2rem 1.75rem;
  width: 100%;
  max-width: 22rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 0 60px rgba(80, 120, 255, 0.12);
}

.hs-setup-logo  { font-size: 3rem; line-height: 1; }
.hs-setup-title { font-size: 1.5rem; font-weight: 800; letter-spacing: 0.08em; margin: 0; color: #fff; }
.hs-setup-sub   { font-size: 0.72rem; opacity: 0.4; margin: 0; text-align: center; }

.hs-setup-planet-card {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(100, 130, 220, 0.2);
  border-radius: 0.625rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.hs-setup-label {
  font-size: 0.7rem;
  opacity: 0.45;
  margin: 0.25rem 0 0;
  align-self: flex-start;
}

.hs-setup-input {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(100, 130, 220, 0.3);
  border-radius: 0.5rem;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.6rem 0.875rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &::placeholder { color: rgba(255,255,255,0.2); }
  &:focus { border-color: rgba(100, 130, 220, 0.7); }
}

.hs-setup-btn {
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.65rem 1rem;
  border-radius: 0.5rem;
  border: none;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: linear-gradient(135deg, #4f6ef7, #7c3aed);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover:not(:disabled) { opacity: 0.9; }

  &--disabled, &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}
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
