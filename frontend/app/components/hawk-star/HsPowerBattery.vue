<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { POWER_BATTERY } from '~/utils/hawkStarConfig.js'

const { t } = useI18n()
const { batteryCharge, batteryHoursToEmpty, gridDown, chargeBattery } = useHawkStar()

// ── The cell, as a cell ───────────────────────────────────────────────────────
// This used to be a slim button with "+10 %" written on it. The number was true
// and the gesture was nothing: charging is the one thing in the game that is
// pure upkeep, so it has to be the thing that is nice to *do*. It is now a
// contact you drag across the cell — the charge follows the finger, the cell
// spits sparks where the contact sits, and one traverse is worth exactly the
// same +10 % the click was worth. The arithmetic is unchanged and still the
// server's; only the way you ask for it moved.
//
// Same shape as the recruit deck and the salvage dial: a block inside the tile's
// building panel, with the build rows underneath.
const pct  = computed(() => Math.round(batteryCharge.value ?? 0))
const full = computed(() => (batteryCharge.value ?? 0) >= POWER_BATTERY.max)

const level = computed(() => {
  if (gridDown.value) return 'empty'
  if (pct.value < 20) return 'low'
  if (pct.value < 50) return 'mid'
  return 'ok'
})

// One segment per swipe, so the cell shows how many more traverses a full charge
// costs without printing it. Derived, never hand-tuned: change clickPercent and
// the cell re-divides itself.
const SEGMENTS = Math.max(1, Math.round(POWER_BATTERY.max / POWER_BATTERY.clickPercent))

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

// ── Timers ───────────────────────────────────────────────────────────────────
const timers = new Set()
const later = (ms, fn) => {
  const id = setTimeout(() => { timers.delete(id); fn() }, ms)
  timers.add(id)
  return id
}
let raf = null
onUnmounted(() => {
  timers.forEach(clearTimeout)
  timers.clear()
  if (raf) cancelAnimationFrame(raf)
})

// ── Sparks ───────────────────────────────────────────────────────────────────
// Purely decorative and deliberately cheap: a spark is a span that flies a few
// pixels and deletes itself. Nothing here is ever read back, so a dropped frame
// costs a picture and never a percent.
const sparks = ref([])
let sparkSeq = 0

const spark = (x, y, power = 1) => {
  const id   = ++sparkSeq
  const ang  = Math.random() * Math.PI * 2
  const dist = (9 + Math.random() * 20) * power
  const dur  = Math.round(240 + Math.random() * 260)
  sparks.value.push({
    id,
    x, y,
    dx: Math.cos(ang) * dist,
    dy: Math.sin(ang) * dist * 0.8,
    size: 2 + Math.round(Math.random() * 2),
    dur,
  })
  // A runaway list could only come from a very long drag on a very fast pointer;
  // trimming the head is cheaper than counting emissions.
  if (sparks.value.length > 48) sparks.value.splice(0, sparks.value.length - 48)
  later(dur, () => { sparks.value = sparks.value.filter((s) => s.id !== id) })
}

const sparkBurst = (x, n = 10, power = 1.6) => {
  for (let i = 0; i < n; i++) spark(x, 20 + Math.random() * 60, power)
}

const sparkStyle = (s) => ({
  left: `${s.x}%`,
  top: `${s.y}%`,
  width: `${s.size}px`,
  height: `${s.size}px`,
  '--hs-dx': `${s.dx}px`,
  '--hs-dy': `${s.dy}px`,
  animationDuration: `${s.dur}ms`,
})

// ── The swipe ────────────────────────────────────────────────────────────────
// A traverse has to *start* on the left and *reach* the far terminal — otherwise
// a tap near the right edge would be a click again, which is the thing this
// replaces. Everything in between is forgiving: the contact may wobble, and
// progress only ever grows, so a shaky hand never loses ground it has made.
const CELL_START = 0.34   // a swipe must begin left of this
const CELL_END   = 0.94   // and arrive here to count

const cellEl   = ref(null)
const dragging = ref(false)   // a valid traverse is under way
const progress = ref(0)       // 0…1 of the current traverse
const headX    = ref(0)       // where the contact sits, in % of the cell
const flash    = ref(false)   // the cell, told that a charge just landed
const rejected = ref(false)   // a traverse that started too far right

let startFrac = 0
let lastSpark = 0

const fracOf = (e) => {
  const r = cellEl.value?.getBoundingClientRect()
  if (!r || !r.width) return 0
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
}

// What the cell draws: the charge the server knows about, plus however much of
// the current traverse has been earned but not yet asked for.
const pendingPct = computed(() => Math.min(
  Math.max(0, POWER_BATTERY.max - (batteryCharge.value ?? 0)),
  progress.value * POWER_BATTERY.clickPercent,
))
const shownPct = computed(() =>
  Math.min(POWER_BATTERY.max, (batteryCharge.value ?? 0) + pendingPct.value))

const canSwipe = computed(() => !gridDown.value && !full.value)

const land = () => {
  // Reset first, then ask: chargeBattery() bumps the live charge optimistically,
  // and a traverse still standing at 1 would draw the same 10 % twice for a
  // frame.
  progress.value = 0
  dragging.value = false
  flash.value    = true
  sparkBurst(Math.min(98, shownPct.value + 2), 16, 2)
  later(420, () => { flash.value = false })
  chargeBattery()
}

const advance = (f) => {
  headX.value = f * 100
  const p = Math.min(1, Math.max(0, (f - startFrac) / Math.max(0.05, CELL_END - startFrac)))
  if (p <= progress.value) return
  progress.value = p
  // Stück für Stück: a spark every few percent of the traverse, at the contact.
  if (p - lastSpark >= 0.05) {
    lastSpark = p
    spark(headX.value, 30 + Math.random() * 40)
    if (Math.random() < 0.5) spark(headX.value, 30 + Math.random() * 40)
  }
  if (p >= 1) land()
}

const onCellDown = (e) => {
  if (!canSwipe.value) return
  const f = fracOf(e)
  if (f > CELL_START) {
    // Not a scold, a nudge: the entry zone lights up so the next attempt starts
    // where it should.
    rejected.value = true
    later(700, () => { rejected.value = false })
    return
  }
  e.currentTarget.setPointerCapture?.(e.pointerId)
  dragging.value = true
  startFrac      = f
  lastSpark      = 0
  progress.value = 0
  headX.value    = f * 100
}

const onCellMove = (e) => {
  if (!dragging.value) return
  advance(fracOf(e))
}

const onCellUp = () => {
  if (!dragging.value) return
  dragging.value = false
  progress.value = 0   // an abandoned traverse drains back, it never half-counts
}

// Keyboard and screen readers get the old button back: one press, one charge.
// The game is the picture, and a picture must never be the only way to play.
const autoSwipe = () => {
  if (!canSwipe.value || dragging.value || raf) return
  const t0 = performance.now()
  dragging.value = true
  startFrac      = 0
  lastSpark      = 0
  progress.value = 0
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 520)
    advance(CELL_END * p)
    raf = (p < 1 && dragging.value) ? requestAnimationFrame(step) : null
  }
  raf = requestAnimationFrame(step)
}

// ── The breaker ──────────────────────────────────────────────────────────────
// A dead grid does not come back by wiping a contact over it — somebody has to
// walk to the switchboard and throw the main lever, and a lever thrown in a
// hurry arcs and drops straight back out. So: drag it right, and drag it SLOWLY.
// Under the speed limit the travel takes about a second and a half, which is
// long enough to feel like a decision and short enough not to be a chore.
const BREAKER_MAX_SPEED = 0.85   // track widths per second — above this it trips
const BREAKER_MIN_MS    = 900    // and the travel may not be quicker than this
const BREAKER_END       = 0.97

const trackEl  = ref(null)
const knobEl   = ref(null)
const knob     = ref(0)        // 0…1 along the track
const pulling  = ref(false)
const strained = ref(false)    // near the speed limit — the lever complains first
const tripped  = ref(false)    // thrown too fast, and it fell straight back out
const thrown   = ref(false)    // it went over

let pullStart = 0
let lastT     = 0
let lastF     = 0

// 0…1 measured over the *handle's* travel, not the rail's width: the lever is
// wide enough now that its own body is a visible share of the track, and mapping
// the raw rail width would leave the grip trailing the thumb by half a handle at
// each end. Same inset the CSS uses to place it, so finger and lever agree.
const knobFrac = (e) => {
  const r = trackEl.value?.getBoundingClientRect()
  if (!r || !r.width) return 0
  const w    = knobEl.value?.offsetWidth ?? 0
  const span = Math.max(1, r.width - w)
  return Math.min(1, Math.max(0, (e.clientX - r.left - w / 2) / span))
}

const trip = () => {
  pulling.value  = false
  strained.value = false
  tripped.value  = true
  knob.value     = 0
  sparkBurst(6, 8, 1.4)
  later(1300, () => { tripped.value = false })
}

const throwOver = () => {
  pulling.value  = false
  strained.value = false
  thrown.value   = true
  knob.value     = 1
  sparkBurst(50, 20, 2.2)
  chargeBattery()
  // The panel loses the breaker the moment the blackout lifts; this only covers
  // the beat before the new state arrives.
  later(900, () => { thrown.value = false; knob.value = 0 })
}

const onKnobDown = (e) => {
  if (thrown.value) return
  e.currentTarget.setPointerCapture?.(e.pointerId)
  e.stopPropagation()
  pulling.value = true
  tripped.value = false
  pullStart  = performance.now()
  lastT      = pullStart
  lastF      = knobFrac(e)
  knob.value = 0
}

const onKnobMove = (e) => {
  if (!pulling.value) return
  const now   = performance.now()
  const f     = knobFrac(e)
  const dt    = Math.max(16, now - lastT) / 1000
  const speed = (f - lastF) / dt
  lastT = now
  lastF = f

  if (speed > BREAKER_MAX_SPEED) { trip(); return }
  strained.value = speed > BREAKER_MAX_SPEED * 0.6

  // The lever cannot be pushed back and re-run: it is a lever, not a slider.
  knob.value = Math.max(knob.value, f)
  if (knob.value > 0.06 && Math.random() < 0.12) {
    spark(knob.value * 100, 40 + Math.random() * 30, 0.7)
  }

  if (knob.value >= BREAKER_END) {
    if (now - pullStart >= BREAKER_MIN_MS) throwOver()
    else trip()
  }
}

const onKnobUp = () => {
  if (!pulling.value) return
  pulling.value  = false
  strained.value = false
  knob.value     = 0   // let go halfway and the spring takes it back
}

const autoThrow = () => {
  if (thrown.value || pulling.value || raf) return
  const t0 = performance.now()
  pulling.value = true
  const step = (now) => {
    const p = Math.min(1, (now - t0) / (BREAKER_MIN_MS + 300))
    knob.value = p
    if (p >= 1) { raf = null; throwOver(); return }
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

// ── What the panel says ──────────────────────────────────────────────────────
const status = computed(() => {
  if (tripped.value)  return t('hawkStar.battery.breakerFast')
  if (thrown.value)   return t('hawkStar.battery.breakerOn')
  if (gridDown.value) return t('hawkStar.battery.breakerHint')
  if (full.value)     return t('hawkStar.battery.full')
  return t('hawkStar.battery.swipe', { n: POWER_BATTERY.clickPercent })
})
</script>

<template>
  <div class="hs-bat" :class="[`hs-bat--${level}`, { 'hs-bat--flash': flash }]">
    <div class="hs-bat-head">
      <span class="hs-bat-icon">🔋</span>
      <h3 class="hs-bat-title">{{ t('hawkStar.battery.title') }}</h3>

      <span v-if="gridDown" class="hs-bat-pct hs-bat-pct--alert">
        ⚠ {{ t('hawkStar.battery.blackout') }}
      </span>
      <span v-else class="hs-bat-pct">{{ pct }}%</span>
    </div>

    <!-- The cell. Terminal on the right, so "left to right" is the direction the
         current would actually flow. -->
    <div class="hs-bat-stage">
      <div
        ref="cellEl"
        class="hs-bat-cell"
        :class="{
          'hs-bat-cell--live': dragging,
          'hs-bat-cell--dead': !canSwipe,
          'hs-bat-cell--rejected': rejected,
        }"
        role="button"
        tabindex="0"
        :aria-label="t('hawkStar.battery.charge', { n: POWER_BATTERY.clickPercent })"
        @pointerdown="onCellDown"
        @pointermove="onCellMove"
        @pointerup="onCellUp"
        @pointercancel="onCellUp"
        @keydown.enter.prevent="autoSwipe"
        @keydown.space.prevent="autoSwipe"
      >
        <span class="hs-bat-fill" :style="{ width: shownPct + '%' }" />
        <span
          v-if="pendingPct > 0"
          class="hs-bat-pending"
          :style="{ left: (shownPct - pendingPct) + '%', width: pendingPct + '%' }"
        />

        <!-- The dividers are the swipes: one segment per traverse. -->
        <span class="hs-bat-segs">
          <i v-for="i in SEGMENTS - 1" :key="i" :style="{ left: (i * 100 / SEGMENTS) + '%' }" />
        </span>

        <!-- Where a swipe has to start, and which way it goes. Both are hints,
             not controls: the arrow only runs while nobody is dragging, and the
             zone only speaks up when somebody started too far right. -->
        <span v-if="canSwipe" class="hs-bat-entry" :style="{ width: CELL_START * 100 + '%' }" />
        <span v-if="canSwipe && !dragging" class="hs-bat-cue">⟩⟩⟩</span>

        <span v-if="dragging" class="hs-bat-contact" :style="{ left: headX + '%' }" />

        <span
          v-for="s in sparks"
          :key="s.id"
          class="hs-bat-spark"
          :style="sparkStyle(s)"
        />
      </div>

      <span class="hs-bat-cap" />
    </div>

    <!-- Dead grid: nothing can be charged until the main lever is back in. -->
    <div
      v-if="gridDown"
      class="hs-bat-breaker"
      :class="{
        'hs-bat-breaker--pulling': pulling,
        'hs-bat-breaker--strained': strained,
        'hs-bat-breaker--tripped': tripped,
        'hs-bat-breaker--thrown': thrown,
      }"
    >
      <span class="hs-bat-breaker-label">🔌 {{ t('hawkStar.battery.breaker') }}</span>

      <div ref="trackEl" class="hs-bat-track" :style="{ '--hs-knob': knob }">
        <span class="hs-bat-track-fill" />
        <span class="hs-bat-track-off">{{ t('hawkStar.battery.off') }}</span>
        <span class="hs-bat-track-on">{{ t('hawkStar.battery.on') }}</span>

        <span
          ref="knobEl"
          class="hs-bat-knob"
          role="button"
          tabindex="0"
          :aria-label="t('hawkStar.battery.breakerHint')"
          @pointerdown="onKnobDown"
          @pointermove="onKnobMove"
          @pointerup="onKnobUp"
          @pointercancel="onKnobUp"
          @keydown.enter.prevent="autoThrow"
          @keydown.space.prevent="autoThrow"
        />
      </div>
    </div>

    <div class="hs-bat-caption">
      <span
        class="hs-bat-status"
        :class="{ 'hs-bat-status--bad': tripped, 'hs-bat-status--good': thrown }"
      >{{ status }}</span>

      <span v-if="timeLeft" class="hs-bat-time">
        {{ t('hawkStar.battery.timeLeft', { time: timeLeft }) }}
      </span>
    </div>

    <p class="hs-bat-hint">{{ t('hawkStar.battery.hint') }}</p>
  </div>
</template>

<style lang="scss" scoped>
// A block inside the energy tile's building panel, like the recruit deck on the
// base tile and the salvage dial on the salvage tile.
.hs-bat {
  --hs-bat-accent: #10b981;

  position: relative;
  min-width: 0;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.22);
  border-radius: var(--hs-r-md);
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &--ok    { --hs-bat-accent: #10b981; }
  &--mid   { --hs-bat-accent: #fbbf24; }
  &--low   { --hs-bat-accent: #f59e0b; }
  &--empty {
    --hs-bat-accent: #ef4444;
    border-color: rgba(239, 68, 68, 0.45);
    background: rgba(239, 68, 68, 0.1);
    animation: hs-bat-pulse 1.6s ease-in-out infinite;
  }
}

@keyframes hs-bat-pulse {
  0%, 100% { border-color: rgba(239, 68, 68, 0.45); }
  50%      { border-color: rgba(239, 68, 68, 0.9); }
}

.hs-bat-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.hs-bat-icon  { font-size: 1rem; line-height: 1; }
.hs-bat-title { margin: 0; font-size: 0.8rem; font-weight: 700; color: #fff; }
.hs-bat-pct {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fde68a;
  font-variant-numeric: tabular-nums;

  &--alert { color: #fca5a5; }
}

// ── The cell ─────────────────────────────────────────────────────────────────
.hs-bat-stage {
  display: flex;
  align-items: stretch;
  gap: 2px;
}

.hs-bat-cell {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 2.6rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.35);
  overflow: hidden;
  cursor: ew-resize;
  // The gesture is horizontal and so is the page's scroll on a phone: without
  // this the browser takes the swipe and the cell never sees it.
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus-visible { outline: 2px solid var(--hs-bat-accent); outline-offset: 2px; }
  &--live     { border-color: rgba(253, 230, 138, 0.8); box-shadow: 0 0 10px rgba(251, 191, 36, 0.35); }
  &--dead     { cursor: not-allowed; }
  &--rejected { border-color: rgba(252, 165, 165, 0.8); }
}

// The terminal, so the cell reads as a battery rather than as a progress bar.
.hs-bat-cap {
  flex: none;
  align-self: center;
  width: 4px;
  height: 1rem;
  border-radius: 0 2px 2px 0;
  background: rgba(255, 255, 255, 0.3);
}

.hs-bat-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--hs-bat-accent) 80%, white) 0%,
    var(--hs-bat-accent) 55%,
    color-mix(in srgb, var(--hs-bat-accent) 75%, black) 100%
  );
  transition: width 0.35s ease, background 0.3s ease;
}
// What the current traverse has earned: brighter than the charge behind it, and
// its width does not animate — it IS the finger.
.hs-bat-pending {
  position: absolute;
  top: 0;
  bottom: 0;
  background: linear-gradient(180deg, #fffbeb, #fde68a 60%, #fbbf24);
  box-shadow: 0 0 12px rgba(253, 224, 71, 0.7);
}

.hs-bat-segs {
  position: absolute;
  inset: 0;
  pointer-events: none;

  i {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(0, 0, 0, 0.35);
  }
}

.hs-bat-entry {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.12), transparent);
  opacity: 0.5;
  transition: opacity 0.2s, background 0.2s;

  .hs-bat-cell--rejected & {
    opacity: 1;
    background: linear-gradient(90deg, rgba(248, 113, 113, 0.45), transparent);
  }
}

// The nudge that says which way. It travels the way the finger should, so the
// gesture is shown rather than written down.
.hs-bat-cue {
  position: absolute;
  top: 50%;
  left: 0.3rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  animation: hs-bat-cue 2.2s ease-in-out infinite;
}
@keyframes hs-bat-cue {
  0%   { transform: translateY(-50%) translateX(0);      opacity: 0.15; }
  35%  { opacity: 0.75; }
  100% { transform: translateY(-50%) translateX(3.5rem); opacity: 0; }
}

// The contact under the finger.
.hs-bat-contact {
  position: absolute;
  top: -10%;
  bottom: -10%;
  width: 3px;
  margin-left: -1.5px;
  background: #fffbeb;
  box-shadow: 0 0 10px 2px rgba(253, 224, 71, 0.9);
  pointer-events: none;
}

.hs-bat-spark {
  position: absolute;
  border-radius: 50%;
  background: #fef3c7;
  box-shadow: 0 0 6px 1px rgba(251, 191, 36, 0.9);
  pointer-events: none;
  animation-name: hs-bat-spark;
  animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
  animation-fill-mode: forwards;
}
@keyframes hs-bat-spark {
  0%   { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--hs-dx), var(--hs-dy)) scale(0.2); opacity: 0; }
}

// The whole cell acknowledges a landed charge — a finger is still covering the
// spot where it happened, so the signal has to be bigger than the spot.
.hs-bat--flash .hs-bat-cell {
  border-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 18px rgba(253, 224, 71, 0.55);
}

// ── The breaker ──────────────────────────────────────────────────────────────
// The lever is sized from one place: the rail's height and the travel inset in
// `left` both derive from --hs-bat-lever, so the handle can grow without any of
// the three going out of step.
//
// It is deliberately large. This is the one control in the game that is meant to
// feel like *machinery* — you walk to the switchboard and throw the main lever —
// and a 24px dot read as a slider nub instead. At 2.75rem the grip clears the
// 44px minimum a thumb can reliably find, which is what made it a fiddle on a
// phone, and on a desktop it reads as a switch rather than a scrollbar.
.hs-bat-breaker {
  --hs-bat-lever: 2.75rem;

  display: flex;
  flex-direction: column;   // the label captions the lever instead of crowding it
  align-items: stretch;
  gap: 0.35rem;
  padding: 0.5rem 0.55rem 0.6rem;
  border-radius: var(--hs-r-sm);
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(239, 68, 68, 0.35);
  transition: border-color 0.2s, background 0.2s;

  // A wider rail is a longer throw, and the throw is time-limited (BREAKER_MIN_MS)
  // rather than distance-limited — so more room only makes the gesture calmer.
  @media (min-width: 640px) { --hs-bat-lever: 3rem; }

  &--strained { border-color: rgba(251, 191, 36, 0.7); }
  &--tripped  { border-color: rgba(248, 113, 113, 0.9); animation: hs-bat-shake 0.35s ease; }
  &--thrown   { border-color: rgba(74, 222, 128, 0.8); background: rgba(74, 222, 128, 0.12); }
}
@keyframes hs-bat-shake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-3px); }
  75%      { transform: translateX(3px); }
}

.hs-bat-breaker-label {
  flex: none;
  font-size: 0.62rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.hs-bat-track {
  position: relative;
  width: 100%;
  min-width: 0;
  height: calc(var(--hs-bat-lever) + 0.5rem);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.55);
  touch-action: none;
}
.hs-bat-track-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--hs-bat-lever) * 0.5 + var(--hs-knob, 0) * (100% - var(--hs-bat-lever)));
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(251, 191, 36, 0.25), rgba(74, 222, 128, 0.45));
  transition: width 0.18s ease;

  // While the lever is in a hand it follows the hand; the spring-back is the
  // only movement that is allowed to be animated.
  .hs-bat-breaker--pulling & { transition: none; }
}
.hs-bat-track-off,
.hs-bat-track-on {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.45);
  pointer-events: none;
}
// OFF starts where the parked handle ends — it labels the position the lever is
// in, so the handle must not be sitting on top of it.
.hs-bat-track-off { left: calc(var(--hs-bat-lever) + 0.55rem); }
.hs-bat-track-on  { right: 0.9rem; }
.hs-bat-breaker--thrown .hs-bat-track-on { color: var(--hs-ok); }

.hs-bat-knob {
  position: absolute;
  top: 50%;
  width: var(--hs-bat-lever);
  height: var(--hs-bat-lever);
  // Centre travels half a handle in from each end, which is the same mapping
  // knobFrac() uses — the grip stays exactly under the thumb across the throw.
  left: calc(var(--hs-bat-lever) * 0.5 + var(--hs-knob, 0) * (100% - var(--hs-bat-lever)));
  margin: calc(var(--hs-bat-lever) * -0.5) 0 0 calc(var(--hs-bat-lever) * -0.5);
  border-radius: 50%;
  background: linear-gradient(180deg, #f8fafc, #94a3b8);
  border: 1px solid rgba(0, 0, 0, 0.35);
  // A rim light on top and a seated shadow below: at this size a flat disc looks
  // painted on, a lit one looks like something you can take hold of.
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -2px 3px rgba(0, 0, 0, 0.25),
    0 3px 6px rgba(0, 0, 0, 0.55);
  cursor: grab;
  touch-action: none;
  transition: left 0.22s cubic-bezier(0.3, 1.4, 0.5, 1), background 0.2s, box-shadow 0.2s, transform 0.12s;

  // Knurling: fine vertical grip lines across the handle. The detail that says
  // "hold this" rather than "drag this", and it only reads now that it has room.
  &::after {
    content: '';
    position: absolute;
    inset: 28%;
    border-radius: 2px;
    background: repeating-linear-gradient(
      90deg,
      rgba(15, 23, 42, 0.55) 0 2px,
      transparent 2px 5px
    );
    pointer-events: none;
  }

  &:focus-visible { outline: 2px solid var(--hs-ok); outline-offset: 3px; }

  .hs-bat-breaker--pulling & {
    cursor: grabbing;
    transform: scale(1.06);   // it gives under the thumb
    transition: background 0.2s, box-shadow 0.2s, transform 0.12s;
  }
  .hs-bat-breaker--strained & { background: linear-gradient(180deg, #fef3c7, #f59e0b); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 0 14px rgba(251, 191, 36, 0.85); }
  .hs-bat-breaker--tripped &  { background: linear-gradient(180deg, #fecaca, #ef4444); }
  .hs-bat-breaker--thrown &   { background: linear-gradient(180deg, #dcfce7, #22c55e); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 0 18px rgba(74, 222, 128, 0.85); }
}

// ── Caption ──────────────────────────────────────────────────────────────────
.hs-bat-caption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.hs-bat-status {
  font-size: 0.64rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);

  &--bad  { color: #fca5a5; }
  &--good { color: var(--hs-ok); }
}
.hs-bat-time {
  font-size: 0.62rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.hs-bat-hint {
  margin: 0;
  font-size: 0.6rem;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.45);
}

@media (prefers-reduced-motion: reduce) {
  .hs-bat--empty { animation: none; }
  .hs-bat-cue    { animation: none; opacity: 0.4; transform: translateY(-50%); }
  .hs-bat-spark  { display: none; }
}
</style>
