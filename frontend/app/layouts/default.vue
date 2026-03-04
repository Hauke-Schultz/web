<script setup lang="ts">
const { init } = useTheme()
onMounted(init)
</script>

<template>
  <div class="site-wrapper">
    <AppHeader />
    <main id="main-content" tabindex="-1">
      <slot />
    </main>
    <footer class="site-footer">
      <div class="container">
        <p>&copy; {{ new Date().getFullYear() }} MyProject</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.site-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

main {
  flex: 1;
}

.site-footer {
  padding-block: var(--space-lg);
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>
