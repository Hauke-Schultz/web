<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <header class="site-header">
    <div class="container site-header__inner">
      <NuxtLink :to="localePath('/')" class="site-header__logo" aria-label="Home">
        MyProject
      </NuxtLink>

      <nav class="site-header__nav" :aria-label="t('nav.main')">
        <NuxtLink :to="localePath('/')">{{ t('nav.home') }}</NuxtLink>
      </nav>

      <div class="site-header__actions">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(8px);
}

.site-header__inner {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  height: 60px;
}

.site-header__logo {
  font-weight: 700;
  font-size: 1.1rem;
  text-decoration: none;
  color: var(--color-text);
  margin-right: auto;
}

.site-header__nav {
  display: flex;
  gap: var(--space-md);
}

.site-header__nav a {
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  transition: color var(--transition-fast);
}

.site-header__nav a:hover,
.site-header__nav a.router-link-active {
  color: var(--color-primary);
}

.site-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
</style>
