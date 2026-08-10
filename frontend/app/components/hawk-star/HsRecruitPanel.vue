<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { t } = useI18n()
const { recruitPool, recruitPoolMax, recruitGrowthPerDay, canRecruit, recruit } = useHawkStar()

const pool = computed(() => Math.floor(recruitPool.value ?? 0))
const pct  = computed(() => recruitPoolMax.value ? Math.min(100, (recruitPool.value / recruitPoolMax.value) * 100) : 0)

const desc = computed(() => `${t('hawkStar.recruit.title')} — ${t('hawkStar.recruit.hint', {
  rate: recruitGrowthPerDay.value,
  max: Math.floor(recruitPoolMax.value),
})}`)
</script>

<template>
  <button
    class="hs-meter-btn hs-recruit"
    :disabled="!canRecruit"
    @click="recruit"
  >
    <span class="hs-meter-btn__track">
      <span class="hs-meter-btn__fill" :style="{ width: pct + '%' }" />
    </span>

    <span class="hs-meter-btn__row">
      <span class="hs-meter-btn__label">👥 {{ t('hawkStar.recruit.perClick') }}</span>
      <span class="hs-meter-btn__value">{{ t('hawkStar.recruit.available', { n: pool }) }}</span>
    </span>

    <span class="hs-meter-btn__desc">{{ desc }}</span>
  </button>
</template>

<style lang="scss" scoped>
/* Shares its shape with HsPowerBattery: one slim button, status bar on the top edge. */
.hs-meter-btn {
  position: relative;
  overflow: hidden;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.15rem;
  padding: 0.4rem 0.6rem;
  padding-top: calc(0.4rem + 3px);
  margin-bottom: 0.5rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid var(--accent-line);
  background: var(--accent-bg);
  color: var(--accent-fg);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s, transform 0.05s;

  &:hover:not(:disabled)  { background: var(--accent-bg-hover); border-color: var(--accent-line-hover); }
  &:active:not(:disabled) { transform: scale(0.99); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.hs-meter-btn__track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--hs-glass-3xl);
}
.hs-meter-btn__fill {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.4s ease;
}

.hs-meter-btn__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.hs-meter-btn__label {
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
}
.hs-meter-btn__value {
  font-size: 0.66rem;
  font-weight: 600;
  opacity: 0.7;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.hs-meter-btn__desc {
  font-size: 0.6rem;
  font-weight: 400;
  line-height: 1.3;
  opacity: 0.55;
}

.hs-recruit {
  --accent: #a78bfa;
  --accent-line: rgba(167, 139, 250, 0.45);
  --accent-line-hover: rgba(167, 139, 250, 0.7);
  --accent-bg: rgba(167, 139, 250, 0.16);
  --accent-bg-hover: rgba(167, 139, 250, 0.3);
  --accent-fg: #ddd6fe;
}
</style>
