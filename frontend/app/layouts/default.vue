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
    <footer class="py-6 border-t border-border text-muted text-sm">
      <div class="container">
        <p>&copy; {{ new Date().getFullYear() }} MyProject</p>
      </div>
    </footer>
  </div>
</template>
