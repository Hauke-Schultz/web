<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
</script>

<template>
  <nav class="lang-switcher" aria-label="Language">
    <ul role="list">
      <li v-for="loc in locales" :key="loc.code">
        <NuxtLink
          :to="switchLocalePath(loc.code)"
          :hreflang="loc.language"
          :aria-current="locale === loc.code ? 'true' : undefined"
          :class="{ active: locale === loc.code }"
        >
          {{ loc.code.toUpperCase() }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.lang-switcher ul {
  display: flex;
  gap: var(--space-xs);
  list-style: none;
}

.lang-switcher a {
  display: inline-block;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-decoration: none;
  color: var(--color-text-muted);
  transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
}

.lang-switcher a:hover,
.lang-switcher a.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: transparent;
}
</style>
