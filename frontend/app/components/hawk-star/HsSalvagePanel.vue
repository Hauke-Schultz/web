<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { RESOURCES } from '~/utils/hawkStarConfig.js'

const { t } = useI18n()
const {
  salvageScrap,
  salvageHold,
  salvageHoldMax,
  salvageHoldEmpty,
  salvageCabinet,
  reportSalvageCatch,
} = useHawkStar()

// ── Timing ────────────────────────────────────────────────────────────────────
// The ring is CSS, the judgement is arithmetic on timestamps: a dropped frame
// must never cost a catch, so nothing here reads the animation's own progress.
const RING_MS    = 1800  // the moment the ring sits exactly on the target
const HIT_MS     = 200   // ± window that counts as a catch at all
const PERFECT_MS = 100   // ± core inside it — a tighter hit fishes a better table
const OVERSHOOT_MS = 350 // the ring keeps shrinking past the target, so "too late"
                         // is something you can see rather than only feel
// One bite per cast. Three made a miss cost nothing and turned the cast into a
// three-round mini-game with its own bookkeeping — pips, a gap timer, a counter
// on screen. A single bite is the same toy with the padding removed: the click
// is the cast, and casting again is free.
const WAIT_MIN = 4000
const WAIT_MAX = 12000
const SHOW_RESULT_MS = 1800

// ── Geometry ─────────────────────────────────────────────────────────────────
// Every circle on screen is derived from the timing above, never hand-tuned.
// The first version drew a hairline target and left the window implicit: ±180 ms
// works out to about five pixels of travel, which is not something a player can
// aim at. Deriving the bands means the picture is the rule — widen HIT_MS and
// the band widens with it, and the two can never drift apart.
// The landing radius is deliberately small and the starting scale large: band
// thickness works out to TARGET_R × (RING_START − 1) × window/RING_MS, so a
// target drawn near the rim leaves the gold core a two-pixel hairline. These
// values keep the ring inside the button at t=0 (1.5 × 2.7 = 4.05 < 4.25) and
// still give the core ~4.5 px to aim at.
const CIRCLE_REM = 8.5   // the button
const TARGET_R   = 1.5   // rem, radius at which the ring "lands"
const RING_START = 2.7   // scale the ring starts from

const scaleAt = (ms) => RING_START - (RING_START - 1) * (ms / RING_MS)

const RING_TRAVEL_MS = RING_MS + OVERSHOOT_MS

// A band spanning ±halfWindow around the landing moment, drawn as a ring whose
// thickness IS the window.
const bandStyle = (halfWindow) => {
  const outer = TARGET_R * scaleAt(RING_MS - halfWindow)
  const inner = TARGET_R * scaleAt(RING_MS + halfWindow)
  return {
    inset:       `${CIRCLE_REM / 2 - outer}rem`,
    borderWidth: `${outer - inner}rem`,
  }
}

const goodBandStyle    = bandStyle(HIT_MS)
const perfectBandStyle = bandStyle(PERFECT_MS)

// The ring's own box is the target circle; the animation scales it from the rim
// through the bands and a little past. Its inset comes from TARGET_R too, so
// there is exactly one number governing where "landed" is.
const ringStyle = {
  inset:           `${CIRCLE_REM / 2 - TARGET_R}rem`,
  '--hs-sal-from': scaleAt(0),
  '--hs-sal-to':   scaleAt(RING_TRAVEL_MS),
  animationDuration: `${RING_TRAVEL_MS}ms`,
}

// idle → waiting → bite → result → idle
const phase        = ref('idle')
const ringStarted  = ref(0)
// True exactly while a click would count. It drives the "Jetzt!" label, the
// glow and nothing else — the same timer, so the word and the light can never
// promise a window that has already closed.
const inWindow     = ref(false)
// Bumping this re-keys the ring element, which is what restarts its animation —
// a CSS animation cannot be told to play again without being remounted.
const ringKey      = ref(0)
const result       = ref(null)

let waitTimer = null
let ringTimer = null
let windowTimer = null
let resetTimer = null

const clearTimers = () => {
  clearTimeout(waitTimer); clearTimeout(ringTimer)
  clearTimeout(windowTimer); clearTimeout(resetTimer)
  waitTimer = ringTimer = windowTimer = resetTimer = null
  inWindow.value = false
}
onUnmounted(clearTimers)

const scheduleReset = () => {
  resetTimer = setTimeout(() => { phase.value = 'idle' }, SHOW_RESULT_MS)
}

const startRing = () => {
  ringKey.value  += 1
  ringStarted.value = Date.now()
  phase.value = 'bite'
  inWindow.value = false
  windowTimer = setTimeout(() => { inWindow.value = true }, RING_MS - HIT_MS)
  // Letting the window pass counts as the same miss a wrong click does.
  ringTimer = setTimeout(missed, RING_MS + HIT_MS)
}

const cast = () => {
  clearTimers()
  // The last outcome deliberately survives the next cast: the line is the only
  // place a catch is ever named, and wiping it on cast meant the answer to
  // "what did I just pull up" vanished the moment you reached for the button.
  phase.value   = 'waiting'
  waitTimer = setTimeout(startRing, WAIT_MIN + Math.random() * (WAIT_MAX - WAIT_MIN))
}

// The only bite there is: a miss ends the cast.
const missed = () => finish(false)

// Two zones, not one. A hit anywhere in the band lands a catch; a hit in the
// gold core fishes a better table. That is the answer to "when is it worth
// clicking carefully" — and it is also the only place in the whole feature
// where precision pays more rather than merely faster.
const strike = () => {
  if (phase.value !== 'bite') return
  const off = Math.abs(Date.now() - ringStarted.value - RING_MS)
  if (off <= PERFECT_MS)  { clearTimers(); return finish(true, 'perfect') }
  if (off <= HIT_MS)      { clearTimers(); return finish(true, 'good') }
  missed()
}

// A miss never touches the network. The server only ever needs to hear about a
// catch, and reporting the failures would only add traffic and slow the rate
// limiter down for the honest player — a cheater would skip them anyway.
const finish = async (hit, zone = null) => {
  clearTimers()
  phase.value = 'result'
  if (!hit) { result.value = { hit: false }; scheduleReset(); return }

  result.value = { hit: true, zone, pending: true }
  const r = await reportSalvageCatch(true, zone)
  result.value = {
    hit: true,
    zone,
    ...r,
    // The catch was real, the hold just had no room left for it.
    thrownBack: !r.failed && r.gained === 0,
  }
  scheduleReset()
}

// One button, four meanings — the circle is the whole game, so it must not grow
// a second control next to it.
const onCircle = () => {
  if (phase.value === 'idle')  return cast()
  if (phase.value === 'bite')  return strike()
}

// Empty while the ring is still travelling: a word that stands there for the
// whole approach tells you nothing about *when*, which is the only thing it
// could usefully say. It appears the instant a click would count.
const circleLabel = computed(() => {
  if (phase.value === 'idle')    return t('hawkStar.salvage.cast')
  if (phase.value === 'waiting') return t('hawkStar.salvage.waiting')
  if (phase.value === 'bite')    return inWindow.value ? t('hawkStar.salvage.now') : ''
  if (!result.value?.hit)        return t('hawkStar.salvage.fled')
  return result.value?.zone === 'perfect'
    ? t('hawkStar.salvage.perfect')
    : t('hawkStar.salvage.landed')
})

const holdPct = computed(() =>
  salvageHoldMax.value ? Math.min(100, Math.max(0, salvageHold.value / salvageHoldMax.value * 100)) : 0
)

const catchName = (key) => t('hawkStar.salvage.catches.' + key)

// ── The cabinet ──────────────────────────────────────────────────────────────
// All sixteen slots are drawn from the very first cast, found or not: the empty
// ones are what make this a collection rather than a payout log, and they are
// the only place the game says how many there are.
const findName = (key) => t('hawkStar.salvage.finds.' + key + '.name')
const findLore = (key) => t('hawkStar.salvage.finds.' + key + '.lore')

// What an artefact did, in one line. It takes the server's `grant` for a fresh
// find and the catalogue entry for one already in the cabinet — the two are the
// same shape on purpose, because a capped store can make the grant differ from
// what the catalogue promised and the line should show what was actually paid.
const effectText = (effect) => {
  if (!effect) return ''
  if (effect.type === 'hold')     return t('hawkStar.salvage.effects.hold',     { amount: effect.amount })
  if (effect.type === 'scrap')    return t('hawkStar.salvage.effects.scrap',    { amount: effect.amount })
  if (effect.type === 'portrait') return t('hawkStar.salvage.effects.portrait', { portrait: effect.portrait })
  if (effect.type === 'resources') {
    const list = Object.entries(effect.resources ?? {})
      .map(([res, n]) => `${n} ${RESOURCES[res]?.icon ?? ''}`)
      .join(' · ')
    return list ? t('hawkStar.salvage.effects.resources', { list }) : ''
  }
  return ''
}

const foundCount = computed(() => salvageCabinet.value.filter(f => f.found).length)

// One slot at a time, click to open and click again to close. A locked slot
// opens too and says only that it is locked — naming an artefact that has not
// been found would give the collection away.
const selectedKey  = ref(null)
const selectedFind = computed(() => salvageCabinet.value.find(f => f.key === selectedKey.value) ?? null)
const toggleFind   = (f) => { selectedKey.value = selectedKey.value === f.key ? null : f.key }
</script>

<template>
  <div class="hs-salvage">
    <div class="hs-sal-head">
      <span class="hs-sal-icon">🧲</span>
      <h2 class="hs-sal-title">{{ t('hawkStar.salvage.title') }}</h2>
      <span class="hs-sal-scrap">🔩 {{ salvageScrap }}</span>
    </div>

    <p class="hs-sal-intro">{{ t('hawkStar.salvage.intro') }}</p>

    <!-- The hold is room LEFT, so the bar empties as you fish. At zero the toy
         keeps working and the scrap goes back over the side — that is the whole
         reason the catch is capped instead of the cast. -->
    <div class="hs-sal-hold">
      <div class="hs-sal-hold-row">
        <span class="hs-sal-hold-label">{{ t('hawkStar.salvage.holdLabel') }}</span>
        <span class="hs-sal-hold-val">{{ Math.floor(salvageHold) }} / {{ salvageHoldMax }}</span>
      </div>
      <span class="hs-sal-bar">
        <span
          class="hs-sal-bar-fill"
          :class="{ 'hs-sal-bar-fill--empty': salvageHoldEmpty }"
          :style="{ width: holdPct + '%' }"
        />
      </span>
      <span v-if="salvageHoldEmpty" class="hs-sal-hold-warn">{{ t('hawkStar.salvage.holdEmpty') }}</span>
    </div>

    <!-- The game itself -->
    <div class="hs-sal-stage">
      <button
        class="hs-sal-circle"
        :class="[`hs-sal-circle--${phase}`, { 'hs-sal-circle--open': inWindow }]"
        :disabled="phase === 'waiting' || phase === 'result'"
        @click="onCircle"
      >
        <!-- Idle ripples: the tell that something is out there, and the reason
             the waiting phase is watchable rather than a blank pause. -->
        <template v-if="phase === 'waiting'">
          <span class="hs-sal-ripple" />
          <span class="hs-sal-ripple hs-sal-ripple--late" />
        </template>

        <!-- The two bands ARE the hit window — both their radius and their
             thickness come straight out of HIT_MS / PERFECT_MS, so what you aim
             at is exactly what is judged. Amber counts, the gold core counts
             for more. -->
        <template v-if="phase === 'bite'">
          <span class="hs-sal-band hs-sal-band--good"    :style="goodBandStyle" />
          <span class="hs-sal-band hs-sal-band--perfect" :style="perfectBandStyle" />
          <span :key="ringKey" class="hs-sal-ring" :style="ringStyle" />
        </template>

        <span class="hs-sal-circle-label">{{ circleLabel }}</span>
      </button>

      <!-- Everything one cast produced, in one column beside the circle: the
           eye is already on the ring, and the empty space next to it was the
           one piece of room the panel had going spare. Keeping the catch line
           and the artefact together also stops the reward arriving in two
           places — the rare half used to appear below the fold while the
           ordinary half sat up here. -->
      <div class="hs-sal-outcome">
        <!-- What happened, in one line. It stays put — no fade, and not cleared
             by the next cast, so the haul is still readable while you fish. -->
        <div class="hs-sal-result">
          <template v-if="result?.hit && result?.pending">…</template>
          <template v-else-if="result?.failed">{{ t('hawkStar.salvage.failed') }}</template>
          <template v-else-if="result?.hit && result?.catch">
            <span class="hs-sal-catch-icon">{{ result.catch.icon }}</span>
            <span class="hs-sal-catch-name">{{ catchName(result.catch.key) }}</span>
            <span v-if="result.thrownBack" class="hs-sal-thrown">{{ t('hawkStar.salvage.thrownBack') }}</span>
            <span v-else class="hs-sal-gain">+{{ result.gained }} 🔩</span>
          </template>
          <template v-else-if="result && !result.hit">{{ t('hawkStar.salvage.fledLong') }}</template>
          <template v-else>&nbsp;</template>
        </div>

        <!-- Artefacts are not charged to the hold, so this can fire on a full
             hold too — which is exactly what keeps the tile worth opening later
             on. The second line is what the artefact actually paid, not what the
             catalogue promises: a full store can cut a delivery short. -->
        <div v-if="result?.find" class="hs-sal-find">
          <span class="hs-sal-find-line">
            ✨ {{ t('hawkStar.salvage.findFound', { name: findName(result.find.key) }) }}
          </span>
          <span class="hs-sal-find-effect">{{ result.find.icon }} {{ effectText(result.find.grant) }}</span>
        </div>
      </div>
    </div>

    <!-- The cabinet. Every slot is drawn from the first cast on: the locked ones
         are the collection, and the counter is the only place the game says how
         many there are to find. -->
    <div class="hs-sal-cabinet">
      <div class="hs-sal-cab-head">
        <span class="hs-sal-cab-title">{{ t('hawkStar.salvage.cabinet') }}</span>
        <span class="hs-sal-cab-count">{{ foundCount }} / {{ salvageCabinet.length }}</span>
      </div>

      <div class="hs-sal-cab-grid">
        <button
          v-for="f in salvageCabinet"
          :key="f.key"
          class="hs-sal-slot"
          :class="{
            'hs-sal-slot--found':  f.found,
            'hs-sal-slot--active': f.key === selectedKey,
          }"
          :title="f.found ? findName(f.key) : t('hawkStar.salvage.cabinetLocked')"
          @click="toggleFind(f)"
        >{{ f.found ? f.icon : '?' }}</button>
      </div>

      <div v-if="selectedFind" class="hs-sal-cab-detail">
        <template v-if="selectedFind.found">
          <span class="hs-sal-cab-name">{{ selectedFind.icon }} {{ findName(selectedFind.key) }}</span>
          <span class="hs-sal-cab-lore">{{ findLore(selectedFind.key) }}</span>
          <span class="hs-sal-cab-effect">{{ effectText(selectedFind.effect) }}</span>
        </template>
        <span v-else class="hs-sal-cab-lore">{{ t('hawkStar.salvage.cabinetLocked') }}</span>
      </div>
      <p v-else class="hs-sal-cab-hint">{{ t('hawkStar.salvage.cabinetHint') }}</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// A block inside the tile's building panel, not a panel of its own — the tile
// carries the smelter as well, so the build rows and the recipe section follow
// underneath. Same role the recruit panel plays on the base tile.
.hs-salvage {
  min-width: 0;
  background: rgba(56, 189, 248, 0.06);
  border: 1px solid rgba(56, 189, 248, 0.18);
  border-radius: var(--hs-r-md);
  padding: 0.75rem 0.85rem;
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.hs-sal-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.hs-sal-icon  { font-size: 1.15rem; line-height: 1; }
.hs-sal-title { font-size: 0.85rem; font-weight: 700; color: #fff; margin: 0; }
.hs-sal-scrap {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fcd34d;
  font-variant-numeric: tabular-nums;
}

.hs-sal-intro {
  margin: 0;
  font-size: 0.63rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.45);
}

.hs-sal-hold {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.hs-sal-hold-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.hs-sal-hold-label { font-size: 0.6rem; color: rgba(255, 255, 255, 0.5); }
.hs-sal-hold-val {
  font-size: 0.6rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
}
.hs-sal-bar {
  display: block;
  height: 5px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.hs-sal-bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: #38bdf8;
  transition: width 0.4s linear;

  &--empty { background: var(--hs-warn); }
}
.hs-sal-hold-warn {
  font-size: 0.58rem;
  color: var(--hs-warn-text);
}

// ── The stage ────────────────────────────────────────────────────────────────
// Circle left, outcome right. The circle keeps its fixed size, the outcome
// column takes what is left and wraps under it when that is too narrow — the
// panel lives inside a tile column, so it cannot assume any width.
.hs-sal-stage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.6rem 0.9rem;
  padding: 0.75rem 0 0.25rem;
}

.hs-sal-circle {
  position: relative;
  width: 8.5rem;
  height: 8.5rem;
  flex: none;
  border-radius: 50%;
  border: 2px solid rgba(56, 189, 248, 0.35);
  background: radial-gradient(circle at 50% 45%, rgba(56, 189, 248, 0.14), rgba(8, 20, 40, 0.55));
  color: #e0f2fe;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, background 0.2s, transform 0.08s;

  &:disabled { cursor: default; }
  &:not(:disabled):active { transform: scale(0.97); }

  // The approach stays cool. Warmth is reserved for the window itself, so the
  // colour change is information rather than decoration.
  &--bite {
    border-color: rgba(148, 163, 184, 0.5);
    background: radial-gradient(circle at 50% 45%, rgba(100, 116, 139, 0.16), rgba(8, 20, 40, 0.6));
    color: #fde68a;
  }
  &--open {
    border-color: rgba(250, 204, 21, 0.9);
    background: radial-gradient(circle at 50% 45%, rgba(250, 204, 21, 0.2), rgba(40, 28, 8, 0.62));
    box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.14);
  }
  &--result { border-color: rgba(255, 255, 255, 0.18); }
}
.hs-sal-circle-label {
  position: relative;
  z-index: 2;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

// The hit window, drawn. `inset` and `border-width` are set inline from the
// timing constants — box-sizing keeps the border inside the box, so the painted
// band spans exactly the radii the clock will accept.
.hs-sal-band {
  position: absolute;
  box-sizing: border-box;
  border-radius: 50%;
  border-style: solid;
  transition: border-color 0.12s;

  &--good    { border-color: rgba(250, 204, 21, 0.16); }
  &--perfect { border-color: rgba(253, 224, 71, 0.42); }
}
.hs-sal-circle--open {
  .hs-sal-band--good    { border-color: rgba(250, 204, 21, 0.3); }
  .hs-sal-band--perfect { border-color: rgba(253, 224, 71, 0.72); }
}

// Travels from the rim through the target and a little past it. Linear on
// purpose: an eased ring would make the last 200 ms unreadable, which is the
// only part that matters. The overshoot is what makes "too late" visible.
// Both scales come from the same `scaleAt()` the bands use.
.hs-sal-ring {
  position: absolute;  // inset comes from ringStyle — TARGET_R governs it
  border-radius: 50%;
  border: 3px solid rgba(226, 232, 240, 0.85);
  animation-name: hs-sal-shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
  transition: border-color 0.12s;
}
.hs-sal-circle--open .hs-sal-ring { border-color: #fde68a; }

@keyframes hs-sal-shrink {
  from { transform: scale(var(--hs-sal-from)); opacity: 0.3; }
  20%  { opacity: 1; }
  to   { transform: scale(var(--hs-sal-to));   opacity: 1; }
}

.hs-sal-ripple {
  position: absolute;
  inset: 2.6rem;
  border-radius: 50%;
  border: 1px solid rgba(125, 211, 252, 0.5);
  animation: hs-sal-ripple 2.2s ease-out infinite;

  &--late { animation-delay: 1.1s; }
}
@keyframes hs-sal-ripple {
  from { transform: scale(0.35); opacity: 0; }
  25%  { opacity: 0.75; }
  to   { transform: scale(1.75); opacity: 0; }
}

// The right-hand column: the catch line, plus the artefact card on the rare
// cast that turns one up. It takes whatever the circle leaves and wraps under
// it once that is narrower than a line of text.
.hs-sal-outcome {
  flex: 1 1 9rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.4rem;
}

// Always on. The reserved min-height is what stops the panel jumping before the
// first catch, so nothing here needs to fade.
.hs-sal-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.15rem 0.35rem;
  min-height: 1.2rem;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.5);
}
.hs-sal-catch-icon { font-size: 0.85rem; }
.hs-sal-catch-name { color: rgba(255, 255, 255, 0.8); font-weight: 600; }
.hs-sal-gain   { color: var(--hs-ok-muted); font-weight: 700; font-variant-numeric: tabular-nums; }
.hs-sal-thrown { color: var(--hs-warn-text); }

.hs-sal-find {
  padding: 0.4rem 0.6rem;
  border-radius: var(--hs-r-md);
  border: 1px solid rgba(196, 181, 253, 0.35);
  background: rgba(139, 92, 246, 0.12);
  font-size: 0.65rem;
  color: #ddd6fe;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.hs-sal-find-line   { font-weight: 700; }
.hs-sal-find-effect { font-size: 0.6rem; color: rgba(221, 214, 254, 0.75); }

// ── Cabinet ──────────────────────────────────────────────────────────────────
// A quiet block under the game: it is a collection, not a control, and must not
// compete with the circle for attention.
.hs-sal-cabinet {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.hs-sal-cab-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.hs-sal-cab-title {
  font-size: 0.68rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.72);
}
.hs-sal-cab-count {
  font-size: 0.65rem;
  font-weight: 700;
  color: #c4b5fd;
  font-variant-numeric: tabular-nums;
}

.hs-sal-cab-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  max-width: 24rem;
  gap: 0.3rem;

	@media (min-width: 640px) {
		grid-template-columns: repeat(8, minmax(0, 1fr));
		max-width: 30rem;
	}
}
.hs-sal-slot {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  line-height: 1;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  // An empty slot is a silhouette, not a puzzle: dim enough to read as missing,
  // legible enough to be counted at a glance.
  color: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.hs-sal-slot--found {
  border-color: rgba(196, 181, 253, 0.35);
  background: rgba(139, 92, 246, 0.12);
  color: #fff;
}
.hs-sal-slot--active {
  border-color: #c4b5fd;
  background: rgba(139, 92, 246, 0.25);
}

.hs-sal-cab-detail {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.4rem 0.5rem;
  border-radius: var(--hs-r-md);
  background: rgba(255, 255, 255, 0.04);
}
.hs-sal-cab-name   { font-size: 0.68rem; font-weight: 700; color: #fff; }
.hs-sal-cab-lore   { font-size: 0.62rem; line-height: 1.4; color: rgba(255, 255, 255, 0.5); font-style: italic; }
.hs-sal-cab-effect { font-size: 0.62rem; font-weight: 600; color: #86efac; }
.hs-sal-cab-hint   { margin: 0; font-size: 0.6rem; line-height: 1.4; color: rgba(255, 255, 255, 0.35); }
</style>
