<script setup>
// ── Docking approach ──────────────────────────────────────────────────────────
// The overlay an anomaly card opens instead of showing two buttons. Something is
// drifting toward your lock, and you have one job: bring it down slowly enough
// to hold it. Land it and the card's big prize pays; miss and it drifts past and
// pays the small one. THERE IS NO LOSING OUTCOME — see HsAnomalyPanel.vue for
// why that shape was chosen.
//
// ONE INPUT, HELD: press anywhere to fire the retro thruster, release to drift.
// And ONE RULE that makes it a game rather than a button: THE THRUSTER ONLY EVER
// SLOWS THE DESCENT, NEVER REVERSES IT. You cannot climb, cannot hover back up,
// cannot fly off the top of the screen. Holding is always "less speed" — the
// input has no wrong direction, only a wrong moment.
//
// The whole skill is therefore WHEN to start the burn, and it has two walls:
//
//   too late   you arrive above V_MAX and the hulk bounces off the collar
//   too early  you stall short, drift, and burn the tank down doing it
//
// ── Why the tank and not a closing iris ───────────────────────────────────────
// A lander judged only on touchdown speed has one degenerate strategy: brake at
// once and CREEP down at walking pace. A player finds it on their first attempt,
// so it has to be answered by a rule rather than by tuning.
//
// The first answer was an iris that shut on a timer, and `docking-difficulty.mjs`
// showed it did NOTHING: at 6.5 s, 7.5 s and 9.0 s the landing rates came out
// identical to the decimal, because every approach is over in about 5.3 s. It
// was a second rule to learn that changed no outcome.
//
// FUEL_S is the wall that actually holds, and it holds better because it
// punishes the exploit specifically instead of punishing slowness in general: a
// creeper burns dry and then free-falls the rest of the shaft, arriving at
// 36–43 %/s against a V_MAX of 27. A BIGGER TANK DOES NOT RESCUE IT — it only
// runs out lower down and hits harder. The 20 s timeout below is a plain
// "drifted past" fallback for an abandoned tab; it is not a difficulty lever and
// must not be tuned as one.
//
// ── Why these numbers ─────────────────────────────────────────────────────────
// Measured, not guessed. `scratchpad/docking-difficulty.mjs` runs this exact
// physics against simulated pilots — each with a standing misjudgement of how
// much room the brake needs, plus a reaction latency — and reports:
//
//   pilot                      landed    hot     dry
//   careless  ±40 %, 400 ms      47 %    53 %     0 %
//   average   ±22 %, 260 ms      76 %    24 %     0 %
//   good      ±12 %, 180 ms      98 %     2 %     0 %
//   excellent ±5 %,  110 ms     100 %     0 %     0 %
//
// Those are the figures at the STEP below (1/120). The script integrates at
// 1/60 and lands within a point or two of each — checked, because a table
// measured at a different step than the one that ships is a table about a
// different game.
//
// ~75 % FOR AN AVERAGE PILOT IS THE DELIBERATE TARGET, and it is much higher
// than the other two toys aim for. An anomaly rolls once every six hours
// (ANOMALY_INTERVAL_HOURS), so a player gets ONE attempt and can never practise.
// The salvage ring can sit near 50 % because casting again is free; intercept
// can, because a sortie is many rounds. A skill game nobody can practise must
// not punish. If this ever needs to be harder, V_MAX is the honest lever — it is
// the only one the sweep moved (23 → 29 walks an average pilot 53 % → 84 %).
//
// REACTION LATENCY IS WHY THE OBVIOUS NUMBERS DO NOT WORK, and it is worth
// knowing before touching GRAV or THRUST. A pilot reacting L seconds late loses
// v·L of braking room out of the v²/2n they needed, so the shortfall as a
// FRACTION of the brake is 2nL/v — it grows with thrust and shrinks with speed.
// A punchy thruster turns this into a latency test rather than a judgement test:
// the first cut (GRAV 12, THRUST 30) spent 24 % of the brake on a 260 ms
// reaction alone and put an average pilot at 8 %. The fix is a WEAK thruster
// held for a LONG time — the braking fraction is GRAV/THRUST, so THRUST ≈ 1.7 ×
// GRAV brakes over roughly the second half of the shaft.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES } from '~/utils/hawkStarConfig.js'

const props = defineProps({
  // The open anomaly, straight off the server: { type, icon, choices, minigame }
  anomaly: { type: Object, required: true },
})
// `finish` carries the choice key the approach produced and fires the INSTANT
// the approach ends, not when the player dismisses the card. A landing the
// player walks away from without pressing anything must still pay.
const emit = defineEmits(['finish', 'close'])

const { t } = useI18n()

// ── The shaft ─────────────────────────────────────────────────────────────────
// Everything is in percent of the shaft's height, so it scales from a phone to a
// desktop without a measurement. The hulk enters at 0 and docks at 100.
const GRAV    = 12    // drift toward the dock, % of shaft per s²
const THRUST  = 20    // retro burn while held, %/s². Net brake is the difference.
const FUEL_S  = 3.5   // seconds of burn in the tank
const V_MAX   = 27    // fastest touchdown the collar still holds, %/s
const TIMEOUT_S = 20  // abandoned approach — not a difficulty lever

// The frame loop integrates at a FIXED step rather than at whatever the display
// hands it. A 60 Hz phone and a 144 Hz monitor have to fly the same approach, and
// a browser that drops a frame under load must not hand the player a different
// game — with a variable step the same hold produces a different speed, which is
// the one thing a skill toy cannot afford.
const STEP = 1 / 120
// Longest span one frame may consume, in seconds. A backgrounded tab returns
// with a gap of arbitrary size; without this the accumulator would burn minutes
// of physics in one frame and the hulk would already be wreckage on return.
const MAX_FRAME = 0.25

// How long the touchdown is left alone before the verdict card covers it.
const VERDICT_MS = 700

// ── State ─────────────────────────────────────────────────────────────────────
const phase   = ref('ready')  // 'ready' | 'flying' | 'done'
const y       = ref(0)        // % down the shaft
const v       = ref(0)        // %/s, never negative — the thruster cannot climb
const fuel    = ref(FUEL_S)
const burning = ref(false)
const elapsed = ref(0)
const outcome = ref(null)     // 'landed' | 'hot' | 'dry' | 'adrift'

const timers = []
const beat = (fn, ms) => { timers.push(setTimeout(fn, ms)) }

// ── The two ends of the card ──────────────────────────────────────────────────
const mg      = computed(() => props.anomaly?.minigame ?? {})
const winKey  = computed(() => mg.value.win)
const loseKey = computed(() => mg.value.lose)
const landed  = computed(() => outcome.value === 'landed')
const paidKey = computed(() => (landed.value ? winKey.value : loseKey.value))

const choiceOf = key => (props.anomaly?.choices ?? []).find(c => c.key === key) ?? null

// The deltas of whichever side ended up paying, rendered exactly as the card
// itself renders them so the verdict and the offer cannot disagree.
const paidRows = computed(() => {
  const c = choiceOf(paidKey.value)
  return Object.entries(c?.gain ?? {}).map(([res, amount]) => ({
    res,
    amount,
    icon: RESOURCES[res]?.icon ?? '•',
    name: t('hawkStar.res.' + res),
  }))
})
const paidBattery = computed(() => choiceOf(paidKey.value)?.battery ?? 0)

// ── Readouts ──────────────────────────────────────────────────────────────────
// Speed is drawn against V_MAX rather than as a bare number: "how far past the
// green" is the only reading that matters, and it is one a player can take at a
// glance while flying. The bar runs to twice the allowance so the green band
// fills the lower half — a scale that ended at V_MAX would peg the moment you
// were in trouble and stop telling you HOW much trouble.
const SPEED_SCALE = V_MAX * 2
const speedPct  = computed(() => Math.min(100, (v.value / SPEED_SCALE) * 100))
const safePct   = computed(() => (V_MAX / SPEED_SCALE) * 100)
const tooFast   = computed(() => v.value > V_MAX)
const fuelPct   = computed(() => (fuel.value / FUEL_S) * 100)
const fuelDry   = computed(() => fuel.value <= 0)

// ── The approach ──────────────────────────────────────────────────────────────
// Guarded on `outcome`, NOT on `phase`. The two are deliberately a beat apart —
// the verdict card only covers the field VERDICT_MS after the touchdown, so the
// player sees where it came down — and during that beat `phase` is still
// 'flying'. Guarding on `phase === 'done'` therefore guards nothing: the loop
// below keeps stepping, keeps finding y at the collar, and re-emits `finish`
// every frame for the whole beat. `anomalyBusy` in the panel happens to swallow
// the repeats, which is exactly what would have made this survive review.
const settle = (kind) => {
  if (outcome.value) return
  outcome.value = kind
  // The choice is claimed at once. The card below is only the telling of it.
  emit('finish', kind === 'landed' ? winKey.value : loseKey.value)
  beat(() => { phase.value = 'done' }, VERDICT_MS)
}

// One fixed physics step. Split out from the frame so the accumulator below can
// run it as many times as the elapsed span calls for.
const step = () => {
  const thrusting = burning.value && fuel.value > 0
  if (thrusting) fuel.value = Math.max(0, fuel.value - STEP)

  // Clamped at zero: the retro burn bleeds speed off and stops there. This is
  // the game's one rule and it lives in this line.
  v.value = Math.max(0, v.value + (GRAV - (thrusting ? THRUST : 0)) * STEP)
  y.value += v.value * STEP
  elapsed.value += STEP

  if (y.value >= 100) {
    y.value = 100
    // `dry` and `hot` are the same failure to the player — it drifts past either
    // way — but they are told apart on the card, because "you ran out" and "you
    // came in hot" are different lessons and the next approach depends on which.
    settle(v.value <= V_MAX ? 'landed' : (fuel.value <= 0 ? 'dry' : 'hot'))
    return
  }
  if (elapsed.value >= TIMEOUT_S) settle('adrift')
}

let raf = null
let last = 0
let acc = 0

const frame = (ts) => {
  raf = requestAnimationFrame(frame)
  if (phase.value !== 'flying') { last = ts; return }

  const span = Math.min(MAX_FRAME, (ts - last) / 1000)
  last = ts
  acc += span
  // `!outcome.value` stops the integration the instant the approach is settled,
  // rather than when the verdict card goes up a beat later.
  while (acc >= STEP && phase.value === 'flying' && !outcome.value) { acc -= STEP; step() }
}

// ── Input ─────────────────────────────────────────────────────────────────────
// Pointer events rather than mouse + touch pairs: one code path covers a thumb,
// a mouse and a stylus, and `pointerup` fires even when the finger has slid off
// the field — a burn that never ended because the thumb drifted over the edge
// would be a stuck thruster and a guaranteed crash.
//
// The FIRST press does not burn. It starts the approach, and the thruster arms
// on release — otherwise the tap that begins the run is also a burn the player
// never asked for, spent at the top of the shaft where it is worth least.
const onDown = (e) => {
  if (phase.value === 'done') return
  e.preventDefault()
  if (phase.value === 'flying') burning.value = true
}
const onUp = () => {
  if (phase.value === 'ready') { phase.value = 'flying'; return }
  burning.value = false
}

// Space and Enter mirror the pointer for a keyboard. `repeat` is ignored: key
// auto-repeat would otherwise re-fire keydown forever and hold the burn on
// regardless of the key ever coming up.
const onKeyDown = (e) => {
  if (e.code !== 'Space' && e.code !== 'Enter') return
  if (e.repeat) return
  e.preventDefault()
  onDown(e)
}
const onKeyUp = (e) => {
  if (e.code !== 'Space' && e.code !== 'Enter') return
  e.preventDefault()
  onUp()
}

onMounted(() => {
  raf = requestAnimationFrame((ts) => { last = ts; frame(ts) })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  // A pointer released outside the field still has to stop the burn.
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
})
onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf)
  timers.forEach(clearTimeout)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})

const outcomeKey = computed(() => ({
  landed: 'hawkStar.anomaly.dock.outcomeLanded',
  hot:    'hawkStar.anomaly.dock.outcomeHot',
  dry:    'hawkStar.anomaly.dock.outcomeDry',
  adrift: 'hawkStar.anomaly.dock.outcomeAdrift',
}[outcome.value] ?? null))
</script>

<template>
  <div class="hs-dock">
    <!-- The shaft. One press anywhere is the whole input, so the field itself is
         the button — there is nothing smaller to hit and nothing to aim at. -->
    <div
      class="hs-dock-field"
      :class="{ 'hs-dock-field--over': phase === 'done' }"
      @pointerdown="onDown"
    >
      <div class="hs-dock-stars" />

      <!-- Fuel down the left, speed down the right, both flanking the shaft so
           neither costs the drop any height. -->
      <div class="hs-dock-gauge hs-dock-gauge--fuel">
        <div
          class="hs-dock-gauge__fill"
          :class="{ 'hs-dock-gauge__fill--dry': fuelDry }"
          :style="{ height: fuelPct + '%' }"
        />
      </div>

      <div class="hs-dock-gauge hs-dock-gauge--speed">
        <!-- The allowance, drawn as a band rather than printed as a number:
             the question in flight is "am I inside it", not "what is it". -->
        <div class="hs-dock-gauge__safe" :style="{ height: safePct + '%' }" />
        <div
          class="hs-dock-gauge__fill"
          :class="{ 'hs-dock-gauge__fill--hot': tooFast }"
          :style="{ height: speedPct + '%' }"
        />
      </div>

      <!-- What is drifting in is the card's own icon, so the thing being flown
           is visibly the thing the card offered. -->
      <div class="hs-dock-hulk" :style="{ top: y + '%' }">
        <span class="hs-dock-hulk__body">{{ anomaly.icon }}</span>
        <span v-if="burning && !fuelDry && phase === 'flying'" class="hs-dock-hulk__burn">🔥</span>
      </div>

      <!-- The collar. Its glow answers the only question in flight: would a
           touchdown right now be held or bounced? -->
      <div class="hs-dock-collar" :class="{ 'hs-dock-collar--hot': tooFast }">
        <div class="hs-dock-collar__lip" />
        <div class="hs-dock-collar__lip" />
      </div>

      <div v-if="phase === 'ready'" class="hs-dock-ready" @pointerup="onUp">
        <span class="hs-dock-ready__hint">{{ t('hawkStar.anomaly.dock.hint') }}</span>
        <span class="hs-dock-ready__go">{{ t('hawkStar.anomaly.dock.start') }}</span>
      </div>

      <div v-if="phase === 'done'" class="hs-dock-over">
        <span class="hs-dock-over__line" :class="{ 'hs-dock-over__line--win': landed }">
          {{ t(outcomeKey) }}
        </span>

        <span class="hs-dock-over__deltas">
          <span v-for="g in paidRows" :key="g.res" :title="g.name" class="hs-dock-delta">
            {{ g.icon }} +{{ g.amount }}
          </span>
          <span v-if="paidBattery > 0" class="hs-dock-delta">
            {{ t('hawkStar.anomaly.batteryDelta', { pct: paidBattery }) }}
          </span>
        </span>

        <button class="hs-dock-close" @click.stop="emit('close')">
          {{ t('hawkStar.anomaly.dock.collect') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-dock { display: flex; flex-direction: column; }

.hs-dock-field {
  position: relative;
  width: 100%;
  /* Tall rather than wide: the whole game is a vertical distance being judged,
     and a squat field would compress the one axis the player reads. */
  aspect-ratio: 3 / 4;
  max-height: 58vh;
  margin: 0 auto;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(129, 140, 248, 0.4);
  background: radial-gradient(ellipse at 50% 100%, rgba(129, 140, 248, 0.18), rgba(8, 10, 24, 0.95) 70%);
  overflow: hidden;
  touch-action: none;   /* a hold must not scroll the panel behind it */
  cursor: pointer;
  user-select: none;
}

.hs-dock-stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 18% 22%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 72% 14%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 42% 61%, rgba(255,255,255,0.35), transparent),
    radial-gradient(1px 1px at 86% 47%, rgba(255,255,255,0.3), transparent);
  pointer-events: none;
}

/* ── Gauges ────────────────────────────────────────────────────────────────
   Both fill from the bottom, so "more" is always "taller" and the two can be
   read against each other without thinking about which way round they are. */
.hs-dock-gauge {
  position: absolute;
  top: 8%;
  bottom: 14%;
  width: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  pointer-events: none;

  &--fuel  { left: 7px; }
  &--speed { right: 7px; }
}
.hs-dock-gauge__fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: #818cf8;
  transition: background 0.12s;

  &--dry { background: var(--hs-danger); }
  &--hot { background: var(--hs-danger); }
}
.hs-dock-gauge__safe {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--hs-ok-bg-dim);
  border-top: 1px solid var(--hs-ok);
}

/* ── The hulk ──────────────────────────────────────────────────────────────
   Positioned in percent of the shaft, exactly as the physics stores it, so the
   picture and the rule are the same number. No CSS transition on `top`: the
   frame loop already moves it every frame, and easing on top of that would draw
   the ship somewhere it is not — which at the collar is the difference between
   a landing the player saw and one they did not. */
.hs-dock-hulk {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}
.hs-dock-hulk__body { font-size: 1.7rem; line-height: 1; }
.hs-dock-hulk__burn {
  font-size: 0.8rem;
  line-height: 1;
  margin-top: -2px;
  filter: saturate(1.4);
}

/* ── The collar ────────────────────────────────────────────────────────────*/
.hs-dock-collar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 12%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-top: 2px solid var(--hs-ok);
  background: linear-gradient(to bottom, var(--hs-ok-bg-dim), transparent);
  transition: border-color 0.12s, background 0.12s;
  pointer-events: none;

  &--hot {
    border-top-color: var(--hs-danger);
    background: linear-gradient(to bottom, var(--hs-danger-bg-cost), transparent);
  }
}
.hs-dock-collar__lip {
  width: 26%;
  height: 55%;
  background: rgba(129, 140, 248, 0.35);
  border: 1px solid rgba(129, 140, 248, 0.55);
  border-top: none;
}

/* ── Cards over the field ──────────────────────────────────────────────────*/
.hs-dock-ready,
.hs-dock-over {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.8rem;
  text-align: center;
  background: rgba(8, 10, 24, 0.82);
  backdrop-filter: blur(2px);
}

.hs-dock-ready__hint {
  font-size: 0.66rem;
  line-height: 1.4;
  opacity: 0.75;
  max-width: 15rem;
}
.hs-dock-ready__go {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #c7d2fe;
}

.hs-dock-over__line {
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--hs-danger);

  &--win { color: var(--hs-ok); }
}
.hs-dock-over__deltas {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
}
.hs-dock-delta {
  font-size: 0.66rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--hs-ok);
  background: var(--hs-ok-bg-dim);
  border: 1px solid var(--hs-ok-border);
}

.hs-dock-close {
  margin-top: 0.2rem;
  padding: 0.4rem 1.1rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(129, 140, 248, 0.6);
  background: rgba(129, 140, 248, 0.22);
  color: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;

  &:hover { background: rgba(129, 140, 248, 0.34); }
}
</style>
