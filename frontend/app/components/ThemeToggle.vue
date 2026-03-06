<script setup lang="ts">
const { theme, toggle } = useTheme()

const label = computed(() =>
  theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
)
</script>

<template>
  <button
    class="inline-flex items-center justify-center w-10 h-10 border border-border rounded-lg bg-surface cursor-pointer text-[1.1rem] transition-colors hover:bg-surface-alt"
    :aria-label="label"
    :title="label"
    @click="toggle"
  >
    <span v-if="theme === 'dark'" aria-hidden="true">☀️</span>
    <span v-else aria-hidden="true">🌙</span>
  </button>
</template>
