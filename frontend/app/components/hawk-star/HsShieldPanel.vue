<script setup>
import { ref, computed, onUnmounted } from 'vue'
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

// ── The dome, and what a charge costs ────────────────────────────────────────
// The battery next door is charged by wiping a contact across the cell, and it
// is free. This one is not, and that single difference decides the whole
// mechanic: the server hands out exactly +10 % for exactly 150 crystal, so a
// mini-game here may never fail *after* the money is gone. So the gesture IS the
// payment — you drag a crystal out of the holder and into the emitter, and you
// can drop it anywhere else right up to the last moment and have spent nothing.
// Nothing is charged until the shard reaches the core.
//
// The other difference worth keeping: an empty shield is not an emergency. The
// battery's blackout gets a breaker to throw; the dome just goes dark and waits,
// exactly as the design says it should.
const pct = computed(() => Math.round(shieldCharge.value ?? 0))

const level = computed(() => {
  if (shieldDown.value) return 'empty'
  if (pct.value < 20) return 'low'
  if (pct.value < 50) return 'mid'
  return 'ok'
})

// How much of the dome one shard buys — and how much of it is left to buy.
const gain = computed(() =>
  Math.min(SHIELD.clickPercent, Math.max(0, SHIELD.max - (shieldCharge.value ?? 0))))

// The cost belongs on the holder, because the holder is what you pick up.
const cost = computed(() =>
  Object.entries(SHIELD.clickCost).map(([res, amount]) => ({
    res,
    amount,
    icon: RESOURCES[res]?.icon ?? '•',
    ok: (playerResources.value[res] ?? 0) >= amount,
  }))
)
const canAfford = computed(() => cost.value.every((c) => c.ok))

const timeLeft = computed(() => {
  const h = shieldHoursToEmpty.value
  if (h == null || h <= 0) return ''
  if (h < 1)  return `~${Math.max(1, Math.round(h * 60))} min`
  if (h < 24) return `~${Math.round(h)} h`
  const d = Math.floor(h / 24)
  const rest = Math.round(h % 24)
  return rest ? `~${d} d ${rest} h` : `~${d} d`
})

// ── Geometry ─────────────────────────────────────────────────────────────────
// One coordinate space for everything: the SVG's viewBox is also the percentage
// space the dragged shard lives in, because the stage is locked to the viewBox's
// aspect ratio. So the emitter is at one pair of numbers and nothing has to be
// converted twice.
const VB = { w: 200, h: 118 }
const DOME = { cx: 100, cy: 92, r: 78 }
const SEGMENTS = Math.max(1, Math.round(SHIELD.max / SHIELD.clickPercent))

const arcPath = `M ${DOME.cx - DOME.r} ${DOME.cy} A ${DOME.r} ${DOME.r} 0 0 1 ${DOME.cx + DOME.r} ${DOME.cy}`

// The joints between segments, so the dome shows how many shards a full shield
// still costs without printing the number.
const ticks = Array.from({ length: SEGMENTS - 1 }, (_, i) => {
  const a = Math.PI * (1 - (i + 1) / SEGMENTS)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return {
    x1: DOME.cx + c * (DOME.r - 5), y1: DOME.cy - s * (DOME.r - 5),
    x2: DOME.cx + c * (DOME.r + 5), y2: DOME.cy - s * (DOME.r + 5),
  }
})

// The emitter, in percent of the stage — same space as the shard.
const EMITTER = { x: (DOME.cx / VB.w) * 100, y: (DOME.cy / VB.h) * 100 }

// ── Timers and sparks ────────────────────────────────────────────────────────
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

// Shards of the crystal that just went in. Same throwaway trick as the battery's
// sparks: decoration that deletes itself and is never read back.
const sparks = ref([])
let sparkSeq = 0
const spark = (x, y, power = 1) => {
  const id   = ++sparkSeq
  const ang  = Math.random() * Math.PI * 2
  const dist = (10 + Math.random() * 26) * power
  const dur  = Math.round(320 + Math.random() * 320)
  sparks.value.push({
    id,
    x, y,
    dx: Math.cos(ang) * dist,
    dy: Math.sin(ang) * dist - 6,   // they mostly go up: the dome is up
    size: 2 + Math.round(Math.random() * 2),
    dur,
  })
  if (sparks.value.length > 40) sparks.value.splice(0, sparks.value.length - 40)
  later(dur, () => { sparks.value = sparks.value.filter((s) => s.id !== id) })
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

// ── Carrying the shard ───────────────────────────────────────────────────────
const stageEl  = ref(null)
const holderEl = ref(null)

const shard     = ref(null)    // { x, y } in % of the stage, or null when holstered
const snapped   = ref(false)   // close enough to the core that letting go pays
const returning = ref(false)   // dropped short — it is flying home, nothing spent
const wave      = ref(0)       // re-keys the shockwave so its animation restarts
const surge     = ref(false)   // the dome, told that a segment just arrived

let home = { x: 12, y: 88 }    // where the holder sits, filled in on pick-up

const stageRect = () => stageEl.value?.getBoundingClientRect() ?? null

const pctOf = (e) => {
  const r = stageRect()
  if (!r || !r.width || !r.height) return { x: 0, y: 0 }
  return {
    x: ((e.clientX - r.left) / r.width) * 100,
    y: ((e.clientY - r.top) / r.height) * 100,
  }
}

// Distance to the core in real pixels, so the catch radius feels the same on a
// phone as on a wide panel.
const distToCore = (p) => {
  const r = stageRect()
  if (!r) return Infinity
  const dx = ((p.x - EMITTER.x) / 100) * r.width
  const dy = ((p.y - EMITTER.y) / 100) * r.height
  return Math.hypot(dx, dy)
}
const snapRadius = () => Math.max(26, (stageRect()?.width ?? 200) * 0.15)

// Inside the pull the core drags the shard the last stretch by itself. It is the
// only forgiving thing here, and it is what makes the drop feel like the emitter
// taking the crystal rather than like hitting a target.
const withPull = (p) => {
  const d = distToCore(p)
  const rad = snapRadius()
  if (d > rad * 2) return p
  const k = 0.45 * (1 - Math.min(1, d / (rad * 2)))
  return {
    x: p.x + (EMITTER.x - p.x) * k,
    y: p.y + (EMITTER.y - p.y) * k,
  }
}

const fire = () => {
  shard.value   = null
  snapped.value = false
  surge.value   = true
  wave.value   += 1
  for (let i = 0; i < 18; i++) spark(EMITTER.x, EMITTER.y, 1.6)
  later(700,  () => { wave.value  = 0 })
  later(600,  () => { surge.value = false })
  chargeShield()
}

const onShardDown = (e) => {
  if (!canChargeShield.value) return
  const r = stageRect()
  const h = holderEl.value?.getBoundingClientRect()
  if (!r || !h) return
  e.currentTarget.setPointerCapture?.(e.pointerId)
  // Remember where it came from, so a dropped shard knows the way back.
  home = {
    x: ((h.left + h.width / 2 - r.left) / r.width) * 100,
    y: ((h.top + h.height / 2 - r.top) / r.height) * 100,
  }
  returning.value = false
  shard.value = withPull(pctOf(e))
  snapped.value = distToCore(shard.value) < snapRadius()
}

const onShardMove = (e) => {
  if (!shard.value || returning.value) return
  const p = withPull(pctOf(e))
  shard.value = p
  const near = distToCore(p) < snapRadius()
  // A shard held in the pull sheds a little of itself the whole time — the core
  // is already working on it before you let go.
  if (near && !snapped.value) spark(EMITTER.x, EMITTER.y, 0.8)
  if (near && Math.random() < 0.14) spark(p.x, p.y, 0.6)
  snapped.value = near
}

const onShardUp = () => {
  if (!shard.value || returning.value) return
  if (snapped.value) { fire(); return }
  // Dropped short: back to the holder, and not a crystal spent.
  returning.value = true
  shard.value = { ...home }
  later(300, () => { shard.value = null; returning.value = false })
}

// Keyboard and screen readers get the old button back: one press, one charge —
// the shard flies the route by itself. The game is the picture, and a picture
// must never be the only way to play.
const autoFire = () => {
  if (!canChargeShield.value || shard.value || raf) return
  const r = stageRect()
  const h = holderEl.value?.getBoundingClientRect()
  if (!r || !h) return
  home = {
    x: ((h.left + h.width / 2 - r.left) / r.width) * 100,
    y: ((h.top + h.height / 2 - r.top) / r.height) * 100,
  }
  const t0 = performance.now()
  shard.value = { ...home }
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 460)
    shard.value = {
      x: home.x + (EMITTER.x - home.x) * p,
      y: home.y + (EMITTER.y - home.y) * p,
    }
    if (p >= 1) { raf = null; snapped.value = true; fire(); return }
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

// ── What the panel says ──────────────────────────────────────────────────────
const status = computed(() => {
  if (shieldFull.value) return t('hawkStar.shield.full')
  if (!canAfford.value) return t('hawkStar.shield.noCrystal')
  if (snapped.value)    return t('hawkStar.shield.release')
  if (shard.value)      return t('hawkStar.shield.carry')
  return t('hawkStar.shield.drag', { n: SHIELD.clickPercent })
})

const shardStyle = computed(() => (shard.value
  ? { left: `${shard.value.x}%`, top: `${shard.value.y}%` }
  : null))
</script>

<template>
  <div class="hs-shd" :class="[`hs-shd--${level}`, { 'hs-shd--surge': surge }]">
    <div class="hs-shd-head">
      <span class="hs-shd-icon">🛡️</span>
      <h3 class="hs-shd-title">{{ t('hawkStar.shield.title') }}</h3>

      <span v-if="shieldDown" class="hs-shd-pct hs-shd-pct--alert">
        ⚠ {{ t('hawkStar.shield.down') }}
      </span>
      <span v-else class="hs-shd-pct">{{ pct }}%</span>
    </div>

    <!-- The dome over the planet, the emitter on the ground under it, and the
         crystal holder beside the emitter. One coordinate space for all three. -->
    <div ref="stageEl" class="hs-shd-stage" :class="{ 'hs-shd-stage--armed': snapped }">
      <svg class="hs-shd-svg" :viewBox="`0 0 ${VB.w} ${VB.h}`" aria-hidden="true">
        <!-- The planet the dome is over. It is the reason the arc is an arc. -->
        <ellipse class="hs-shd-ground" :cx="DOME.cx" :cy="VB.h + 6" :rx="DOME.r + 34" ry="26" />

        <!-- The dome that could be: what is not paid for yet. -->
        <path class="hs-shd-arc-bg" :d="arcPath" pathLength="100" />

        <!-- What one shard would add, shown only while one is in the pull. It is
             the price tag drawn on the thing you are buying. -->
        <path
          v-if="snapped && gain > 0"
          class="hs-shd-arc-ghost"
          :d="arcPath"
          pathLength="100"
          :stroke-dasharray="`${gain} 100`"
          :stroke-dashoffset="-pct"
        />

        <!-- The dome that is. -->
        <path
          class="hs-shd-arc"
          :d="arcPath"
          pathLength="100"
          :stroke-dasharray="`${pct} 100`"
        />

        <line
          v-for="(k, i) in ticks"
          :key="i"
          class="hs-shd-tick"
          :x1="k.x1" :y1="k.y1" :x2="k.x2" :y2="k.y2"
        />

        <circle class="hs-shd-core" :cx="DOME.cx" :cy="DOME.cy" r="6" />
        <circle class="hs-shd-core-dot" :cx="DOME.cx" :cy="DOME.cy" r="2.4" />
      </svg>

      <!-- The shockwave the emitter sends up the dome when a shard goes in. -->
      <span
        v-if="wave"
        :key="wave"
        class="hs-shd-wave"
        :style="{ left: EMITTER.x + '%', top: EMITTER.y + '%' }"
      />

      <!-- The holder. Empty and dimmed when a charge cannot be paid for, so
           "no crystal" is something you see before you reach for it. -->
      <button
        ref="holderEl"
        class="hs-shd-holder"
        :class="{
          'hs-shd-holder--empty': !canChargeShield,
          'hs-shd-holder--lifted': !!shard,
        }"
        :disabled="!canChargeShield"
        :aria-label="t('hawkStar.shield.charge', { n: SHIELD.clickPercent })"
        @pointerdown="onShardDown"
        @pointermove="onShardMove"
        @pointerup="onShardUp"
        @pointercancel="onShardUp"
        @keydown.enter.prevent="autoFire"
        @keydown.space.prevent="autoFire"
      >
        <span class="hs-shd-holder-gem">{{ RESOURCES.crystal?.icon ?? '💎' }}</span>
        <span class="hs-shd-holder-cost">
          <span
            v-for="c in cost"
            :key="c.res"
            class="hs-shd-tag"
            :class="c.ok ? 'hs-shd-tag--ok' : 'hs-shd-tag--no'"
          >{{ c.amount }}</span>
        </span>
      </button>

      <!-- The shard in hand. It is the payment, and it is still yours until it
           touches the core. -->
      <span
        v-if="shard"
        class="hs-shd-shard"
        :class="{ 'hs-shd-shard--snapped': snapped, 'hs-shd-shard--home': returning }"
        :style="shardStyle"
      >{{ RESOURCES.crystal?.icon ?? '💎' }}</span>

      <span
        v-for="s in sparks"
        :key="s.id"
        class="hs-shd-spark"
        :style="sparkStyle(s)"
      />
    </div>

    <div class="hs-shd-caption">
      <span class="hs-shd-status" :class="{ 'hs-shd-status--bad': !canAfford && !shieldFull }">
        {{ status }}
      </span>
      <span v-if="timeLeft" class="hs-shd-time">
        {{ t('hawkStar.shield.timeLeft', { time: timeLeft }) }}
      </span>
    </div>

    <p class="hs-shd-hint">{{ t('hawkStar.shield.hint') }}</p>

    <div v-if="shieldError" class="hs-shd-error">{{ shieldError }}</div>
  </div>
</template>

<style lang="scss" scoped>
// A block on the defense tile, the same shape as the battery block on the energy
// tile — the two mechanics still look like relatives, they just no longer share
// a button.
.hs-shd {
  --hs-shd-accent: #38bdf8;
  // The glow is its own token rather than a color-mix() of the accent: it sits
  // inside a filter, which is the one place color-mix() is still patchy.
  --hs-shd-glow: rgba(56, 189, 248, 0.7);

  position: relative;
  min-width: 0;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: var(--hs-r-md);
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &--ok    { --hs-shd-accent: #38bdf8; --hs-shd-glow: rgba(56, 189, 248, 0.7); }
  &--mid   { --hs-shd-accent: #60a5fa; --hs-shd-glow: rgba(96, 165, 250, 0.7); }
  &--low   { --hs-shd-accent: #f59e0b; --hs-shd-glow: rgba(245, 158, 11, 0.7); }
  // An empty shield goes dark and stays still. It never pulses: unlike a
  // blackout it costs the planet nothing today.
  &--empty {
    --hs-shd-accent: #ef4444;
    --hs-shd-glow: rgba(239, 68, 68, 0.6);
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.08);
  }
}

.hs-shd-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.hs-shd-icon  { font-size: 1rem; line-height: 1; }
.hs-shd-title { margin: 0; font-size: 0.8rem; font-weight: 700; color: #fff; }
.hs-shd-pct {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 700;
  color: #bae6fd;
  font-variant-numeric: tabular-nums;

  &--alert { color: #fca5a5; }
}

// ── The stage ────────────────────────────────────────────────────────────────
// Locked to the viewBox's ratio, which is what lets the shard, the emitter and
// the holder all be positioned in plain percentages.
.hs-shd-stage {
  position: relative;
  width: 100%;
  max-width: 20rem;
  margin: 0 auto;
  aspect-ratio: 200 / 118;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.hs-shd-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.hs-shd-ground {
  fill: rgba(255, 255, 255, 0.06);
  stroke: rgba(255, 255, 255, 0.12);
  stroke-width: 1;
}

.hs-shd-arc-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 5;
  stroke-linecap: round;
}
.hs-shd-arc {
  fill: none;
  stroke: var(--hs-shd-accent);
  stroke-width: 5;
  stroke-linecap: butt;
  filter: drop-shadow(0 0 4px var(--hs-shd-glow));
  transition: stroke-dasharray 0.4s ease, stroke 0.3s ease;
}
// What the shard in your hand would buy.
.hs-shd-arc-ghost {
  fill: none;
  stroke: #e0f2fe;
  stroke-width: 5;
  stroke-linecap: butt;
  opacity: 0.55;
  animation: hs-shd-ghost 0.9s ease-in-out infinite;
}
@keyframes hs-shd-ghost {
  0%, 100% { opacity: 0.25; }
  50%      { opacity: 0.7; }
}
.hs-shd-tick {
  stroke: rgba(0, 0, 0, 0.45);
  stroke-width: 1.4;
}

.hs-shd-core {
  fill: rgba(56, 189, 248, 0.2);
  stroke: var(--hs-shd-accent);
  stroke-width: 1.4;
  transition: fill 0.2s, stroke 0.2s;
}
.hs-shd-core-dot {
  fill: var(--hs-shd-accent);
  transition: fill 0.2s;
}
// The core reaches for a shard that is close enough to take.
.hs-shd-stage--armed {
  .hs-shd-core { fill: rgba(224, 242, 254, 0.55); stroke: #e0f2fe; }
  .hs-shd-core-dot { fill: #fff; }
}

// ── The holder and the shard ─────────────────────────────────────────────────
.hs-shd-holder {
  position: absolute;
  left: 1%;
  bottom: 2%;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.3rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(56, 189, 248, 0.35);
  background: rgba(8, 47, 73, 0.65);
  cursor: grab;
  touch-action: none;
  transition: border-color 0.2s, opacity 0.2s;

  &:focus-visible { outline: 2px solid var(--hs-shd-accent); outline-offset: 2px; }
  &:disabled { cursor: not-allowed; }
  // Holding one: the socket it came out of stays visible and empty, which is
  // what tells you the shard in flight is the one you are about to spend.
  &--lifted .hs-shd-holder-gem { opacity: 0.18; }
  &--empty  { opacity: 0.5; border-color: rgba(255, 255, 255, 0.18); }
  &--empty .hs-shd-holder-gem { filter: grayscale(1); opacity: 0.4; }
}
.hs-shd-holder-gem  { font-size: 0.95rem; line-height: 1; transition: opacity 0.2s; }
.hs-shd-holder-cost { display: flex; gap: 0.15rem; }
.hs-shd-tag {
  font-size: 0.58rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  &--ok { color: var(--hs-ok); }
  &--no { color: var(--hs-danger); }
}

.hs-shd-shard {
  position: absolute;
  font-size: 1.1rem;
  line-height: 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
  filter: drop-shadow(0 0 6px rgba(125, 211, 252, 0.8));
  transition: none;

  // In the core's pull: bigger, brighter, and turning — it is being taken.
  &--snapped {
    filter: drop-shadow(0 0 12px rgba(224, 242, 254, 1));
    animation: hs-shd-shard-pull 0.6s ease-in-out infinite;
  }
  // Dropped short. The only movement here that is animated, because it is the
  // only one that is not a hand.
  &--home {
    transition: left 0.28s ease, top 0.28s ease, opacity 0.28s ease;
    opacity: 0.35;
  }
}
@keyframes hs-shd-shard-pull {
  0%, 100% { transform: translate(-50%, -50%) scale(1.15) rotate(-6deg); }
  50%      { transform: translate(-50%, -50%) scale(1.3)  rotate(6deg); }
}

// The pulse the emitter sends up the dome.
.hs-shd-wave {
  position: absolute;
  width: 2rem;
  height: 2rem;
  margin: -1rem 0 0 -1rem;
  border-radius: 50%;
  border: 2px solid #e0f2fe;
  pointer-events: none;
  animation: hs-shd-wave 0.7s ease-out forwards;
}
@keyframes hs-shd-wave {
  0%   { transform: scale(0.3); opacity: 0.9; }
  100% { transform: scale(5);   opacity: 0; }
}

// The whole dome answers, not only the segment that changed — the new stretch
// is thin, and a shard that cost 150 crystal deserves to be felt.
.hs-shd--surge .hs-shd-arc {
  stroke: #e0f2fe;
  filter: drop-shadow(0 0 10px rgba(224, 242, 254, 0.9));
}

.hs-shd-spark {
  position: absolute;
  border-radius: 50%;
  background: #e0f2fe;
  box-shadow: 0 0 6px 1px rgba(125, 211, 252, 0.9);
  pointer-events: none;
  animation-name: hs-shd-spark;
  animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
  animation-fill-mode: forwards;
}
@keyframes hs-shd-spark {
  0%   { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--hs-dx), var(--hs-dy)) scale(0.2); opacity: 0; }
}

// ── Caption ──────────────────────────────────────────────────────────────────
.hs-shd-caption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.hs-shd-status {
  font-size: 0.64rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.72);

  &--bad { color: var(--hs-danger); }
}
.hs-shd-time {
  font-size: 0.62rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.hs-shd-hint {
  margin: 0;
  font-size: 0.6rem;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.45);
}
.hs-shd-error {
  margin: 0;
  font-size: 0.62rem;
  color: var(--hs-danger);
}

@media (prefers-reduced-motion: reduce) {
  .hs-shd-arc-ghost,
  .hs-shd-shard--snapped { animation: none; }
  .hs-shd-spark { display: none; }
  .hs-shd-wave  { animation-duration: 0.3s; }
}
</style>
