<script setup lang="ts">
const { theme, toggle } = useTheme()

const label = computed(() =>
  theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
)
</script>

<template>
  <button
    class="theme-toggle"
    :aria-label="label"
    :title="label"
    @click="toggle"
  >
    <span v-if="theme === 'dark'" aria-hidden="true">☀️</span>
    <span v-else aria-hidden="true">🌙</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  font-size: 1.1rem;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.theme-toggle:hover {
  background: var(--color-surface-alt);
}
</style>
