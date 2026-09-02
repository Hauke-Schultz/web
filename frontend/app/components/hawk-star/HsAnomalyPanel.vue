<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsDockingGame from './HsDockingGame.vue'

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
const typeKey  = computed(() => (flight.value ?? anomaly.value)?.type ?? '')

// ── Cards that are flown instead of clicked ───────────────────────────────────
// Some anomalies arrive carrying a `minigame` block (config.php decides which,
// and the reasoning for the set lives there). Those drop the two buttons for a
// docking approach: land the hulk and the big side pays, miss and the small one
// does.
//
// THE SHAPE IS "SMALL FOR FREE, OR FLY FOR THE BIG ONE", and it is worth being
// honest about what that costs: playing is never WORSE than waving it through,
// so there is no wager here and no tactical reason to decline. Waving through is
// a convenience — no time, no hands free, no appetite for a dexterity toy — not
// a play. The tension lives in the approach itself rather than in a decision in
// front of it.
//
// The alternative was to punish a botched landing with nothing at all, which
// would have made it a real gamble. It was rejected on the cadence:
// ANOMALY_INTERVAL_HOURS is 6, so a player gets ONE attempt every six hours and
// can never practise. Losing a rare event outright to a fumble is the worst
// feeling this tile can produce, and it would fall hardest on exactly the
// players least able to avoid it.
const minigame  = computed(() => anomaly.value?.minigame ?? null)

// THE FLIGHT HOLDS ITS OWN COPY OF THE ANOMALY, and it has to.
//
// `finish` fires at touchdown, so the resolve is already in flight while the
// verdict is still being read — and the answer sets the planet's `anomaly` to
// null, which is correct (it has been answered). Rendering the approach off the
// live `anomaly` therefore tore the whole card down at the instant of landing:
// the player saw the idle tile, never the touchdown, and never what they won.
// A snapshot keeps the field and its verdict alive until the player dismisses
// it, with no bearing on when the payout is claimed.
const flight = ref(null)
const startFlight = () => { flight.value = anomaly.value }
const closeFlight = () => { flight.value = null }

// What the head is describing: the snapshot while flying, the open anomaly
// otherwise. The head is identical either way, so it reads one of the two rather
// than being written twice.
const shown = computed(() => flight.value ?? anomaly.value)

const choiceFor = key => choices.value.find(c => c.key === key) ?? null
const winChoice  = computed(() => choiceFor(minigame.value?.win))
const loseChoice = computed(() => choiceFor(minigame.value?.lose))

// The approach reports the key it produced and that key is resolved as-is. There
// is no separate "I played" flag and no bonus riding on one, which is what keeps
// a faked landing from being worth anything a click could not already win — see
// the ANOMALIES comment in config.php.
const onFlightFinish = (key) => { resolveAnomaly(key) }

// ── Swiping the card away ─────────────────────────────────────────────────────
// A horizontal drag takes the small reward outright — the gesture the card's
// wording promises ("let it drift on"). The button below does the same thing and
// is the real affordance: the swipe is a shortcut for a thumb, never the only
// way out, because a gesture with no visible control is a feature only the
// player who guessed it has.
//
// The threshold is deliberately well past a tap's wobble, so a finger that moves
// a few pixels while pressing the approach button still presses it.
const SWIPE_PX = 70
const dragFrom = ref(null)
const dragDx   = ref(0)

const onCardDown = (e) => { dragFrom.value = e.clientX; dragDx.value = 0 }
const onCardMove = (e) => {
  if (dragFrom.value === null) return
  dragDx.value = e.clientX - dragFrom.value
}
const onCardUp = () => {
  const dx = dragDx.value
  dragFrom.value = null
  dragDx.value = 0
  if (Math.abs(dx) >= SWIPE_PX && !anomalyBusy.value && loseChoice.value) {
    resolveAnomaly(loseChoice.value.key)
  }
}
</script>

<template>
  <div class="hs-anomaly">
    <!-- Quiet tile: nothing is waiting right now. `!flight` holds the field open
         through the moment of landing — the payout is claimed at touchdown, so
         `hasAnomaly` has already gone false while the verdict is still up. -->
    <div v-if="!hasAnomaly && !flight" class="hs-anomaly-idle">
      <span class="hs-anomaly-idle__icon">📡</span>
      <span class="hs-anomaly-idle__text">{{ t('hawkStar.anomaly.idle') }}</span>
    </div>

    <!-- One closed card: heading, the instruction and whatever answers it belong
         to the same decision, so they share a single frame. The head is the same
         whether the card is clicked or flown — only what sits under it changes,
         which is why the two forms branch inside the card rather than duplicating
         it. -->
    <div
      v-else
      class="hs-anomaly-card"
      :class="{ 'hs-anomaly-card--flown': !!minigame || !!flight }"
      @pointerdown="minigame && !flight ? onCardDown($event) : null"
      @pointermove="minigame && !flight ? onCardMove($event) : null"
      @pointerup="minigame && !flight ? onCardUp() : null"
      @pointercancel="minigame && !flight ? onCardUp() : null"
    >
      <div class="hs-anomaly-head">
        <span class="hs-anomaly-icon">{{ shown.icon }}</span>
        <div class="hs-anomaly-headtext">
          <div class="hs-anomaly-name">{{ t('hawkStar.anomaly.types.' + typeKey + '.name') }}</div>
          <div class="hs-anomaly-desc">{{ t('hawkStar.anomaly.types.' + typeKey + '.desc') }}</div>
        </div>
        <!-- No clock during the approach: the countdown belongs to the offer, and
             the offer has already been answered by the time the hulk is falling. -->
        <span v-if="!flight" class="hs-anomaly-timer" :title="t('hawkStar.anomaly.expiresHint')">⏳ {{ timeLeft }}</span>
      </div>

      <!-- ── Flown card ──────────────────────────────────────────────────────
           The approach in place of the two buttons. It replaces the card's body
           rather than opening over the page: the head above it is still naming
           what is drifting in, and that is the caption the field wants. It reads
           the SNAPSHOT, never the live anomaly — which is gone the instant the
           landing is claimed. -->
      <HsDockingGame
        v-if="flight"
        :anomaly="flight"
        @finish="onFlightFinish"
        @close="closeFlight"
      />

      <template v-else-if="minigame">
        <div class="hs-anomaly-prompt">{{ t('hawkStar.anomaly.dock.prompt') }}</div>

        <div class="hs-anomaly-flight">
          <!-- The big side, and the only route to it. Its deltas are printed
               exactly as a clickable choice prints them, because it IS one —
               the approach decides whether it pays, not what it pays. -->
          <button
            class="hs-anomaly-choice hs-anomaly-choice--fly"
            :disabled="anomalyBusy"
            @click="startFlight()"
          >
            <span class="hs-anomaly-choice__label">
              🚀 {{ t('hawkStar.anomaly.types.' + typeKey + '.choices.' + minigame.win) }}
            </span>
            <span class="hs-anomaly-deltas">
              <span v-for="g in winChoice?.gains ?? []" :key="'w' + g.res" :title="g.name" class="hs-anomaly-delta hs-anomaly-delta--gain">
                {{ g.icon }} +{{ g.amount }}
              </span>
              <span v-if="(winChoice?.battery ?? 0) > 0" class="hs-anomaly-delta hs-anomaly-delta--gain">
                {{ t('hawkStar.anomaly.batteryDelta', { pct: winChoice.battery }) }}
              </span>
            </span>
          </button>

          <!-- The consolation, taken outright. Quieter than the button above
               on purpose: it is the way out, not the offer. -->
          <button
            class="hs-anomaly-wave"
            :disabled="anomalyBusy"
            @click="resolveAnomaly(minigame.lose)"
          >
            <span class="hs-anomaly-wave__label">
              {{ t('hawkStar.anomaly.types.' + typeKey + '.choices.' + minigame.lose) }}
            </span>
            <span class="hs-anomaly-deltas">
              <span v-for="g in loseChoice?.gains ?? []" :key="'l' + g.res" :title="g.name" class="hs-anomaly-delta hs-anomaly-delta--gain">
                {{ g.icon }} +{{ g.amount }}
              </span>
              <span v-if="(loseChoice?.battery ?? 0) > 0" class="hs-anomaly-delta hs-anomaly-delta--gain">
                {{ t('hawkStar.anomaly.batteryDelta', { pct: loseChoice.battery }) }}
              </span>
            </span>
          </button>
        </div>
      </template>

      <!-- ── Clicked card ────────────────────────────────────────────────────
           Two guaranteed outcomes, unchanged: the anomalies whose sides are
           equals have nothing for a skill gate to rank. -->
      <template v-else>
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
      </template>

      <!-- Shared by both forms: a refusal has to be readable whether the answer
           was clicked or flown. -->
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

/* ── The flown card ─────────────────────────────────────────────────────────
   A drag across it takes the small reward, so the browser's own horizontal
   gesture has to stay out of the way — otherwise the swipe scrolls the page
   under the card instead of answering it. */
.hs-anomaly-card--flown { touch-action: pan-y; }

/* Stacked rather than side by side: these two are NOT equals the way the
   clicked card's pair are, and setting them in matching columns either side of
   an "or" would say they were. The offer sits on top at full width, the way out
   sits under it. */
.hs-anomaly-flight {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.45rem 0.6rem 0.6rem;
}

.hs-anomaly-choice--fly {
  flex: none;
  gap: 0.35rem;
  border-color: rgba(129, 140, 248, 0.7);
  background: rgba(129, 140, 248, 0.22);

  &:hover:not(:disabled) { background: rgba(129, 140, 248, 0.34); }
}

/* Deliberately not a `.hs-anomaly-choice`: the consolation must not look like
   the offer above it, or the card reads as two options again. */
.hs-anomaly-wave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.4rem 0.55rem;
  border-radius: var(--hs-r-sm);
  border: 1px dashed var(--hs-line-lg);
  background: var(--hs-glass-xs);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }

  .hs-anomaly-deltas { margin-top: 0; }
}
.hs-anomaly-wave__label {
  font-size: 0.64rem;
  font-weight: 600;
  line-height: 1.25;
  opacity: 0.75;
  overflow-wrap: anywhere;
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
