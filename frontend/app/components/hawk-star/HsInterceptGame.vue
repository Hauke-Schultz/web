<script setup>
// ── Fire control ──────────────────────────────────────────────────────────────
// The overlay behind 🎯 Abschießen. One satellite crossing the sky, one laser
// battery fixed at the bottom centre, and one rule: THE BOLT TAKES TIME TO GET
// THERE. You do not shoot at the satellite, you shoot at where it is going to
// be. That single fact is the whole game — it explains itself the first time a
// bolt arrives behind the target, and it gets harder without any new rule being
// introduced, because the target's speed is what the lead is measured against.
//
// ONE TAP IS THE WHOLE INPUT: you tap the spot on the sky you want to hit, and
// the battery swings to that angle and fires at it. Aiming and firing are not
// two steps. The first version had the launcher track the pointer and fire on
// click, which is fine with a mouse and unusable with a thumb — on a touch
// screen there is no hover, so there was no way to aim before committing.
//
// Only the tap's HORIZONTAL position is read. The bolt always terminates on the
// satellite's lane, so tapping high or low on the same column aims at the same
// place — which is exactly the forgiveness a thumb needs, and it makes "tap
// where you want to hit" literally true rather than approximately true. The
// angle is then a consequence, drawn because it looks like a gun battery
// tracking a target, not because it is another thing to get right.
//
// Difficulty is not a knob, it is the target's behaviour, and it escalates on
// the damage the player has already done:
//
//   after hit 1  the satellite speeds up   → the lead you just learned is short
//   after hit 2  it goes to full drive     → and short again
//
// IT ALWAYS RUNS WALL TO WALL. It leaves one edge, crosses, turns at the other,
// and comes back — nothing else, at any stage. There was a third stage that
// reversed at random, and it went because a reversal falling inside the shell's
// 700 ms flight cannot be predicted by anyone, however good: the last hit was a
// coin toss with a price on it rather than something to be good at.
//
// Be aware of what that costs, because it is the honest reading of the table
// below: SPEED ALONE IS A WEAK DIFFICULTY LEVER. A gunner only pays for it
// through their misjudgement of the speed, so doubling it moves an average
// gunner's last-stage hit rate by a few points, not by tens. The escalation is
// now mostly something you SEE rather than something that beats you — which is
// the right trade for a target that behaves predictably, but it does mean the
// speed multipliers are not where to reach if this ever needs to be harder.
// The honest levers without randomness are the kill box (HIT_HALF) and the
// flight time (SHELL_MS, which lengthens the lead and so amplifies any error
// in reading the speed).
//
// Three hits kill it (SPY.satelliteArmor, the server's number mirrored). That is
// the smallest count that lets both stages actually show up.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { SPY, RESOURCES } from '~/utils/hawkStarConfig.js'

const props = defineProps({
  // The bogey being shot at: { playerId, username, portrait, hits, armor }
  target: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const { t } = useI18n()
const { fireIntercept, playerResources, interceptError } = useHawkStar()

// ── The field ─────────────────────────────────────────────────────────────────
// Everything is in percent of the field box, so the game scales from a phone to
// a desktop without a single measurement. The one exception is the pointer,
// which arrives in pixels and is converted on the way in.
const SAT_Y      = 16   // % from the top — the orbit lane
const GUN_Y      = 88   // % — the muzzle
const GUN_X      = 50   // % — bolted to the middle, and it stays there
// Flight time, muzzle to the lane. THE rule. Constant rather than scaled by the
// bolt's length: the longest shot across this field is only about 18 % further
// than the shortest, and a lead that changed with how far out you aimed would be
// a second rule to learn for a difference nobody can see.
const SHELL_MS   = 700
const HIT_HALF   = 5.0  // % — half the width of the kill box around the satellite
const SAT_HALF   = 4.4  // % — half the body's clearance at the walls

// Speed in % of field width per second. The escalation is a multiplier on the
// base, indexed by hits already taken — so a satellite you softened last night
// is still fast when you come back, which is the point of persisting damage.
const BASE_SPEED = 28
// Chosen to be SEEN. Since the statistical bite of speed is small (see above),
// these are set where the step is obvious to the eye — a satellite that visibly
// picks up after each hit tells the player their round landed, which is the job
// this escalation actually does well.
const SPEED_BY_HITS = [1, 1.3, 1.65]

// There is no cap on a sortie. You fire until the satellite comes apart or the
// magazine is empty, and the magazine is the planet's power cells — one limit,
// visible as a number, and it is the same number the rest of the game already
// spends. A separate per-sortie cap was a second budget layered on top of it,
// and the readout then had to show the smaller of the two, which is exactly the
// kind of quantity nobody can plan against.

// How long the impact is left alone on screen before anything covers it. Long
// enough to read the mark, and to watch the last one blow the dish up.
const VERDICT_MS = 900

// How long an impact mark stays. Both kinds get the same three seconds, so the
// last few rounds are readable together: where the ☁️ and 💥 sit relative to the
// satellite is the picture of how far off the lead is, and a hit that vanished
// in half a second took its half of that picture with it.
const MARK_FADE_MS = 3000

// ── Why these numbers ─────────────────────────────────────────────────────────
// They were measured, not guessed. `scratchpad/intercept-difficulty.mjs` runs this
// exact geometry against simulated gunners — each predicts the impact point and
// misses it by a normally-distributed error in % of field width — and reports the
// cost of a kill AND the hit rate at each of the three stages:
//
//   gunner            salvos  cells  1-salvo   0→1    1→2    2→3
//   careless  ±14 %     2.5    12.2    16 %    26 %   25 %   23 %
//   average   ±8 %      1.6     7.1    51 %    44 %   42 %   41 %
//   good      ±4.5 %    1.1     4.4    92 %    70 %   70 %   65 %
//   excellent ±2 %      1.0     3.1   100 %    98 %   98 %   97 %
//
// THE PER-STAGE COLUMNS ARE THE ONES THAT MATTER, and averaging them away is how
// this got shipped wrong once already: an earlier cut read a respectable 2.8
// salvos for an average gunner while its three stages were 40 % / 40 % / 11 %,
// and even an EXCELLENT gunner converted 21 % of rounds at the last one. The
// average had hidden a coin toss completely.
//
// The columns are nearly flat now, and that is the deliberate consequence of a
// target that only runs wall to wall: with nothing random left, the stages differ
// by speed alone and speed is a weak lever. The game is correspondingly easier
// than the cut before it — an average gunner kills in 1.6 salvos for about 7
// cells, and one salvo in two ends it outright.
//
// The model has TWO error terms and needs both — aim wobble, and a proportional
// misjudgement of the SPEED, which is the only channel through which a faster
// target costs anything. With aim error alone the simulated gunner predicts the
// impact point perfectly however fast the satellite moves, and the script
// reported ×1.0 and ×1.8 as equally hard: worthless for exactly the question it
// was being asked. Even so it stays OPTIMISTIC, because it also predicts a wall
// bounce mid-flight perfectly and a person does not. Read the table as a floor
// on the difficulty, never a ceiling, and re-run the script rather than
// eyeballing it if any of these change.

// ── Where the satellite is, as a function of time ─────────────────────────────
// Not integrated per frame. The path is a list of LEGS — each one a straight run
// with a start time, a start position and a velocity — and `satXAt(t)` evaluates
// the current leg exactly. Two things fall out of that and both matter:
//
//   a dropped frame cannot cost a hit, because the hit test does not consult the
//   animation at all: it asks where the satellite WILL BE at firedAt + SHELL_MS
//   and answers the moment the round is fired;
//
//   and the picture cannot drift from the rule, because the picture is the same
//   function, sampled at `now` instead of at impact.
//
// This is the same principle the salvage dial is built on: the contact is CSS,
// the judgement is arithmetic on timestamps.
const leg = ref({ at: 0, x: 50, vx: BASE_SPEED })

const speedNow = (hits) => BASE_SPEED * (SPEED_BY_HITS[Math.min(hits, SPEED_BY_HITS.length - 1)])

// Walk the leg forward, bouncing off the walls as many times as the elapsed
// time requires. A long tab-switch must not teleport the satellite out of the
// field, and a fold-back is cheaper to write than a modulo over a zig-zag.
const satXAt = (t) => {
  const l = leg.value
  let x = l.x + l.vx * ((t - l.at) / 1000)
  const lo = SAT_HALF, hi = 100 - SAT_HALF
  const span = hi - lo
  if (span <= 0) return lo
  // Reflect into [lo, hi] — the triangle wave, without a loop over the bounces.
  const folded = Math.abs(((x - lo) % (2 * span) + 2 * span) % (2 * span) - span)
  x = hi - folded
  return x
}

// Which way it is travelling right now — only used to draw the body facing the
// right way, never for the hit test.
const satDirAt = (t) => {
  const a = satXAt(t)
  const b = satXAt(t + 60)
  return b >= a ? 1 : -1
}

// Start a new leg from wherever the satellite is at `t`. Only a landed hit calls
// it — that is the one thing that changes the path, and it changes the speed
// while keeping the direction, so the run to the wall is never interrupted.
const relegAt = (t, vx) => {
  leg.value = { at: t, x: satXAt(t), vx }
}

// ── State ─────────────────────────────────────────────────────────────────────
const hits    = ref(props.target.hits ?? 0)
const armor   = computed(() => props.target.armor ?? SPY.satelliteArmor)

// Where the battery is pointing — the last thing tapped. Cosmetic: it swings the
// muzzle and nothing else. The shot's aim travels with the bolt.
const aimX    = ref(50)
const shells  = ref([])   // { id, x, firedAt, hit }
// Impact marks. A LIST, not one mark: a miss now lingers for three seconds and
// rounds can land 700 ms apart, so up to four of them share the sky. The single
// ref this replaced would have had each new impact erase the one before it —
// exactly the marks a gunner is trying to read a pattern out of.
const flashes = ref([])   // { id, x, kind } — cosmetic, never consulted by a rule
// True from the trigger until the round has landed and been read. It is also
// what keeps at most one shell in the air, which is the point: a gunner who
// cannot fire again until the last round arrives always SEES the last round
// arrive.
const busy    = ref(false)
// The two ends of a kill, deliberately separate. `killed` is the impact — the
// dish becomes a 💥 — and `done` is the verdict card that covers the field
// VERDICT_MS later. Driving both off one flag is what hid the last shot: the
// card went up the moment the server answered, while the round was still
// climbing, so the shot that won the game was the one shot nobody ever saw.
const killed  = ref(false)
const done    = ref(null) // 'destroyed' | 'dry' — the only two ways a sortie ends
const nowMs   = ref(Date.now())
// Where it died. The clock keeps running after the kill — it drives the fade of
// the last shell and the impact mark — so a wreck drawn at the live position
// would sail calmly on across the sky.
const wreckX  = ref(50)

const cellsLeft = computed(() =>
  Math.floor(playerResources.value[Object.keys(SPY.interceptCost)[0]] ?? 0)
)
const ammoIcon = RESOURCES.power_cell?.icon ?? '⚡'

const canFire   = computed(() => !busy.value && !done.value && cellsLeft.value > 0)

// Where the satellite is drawn, and where it is at this instant for anything
// that needs to know. Recomputed off `nowMs`, which the frame loop advances.
const satX   = computed(() => satXAt(nowMs.value))
const satDir = computed(() => satDirAt(nowMs.value))

// ── The frame loop ────────────────────────────────────────────────────────────
// It only advances the clock and retires finished shells. Nothing about the
// outcome of a shot is decided here, and nothing about the satellite's path
// either — the path is `satXAt()` and the walls are the only thing that turns it.
let raf = null

// Pending beats — the pause between an impact and the card that covers it.
// Tracked because closing the overlay mid-flight must not leave a verdict
// scheduled against a component on its way out.
const timers = []
const beat = (fn, ms) => { timers.push(setTimeout(fn, ms)) }

// Runs `fn` when a round fired at `firedAt` reaches the lane — now, if the
// moment has already passed. This is what puts every visible consequence of a
// shot on the bolt's clock instead of the network's; see fire().
const atImpact = (firedAt, fn) =>
  beat(fn, Math.max(0, SHELL_MS - (Date.now() - firedAt)))

const frame = () => {
  const t = Date.now()
  nowMs.value = t

  // A shell is drawn until it reaches the lane; the verdict it carries was
  // written when it was fired.
  for (let i = shells.value.length - 1; i >= 0; i--) {
    if (t - shells.value[i].firedAt >= SHELL_MS) {
      const s = shells.value[i]
      // The killing round leaves no mark of its own: the wreck is already a 💥
      // at the same spot and the same instant, and two of them stacked reads as
      // a rendering fault rather than as an explosion.
      if (!s.kills) {
        flashes.value.push({ id: s.id, x: s.x, kind: s.hit ? 'hit' : 'miss' })
        // Removed on its own clock rather than by a cap on the list: the element
        // has to outlive its CSS animation exactly, or it pops back to full
        // opacity for a frame before it goes.
        beat(() => { flashes.value = flashes.value.filter(f => f.id !== s.id) }, MARK_FADE_MS)
      }
      shells.value.splice(i, 1)
    }
  }

  raf = requestAnimationFrame(frame)
}

onMounted(() => {
  const t = Date.now()
  // Enter at a random point of the lane travelling a random way, so the first
  // shot of a salvo is never the same shot twice.
  leg.value = {
    at: t,
    x: 20 + Math.random() * 60,
    vx: speedNow(hits.value) * (Math.random() < 0.5 ? -1 : 1),
  }
  raf = requestAnimationFrame(frame)
})
onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf)
  for (const id of timers) clearTimeout(id)
})

// ── Aiming ────────────────────────────────────────────────────────────────────
// One coordinate out of the tap, clamped to the lane the satellite can occupy so
// a tap in the corner still aims somewhere the target could actually be.
const fieldEl = ref(null)

const columnAt = (clientX) => {
  const box = fieldEl.value?.getBoundingClientRect()
  if (!box || !box.width) return null
  const pct = ((clientX - box.left) / box.width) * 100
  return Math.max(SAT_HALF, Math.min(100 - SAT_HALF, pct))
}

// ── Firing ────────────────────────────────────────────────────────────────────
// The verdict is decided HERE, at the instant of the shot, from where the
// satellite will be when the round arrives — not later, when the sprite happens
// to overlap. The animation is a re-telling of a decision already made.
//
// EVERY VISIBLE CONSEQUENCE RUNS ON THE SHELL'S CLOCK, and it is scheduled
// before the request is even sent. The network gets no vote on when a round
// lands. Two versions of this got it wrong in opposite ways:
//
//   the first showed the verdict card the moment the server answered, which on a
//   fast connection covered the field while the shell was still climbing — the
//   shot that won the game was the one shot nobody ever saw;
//
//   the second waited for the server AND for the impact, which fixed that but
//   left the reverse fault on a slow one: the flash appeared on time and the
//   dish sailed on for another second before exploding.
//
// The client does not need to be told any of it. It decided `hit` itself and it
// knows the armour, so it knows whether this round is the last one. The server
// still owns the number — it is reconciled below the moment it answers — but it
// is not on the critical path of anything the eye sees.
const fire = async (x) => {
  if (!canFire.value || x == null) return
  aimX.value = x
  const firedAt = Date.now()
  const impactX = satXAt(firedAt + SHELL_MS)
  const hit     = Math.abs(impactX - x) <= HIT_HALF
  const kills   = hit && hits.value + 1 >= armor.value

  shells.value.push({ id: firedAt, x, firedAt, hit, kills })
  busy.value = true

  // Set before the await so the impact handler can tell a round that was fired
  // from one the server sent back — see the refusal branch at the bottom.
  let refused = false

  atImpact(firedAt, () => {
    if (refused) return
    busy.value = false
    if (hit) hits.value = Math.min(armor.value, hits.value + 1)

    if (kills) {
      // The dish blows up where the round actually met it, and at the moment it
      // met it. The card waits a beat so the 💥 is read before it is covered.
      wreckX.value = impactX
      killed.value = true
      beat(() => { done.value = 'destroyed' }, VERDICT_MS)
      return
    }

    // A landed hit changes what the next lead has to be, and it has to change ON
    // THE HIT: a satellite that accelerates when an HTTP response lands is a
    // satellite that accelerates for no reason the player can see.
    if (hit) {
      const dir = Math.sign(leg.value.vx) || 1
      relegAt(Date.now(), speedNow(hits.value) * dir)
    }
  })

  const result = await fireIntercept(props.target.playerId, hit)

  // The server refused the round. Take the shell back off the board rather than
  // pretending it flew, and give the shot back — nothing was paid for it.
  //
  // Only an empty magazine ends the sitting. A refusal is not always fatal: the
  // 250 ms floor answers 429 to a round fired on the heels of the last one, and
  // ending the whole salvo over a message that says "wait a moment" would be the
  // rudest possible reading of it. `interceptError` is on screen either way.
  if (!result) {
    refused = true
    shells.value = shells.value.filter(s => s.id !== firedAt)
    busy.value = false
    if (cellsLeft.value <= 0) done.value = 'dry'
    return
  }

  // Reconcile with the authority — BUT NEVER BEFORE THE ROUND HAS LANDED. This
  // used to assign straight from here, which is a second writer to `hits` racing
  // the one at impact, and the server almost always won the race because it
  // answers in ~200 ms against the bolt's 700. One hit was then counted twice:
  // the answer set the bar to 1, and the impact handler afterwards added its own
  // +1 on top and made it 2.
  //
  // The visible half of that is the bar jumping 1 → 3 → back to 2, which is what
  // was reported. The dangerous half is `kills`, which is computed from
  // `hits.value` at the trigger: with the count inflated, the SECOND round
  // satisfied `hits + 1 >= armor`, so the client blew the dish up and printed
  // "destroyed" over a satellite the server still had alive at 2/3.
  //
  // Routed through atImpact() the two writes are ordered rather than racing —
  // the local +1 first, this correction immediately after it, both on the bolt's
  // clock — and they agree, so nothing moves twice.
  if (typeof result.hits === 'number') {
    atImpact(firedAt, () => { if (!refused) hits.value = result.hits })
  }

  // The magazine came up empty. Timed from the IMPACT rather than from now, so
  // the card lands a readable beat after the last round however slow the answer
  // was — `cellsLeft` is already the post-shot figure by this point, because the
  // response carried the new stock with it.
  if (!kills && cellsLeft.value <= 0) {
    const wait = Math.max(0, firedAt + SHELL_MS + VERDICT_MS - Date.now())
    beat(() => { done.value = 'dry' }, wait)
  }
}

// `touchstart` is handled on its own and prevented, which also suppresses the
// synthetic click the browser would send ~300 ms later — otherwise a tap costs
// two power cells.
const onFieldClick = (e) => fire(columnAt(e.clientX))
const onFieldTouch = (e) => { if (e.touches[0]) fire(columnAt(e.touches[0].clientX)) }

// ── Readout ───────────────────────────────────────────────────────────────────

// ── Drawing the bolt ──────────────────────────────────────────────────────────
// Percentages are not a coordinate system you can take an angle in: the field is
// 3:2, so 10 % across and 10 % up are different lengths on screen and an angle
// computed from the raw numbers would lean wrong. FIELD_RATIO converts the
// vertical into the horizontal's units first. Get this wrong and the muzzle
// points somewhere the bolt does not go, which is the one thing on screen a
// player would read as the game lying to them.
const FIELD_RATIO = 3 / 2

const angleTo = (x) => {
  const dx = x - GUN_X
  const dy = (GUN_Y - SAT_Y) / FIELD_RATIO   // % of width, not of height
  return Math.atan2(dx, dy) * (180 / Math.PI)
}

// The muzzle points wherever it last fired, so the battery visibly tracks.
const gunStyle = computed(() => ({
  left: GUN_X + '%',
  top:  GUN_Y + '%',
  transform: `translate(-50%,-50%) rotate(${angleTo(aimX.value).toFixed(1)}deg)`,
}))

// One bolt: a streak that travels from the muzzle to (x, SAT_Y) over SHELL_MS,
// lying along its own path. `left`/`top` are animated in percent — both resolve
// against the field, so the travel needs no measurement.
const shellStyle = (shell) => ({
  '--x0': GUN_X + '%',
  '--y0': GUN_Y + '%',
  '--x1': shell.x + '%',
  '--y1': SAT_Y + '%',
  '--ms': SHELL_MS + 'ms',
  '--rot': angleTo(shell.x).toFixed(1) + 'deg',
})

const stageKey = computed(() => {
  if (hits.value >= 2) return 'hawkStar.intercept.stageEvading'
  if (hits.value >= 1) return 'hawkStar.intercept.stageFast'
  return 'hawkStar.intercept.stageSteady'
})

const doneKey = computed(() => ({
  destroyed: 'hawkStar.intercept.outcomeDestroyed',
  dry:       'hawkStar.intercept.outcomeDry',
}[done.value] ?? null))
</script>

<template>
  <!-- No title bar and no armour bar of its own. The row that opened this is
       still on screen directly above, carrying the bogey's name and the same
       damage in `hs-orbit-armor` — printing either again would be a second copy
       of a fact three centimetres away, and it would cost the field the height.
       Closing is the same 🎯 button that opened it. -->
  <div class="hs-icept">
    <!-- The field. One tap anywhere in the sky is the whole input: the battery
         swings to that column and fires at it. Only the horizontal position is
         read, so a thumb landing high or low aims at the same place. -->
    <div
      ref="fieldEl"
      class="hs-icept-field"
      :class="{ 'hs-icept-field--over': !!done }"
      @touchstart.prevent="onFieldTouch"
      @click="onFieldClick"
    >
      <div class="hs-icept-stars" />

      <!-- The bogey -->
      <div
        v-if="!killed"
        class="hs-icept-sat"
        :style="{ left: satX + '%', top: SAT_Y + '%', transform: `translate(-50%,-50%) scaleX(${satDir})` }"
      >📡</div>
      <div
        v-else
        class="hs-icept-wreck"
        :style="{ left: wreckX + '%', top: SAT_Y + '%' }"
      >💥</div>

      <!-- Rounds in the air. `--t` drives the climb; the outcome is already
           decided, so this is presentation only. -->
      <div
        v-for="s in shells"
        :key="s.id"
        class="hs-icept-shell"
        :style="shellStyle(s)"
      />

      <!-- Where rounds actually arrived: 💥 for a hit, ☁️ for a miss, both
           hanging for three seconds so the last few are readable together. -->
      <div
        v-for="f in flashes"
        :key="f.id"
        class="hs-icept-flash"
        :class="`hs-icept-flash--${f.kind}`"
        :style="{ left: f.x + '%', top: SAT_Y + '%' }"
      >{{ f.kind === 'hit' ? '💥' : '☁️' }}</div>

      <!-- The battery -->
      <div class="hs-icept-gun" :style="gunStyle">🔺</div>
      <div class="hs-icept-ground" />

      <div v-if="done" class="hs-icept-over">
        <span class="hs-icept-over__line">{{ t(doneKey) }}</span>
        <button v-if="done !== 'destroyed'" class="hs-icept-again" @click.stop="emit('close')">
          {{ t('hawkStar.intercept.back') }}
        </button>
        <button v-else class="hs-icept-again hs-icept-again--win" @click.stop="emit('close')">
          {{ t('hawkStar.intercept.back') }}
        </button>
      </div>
    </div>

    <div class="hs-icept-foot">
      <span class="hs-icept-stage">{{ t(stageKey) }}</span>
      <!-- The magazine, and the only thing standing between you and the kill. -->
      <span class="hs-icept-ammo" :class="{ 'hs-icept-ammo--out': cellsLeft <= 0 }">
        {{ ammoIcon }} {{ cellsLeft }}
      </span>
    </div>

  <div v-if="interceptError" class="hs-icept-error">{{ interceptError }}</div>
  <div class="hs-icept-hint">{{ t('hawkStar.intercept.hint') }}</div>
  </div>
</template>

<style lang="scss" scoped>
// A panel in the tile column, framed like the orbit list it stands in for —
// same border and the same margin, so opening fire does not make the column
// jump. It was a fixed, blurred sheet over the whole page; running your own
// orbital battery is part of running the planet, not a mode you enter.
.hs-icept {
  margin-bottom: 0.5rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(248,113,113,0.35);
  background: rgba(248,113,113,0.08);
  // Clips the field's corners to the panel's radius, which is the only reason
  // the field can now run to the edge without a rounding of its own.
  overflow: hidden;
}


// ── The field ────────────────────────────────────────────────────────────────
// A fixed aspect so the percentage geometry means the same thing everywhere, and
// so the lead a player learns on a phone still holds on a desktop.
//
// `container-type: inline-size` is what lets everything DRAWN in here be sized
// in `cqw` — percent of the field's own width — instead of in rem. That matters
// now the field lives in a column whose width is not ours to choose: at 16 rem a
// 1.9 rem satellite is 12 % of the field, so its half-width overflows the ±5 %
// kill box and rounds start visibly clipping the dish without counting. The one
// unfairness this game cannot afford, and a rem size walks straight into it the
// first time the column gets narrow.
.hs-icept-field {
  position: relative;
  container-type: inline-size;
  // Edge to edge. The panel's own border already frames it, and every pixel of
  // width here is worth more than a margin: the whole geometry is a percentage
  // of this box, so a wider field is a physically bigger target and a longer
  // travel to read the lead against.
  aspect-ratio: 3 / 2;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  background: radial-gradient(120% 80% at 50% 100%, rgba(30,58,138,0.35), rgba(2,4,12,0.9) 70%);
  overflow: hidden;
  cursor: crosshair;
  touch-action: none;
  user-select: none;

  &--over { cursor: default; }
}

// Cheap starfield: two repeating-gradients crossed, no assets, no DOM.
.hs-icept-stars {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  background-image:
    radial-gradient(1px 1px at 12% 22%, #fff 50%, transparent 50%),
    radial-gradient(1px 1px at 71% 12%, #fff 50%, transparent 50%),
    radial-gradient(1px 1px at 34% 46%, #fff 50%, transparent 50%),
    radial-gradient(1px 1px at 88% 38%, #fff 50%, transparent 50%),
    radial-gradient(1px 1px at 55% 28%, #fff 50%, transparent 50%),
    radial-gradient(1px 1px at 24% 66%, #fff 50%, transparent 50%);
}

// Sized to the kill box, not to taste: HIT_HALF is 5 % of the field and the
// field is ~28 rem, so the box is about 2.8 rem across and a 1.9 rem body sits
// inside it with room to spare. The sprite must stay SMALLER than the box —
// a round that visually clipped the dish and did not count would be the one
// unfairness this game cannot afford.
// NO REM FALLBACK HERE, deliberately, and it is the one place in this file
// where that is a rule rather than a preference. The dish has to stay narrower
// than the ±HIT_HALF box that decides a hit, and HIT_HALF is a percentage of the
// field — so the only size that can hold at every column width is a percentage
// of the same field. A rem fallback cannot: 1.9rem overflows the box in a 30 rem
// column and is three times too wide in a 13 rem one (scratchpad/
// intercept-sprite-check.mjs measures it). Without container-query support the
// declaration is simply invalid and the glyph inherits the panel's font size,
// which is far SMALLER than the box — a shrunken dish is survivable, a dish
// wider than the box that counts the hit is not.
.hs-icept-sat {
  position: absolute;
  font-size: 8cqw;     // ≈ 4 % half-width against the ±5 % kill box
  line-height: 1;
  filter: drop-shadow(0 0 6px rgba(56,189,248,0.6));
  pointer-events: none;
}

.hs-icept-wreck {
  position: absolute;
  font-size: 1.8rem;
  font-size: 10cqw;
  line-height: 1;
  transform: translate(-50%,-50%);
  pointer-events: none;
  animation: hs-icept-boom 0.5s ease-out;
}

@keyframes hs-icept-boom {
  from { transform: translate(-50%,-50%) scale(0.2); opacity: 0; }
  to   { transform: translate(-50%,-50%) scale(1);   opacity: 1; }
}

// The flight is one linear pass over exactly SHELL_MS — the same duration the
// hit test used, handed in as a custom property so the two can never disagree.
// Both axes are animated now that a bolt can travel at an angle, and both are
// percentages of the field, so nothing here needs a measurement.
.hs-icept-shell {
  position: absolute;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(253,230,138,0), #fde68a);
  box-shadow: 0 0 6px rgba(251,191,36,0.8);
  // The streak lies along its own path: the rotation is the bearing the JS
  // worked out, and it is applied after the centring translate.
  transform: translate(-50%,-50%) rotate(var(--rot));
  pointer-events: none;
  animation: hs-icept-fly var(--ms) linear forwards;
}

@keyframes hs-icept-fly {
  from { left: var(--x0); top: var(--y0); }
  to   { left: var(--x1); top: var(--y1); }
}

// The two marks have different jobs and therefore different lifetimes, so the
// animation lives on the modifier rather than on the base.
.hs-icept-flash {
  position: absolute;
  transform: translate(-50%,-50%);
  pointer-events: none;

  // Both marks bloom, hold and drift up out of the lane on the same three-second
  // clock. The drift is what keeps a run of them from stacking into a smear on
  // one line; a hit is drawn a size larger, which is all that separates them
  // beyond the glyph.
  &--hit  { font-size: 7cqw; animation: hs-icept-puff 3s ease-out forwards; }
  &--miss { font-size: 5cqw; animation: hs-icept-puff 3s ease-out forwards; }
}

// Most of the three seconds is spent readable: it blooms in over the first
// tenth, holds, and only gives up the last third of the time to the fade.
@keyframes hs-icept-puff {
  0%   { opacity: 0;    transform: translate(-50%,-50%) scale(0.5); }
  8%   { opacity: 0.95; transform: translate(-50%,-55%) scale(1); }
  65%  { opacity: 0.8;  transform: translate(-50%,-80%) scale(1.1); }
  100% { opacity: 0;    transform: translate(-50%,-130%) scale(1.25); }
}

// Bolted to the middle and swinging to the last bearing fired. The transition is
// on the transform, which is the only thing that moves now — it used to slide
// along `left`, back when the launcher chased the pointer.
.hs-icept-gun {
  position: absolute;
  font-size: 1.2rem;
  font-size: 6cqw;
  line-height: 1;
  pointer-events: none;
  filter: drop-shadow(0 0 5px rgba(248,113,113,0.5));
  transition: transform 0.12s ease-out;
}

.hs-icept-ground {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 8%;
  background: linear-gradient(180deg, rgba(120,53,15,0.45), rgba(60,20,5,0.85));
  border-top: 1px solid rgba(251,191,36,0.25);
}

.hs-icept-over {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: rgba(4,6,14,0.72);
  backdrop-filter: blur(2px);
}

.hs-icept-over__line { font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.85); text-align: center; padding: 0 1rem; }

.hs-icept-again {
  padding: 0.3rem 0.8rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.8);
  font-size: 0.62rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.12); }
  &--win  { border-color: rgba(52,211,153,0.5); color: #6ee7b7; }
}

// ── Foot ─────────────────────────────────────────────────────────────────────
.hs-icept-foot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.7rem 0.2rem;
}

.hs-icept-stage { flex: 1; font-size: 0.55rem; color: rgba(255,255,255,0.5); }

.hs-icept-ammo {
  font-size: 0.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fcd34d;

  &--out { color: rgba(248,113,113,0.9); }
}

.hs-icept-error {
  padding: 0 0.7rem 0.2rem;
  font-size: 0.55rem;
  color: rgba(248,113,113,0.9);
}

.hs-icept-hint {
  padding: 0 0.7rem 0.6rem;
  font-size: 0.52rem;
  line-height: 1.35;
  color: rgba(255,255,255,0.38);
}
</style>
