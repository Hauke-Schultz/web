<script setup>
import { useI18n } from 'vue-i18n'

const { locale, setLocale } = useI18n()

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
]
</script>

<template>
  <div class="hs-lang">
    <button
      v-for="loc in LOCALES"
      :key="loc.code"
      class="hs-lang-btn"
      :class="{ 'hs-lang-btn--active': locale === loc.code }"
      @click="setLocale(loc.code)"
    >{{ loc.label }}</button>
  </div>
</template>

<style lang="scss" scoped>
.hs-lang {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;

  @media (min-width: 640px) {
    gap: 0.5rem;
  }
}

.hs-lang-btn {
  flex: 1;
  padding: 0.25rem 0.35rem;
  border-radius: var(--hs-r-md);
  border: 1px solid var(--hs-line-sm);
  background: var(--hs-glass-sm);
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover:not(.hs-lang-btn--active) {
    background: var(--hs-glass-md);
    color: rgba(255, 255, 255, 0.7);
  }

  &--active {
    background: var(--hs-glass-lg);
    border-color: var(--hs-glass-2xl);
    color: rgba(255, 255, 255, 0.85);
  }
}
</style>
