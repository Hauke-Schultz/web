<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { t } = useI18n()
const {
  recruitPool,
  recruitPoolMax,
  recruitGrowthPerDay,
  recruitGrowthPerHour,
  canRecruit,
  recruit,
  playerResources,
  formatTime,
} = useHawkStar()

// ── The pool, as people ───────────────────────────────────────────────────────
// The panel used to be one slim button with a number on it. The number was
// honest and told you nothing: a pool that fills at twelve a day and caps at
// eighteen is a *queue of people waiting to be taken on*, and that is a picture,
// not a figure. Everything below is that picture — the arithmetic is unchanged
// and still the server's.
const pool      = computed(() => recruitPool.value ?? 0)
const poolWhole = computed(() => Math.floor(pool.value))
const poolFrac  = computed(() => pool.value - poolWhole.value)
const poolFull  = computed(() => recruitPoolMax.value > 0 && pool.value >= recruitPoolMax.value)
const population = computed(() => Math.floor(playerResources.value?.population ?? 0))

// ── The candidate ─────────────────────────────────────────────────────────────
// Rolled in the browser and lost on reload, exactly like a salvage cast: the
// server deals in a pool of anonymous heads, and inventing somebody to put a
// name on the click costs nothing and is never asked about afterwards. Nobody is
// mechanically different from anybody else — a recruit is a recruit — so this is
// pure colour and cannot touch a number.
//
// A registry designation rather than a name and a trade. A trade was a promise
// the game does not keep (a medic works the mine like everybody else), and it
// took a translated word to say so; a designation says only "this is a specific
// person" and is the same string in every language.
const SIGILS = ['K', 'T', 'V', 'N', 'R', 'X', 'Z', 'J', 'S', 'L', 'D', 'Y']
const STEMS  = [
  'Orin', 'Vahl', 'Nyx', 'Kade', 'Sarn', 'Thal', 'Vex', 'Quill',
  'Ysar', 'Mire', 'Corr', 'Sable', 'Wren', 'Ferrix', 'Halden', 'Ismar',
  'Tovek', 'Lune', 'Draeg', 'Solen', 'Kesh', 'Varn', 'Ostra', 'Rhen',
]
// Person glyphs, and nothing more: the figure varies so a new candidate looks
// like a new person, but it no longer claims to be a profession.
const FACES = ['🧑‍🚀', '👩‍🚀', '👨‍🚀', '🧑', '👩', '👨', '🧑‍🦱', '🧑‍🦰']

// What they call across the deck. It is the only thing that says *click this
// one* without a label pointing at it — a person walking past is scenery until
// they ask you for something. Rolled with the candidate, and deliberately silly:
// nothing else in the panel gets to be.
//
// One number, because the lines themselves live in `hawkStar.recruit.bubbles.*`
// and this side only needs to know how many there are — bump it when the i18n
// block grows, and nothing else here changes.
const LINE_COUNT = 14
const LINES = Array.from({ length: LINE_COUNT }, (_, i) => `b${i + 1}`)

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rollName = () =>
  `${pick(SIGILS)}. ${pick(STEMS)}-${10 + Math.floor(Math.random() * 890)}`
const rollOne = () => ({ name: rollName(), face: pick(FACES), line: pick(LINES) })

const candidate = ref(rollOne())
const rollCandidate = () => { candidate.value = rollOne() }

// The bob and the halo run on child elements, and animation events bubble — so
// without this guard a candidate would be re-rolled twice a second by the bob
// rather than once per lap by the walk. Keyframe *names* are no help: scoped
// styles rewrite them.
const onLap = (e) => { if (e.target === e.currentTarget) rollCandidate() }

// ── Signing one on ────────────────────────────────────────────────────────────
const boarding = ref(false)   // the beat between the click and the next candidate
const flash    = ref(false)   // the airlock, told that someone just went through
const floater  = ref(false)   // the +1 that rises off the gate
const walkerKey = ref(0)      // re-keys the walker so its walk restarts

// Somebody is only on the deck if there is somebody in the pool to send out. The
// walker IS the front of the queue, not an extra — queue plus walker always adds
// up to the whole recruits the server says are waiting.
const hasCandidate = computed(() => poolWhole.value >= 1 && !boarding.value)
const queueCount   = computed(() => Math.max(0, poolWhole.value - (hasCandidate.value ? 1 : 0)))

const timers = new Set()
const later = (ms, fn) => {
  const id = setTimeout(() => { timers.delete(id); fn() }, ms)
  timers.add(id)
}
onUnmounted(() => { timers.forEach(clearTimeout); timers.clear() })

const TAKE_MS = 420

// The whole game: click the person, not a button. Missing costs nothing — they
// pace the deck until they are taken, and a candidate who reaches the far end
// simply turns round. There is no wrong click here, and there must not be: the
// pool is the ceiling, so hurrying can only ever save time, never earn more.
const hire = () => {
  if (!canRecruit.value || boarding.value) return
  boarding.value = true
  flash.value    = true
  floater.value  = true

  recruit()

  later(TAKE_MS,      () => { boarding.value = false; rollCandidate(); walkerKey.value += 1 })
  later(TAKE_MS + 80, () => { flash.value = false })
  later(1100,         () => { floater.value = false })
}

// ── The next one ──────────────────────────────────────────────────────────────
// What the fraction of a recruit is worth in minutes. It is the one number the
// old panel could not show at all, and the reason the queue is worth looking at
// when it is empty.
const nextInSec = computed(() => {
  if (poolFull.value || recruitGrowthPerHour.value <= 0) return null
  return Math.ceil((1 - poolFrac.value) / recruitGrowthPerHour.value * 3600)
})

const hint = computed(() => t('hawkStar.recruit.hint', {
  rate: recruitGrowthPerDay.value,
  max: Math.floor(recruitPoolMax.value),
}))
</script>

<template>
  <div class="hs-recruit">
    <div class="hs-rec-head">
      <span class="hs-rec-icon">👥</span>
      <h3 class="hs-rec-title">{{ t('hawkStar.recruit.title') }}</h3>
      <span class="hs-rec-pop">🏠 {{ population }}</span>
    </div>

    <!-- Deck on the left, queue on the right. They are the same fact twice —
         who is on offer and how many are behind them — so they belong on one
         line, and the queue no longer needs a heading to say which is which. -->
    <div class="hs-rec-stage">
      <!-- The deck: they walk it, you take them off it. -->
      <div class="hs-rec-deck" :class="{ 'hs-rec-deck--empty': !hasCandidate }">
        <span class="hs-rec-floor" />

        <button
          v-if="hasCandidate"
          :key="walkerKey"
          class="hs-rec-walker"
          :title="t('hawkStar.recruit.hireHint', { name: candidate.name })"
          @click="hire"
          @animationiteration="onLap"
        >
          <!-- Outside the mirrored wrapper, or the shout would come out
               backwards on the way home. -->
          <span class="hs-rec-walker-ring" />
          <!-- Facing and bobbing are two animations on two elements: they both
               drive `transform`, and one element can only run the last one. -->
          <span class="hs-rec-face">
            <span class="hs-rec-body">{{ candidate.face }}</span>
          </span>
        </button>

        <!-- What they are shouting. A sibling of the walker rather than a child,
             so its width can be a share of the deck instead of a share of the
             3 rem figure — a bubble wide enough to hold a line in one line has
             to know how much room the deck has. It travels on its own copy of
             the walk (same 16 s, same keys, restarted together), which is also
             what lets it slide clear of the deck's edges at the turns while the
             tail counter-slides to stay over whoever is talking.
             Clicking the words is clicking the person: same handler. -->
        <span
          v-if="hasCandidate"
          :key="walkerKey"
          class="hs-rec-bubble"
          @click="hire"
        >
          <span :key="candidate.name" class="hs-rec-bubble-text">
            {{ t('hawkStar.recruit.bubbles.' + candidate.line) }}
          </span>
        </span>

        <!-- The airlock is where they go, not a second way to take them: it is
             deliberately not clickable, because the person is the target and two
             ways to do the same thing would make the game a button again. -->
        <span class="hs-rec-gate" :class="{ 'hs-rec-gate--flash': flash }">
          <span class="hs-rec-gate-slit" />
        </span>

        <span v-if="floater" class="hs-rec-floater">+1 👥</span>
      </div>

      <!-- The magazine. Every slot the pool can hold is drawn from the start, so
           the cap is something you can see rather than something the hint has to
           say — same reason the salvage cabinet draws its locked slots. Small
           and quiet: the deck is where the game is, this is only the supply. -->
      <div class="hs-rec-queue" :title="t('hawkStar.recruit.queue')">
        <div class="hs-rec-queue-grid">
          <span
            v-for="i in Math.floor(recruitPoolMax)"
            :key="i"
            class="hs-rec-slot"
            :class="{ 'hs-rec-slot--filled': i <= queueCount }"
          >
            <!-- The one at the head of the empty stretch is the next person,
                 drawn as far as they have grown. A recruit arriving as a number
                 that ticks over hides the only thing actually happening here. -->
            <template v-if="i === queueCount + 1 && !poolFull">
              <span class="hs-rec-grow-ghost">👤</span>
              <span
                class="hs-rec-grow"
                :style="{ clipPath: `inset(${(1 - poolFrac) * 100}% 0 0 0)` }"
              >👤</span>
            </template>
            <template v-else-if="i <= queueCount">👤</template>
          </span>
        </div>

        <span class="hs-rec-queue-count" :class="{ 'hs-rec-queue-count--full': poolFull }">
          {{ poolWhole }} / {{ Math.floor(recruitPoolMax) }}
        </span>
      </div>
    </div>

    <div class="hs-rec-caption">
      <span v-if="hasCandidate" class="hs-rec-name">{{ candidate.name }}</span>
      <span v-else class="hs-rec-none">{{ t('hawkStar.recruit.nobody') }}</span>

      <span v-if="poolFull" class="hs-rec-next hs-rec-next--full">{{ t('hawkStar.recruit.full') }}</span>
      <span v-else-if="nextInSec !== null" class="hs-rec-next">
        {{ t('hawkStar.recruit.nextIn', { time: formatTime(nextInSec) }) }}
      </span>
    </div>

    <p class="hs-rec-hint">{{ hint }}</p>
  </div>
</template>

<style lang="scss" scoped>
// A block inside the base tile's building panel, not a panel of its own — same
// arrangement as the salvage game on its tile, so the build rows still follow
// underneath.
.hs-recruit {
  min-width: 0;
  background: rgba(167, 139, 250, 0.08);
  border: 1px solid rgba(167, 139, 250, 0.22);
  border-radius: var(--hs-r-md);
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-rec-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.hs-rec-icon  { font-size: 1rem; line-height: 1; }
.hs-rec-title { margin: 0; font-size: 0.8rem; font-weight: 700; color: #fff; }
// Where the people end up. The panel is about this number going up, so it is the
// one thing in the header worth printing.
.hs-rec-pop {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 700;
  color: #ddd6fe;
  font-variant-numeric: tabular-nums;
}

// ── Stage: deck left, queue right ────────────────────────────────────────────
// The deck takes what is left, the queue is a fixed block — six columns is the
// whole cap in three rows, which comes out at almost exactly the deck's height.
// Below 9 rem of deck the two stack instead, because a walkway you cannot walk
// is worse than a tall panel.
.hs-rec-stage {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0.4rem 0.5rem;
}

// ── The queue ────────────────────────────────────────────────────────────────
.hs-rec-queue {
  flex: none;
  align-self: center;   // the deck is the taller of the two now
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 0.2rem;
  padding: 0.25rem 0.3rem;
  border-radius: var(--hs-r-sm);
  background: rgba(0, 0, 0, 0.16);
}
.hs-rec-queue-grid {
  display: grid;
  grid-template-columns: repeat(6, 0.8rem);
  gap: 0.05rem;
}
.hs-rec-queue-count {
  font-size: 0.58rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;

  &--full { color: var(--hs-warn-text); }
}

.hs-rec-slot {
  position: relative;
  width: 0.8rem;
  height: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.66rem;
  line-height: 1;
  // An empty slot is a place, not a person: enough of a mark to be counted, not
  // enough to be mistaken for somebody standing there.
  color: rgba(255, 255, 255, 0.85);

  // The floor mark under each place. At this size it is what actually makes the
  // empty slots countable — the glyph is too small to be missed for anything.
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 0.28rem;
    height: 2px;
    margin-left: -0.14rem;
    border-radius: 1px;
    background: rgba(255, 255, 255, 0.1);
  }
  &--filled::before { background: rgba(196, 181, 253, 0.5); }
}
// The one being made. Grey underneath, lilac on top, and the top is clipped to
// however much of a recruit has actually grown.
.hs-rec-grow-ghost,
.hs-rec-grow {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hs-rec-grow-ghost { color: rgba(255, 255, 255, 0.12); }
.hs-rec-grow {
  color: #c4b5fd;
  transition: clip-path 0.6s linear;
  filter: drop-shadow(0 0 4px rgba(196, 181, 253, 0.55));
}

// ── The deck ─────────────────────────────────────────────────────────────────
.hs-rec-deck {
  position: relative;
  flex: 1 1 9rem;
  min-width: 0;
  // Room for the figure plus the bubble over their head. Not a fixed height: if
  // the queue block beside it is taller the deck stretches to match, so the two
  // read as one object rather than as a panel with something parked next to it.
  min-height: 5rem;
  border-radius: var(--hs-r-sm);
  background:
    linear-gradient(to bottom, rgba(0, 0, 0, 0.18), rgba(167, 139, 250, 0.06)),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 1.6rem);
  overflow: hidden;
  transition: opacity 0.3s;

  &--empty { opacity: 0.5; }
}
.hs-rec-floor {
  position: absolute;
  left: 0.3rem;
  right: 0.3rem;
  bottom: 0.55rem;
  height: 1px;
  background: linear-gradient(to right, rgba(196, 181, 253, 0), rgba(196, 181, 253, 0.35), rgba(196, 181, 253, 0.15));
}

// The target. A generous tap area around a small figure: the game is worth
// nothing if it cannot be played with a thumb, and the pool is the ceiling
// anyway — making it hard to hit would take time away and give nothing back.
.hs-rec-walker {
  position: absolute;
  bottom: 0.2rem;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: hs-rec-walk 16s linear infinite;
  z-index: 2;
}
// Which way they are looking. Same 16 s clock as the walk and started by the
// same insertion, so the turn and the flip cannot drift apart.
.hs-rec-face {
  display: flex;
  animation: hs-rec-face 16s linear infinite;
}
.hs-rec-body {
  font-size: 1.4rem;
  line-height: 1;
  animation: hs-rec-bob 0.5s ease-in-out infinite;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45));
}

// ── The shout ────────────────────────────────────────────────────────────────
// The panel can say "click the person" in the hint, and nobody reads hints. A
// figure asking to be taken on says the same thing in the one place you are
// already looking, and it is the only silly thing in the whole game.
//
// The width is the whole reason it is a sibling of the walker and not a child:
// as a child, a percentage would be a share of the 3 rem figure. Here it is a
// share of the deck, capped at 12.8 rem — wide enough that every line fits on
// one line, narrow enough to leave the walkway visible on a wide tile.
//
// It rides its own copy of the walk. Both animations are 16 s linear, share the
// keyframe percentages and are (re-)created together, so they cannot drift — see
// the keyframes below for how a box far wider than the figure stays inside the
// deck at both turns while the tail stays on the speaker's head.
.hs-rec-bubble {
  position: absolute;
  bottom: 3.05rem;              // just above the 3 rem walker at bottom: 0.2rem
  width: min(12.8rem, calc(100% - 0.4rem));
  padding: 0.18rem 0.4rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(221, 214, 254, 0.45);
  background: rgba(46, 30, 84, 0.95);
  color: #ede9fe;
  font-size: 0.63rem;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  z-index: 3;
  animation: hs-rec-bubble-move 16s linear infinite;

  // The tail, pointing straight down at whoever is talking — and sliding along
  // the bubble's underside by the same amount the box was pushed off centre.
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    margin-left: -0.2rem;
    border: 0.2rem solid transparent;
    border-top-color: rgba(221, 214, 254, 0.45);
    animation: hs-rec-tail-move 16s linear infinite;
  }
}
// Only the text pops, not the box: the box is carrying the travel animation and
// one element can run only the last `transform` it is given.
.hs-rec-bubble-text {
  display: block;
  animation: hs-rec-say 380ms ease-out;
}
@keyframes hs-rec-say {
  from { opacity: 0; transform: translateY(0.2rem); }
  to   { opacity: 1; transform: translateY(0); }
}

// Not "centre it, then clamp": a clamp needs a correction that depends on how
// wide the bubble ended up, and it is only ever right at one width. Instead the
// box is *pinned* at the turns — left edge 0.2 rem in at the near one, right
// edge 0.2 rem in at the far one — and everything in between is the browser
// interpolating between those two states.
//
// That is exact rather than approximate, and the reason is that every part of
// this moves linearly on the same 16 s clock with the same keys: the walker's
// travel, the box, and the tail's offset inside the box. Halfway through, the
// interpolation puts the tail at `50% + 0.2rem` of the box and the walker at
// `50% + 0.2rem` of the deck — the same point, at any deck width and any bubble
// width. The tail's two ends are just the walker's centre measured from
// whichever edge is pinned: 3.9 − 0.2 near, 3.5 − 0.2 far.
@keyframes hs-rec-bubble-move {
  0%,  8%   { left: 0.2rem;              transform: translateX(0); }
  46%, 58%  { left: calc(100% - 0.2rem); transform: translateX(-100%); }
  96%, 100% { left: 0.2rem;              transform: translateX(0); }
}
@keyframes hs-rec-tail-move {
  0%,  8%   { left: 3.7rem; }
  46%, 58%  { left: calc(100% - 3.3rem); }
  96%, 100% { left: 3.7rem; }
}
// The halo says "this one is clickable" without a word, and it is the only
// pulsing thing on the deck.
.hs-rec-walker-ring {
  position: absolute;
  inset: 0.15rem;
  border-radius: 50%;
  border: 1px solid rgba(196, 181, 253, 0.4);
  background: radial-gradient(circle, rgba(167, 139, 250, 0.22), rgba(167, 139, 250, 0) 70%);
  animation: hs-rec-halo 1.9s ease-in-out infinite;
}
.hs-rec-walker:hover .hs-rec-walker-ring {
  border-color: rgba(221, 214, 254, 0.9);
  background: radial-gradient(circle, rgba(167, 139, 250, 0.38), rgba(167, 139, 250, 0) 72%);
}
// There and back, at a walk. The far end is measured from the right so the
// candidate always stops short of the airlock whatever width the tile gives the
// deck — 5rem is the gate plus its margin plus the walker's own box.
//
// Pace matters more than it looks: the first build crossed in three seconds and
// was genuinely hard to hit, which turns a pastime into a test of aim. Sixteen
// seconds a lap is about a step a second across a tile, and each end holds for
// nearly a second and a half — a standing target twice a lap, for anyone who
// would rather wait than chase. There is nothing to win by being quick here, so
// there must be nothing to lose by being slow.
// The near end stops 2.4 rem in rather than at the edge — it gives the figure
// somewhere to have come from, and the bubble's clamp constants are measured
// from it. The far end is set by the airlock.
@keyframes hs-rec-walk {
  0%   { left: 2.4rem; }
  8%   { left: 2.4rem; }
  46%  { left: calc(100% - 5rem); }
  50%  { left: calc(100% - 5rem); }
  58%  { left: calc(100% - 5rem); }
  96%  { left: 2.4rem; }
  100% { left: 2.4rem; }
}
// The flip happens at the far turn and is undone at the near one — the walker
// itself no longer carries a transform, so the bubble above it stays the right
// way round.
@keyframes hs-rec-face {
  0%,  49.9%  { transform: scaleX(1); }
  50%, 99.9%  { transform: scaleX(-1); }
  100%        { transform: scaleX(1); }
}
@keyframes hs-rec-bob {
  0%, 100% { transform: translateY(0)      rotate(-2deg); }
  50%      { transform: translateY(-0.1rem) rotate(2deg); }
}
@keyframes hs-rec-halo {
  0%, 100% { opacity: 0.45; transform: scale(0.92); }
  50%      { opacity: 1;    transform: scale(1.06); }
}

// The airlock. Not a control — the destination.
.hs-rec-gate {
  position: absolute;
  right: 0.3rem;
  bottom: 0.35rem;
  width: 1.5rem;
  height: 2.5rem;
  border-radius: 0.5rem 0.5rem 0.15rem 0.15rem;
  border: 1px solid rgba(196, 181, 253, 0.4);
  background: linear-gradient(to bottom, rgba(139, 92, 246, 0.28), rgba(139, 92, 246, 0.08));
  overflow: hidden;
  transition: box-shadow 0.15s, border-color 0.15s;

  &--flash {
    border-color: #ede9fe;
    box-shadow: 0 0 14px rgba(196, 181, 253, 0.8), inset 0 0 12px rgba(237, 233, 254, 0.55);
  }
}
.hs-rec-gate-slit {
  position: absolute;
  left: 50%;
  top: 0.35rem;
  bottom: 0.35rem;
  width: 3px;
  margin-left: -1.5px;
  border-radius: 2px;
  background: linear-gradient(to bottom, rgba(237, 233, 254, 0.15), rgba(237, 233, 254, 0.6), rgba(237, 233, 254, 0.15));
}
.hs-rec-gate--flash .hs-rec-gate-slit { background: #fff; }

.hs-rec-floater {
  position: absolute;
  right: 0.2rem;
  bottom: 2.6rem;
  font-size: 0.7rem;
  font-weight: 800;
  color: #ddd6fe;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
  white-space: nowrap;
  pointer-events: none;
  z-index: 3;
  animation: hs-rec-float 1100ms ease-out forwards;
}
@keyframes hs-rec-float {
  from { transform: translateY(0.5rem); opacity: 0; }
  20%  { opacity: 1; }
  to   { transform: translateY(-1.4rem); opacity: 0; }
}

.hs-rec-caption {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.15rem 0.5rem;
  min-height: 0.9rem;
  font-size: 0.63rem;
}
// A registry designation, so it reads as one: tabular figures and a touch of
// letter-spacing keep "V. Ferrix-408" from looking like a surname.
.hs-rec-name {
  color: rgba(221, 214, 254, 0.9);
  font-weight: 600;
  letter-spacing: 0.03em;
  font-variant-numeric: tabular-nums;
}
.hs-rec-none { color: rgba(255, 255, 255, 0.35); font-style: italic; }
.hs-rec-next {
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;

  &--full { color: var(--hs-warn-text); }
}

.hs-rec-hint {
  margin: 0;
  font-size: 0.58rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.35);
}

// The walk and the halo are the invitation, not the game — under reduced motion
// the candidate simply stands on the deck and is clicked where they stand.
@media (prefers-reduced-motion: reduce) {
  .hs-rec-walker { animation: none; left: 30%; }
  .hs-rec-face,
  .hs-rec-body,
  .hs-rec-walker-ring,
  .hs-rec-bubble-text,
  .hs-rec-floater { animation: none; }
  .hs-rec-floater { opacity: 1; }
  // The bubble has to be told where to stand once its travel is switched off:
  // over the figure, which is parked at 30 % of the deck.
  .hs-rec-bubble {
    animation: none;
    left: calc(30% + 1.5rem);
    transform: translateX(-50%);
  }
  .hs-rec-bubble::after { animation: none; left: 50%; }
}
</style>
