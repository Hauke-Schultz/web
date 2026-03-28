<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const hideNav = computed(() => !!route.meta.hideNav)
</script>

<template>
  <header class="sticky top-0 z-[100] bg-surface border-b border-border backdrop-blur-sm">
    <div class="container flex items-center gap-6 h-[60px]">
      <NuxtLink
        v-if="!hideNav"
        :to="localePath('/')"
        class="font-bold text-lg no-underline text-fg mr-auto"
        aria-label="Home"
      >
        Hauke Schultz
      </NuxtLink>

      <nav v-if="!hideNav" class="flex gap-4" :aria-label="t('nav.main')">
        <NuxtLink
          :to="localePath('/')"
          class="no-underline text-muted text-sm transition-colors hover:text-primary [&.router-link-active]:text-primary"
        >{{ t('nav.home') }}</NuxtLink>
      </nav>

      <div class="flex items-center gap-2 ml-auto">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </div>
  </header>
</template>
