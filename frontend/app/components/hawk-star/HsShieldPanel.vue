<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { SHIELD, RESOURCES } from '~/utils/hawkStarConfig.js'

const { t } = useI18n()
const {
  shieldCharge,
  shieldHoursToEmpty,
  shieldDown,
  shieldFull,
  canChargeShield,
  shieldError,
  chargeShield,
  playerResources,
} = useHawkStar()

const pct = computed(() => Math.round(shieldCharge.value ?? 0))

const level = computed(() => {
  if (shieldDown.value) return 'empty'
  if (pct.value < 20) return 'low'
  if (pct.value < 50) return 'mid'
  return 'ok'
})

// The click costs resources, so the cost belongs on the button itself — the
// battery next door is free and deliberately shows none.
const cost = computed(() =>
  Object.entries(SHIELD.clickCost).map(([res, amount]) => ({
    res,
    amount,
    icon: RESOURCES[res]?.icon ?? '•',
    ok: (playerResources.value[res] ?? 0) >= amount,
  }))
)

const timeLeft = computed(() => {
  const h = shieldHoursToEmpty.value
  if (h == null || h <= 0) return ''
  if (h < 1)  return `~${Math.max(1, Math.round(h * 60))} min`
  if (h < 24) return `~${Math.round(h)} h`
  const d = Math.floor(h / 24)
  const rest = Math.round(h % 24)
  return rest ? `~${d} d ${rest} h` : `~${d} d`
})

const desc = computed(() => {
  const head = timeLeft.value
    ? `${t('hawkStar.shield.title')} · ${t('hawkStar.shield.timeLeft', { time: timeLeft.value })}`
    : t('hawkStar.shield.title')
  return `${head} — ${t('hawkStar.shield.hint')}`
})
</script>

<template>
  <div class="hs-shield-wrap">
    <button
      class="hs-meter-btn hs-shield"
      :class="`hs-shield--${level}`"
      :disabled="!canChargeShield"
      @click="chargeShield"
    >
      <span class="hs-meter-btn__track">
        <span class="hs-meter-btn__fill" :style="{ width: pct + '%' }" />
      </span>

      <span class="hs-meter-btn__row">
        <span class="hs-meter-btn__label">
          🛡️ {{ t('hawkStar.shield.charge', { n: SHIELD.clickPercent }) }}
        </span>

        <span v-if="shieldDown" class="hs-meter-btn__value hs-meter-btn__value--alert">
          ⚠ {{ t('hawkStar.shield.down') }}
        </span>
        <span v-else class="hs-meter-btn__value">{{ pct }}%</span>
      </span>

      <span class="hs-meter-btn__row">
        <span class="hs-shield-cost">
          <span
            v-for="c in cost"
            :key="c.res"
            class="hs-shield-cost__tag"
            :class="c.ok ? 'hs-shield-cost__tag--ok' : 'hs-shield-cost__tag--no'"
          >{{ c.icon }} {{ c.amount }}</span>
        </span>
        <span v-if="shieldFull" class="hs-meter-btn__value">{{ t('hawkStar.shield.full') }}</span>
      </span>

      <span class="hs-meter-btn__desc">{{ desc }}</span>
    </button>

    <div v-if="shieldError" class="hs-shield-error">{{ shieldError }}</div>
  </div>
</template>

<style lang="scss" scoped>
/* Same slim meter button as HsPowerBattery — the two mechanics look alike on
   purpose, they only differ in colour and in the cost row. */
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
  &:disabled { opacity: 0.45; cursor: not-allowed; }
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
  transition: width 0.4s ease, background 0.3s ease;
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
.hs-meter-btn__value--alert { opacity: 1; color: #fca5a5; font-weight: 700; }
.hs-meter-btn__desc {
  font-size: 0.6rem;
  font-weight: 400;
  line-height: 1.3;
  opacity: 0.55;
}

.hs-shield-cost {
  display: flex;
  gap: 0.25rem;
}
.hs-shield-cost__tag {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  &--ok { color: var(--hs-ok);     background: var(--hs-ok-bg-dim);      border: 1px solid var(--hs-ok-border); }
  &--no { color: var(--hs-danger); background: var(--hs-danger-bg-cost); border: 1px solid var(--hs-danger-border); }
}

.hs-shield {
  --accent: #38bdf8;
  --accent-line: rgba(56, 189, 248, 0.45);
  --accent-line-hover: rgba(56, 189, 248, 0.7);
  --accent-bg: rgba(56, 189, 248, 0.14);
  --accent-bg-hover: rgba(56, 189, 248, 0.28);
  --accent-fg: #bae6fd;

  &--ok    { --accent: #38bdf8; }
  &--mid   { --accent: #60a5fa; }
  &--low   { --accent: #f59e0b; }
  &--empty {
    --accent: #ef4444;
    --accent-line: rgba(239, 68, 68, 0.5);
    --accent-bg: rgba(239, 68, 68, 0.1);
  }
}

.hs-shield-error {
  margin: -0.25rem 0 0.5rem;
  font-size: 0.62rem;
  color: var(--hs-danger);
}
</style>
