<script setup lang="ts">
const { init } = useTheme()
onMounted(init)
</script>

<template>
  <div class="flex flex-col min-h-dvh">
    <AppHeader />
    <main id="main-content" tabindex="-1" class="flex-1">
      <slot />
    </main>
  </div>
</template>
