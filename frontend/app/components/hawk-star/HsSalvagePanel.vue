<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
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
// The contact is CSS, the judgement is arithmetic on timestamps: a dropped frame
// must never cost a catch, so nothing here reads the animation's own progress.
const RING_MS    = 1800  // the moment the contact sits exactly on the middle
const HIT_MS     = 200   // ± window that counts as a catch at all
const PERFECT_MS = 100   // ± core inside it — a tighter hit fishes a better table
const OVERSHOOT_MS = 500 // the contact keeps flying past the middle, so "too
                         // late" is something you can see rather than only
                         // feel. It is also the delay before the miss is
                         // announced: the verdict must not land while the dot
                         // is still on the crosshair.
// One bite per cast. Three made a miss cost nothing and turned the cast into a
// three-round mini-game with its own bookkeeping — pips, a gap timer, a counter
// on screen. A single bite is the same toy with the padding removed: the click
// is the cast, and casting again is free.
const WAIT_MIN = 4000
const WAIT_MAX = 12000
// Long enough to read the outcome on the dial, short enough that the button is
// back before the hand is: the result line beside it survives the next cast
// anyway, so this only governs how long the button stays locked.
const SHOW_RESULT_MS = 1200

// ── Geometry ─────────────────────────────────────────────────────────────────
// Every circle on screen is derived from the timing above, never hand-tuned.
// The first version drew a hairline target and left the window implicit: ±180 ms
// works out to about five pixels of travel, which is not something a player can
// aim at. Deriving the target from the clock means the picture *is* the rule —
// widen HIT_MS and the target widens with it, and the two can never drift apart.
// CIRCLE_REM is the single source of the button's size — the stylesheet reads it
// back as a custom property, because the geometry here and the drawn circle
// drifting apart is exactly the bug this file is built to avoid.
const CIRCLE_REM = 8     // the button
const TARGET_R   = 1.4   // rem, the radius the contact starts its run from ×
const RING_START = 2.7   //      this scale — together, where a bite appears

// The hold ring is drawn outside the button, in the dial's padding.
const HOLD_GAP_REM = 0.55

const RING_TRAVEL_MS = RING_MS + OVERSHOOT_MS

// ── The contact ───────────────────────────────────────────────────────────────
// A radar blip closing on the middle: it leaves the rim and is dead centre at
// RING_MS, the moment a click pays most. It is now the *only* moving part —
// a white ring used to shrink through the bands alongside it, saying the same
// thing a second time, and two clocks for one instant is one too many.
// Only the bearing is random. The distance and the duration are fixed, because a
// contact that came in at its own pace would be a second rule contradicting the
// first.
// It does not stop dead in the middle either. One linear pass carries it from
// the rim to the far side, and because the speed is constant it is at zero at
// exactly RING_MS without anyone having to say so — the crossing is a
// consequence of the geometry, not a keyframe that has to be kept in step.
const BLIP_FROM_REM = TARGET_R * RING_START
const BLIP_PAST_REM = BLIP_FROM_REM * OVERSHOOT_MS / RING_MS

// ── The target ────────────────────────────────────────────────────────────────
// Two circles at the centre, and their radii are the hit windows measured in the
// contact's own travel: how far the blip gets in HIT_MS, and in PERFECT_MS. So
// "the dot is inside the amber circle" is exactly "a click counts", and "the dot
// covers the gold core" is exactly "this one rolls the better table" — the same
// derived-from-the-clock rule the old bands followed, restated for the one thing
// still moving.
//
// This had to be re-derived when the shrinking ring went. The bands used to sit
// where the *ring* landed (TARGET_R, 1.4 rem out); the contact crosses that
// radius at ~1130 ms, some 470 ms before the window opens, so leaving them there
// would have left a gold ring being flown through at a moment that pays nothing.
const BLIP_SPEED_REM_PER_MS = (BLIP_FROM_REM + BLIP_PAST_REM) / RING_TRAVEL_MS

const targetStyle = (halfWindow) => {
  const r = BLIP_SPEED_REM_PER_MS * halfWindow
  return { inset: `${CIRCLE_REM / 2 - r}rem` }
}

const goodBandStyle    = targetStyle(HIT_MS)
const perfectBandStyle = targetStyle(PERFECT_MS)

const blipAngle = ref(0)
const blipStyle = computed(() => ({
  '--hs-sal-blip-a':    `${blipAngle.value}deg`,
  '--hs-sal-blip-r':    `${BLIP_FROM_REM}rem`,
  '--hs-sal-blip-past': `${BLIP_PAST_REM}rem`,
  // Two animations, two jobs: the pass (transform, the whole travel) and the
  // exit (opacity, starting the instant the window shuts — not the instant it
  // crosses the middle, because the last 200 ms of the window still pays and a
  // dimming contact would say otherwise). Splitting them by property is what
  // lets the fade start on a timing constant instead of on a keyframe
  // percentage that would have to be recomputed whenever the timing moves.
  animationDuration: `${RING_TRAVEL_MS}ms, ${OVERSHOOT_MS - HIT_MS}ms`,
  animationDelay:    `0ms, ${RING_MS + HIT_MS}ms`,
}))

// The dial is the button plus the gap the hold ring is drawn in. Handing both
// numbers to CSS keeps the stylesheet from re-stating them.
const dialStyle = {
  '--hs-sal-circle': `${CIRCLE_REM}rem`,
  '--hs-sal-gap':    `${HOLD_GAP_REM}rem`,
  padding: `${HOLD_GAP_REM}rem`,
}

// idle → waiting → bite → result → idle
const phase        = ref('idle')
const ringStarted  = ref(0)
// True exactly while a click would count. It drives the "Jetzt!" label, the
// glow and nothing else — the same timer, so the word and the light can never
// promise a window that has already closed.
const inWindow     = ref(false)
// True for the short stretch between the window shutting and the verdict being
// announced — the beat in which the contact tears past the middle. A click here
// is a miss like any other; the flag only decides what the button looks like
// and what the word says.
const windowClosed = ref(false)
// Bumping this re-keys the contact, which is what restarts its animation —
// a CSS animation cannot be told to play again without being remounted.
const ringKey      = ref(0)
const result       = ref(null)

let waitTimer = null
let ringTimer = null
let windowTimer = null
let lateTimer = null
let resetTimer = null

const clearTimers = () => {
  clearTimeout(waitTimer); clearTimeout(ringTimer)
  clearTimeout(windowTimer); clearTimeout(lateTimer); clearTimeout(resetTimer)
  waitTimer = ringTimer = windowTimer = lateTimer = resetTimer = null
  inWindow.value = false
  windowClosed.value = false
}

// ── Feedback ──────────────────────────────────────────────────────────────────
// Purely decorative state, kept strictly apart from the four timers above: the
// game must not be able to hang on a piece of confetti. Nothing here is ever
// read back, and all of it is dropped on unmount.
//
// What it is for: the button was a circle that changed colour, and a toy whose
// only feedback is a colour change does not feel like it is doing anything. The
// cast throws something out, a catch throws scrap back at you, a miss shrugs.
const wave    = ref(null)   // one expanding pulse: { kind: 'cast' | 'catch', id }
const flash   = ref(null)   // 'perfect' | 'good' | 'miss', drives the button's own jolt
const sparks  = ref([])     // flying scrap, one element per particle
const floater = ref(null)   // the "+N 🔩" that rises off the dial
// The purse in the header, told that it just went up. Without it the sparks fly
// off into nothing and the counter changes somewhere else entirely.
const scrapPop = ref(false)

let decoId = 0
const decoTimers = new Set()
// setTimeout that forgets itself, so `clearDeco` never has to know what is
// outstanding — there can be a dozen of these in flight during a good burst.
const later = (ms, fn) => {
  const id = setTimeout(() => { decoTimers.delete(id); fn() }, ms)
  decoTimers.add(id)
}
const clearDeco = () => {
  decoTimers.forEach(clearTimeout); decoTimers.clear()
  wave.value = flash.value = floater.value = null
  scrapPop.value = false
  sparks.value = []
}

const SPARK_MS = 750

const pulse = (kind, ms) => {
  wave.value = { kind, id: ++decoId }
  later(ms, () => { if (wave.value?.kind === kind) wave.value = null })
}

// The class has to outlive the keyframes it triggers, or the animation is cut
// off mid-way — hence one duration per kind rather than one for all three.
const JOLT_MS = { good: 440, perfect: 540, miss: 420 }
const jolt = (kind) => {
  flash.value = kind
  later(JOLT_MS[kind] ?? 450, () => { if (flash.value === kind) flash.value = null })
}

// Scrap thrown out of the dial. Count follows the haul, so a big catch looks
// like one — the number in the line is the fact, this is the feeling.
const burst = (count) => {
  const made = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist  = 2.8 + Math.random() * 2.2
    made.push({
      id: ++decoId,
      style: {
        '--hs-sal-dx':  `${Math.cos(angle) * dist}rem`,
        '--hs-sal-dy':  `${Math.sin(angle) * dist}rem`,
        '--hs-sal-rot': `${-150 + Math.random() * 300}deg`,
        animationDelay: `${Math.round(Math.random() * 110)}ms`,
      },
    })
  }
  sparks.value = [...sparks.value, ...made]
  const ids = new Set(made.map(s => s.id))
  later(SPARK_MS + 200, () => { sparks.value = sparks.value.filter(s => !ids.has(s.id)) })
}

onUnmounted(() => { clearTimers(); clearDeco() })

const scheduleReset = () => {
  resetTimer = setTimeout(() => { phase.value = 'idle' }, SHOW_RESULT_MS)
}

const startRing = () => {
  ringKey.value  += 1
  // A fresh bearing every bite: the eye must not be able to learn where to wait.
  blipAngle.value = Math.random() * 360
  ringStarted.value = Date.now()
  phase.value = 'bite'
  inWindow.value    = false
  windowClosed.value = false
  windowTimer = setTimeout(() => { inWindow.value = true }, RING_MS - HIT_MS)
  // The window shuts on time — the word and the glow go out with it, and the
  // contact is still on screen to be seen tearing past the middle.
  lateTimer = setTimeout(() => {
    inWindow.value = false
    windowClosed.value = true
  }, RING_MS + HIT_MS)
  // …and the verdict lands a beat later, once the contact has
  // finished their overshoot. Letting the window pass counts as the same miss a
  // wrong click does; it is only *announced* once the miss is visible, because
  // "gone" arriving while the dot still sits dead centre reads as the game
  // having taken the catch away rather than as having been too slow.
  ringTimer = setTimeout(missed, RING_TRAVEL_MS)

  // Judge against the clock the player is actually watching. Vue renders on the
  // next tick and the browser starts the CSS animations on the frame after that,
  // so a bite timed from this function is a frame or two ahead of
  // the contact on screen — always in the same direction, always against the
  // player. Re-stamping on the first painted frame costs nothing and makes "dead
  // centre" mean dead centre. If the frame never comes (a backgrounded tab), the
  // original stamp stands and nothing is worse than it was.
  const bite = ringKey.value
  nextTick(() => requestAnimationFrame(() => {
    if (ringKey.value === bite) ringStarted.value = Date.now()
  }))
}

const cast = () => {
  clearTimers()
  clearDeco()
  // The one thing the player does that has no outcome attached: the pulse is
  // the whole acknowledgement, and without it the button swallowed the click.
  pulse('cast', 700)
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
  if (!hit) { jolt('miss'); result.value = { hit: false }; scheduleReset(); return }

  // The jolt fires on the click, not on the answer: the hit was decided here,
  // and making the player wait for the network before the button reacts is what
  // would make a good click feel unrewarded.
  jolt(zone)
  pulse('catch', 620)
  result.value = { hit: true, zone, pending: true }

  const r = await reportSalvageCatch(true, zone)
  result.value = {
    hit: true,
    zone,
    ...r,
    // The catch was real, the hold just had no room left for it.
    thrownBack: !r.failed && r.gained === 0,
  }
  // Scrap only flies when scrap was actually earned — a thrown-back catch has
  // to look different from a paid one, or the hold ceiling stops reading as a
  // ceiling at all.
  if (r.gained > 0) {
    burst(Math.min(12, 3 + Math.round(r.gained / 3)))
    floater.value = `+${r.gained} 🔩`
    scrapPop.value = true
    later(1100, () => { floater.value = null })
    later(700,  () => { scrapPop.value = false })
  }
  scheduleReset()
}

// One button, four meanings — the circle is the whole game, so it must not grow
// a second control next to it.
const onCircle = () => {
  if (phase.value === 'idle')  return cast()
  if (phase.value === 'bite')  return strike()
}

// Empty while the contact is still travelling: a word that stands there for the
// whole approach tells you nothing about *when*, which is the only thing it
// could usefully say. It appears the instant a click would count.
const circleLabel = computed(() => {
  if (phase.value === 'idle')    return t('hawkStar.salvage.cast')
  if (phase.value === 'waiting') return t('hawkStar.salvage.waiting')
  // Empty on the approach, *Jetzt!* in the window, and *Entwischt* for the beat
  // the contact spends tearing past — the catch is already lost by then, and
  // saying so while it is still visibly leaving is what makes the miss legible.
  if (phase.value === 'bite') {
    if (inWindow.value)     return t('hawkStar.salvage.now')
    if (windowClosed.value) return t('hawkStar.salvage.fled')
    return ''
  }
  if (!result.value?.hit)        return t('hawkStar.salvage.fled')
  return result.value?.zone === 'perfect'
    ? t('hawkStar.salvage.perfect')
    : t('hawkStar.salvage.landed')
})

const holdPct = computed(() =>
  salvageHoldMax.value ? Math.min(100, Math.max(0, salvageHold.value / salvageHoldMax.value * 100)) : 0
)

// The hold, drawn as the ring around the button instead of a bar under it. It
// is the one number that decides whether the next cast pays, so it belongs on
// the thing you are about to click — and as a ring it costs no vertical space
// at all. Radius 46 in a 0–100 viewBox, so the arc lands just outside the rim.
const HOLD_R = 46
const HOLD_C = 2 * Math.PI * HOLD_R
const holdArcStyle = computed(() => ({
  strokeDasharray:  `${HOLD_C}`,
  strokeDashoffset: `${HOLD_C * (1 - holdPct.value / 100)}`,
}))

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
      <span class="hs-sal-scrap" :class="{ 'hs-sal-scrap--pop': scrapPop }">🔩 {{ salvageScrap }}</span>
    </div>

    <!-- The game itself: dial on the left, everything written on the right. -->
    <div class="hs-sal-stage">
      <div
        class="hs-sal-dial"
        :class="[`hs-sal-dial--${phase}`, flash ? `hs-sal-dial--${flash}` : null]"
        :style="dialStyle"
      >
        <!-- The hold, as the ring around the button. It is room LEFT, so the arc
             empties as you fish; at zero the toy keeps working and the scrap
             goes back over the side, which is the whole reason the catch is
             capped instead of the cast. -->
        <svg class="hs-sal-hold-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="hs-sal-hold-track" cx="50" cy="50" :r="HOLD_R" />
          <circle
            class="hs-sal-hold-arc"
            :class="{ 'hs-sal-hold-arc--empty': salvageHoldEmpty }"
            cx="50" cy="50" :r="HOLD_R"
            :style="holdArcStyle"
          />
        </svg>

        <!-- One pulse, two meanings: outward on the cast, inward-lit on a catch.
             Re-keyed so the animation restarts rather than being ignored. -->
        <span
          v-if="wave"
          :key="wave.id"
          class="hs-sal-wave"
          :class="`hs-sal-wave--${wave.kind}`"
        />

        <button
          class="hs-sal-circle"
          :class="[
            `hs-sal-circle--${phase}`,
            { 'hs-sal-circle--open': inWindow, 'hs-sal-circle--late': windowClosed },
          ]"
          :disabled="phase === 'waiting' || phase === 'result'"
          @click="onCircle"
        >
          <!-- The beam is out: a sweep and two ripples. This is the only thing
               on screen during the wait, and a blank circle for up to twelve
               seconds reads as broken rather than as patient. -->
          <template v-if="phase === 'waiting'">
            <span class="hs-sal-sweep" />
            <span class="hs-sal-ripple" />
            <span class="hs-sal-ripple hs-sal-ripple--late" />
          </template>

          <!-- The two circles ARE the hit window: their radii are how far the
               contact travels in HIT_MS and in PERFECT_MS, so where the dot is
               *is* what is judged. Amber counts, the gold core counts for more. -->
          <template v-if="phase === 'bite'">
            <!-- The crosshair, so the middle is a place before anything is in it. -->
            <span class="hs-sal-core" />
            <span class="hs-sal-band hs-sal-band--good"    :style="goodBandStyle" />
            <span class="hs-sal-band hs-sal-band--perfect" :style="perfectBandStyle" />
            <!-- The contact itself: rolled bearing, one clock. -->
            <span :key="`blip-${ringKey}`" class="hs-sal-blip" :style="blipStyle" />
          </template>

          <span class="hs-sal-circle-label">{{ circleLabel }}</span>
        </button>

        <!-- Scrap, thrown out of the dial and gone again. Outside the button so
             the particles can leave it, and `pointer-events: none` so they can
             never eat the next click. -->
        <span
          v-for="s in sparks"
          :key="s.id"
          class="hs-sal-spark"
          :style="s.style"
        >🔩</span>

        <span v-if="floater" class="hs-sal-floater">{{ floater }}</span>
      </div>

      <!-- Everything written, in one column beside the dial: what the toy is,
           how much room is left, what the last cast produced, and the artefact
           on the rare cast that turns one up. The reward used to arrive in two
           places — the rare half below the fold, the ordinary half above it. -->
      <div class="hs-sal-outcome">
        <p class="hs-sal-intro">{{ t('hawkStar.salvage.intro') }}</p>

        <div class="hs-sal-hold-row">
          <span class="hs-sal-hold-label">{{ t('hawkStar.salvage.holdLabel') }}</span>
          <span class="hs-sal-hold-val" :class="{ 'hs-sal-hold-val--empty': salvageHoldEmpty }">
            {{ Math.floor(salvageHold) }} / {{ salvageHoldMax }}
          </span>
        </div>
        <span v-if="salvageHoldEmpty" class="hs-sal-hold-warn">{{ t('hawkStar.salvage.holdEmpty') }}</span>

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
  padding: 0.7rem 0.8rem;
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
  transform-origin: right center;

  // Where the scrap ends up. The sparks leave the dial, the counter answers —
  // otherwise the payout happens in one corner and the total in another.
  &--pop { animation: hs-sal-scrap-pop 700ms ease-out; }
}
@keyframes hs-sal-scrap-pop {
  0%   { transform: scale(1);    color: #fcd34d; }
  25%  { transform: scale(1.18); color: #fff; text-shadow: 0 0 10px rgba(252, 211, 77, 0.7); }
  100% { transform: scale(1);    color: #fcd34d; }
}

.hs-sal-intro {
  margin: 0;
  font-size: 0.62rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.42);
}

// The bar is gone — the hold is the ring around the button now. What is left of
// it is the exact figure, which a ring cannot give you.
.hs-sal-hold-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.hs-sal-hold-label { font-size: 0.6rem; color: rgba(255, 255, 255, 0.5); }
.hs-sal-hold-val {
  font-size: 0.62rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;

  &--empty { color: var(--hs-warn-text); }
}
.hs-sal-hold-warn {
  font-size: 0.58rem;
  line-height: 1.35;
  color: var(--hs-warn-text);
}

// ── The stage ────────────────────────────────────────────────────────────────
// Dial left, everything written right. The dial keeps its fixed size, the column
// takes what is left and wraps under it when that is too narrow — the panel
// lives inside a tile column, so it cannot assume any width.
.hs-sal-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem 0.9rem;
  padding: 0.35rem 0 0.15rem;
}

// ── The dial ─────────────────────────────────────────────────────────────────
// Button, hold ring and every piece of confetti in one positioned box. Its
// padding is the gap the ring is drawn in and comes from `HOLD_GAP_REM`, its
// size from `--hs-sal-circle` — both set inline, so the geometry in the script
// and the picture on screen cannot drift.
.hs-sal-dial {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  isolation: isolate;
}

// Idle breathing. A button that sits perfectly still reads as a label, and this
// is the whole invitation to press it. Drawn *behind* the button rather than on
// it, so the button's own hover and press states keep their box-shadow to
// themselves — one glow per meaning.
.hs-sal-dial--idle::after {
  content: '';
  position: absolute;
  inset: var(--hs-sal-gap);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.22), rgba(56, 189, 248, 0) 72%);
  animation: hs-sal-breathe 3.4s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}
@keyframes hs-sal-breathe {
  0%, 100% { transform: scale(0.94); opacity: 0.3; }
  50%      { transform: scale(1.09); opacity: 0.85; }
}

.hs-sal-hold-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  // 0° is East in SVG, and a gauge that starts anywhere but the top reads as
  // decoration rather than as a measure.
  transform: rotate(-90deg);
  pointer-events: none;
}
.hs-sal-hold-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 4;
}
.hs-sal-hold-arc {
  fill: none;
  stroke: #38bdf8;
  stroke-width: 4;
  stroke-linecap: round;
  filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.45));
  // Slower than the bar was: the hold moves by a catch at a time, and a ring
  // that snaps is a ring you never see move.
  transition: stroke-dashoffset 0.6s ease, stroke 0.3s;

  &--empty {
    stroke: var(--hs-warn);
    filter: drop-shadow(0 0 3px rgba(250, 204, 21, 0.4));
  }
}

.hs-sal-circle {
  position: relative;
  width: var(--hs-sal-circle);
  height: var(--hs-sal-circle);
  flex: none;
  border-radius: 50%;
  border: 2px solid rgba(56, 189, 248, 0.35);
  background: radial-gradient(circle at 50% 45%, rgba(56, 189, 248, 0.14), rgba(8, 20, 40, 0.55));
  color: #e0f2fe;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;   // keeps the sweep and the ripples inside the rim
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s, transform 0.08s;

  &:disabled { cursor: default; }
  &:not(:disabled):active { transform: scale(0.96); }
  // Hover belongs to the idle button alone. During the bite the glow is
  // information — a blue hover ring on top of the gold one would be a second
  // light saying something the clock does not.
  &--idle:hover {
    border-color: rgba(125, 211, 252, 0.65);
    box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.1);
  }

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
  // The window has shut but the bite is still on screen. Everything goes cold at
  // once — that is the moment the catch was lost, and it has to be the moment it
  // looks lost, not half a second later when the panel gets round to saying so.
  &--late {
    border-color: rgba(148, 163, 184, 0.22);
    background: radial-gradient(circle at 50% 45%, rgba(100, 116, 139, 0.1), rgba(8, 20, 40, 0.6));
    color: rgba(255, 255, 255, 0.4);
  }
  &--result { border-color: rgba(255, 255, 255, 0.18); }
}
.hs-sal-circle--late {
  .hs-sal-band--good    { border-color: rgba(255, 255, 255, 0.06); }
  .hs-sal-band--perfect { border-color: rgba(255, 255, 255, 0.1); background: none; }
}
// The middle of the button belongs to the contact and the target, so the word
// lives in the lower third — in every phase, not only during the bite, because
// a label that jumps to make room is a label you have to re-find each time.
// Derived from the button's own size, so it stays in the lower third whatever
// CIRCLE_REM becomes.
.hs-sal-circle-label {
  position: relative;
  z-index: 2;
  transform: translateY(calc(var(--hs-sal-circle) * 0.26));
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

// ── The target ───────────────────────────────────────────────────────────────
// The hit window, drawn: two circles at the centre whose radii are set inline
// from `targetStyle()` — how far the contact travels in HIT_MS and in
// PERFECT_MS. The dot inside the amber circle is a catch; the dot over the gold
// core is the better table. Small, because the window is small: ±200 ms of the
// contact's travel is 0.42 rem, and drawing it any larger would be a picture
// promising something the clock does not.
.hs-sal-band {
  position: absolute;
  box-sizing: border-box;
  border-radius: 50%;
  border: 1px solid;
  transition: border-color 0.12s, background 0.12s;

  &--good    { border-color: rgba(250, 204, 21, 0.35); }
  &--perfect {
    border-color: rgba(253, 224, 71, 0.6);
    background: rgba(250, 204, 21, 0.16);
  }
}
.hs-sal-circle--open {
  .hs-sal-band--good    { border-color: rgba(250, 204, 21, 0.85); }
  .hs-sal-band--perfect {
    border-color: #fde68a;
    background: rgba(250, 204, 21, 0.4);
  }
}

// The crosshair. Faint on purpose: it is where the contact is going, not a thing
// to look at — but without it the middle is nowhere in particular before the
// circles have anything in them. No ring of its own any more; the target circles
// are the rings now, and a third one only muddled them.
.hs-sal-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  pointer-events: none;

  &::before,
  &::after {
    content: '';
    position: absolute;
    background: rgba(255, 255, 255, 0.16);
  }
  &::before { left: 0; top: -0.75rem; height: 1.5rem; width: 1px;  margin-left: -0.5px; }
  &::after  { top:  0; left: -0.75rem; width: 1.5rem; height: 1px; margin-top: -0.5px; }
}

// The blip. Red because a contact is red, and because nothing else on the dial
// is — the eye finds it without being told. Its transform is
// `rotate(bearing) translateY(−distance)`, so one animation carries it straight
// down the bearing to the centre and the wake below rides along.
.hs-sal-blip {
  position: absolute;
  left: 50%;
  top: 50%;
  // Sized against the target it is flying into: a shade over the gold core
  // (0.21 rem radius) and comfortably inside the amber one, so "covers the
  // core" and "inside the ring" are both things you can actually see. The glow
  // carries the visibility the pixels no longer have to.
  width: 0.45rem;
  height: 0.45rem;
  margin: -0.225rem 0 0 -0.225rem;
  border-radius: 50%;
  background: radial-gradient(circle, #fee2e2 0%, #ef4444 60%, rgba(239, 68, 68, 0.4) 100%);
  box-shadow: 0 0 9px rgba(239, 68, 68, 0.8);
  // Duration and delay are set inline; the pass is linear for the same reason
  // the ring is — an eased approach would make the last 200 ms unreadable, and
  // a constant speed is also what puts the dot on the crosshair at RING_MS.
  animation-name: hs-sal-blip-pass, hs-sal-blip-gone;
  animation-timing-function: linear, ease-in;
  animation-fill-mode: forwards, forwards;
  pointer-events: none;
  z-index: 1;

  // The wake: a short streak pointing back the way it came. The parent's
  // rotation carries it, so it is always along the line of travel — motion you
  // can still see in a freeze-frame.
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 50%;
    width: 2px;
    height: 1.5rem;
    margin-left: -1px;
    border-radius: 1px;
    background: linear-gradient(to top, rgba(239, 68, 68, 0.5), rgba(239, 68, 68, 0));
  }
}
// Arrived. The window and the contact light up together, from the same flag.
.hs-sal-circle--open .hs-sal-blip {
  box-shadow: 0 0 14px rgba(248, 113, 113, 0.95), 0 0 0 5px rgba(239, 68, 68, 0.18);
}

// One straight pass: rim → crosshair → out the far side. Zero is crossed at
// RING_MS because the speed is constant, and the wake keeps pointing back the
// way it came all the way through.
@keyframes hs-sal-blip-pass {
  from {
    transform: rotate(var(--hs-sal-blip-a)) translateY(calc(-1 * var(--hs-sal-blip-r))) scale(0.65);
    opacity: 0;
  }
  10% { opacity: 1; }
  to {
    transform: rotate(var(--hs-sal-blip-a)) translateY(var(--hs-sal-blip-past)) scale(1);
    opacity: 1;
  }
}
// The exit, on its own property so it can start exactly when the window shuts.
@keyframes hs-sal-blip-gone {
  from { opacity: 1; }
  to   { opacity: 0; }
}

.hs-sal-ripple {
  position: absolute;
  inset: 2.4rem;
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

// The sweep behind them: a beam turning in the debris field. Conic, so the
// bright edge leads and the tail fades — a plain rotating bar looks mechanical.
.hs-sal-sweep {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(56, 189, 248, 0.28),
    rgba(56, 189, 248, 0.05) 40%,
    rgba(56, 189, 248, 0) 62%
  );
  animation: hs-sal-sweep 2.8s linear infinite;
  pointer-events: none;
}
@keyframes hs-sal-sweep { to { transform: rotate(360deg); } }

// ── Cast, catch, miss ────────────────────────────────────────────────────────
// One pulse element, two jobs. The cast throws a ring outward — that is the
// player's click leaving the dial. The catch flares inward-lit and gold, which
// is the same event the sparks answer.
.hs-sal-wave {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  z-index: 3;

  &--cast {
    border: 2px solid rgba(125, 211, 252, 0.85);
    animation: hs-sal-cast 700ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  }
  &--catch {
    border: 3px solid rgba(253, 224, 71, 0.9);
    box-shadow: 0 0 18px rgba(250, 204, 21, 0.35);
    animation: hs-sal-catch 620ms ease-out forwards;
  }
}
@keyframes hs-sal-cast {
  from { transform: scale(0.55); opacity: 0; }
  20%  { opacity: 1; }
  to   { transform: scale(1.35); opacity: 0; }
}
@keyframes hs-sal-catch {
  from { transform: scale(1);    opacity: 0.95; }
  to   { transform: scale(1.28); opacity: 0; }
}

// The button's own jolt. Landed pops, dead centre pops harder and glows, a miss
// shrugs it off — three different answers to the same click, which is what makes
// the click feel judged rather than merely recorded.
.hs-sal-dial--good .hs-sal-circle    { animation: hs-sal-pop 420ms ease-out; }
.hs-sal-dial--perfect .hs-sal-circle { animation: hs-sal-pop-hard 520ms ease-out; }
.hs-sal-dial--miss .hs-sal-circle    { animation: hs-sal-shrug 400ms ease-out; }

@keyframes hs-sal-pop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.05); }
  100% { transform: scale(1); }
}
@keyframes hs-sal-pop-hard {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.5); }
  30%  { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(250, 204, 21, 0.22); }
  100% { transform: scale(1);    box-shadow: 0 0 0 16px rgba(250, 204, 21, 0); }
}
@keyframes hs-sal-shrug {
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-5px) rotate(-1deg); }
  50%      { transform: translateX(5px)  rotate(1deg); }
  80%      { transform: translateX(-2px); }
}

// Scrap leaving the dial. Angle, distance, spin and a little stagger are rolled
// per particle, because eight identical arcs read as a machine, not a haul.
.hs-sal-spark {
  position: absolute;
  left: 50%;
  top: 50%;
  font-size: 0.8rem;
  line-height: 1;
  pointer-events: none;
  opacity: 0;
  z-index: 4;
  animation: hs-sal-spark 750ms ease-out forwards;
}
@keyframes hs-sal-spark {
  from { transform: translate(-50%, -50%) scale(0.4) rotate(0deg); opacity: 0; }
  18%  { opacity: 1; }
  to   {
    transform:
      translate(calc(-50% + var(--hs-sal-dx)), calc(-50% + var(--hs-sal-dy)))
      scale(1) rotate(var(--hs-sal-rot));
    opacity: 0;
  }
}

// The number, rising off the dial. The result line beside it is the record; this
// is the moment, and it is the only place the gain is ever animated.
.hs-sal-floater {
  position: absolute;
  left: 50%;
  top: 26%;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--hs-ok-muted);
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.65);
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
  animation: hs-sal-float 1100ms ease-out forwards;
}
@keyframes hs-sal-float {
  from { transform: translate(-50%, 0.7rem); opacity: 0; }
  22%  { opacity: 1; }
  to   { transform: translate(-50%, -2.4rem); opacity: 0; }
}

// The right-hand column: what the toy is, how much room is left, what the last
// cast produced, and the artefact card on the rare cast that turns one up. It
// takes whatever the dial leaves and wraps under it once that is narrower than
// a line of text. Left-aligned throughout — four centred blocks of different
// widths have no edge for the eye to run down.
.hs-sal-outcome {
  flex: 1 1 11rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.35rem;
  text-align: left;
}

// Always on. The reserved min-height is what stops the column jumping before the
// first catch, so nothing here needs to fade.
.hs-sal-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem 0.35rem;
  min-height: 1.2rem;
  padding-top: 0.15rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.5);
}
.hs-sal-catch-icon { font-size: 0.85rem; }
.hs-sal-catch-name { color: rgba(255, 255, 255, 0.8); font-weight: 600; }
.hs-sal-gain   { color: var(--hs-ok-muted); font-weight: 700; font-variant-numeric: tabular-nums; }
.hs-sal-thrown { color: var(--hs-warn-text); }

// The one thing in the panel that is allowed to announce itself: it appears on
// about one cast in seventy, so it fades in rather than blinking into place.
.hs-sal-find {
  padding: 0.35rem 0.5rem;
  border-radius: var(--hs-r-md);
  border: 1px solid rgba(196, 181, 253, 0.35);
  background: rgba(139, 92, 246, 0.12);
  font-size: 0.65rem;
  line-height: 1.35;
  color: #ddd6fe;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  animation: hs-sal-find-in 500ms ease-out;
}
@keyframes hs-sal-find-in {
  from { opacity: 0; transform: translateY(-0.3rem); box-shadow: 0 0 0 0 rgba(196, 181, 253, 0.5); }
  40%  { opacity: 1; box-shadow: 0 0 0 5px rgba(196, 181, 253, 0.16); }
  to   { opacity: 1; transform: translateY(0); box-shadow: 0 0 0 0 rgba(196, 181, 253, 0); }
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
	grid-template-columns: repeat(8, minmax(0, 1fr));
  max-width: 24rem;
  gap: 0.3rem;

	@media (min-width: 640px) {
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

// The celebration is optional, the game is not. Everything decorative stops; the
// contact keeps flying, because without it there is nothing to aim at — it is
// the rule made visible, not an effect.
@media (prefers-reduced-motion: reduce) {
  .hs-sal-sweep,
  .hs-sal-ripple,
  .hs-sal-wave,
  .hs-sal-spark,
  .hs-sal-floater,
  .hs-sal-find,
  .hs-sal-dial--idle::after,
  .hs-sal-scrap--pop,
  .hs-sal-dial--good .hs-sal-circle,
  .hs-sal-dial--perfect .hs-sal-circle,
  .hs-sal-dial--miss .hs-sal-circle {
    animation: none;
  }
  .hs-sal-spark,
  .hs-sal-wave { display: none; }
  .hs-sal-floater { opacity: 1; }
}
</style>
