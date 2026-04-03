<script setup lang="ts">
const { init, applyTheme } = useTheme()
const route = useRoute()
onMounted(() => {
  init()
  const forced = route.meta.forceTheme as string | undefined
  if (forced === 'dark' || forced === 'light') applyTheme(forced)
})

const hideHeader = computed(() => !!route.meta.hideHeader)
</script>

<template>
  <div class="flex flex-col min-h-dvh">
    <AppHeader v-if="!hideHeader" />
    <main id="main-content" tabindex="-1" class="flex-1">
      <slot />
    </main>
  </div>
</template>
