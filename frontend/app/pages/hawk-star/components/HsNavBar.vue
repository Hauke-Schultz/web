<script setup>
import { useHawkStar } from '~/composables/useHawkStar.js'

const props = defineProps({
  currentView: { type: String, required: true },
})
const emit = defineEmits(['update:currentView'])

const { starMapLevel } = useHawkStar()
</script>

<template>
  <nav class="hs-nav">
    <button
      class="hs-nav-tab"
      :class="{ 'hs-nav-tab--active': currentView === 'planet' }"
      @click="emit('update:currentView', 'planet')"
    >
      <span class="hs-nav-icon">🌍</span>
      <span>Planet</span>
    </button>

    <button
      class="hs-nav-tab"
      :class="{
        'hs-nav-tab--active': currentView === 'solar-system',
        'hs-nav-tab--locked': starMapLevel < 1,
      }"
      :disabled="starMapLevel < 1"
      :title="starMapLevel < 1 ? 'Build Star Map Lv1 to unlock' : 'Solar System'"
      @click="emit('update:currentView', 'solar-system')"
    >
      <span class="hs-nav-icon">☀️</span>
      <span>System</span>
      <span v-if="starMapLevel < 1" class="hs-nav-lock">🔒</span>
    </button>

    <button
      class="hs-nav-tab"
      :class="{
        'hs-nav-tab--active': currentView === 'galaxy',
        'hs-nav-tab--locked': starMapLevel < 2,
      }"
      :disabled="starMapLevel < 2"
      :title="starMapLevel < 2 ? 'Build Star Map Lv2 to unlock' : 'Galaxy Map'"
      @click="emit('update:currentView', 'galaxy')"
    >
      <span class="hs-nav-icon">🗺️</span>
      <span>Galaxy</span>
      <span v-if="starMapLevel < 2" class="hs-nav-lock">🔒</span>
    </button>
  </nav>
</template>

<style lang="scss" scoped>
.hs-nav {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex-shrink: 0;
  width: calc((28rem - 3 * 0.375rem) / 4);

  @media (min-width: 640px) {
    gap: 0.5rem;
    width: calc((28rem - 3 * 0.5rem) / 4);
  }
}

.hs-nav-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1;
  padding: 0.25rem 0.15rem;
  border-radius: var(--hs-r-md);
  border: 1px solid var(--hs-line-sm);
  background: var(--hs-glass-sm);
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    background: var(--hs-glass-md);
    color: rgba(255, 255, 255, 0.8);
  }

  &--active {
    background: var(--hs-glass-lg);
    border-color: var(--hs-glass-2xl);
    color: #fff;
  }

  &--locked {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.hs-nav-icon { font-size: 1.1rem; line-height: 1; }
.hs-nav-lock { font-size: 0.6rem; opacity: 0.7; margin-left: 2px; }

</style>
