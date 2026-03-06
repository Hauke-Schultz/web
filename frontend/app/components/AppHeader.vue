<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <header class="sticky top-0 z-[100] bg-surface border-b border-border backdrop-blur-sm">
    <div class="container flex items-center gap-6 h-[60px]">
      <NuxtLink
        :to="localePath('/')"
        class="font-bold text-lg no-underline text-fg mr-auto"
        aria-label="Home"
      >
        MyProject
      </NuxtLink>

      <nav class="flex gap-4" :aria-label="t('nav.main')">
        <NuxtLink
          :to="localePath('/')"
          class="no-underline text-muted text-sm transition-colors hover:text-primary [&.router-link-active]:text-primary"
        >{{ t('nav.home') }}</NuxtLink>
        <NuxtLink
          :to="localePath('/party')"
          class="no-underline text-muted text-sm transition-colors hover:text-primary [&.router-link-active]:text-primary"
        >{{ t('nav.party') }}</NuxtLink>
      </nav>

      <div class="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </div>
  </header>
</template>
