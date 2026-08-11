<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { t } = useI18n()
const {
  anomaly,
  hasAnomaly,
  anomalySecondsLeft,
  anomalyBusy,
  anomalyError,
  resolveAnomaly,
  playerResources,
  formatTime,
} = useHawkStar()

// The server ships each choice as concrete deltas, so a choice renders the same
// way no matter which anomaly type produced it — new types need no UI work.
const rows = (choice, kind) =>
  Object.entries(choice?.[kind] ?? {}).map(([res, amount]) => ({
    res,
    amount,
    icon: RESOURCES[res]?.icon ?? '•',
    name: t('hawkStar.res.' + res),
  }))

const choices = computed(() => (anomaly.value?.choices ?? []).map(c => ({
  ...c,
  gains: rows(c, 'gain'),
  costs: rows(c, 'cost'),
  // A choice is only blocked by what it costs — every payout is a gift.
  affordable: Object.entries(c.cost ?? {}).every(
    ([res, amt]) => (playerResources.value[res] ?? 0) >= amt
  ),
})))

const timeLeft = computed(() => formatTime(anomalySecondsLeft.value))
const typeKey  = computed(() => anomaly.value?.type ?? '')
</script>

<template>
  <div class="hs-anomaly">
    <!-- Quiet tile: nothing is waiting right now -->
    <div v-if="!hasAnomaly" class="hs-anomaly-idle">
      <span class="hs-anomaly-idle__icon">📡</span>
      <span class="hs-anomaly-idle__text">{{ t('hawkStar.anomaly.idle') }}</span>
    </div>

    <!-- One closed card: heading, the "pick one" instruction and both options
         belong to the same decision, so they share a single frame. -->
    <div v-else class="hs-anomaly-card">
      <div class="hs-anomaly-head">
        <span class="hs-anomaly-icon">{{ anomaly.icon }}</span>
        <div class="hs-anomaly-headtext">
          <div class="hs-anomaly-name">{{ t('hawkStar.anomaly.types.' + typeKey + '.name') }}</div>
          <div class="hs-anomaly-desc">{{ t('hawkStar.anomaly.types.' + typeKey + '.desc') }}</div>
        </div>
        <span class="hs-anomaly-timer" :title="t('hawkStar.anomaly.expiresHint')">⏳ {{ timeLeft }}</span>
      </div>

      <div class="hs-anomaly-prompt">{{ t('hawkStar.anomaly.prompt') }}</div>

      <div class="hs-anomaly-choices">
        <template v-for="(choice, i) in choices" :key="choice.key">
          <!-- The "or" between the two buttons is what makes the fork readable -->
          <span v-if="i > 0" class="hs-anomaly-or">{{ t('hawkStar.anomaly.or') }}</span>

          <button
            class="hs-anomaly-choice"
            :disabled="anomalyBusy || !choice.affordable"
            @click="resolveAnomaly(choice.key)"
          >
            <span class="hs-anomaly-choice__label">
              {{ t('hawkStar.anomaly.types.' + typeKey + '.choices.' + choice.key) }}
            </span>

            <span class="hs-anomaly-deltas">
              <span v-for="g in choice.gains" :key="'g' + g.res" :title="g.name" class="hs-anomaly-delta hs-anomaly-delta--gain">
                {{ g.icon }} +{{ g.amount }}
              </span>
              <!-- Spelled out rather than given an icon: the power cell already
                   owns 🔋, and "🔋 +2" next to "🔋 +40 %" would read as one thing -->
              <span v-if="choice.battery > 0" class="hs-anomaly-delta hs-anomaly-delta--gain">
                {{ t('hawkStar.anomaly.batteryDelta', { pct: choice.battery }) }}
              </span>
              <span v-for="c in choice.costs" :key="'c' + c.res" :title="c.name" class="hs-anomaly-delta hs-anomaly-delta--cost">
                {{ c.icon }} −{{ c.amount }}
              </span>
            </span>

            <span v-if="!choice.affordable" class="hs-anomaly-blocked">
              {{ t('hawkStar.anomaly.cannotAfford') }}
            </span>
          </button>
        </template>
      </div>

      <div v-if="anomalyError" class="hs-anomaly-error">{{ anomalyError }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-anomaly {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.hs-anomaly-idle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.7rem;
  border-radius: var(--hs-r-sm);
  border: 1px dashed var(--hs-line-lg);
  background: var(--hs-glass-xs);
}
.hs-anomaly-idle__icon { font-size: 1rem; opacity: 0.5; }
.hs-anomaly-idle__text { font-size: 0.66rem; opacity: 0.45; line-height: 1.4; }

/* The whole decision lives in one frame — head, instruction and both options. */
.hs-anomaly-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(129, 140, 248, 0.4);
  background: rgba(129, 140, 248, 0.07);
  overflow: hidden;
}

.hs-anomaly-head {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.55rem 0.7rem;
  border-bottom: 1px solid rgba(129, 140, 248, 0.25);
  background: rgba(129, 140, 248, 0.14);
}
.hs-anomaly-icon { font-size: 1.35rem; line-height: 1.1; }
.hs-anomaly-headtext { flex: 1; min-width: 0; }
.hs-anomaly-name {
  font-size: 0.76rem;
  font-weight: 700;
  color: #c7d2fe;
}
.hs-anomaly-desc {
  font-size: 0.62rem;
  line-height: 1.35;
  opacity: 0.6;
  margin-top: 1px;
}
.hs-anomaly-timer {
  font-size: 0.62rem;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

/* Says out loud what the tile expects: pick one, the other is gone. */
.hs-anomaly-prompt {
  padding: 0.45rem 0.7rem 0;
  font-size: 0.6rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #c7d2fe;
  opacity: 0.75;
}

/* The two options sit left and right, split by the "or" — the fork is the layout. */
.hs-anomaly-choices {
  display: flex;
  align-items: stretch;
  gap: 0.35rem;
  padding: 0.45rem 0.6rem 0.6rem;
}

.hs-anomaly-or {
  flex: 0 0 auto;
  align-self: center;
  font-size: 0.55rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.45;
}

.hs-anomaly-choice {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.3rem;
  padding: 0.5rem 0.55rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(129, 140, 248, 0.4);
  background: rgba(129, 140, 248, 0.12);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s, transform 0.05s;

  &:hover:not(:disabled)  { background: rgba(129, 140, 248, 0.26); border-color: rgba(129, 140, 248, 0.7); }
  &:active:not(:disabled) { transform: scale(0.99); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.hs-anomaly-choice__label {
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

/* Stacked, not wrapped: in a half-width column one delta per line stays legible. */
.hs-anomaly-deltas {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.2rem;
  margin-top: auto;
}
.hs-anomaly-delta {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  &--gain { color: var(--hs-ok);     background: var(--hs-ok-bg-dim);     border: 1px solid var(--hs-ok-border); }
  &--cost { color: var(--hs-danger); background: var(--hs-danger-bg-cost); border: 1px solid var(--hs-danger-border); }
}

.hs-anomaly-blocked {
  font-size: 0.58rem;
  font-weight: 600;
  color: var(--hs-danger);
  opacity: 0.9;
}

.hs-anomaly-error {
  padding: 0 0.7rem 0.55rem;
  font-size: 0.62rem;
  color: var(--hs-danger);
}
</style>
