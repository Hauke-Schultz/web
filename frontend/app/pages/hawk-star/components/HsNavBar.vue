<script setup>
import { useHawkStar } from '../useHawkStar.js'

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
        'hs-nav-tab--active':  currentView === 'galaxy',
        'hs-nav-tab--locked':  starMapLevel === 0,
      }"
      :disabled="starMapLevel === 0"
      :title="starMapLevel === 0 ? 'Build Star Map to unlock' : 'Galaxy Map'"
      @click="emit('update:currentView', 'galaxy')"
    >
      <span class="hs-nav-icon">🗺️</span>
      <span>Galaxy</span>
      <span v-if="starMapLevel === 0" class="hs-nav-lock">🔒</span>
    </button>
  </nav>
</template>

<style lang="scss" scoped>
.hs-nav {
  display: flex;
  gap: 0.375rem;
  width: 100%;
  max-width: 52rem;
  margin-bottom: 0.75rem;
}

.hs-nav-tab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
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

.hs-nav-icon { font-size: 0.875rem; }
.hs-nav-lock { font-size: 0.6rem; opacity: 0.7; margin-left: 2px; }
</style>
