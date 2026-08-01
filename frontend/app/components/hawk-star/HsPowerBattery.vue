<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { t } = useI18n()
const { batteryCharge, batteryHoursToEmpty, gridDown, chargeBattery } = useHawkStar()

const pct = computed(() => Math.round(batteryCharge.value ?? 0))

const level = computed(() => {
  if (gridDown.value) return 'empty'
  if (pct.value < 20) return 'low'
  if (pct.value < 50) return 'mid'
  return 'ok'
})

const timeLeft = computed(() => {
  const h = batteryHoursToEmpty.value
  if (h == null) return ''
  if (h <= 0) return ''
  if (h < 1)  return `~${Math.max(1, Math.round(h * 60))} min`
  if (h < 24) return `~${Math.round(h)} h`
  const d = Math.floor(h / 24)
  const rest = Math.round(h % 24)
  return rest ? `~${d} d ${rest} h` : `~${d} d`
})
</script>

<template>
  <div class="hs-battery" :class="`hs-battery--${level}`">
    <div class="hs-battery__head">
      <span class="hs-battery__title">🔋 {{ t('hawkStar.battery.title') }}</span>
      <span class="hs-battery__pct">{{ pct }}%</span>
    </div>

    <div class="hs-battery__track">
      <div class="hs-battery__fill" :style="{ width: pct + '%' }" />
    </div>

    <div class="hs-battery__foot">
      <span v-if="gridDown" class="hs-battery__status hs-battery__status--empty">
        ⚠ {{ t('hawkStar.battery.blackout') }}
      </span>
      <span v-else class="hs-battery__status">
        {{ t('hawkStar.battery.timeLeft', { time: timeLeft }) }}
      </span>

      <button class="hs-battery__btn" @click="chargeBattery">
        ⚡ {{ t('hawkStar.battery.charge') }}
      </button>
    </div>

    <p class="hs-battery__hint">{{ t('hawkStar.battery.hint') }}</p>
  </div>
</template>

<style lang="scss" scoped>
.hs-battery {
  --bat: #10b981;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.75rem;
  margin-bottom: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &--ok    { --bat: #10b981; }
  &--mid   { --bat: #fbbf24; }
  &--low   { --bat: #f59e0b; }
  &--empty {
    --bat: #ef4444;
    border-color: rgba(239, 68, 68, 0.5);
    background: rgba(239, 68, 68, 0.08);
    animation: hs-battery-pulse 1.6s ease-in-out infinite;
  }
}

.hs-battery__head { display: flex; align-items: center; justify-content: space-between; }
.hs-battery__title { font-size: 0.8rem; font-weight: 700; color: #fff; }
.hs-battery__pct   { font-size: 0.8rem; font-weight: 700; color: var(--bat); font-variant-numeric: tabular-nums; }

.hs-battery__track {
  height: 0.75rem;
  border-radius: 9999px;
  background: var(--hs-glass-3xl);
  overflow: hidden;
}
.hs-battery__fill {
  height: 100%;
  border-radius: 9999px;
  background: var(--bat);
  transition: width 0.4s ease, background 0.3s ease;
}

.hs-battery__foot { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }

.hs-battery__status { font-size: 0.68rem; color: rgba(255, 255, 255, 0.55); font-variant-numeric: tabular-nums; }
.hs-battery__status--empty { color: #fca5a5; font-weight: 700; }

.hs-battery__btn {
  padding: 0.35rem 0.7rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid rgba(251, 191, 36, 0.45);
  background: rgba(251, 191, 36, 0.14);
  color: #fde68a;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, transform 0.05s;

  &:hover  { background: rgba(251, 191, 36, 0.28); border-color: rgba(251, 191, 36, 0.7); }
  &:active { transform: scale(0.96); }
}

.hs-battery__hint { font-size: 0.6rem; opacity: 0.4; margin: 0; }

@keyframes hs-battery-pulse {
  0%, 100% { border-color: rgba(239, 68, 68, 0.5); }
  50%      { border-color: rgba(239, 68, 68, 0.9); }
}
</style>
