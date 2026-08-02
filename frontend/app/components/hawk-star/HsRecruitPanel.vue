<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { t } = useI18n()
const { recruitPool, recruitPoolMax, canRecruit, recruit } = useHawkStar()

const pool = computed(() => Math.floor(recruitPool.value ?? 0))
const pct  = computed(() => recruitPoolMax.value ? Math.min(100, (recruitPool.value / recruitPoolMax.value) * 100) : 0)
</script>

<template>
  <div class="hs-recruit">
    <div class="hs-recruit__head">
      <span class="hs-recruit__title">👥 {{ t('hawkStar.recruit.title') }}</span>
      <span class="hs-recruit__pool">{{ pool }} / {{ recruitPoolMax }}</span>
    </div>

    <div class="hs-recruit__track">
      <div class="hs-recruit__fill" :style="{ width: pct + '%' }" />
    </div>

    <button class="hs-recruit__btn" :disabled="!canRecruit" @click="recruit">
      +1 👥 {{ t('hawkStar.recruit.button') }}
    </button>

    <p class="hs-recruit__hint">{{ t('hawkStar.recruit.hint') }}</p>
  </div>
</template>

<style lang="scss" scoped>
.hs-recruit {
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.75rem;
  margin-bottom: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hs-recruit__head { display: flex; align-items: center; justify-content: space-between; }
.hs-recruit__title { font-size: 0.8rem; font-weight: 700; color: #fff; }
.hs-recruit__pool  { font-size: 0.8rem; font-weight: 700; color: #c4b5fd; font-variant-numeric: tabular-nums; }

.hs-recruit__track {
  height: 0.6rem;
  border-radius: 9999px;
  background: var(--hs-glass-3xl);
  overflow: hidden;
}
.hs-recruit__fill {
  height: 100%;
  border-radius: 9999px;
  background: #a78bfa;
  transition: width 0.4s ease;
}

.hs-recruit__btn {
  padding: 0.45rem 0.7rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.78rem;
  font-weight: 700;
  border: 1px solid rgba(167, 139, 250, 0.45);
  background: rgba(167, 139, 250, 0.16);
  color: #ddd6fe;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.05s;

  &:hover:not(:disabled) { background: rgba(167, 139, 250, 0.3); border-color: rgba(167, 139, 250, 0.7); }
  &:active:not(:disabled) { transform: scale(0.97); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.hs-recruit__hint { font-size: 0.6rem; opacity: 0.4; margin: 0; }
</style>
