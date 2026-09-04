<script setup>
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsOnboardingPanel from '~/components/hawk-star/HsOnboardingPanel.vue'
import HsPlanetMarker from '~/components/hawk-star/HsPlanetMarker.vue'
import HsProfilePanel from '~/components/hawk-star/HsProfilePanel.vue'
import HsSettingsPanel from '~/components/hawk-star/HsSettingsPanel.vue'

const emit = defineEmits(['go-planet'])

const { t } = useI18n()
const {
  empireStatus,
  empireAlertCount,
  empireResearch,
  focusPlanetTile,
  homePlanetId,
  homeSystem,
  activePlanetId,
  playerPortrait,
  playerName,
  playerDisposition,
  onboardingSteps,
  onboardingDoneCount,
  onboardingComplete,
  PLANET_TYPES,
  now,
  formatTime,
} = useHawkStar()

// A row's label is assembled here rather than in the composable: useI18n() can
// only be called inside a component, so the row ships a key plus its params and
// `paramKeys` for the values that are themselves translated (a resource name, a
// tile name, a unit name).
const rowLabel = (row) => {
  const params = { ...row.labelParams }
  for (const [name, key] of Object.entries(row.paramKeys ?? {})) params[name] = t(key)
  return t(row.labelKey, params)
}

const remSec = (endsAt) => Math.max(0, Math.ceil((endsAt - now.value) / 1000))

const pct = (startedAt, endsAt) => {
  if (!startedAt || !endsAt) return null
  return Math.min(100, Math.max(0, (now.value - startedAt) / (endsAt - startedAt) * 100))
}

// Whole hours are the honest unit here — a shield drains 1.25 %/h, so minutes
// would suggest a precision the number does not have.
const holds = (hours) => hours == null ? '' : t('hawkStar.empire.holds', { h: Math.max(1, Math.round(hours)) })

// Below 20 % amber, empty red — the same thresholds the tiles themselves use,
// so a meter never reads differently here than on the planet it belongs to.
const meterLevel = (v) => v <= 0 ? 'empty' : v < 20 ? 'low' : 'ok'

const planetIcon = (type) => PLANET_TYPES[type]?.icon ?? '🪐'

// How long ago, in the coarsest unit that still says something. Same ladder the
// galaxy card uses for intel age.
const ago = (ts) => {
  const h = Math.max(0, (now.value - ts) / 3600000)
  if (h < 1)  return t('hawkStar.galaxy.intelAgeMin',   { n: Math.max(1, Math.round(h * 60)) })
  if (h < 48) return t('hawkStar.galaxy.intelAgeHours', { n: Math.round(h) })
  return t('hawkStar.galaxy.intelAgeDays', { n: Math.floor(h / 24) })
}

// `won` in a report always means the ATTACKER won, so from this planet's chair
// it is the loss — the same translation `logOutcome()` does in the galaxy card.
const raidOutcome = (raid) => raid.won
  ? t('hawkStar.empire.raidLost')
  : t('hawkStar.empire.raidHeld')

// What they carried off. Only refined goods can be plundered, so every entry
// has an icon and there is never a long list.
const lootItems = (raid) => Object.entries(raid.loot ?? {})
  .filter(([, amount]) => amount > 0)
  .map(([res, amount]) => ({ res, amount, icon: RESOURCES[res]?.icon ?? '•' }))

// How the planet IS — this drives the card's frame, and only severity may
// colour that. It reads the rows rather than recomputing anything, so the frame
// can never disagree with the list below it.
const cardTone = (p) => {
  if (p.battery?.down)                      return 'alarm'
  if (p.rows.some(r => r.kind === 'alarm')) return 'alarm'
  if (p.rows.some(r => r.kind === 'warn'))  return 'warn'
  return 'ok'
}

// The badge, in one word. Above "idle" it answers how the planet is; below it,
// what the planet is doing. Activity outranks "idle" on purpose: an empty build
// slot is a warning on nearly every young planet, so a badge that let it win
// would practically never get to say "building". Nothing is lost by that — the
// amber frame stays, and the warning is still a row on the card.
const stateBadge = (p) => {
  if (p.battery?.down)                      return { key: 'stateBlackout',   cls: 'alarm' }
  if (p.rows.some(r => r.kind === 'alarm')) return { key: 'stateAlert',      cls: 'alarm' }
  if (p.activity === 'building')            return { key: 'stateBuilding',   cls: 'busy'  }
  if (p.activity === 'converting')          return { key: 'stateConverting', cls: 'busy'  }
  if (p.rows.some(r => r.kind === 'warn'))  return { key: 'stateIdle',       cls: 'warn'  }
  // Nothing wrong and nothing under way — which, since a build would have been
  // caught two lines up, always means nothing is being built. The badge says so
  // instead of the old "Produktiv": an empty build queue is the one thing a
  // commander can always act on, and a card that reads "fine" gets closed
  // without a second look. `stateOk` is unreachable from here and is gone.
  return { key: 'stateNoBuild', cls: 'idle' }
}

// The jump is the point of the board: set the planet AND the tile, then turn
// the page to the planet view. A finding you cannot act on from where it is
// shown is only half an answer.
const jumpTo = (planetId, slot) => {
  if (!focusPlanetTile(planetId, slot)) return
  emit('go-planet')
}

// ── Which cards are open ──────────────────────────────────────────────────────
// One map for every card on the board — the commander, each planet, the guide —
// because they are all the same control.
//
// They start OPEN. The board is something you read, not something you navigate:
// you come to it to find out which planet needs you, and a stack of lids answers
// that with "open them and see". The lid's own summary (a state badge, an alert
// count, a step count) is a reminder of what is inside, not a substitute for it.
// Shut-by-default made the fast case — nothing wrong anywhere — the one that
// cost the most clicks.
//
// The commander card is the exception, and it is the only card here that is an
// EDITOR rather than a report: a portrait, a name, a disposition, none of which
// changes on its own, so it has nothing to tell you until you go looking for it.
// Open by default it would just be a form in the way of the empire.
//
// Hence the default-plus-overrides shape rather than a seeded map: the planet
// cards are keyed by planet id, so a colony founded while the panel is up has no
// entry to seed and must still come up open like its neighbours.
const CLOSED_BY_DEFAULT = new Set(['profile'])

const open = ref({})

const isOpen     = (id) => open.value[id] ?? !CLOSED_BY_DEFAULT.has(id)
// Off `isOpen`, not off the raw map: `!undefined` is `true`, so a card that has
// never been touched would toggle to the state it is already in and the first
// click on it would do nothing.
const toggleCard = (id) => { open.value[id] = !isOpen(id) }

// The profile panel's own header bar is gone, so the confirmation it used to
// show lands here instead, in the head you opened the panel from.
const savedFlash = ref(false)
let savedTimer = null
const flashSaved = () => {
  savedFlash.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedFlash.value = false }, 1500)
}

// ── The system band in the header ─────────────────────────────────────────────
// The board answers "where do I look", and the answer used to be spread over
// four cards you had to read down. The band states it in one line, framed the
// way the Solar System view frames its own header — star, name, class, then the
// planets, then the count — because it is the same system and should introduce
// itself the same way on both screens.
//
// It shows **every** planet, not only the ones you hold. An empire of two in a
// system of seven is a fact about the empire, and a board that only ever drew
// your own planets could never say it. The ones you do not hold render in the
// state the map would give them (free, unscanned, uninhabitable) and do not
// respond — there is no card under them to go to.
const planets = computed(() => homeSystem.value?.planets ?? [])

const starClassLabel = (cls) => t(`hawkStar.starClass.${cls}`, cls ?? '')

// The board's status for a planet, or null when it is not ours. One lookup
// behind the badge, the tone and whether the disc does anything at all, so the
// three can never disagree about which planets are on the board.
const statusOf = (planet) => empireStatus.value.find(s => s.planetId === planet.id) ?? null

// A notice with no severity behind it is still a notice, so the badge falls back
// to amber rather than disappearing into the disc. Takes the planet so the
// template does not have to call statusOf() twice on one line.
const badgeTone = (planet) => {
  const s = statusOf(planet)
  return s && cardTone(s) === 'alarm' ? 'alarm' : 'warn'
}

// A disc is a jump to that planet's card. Same trick the Solar System's list
// uses: one ref on the container and a data attribute, rather than a function
// ref per card — this component re-renders every tick and that would churn a
// ref callback per planet per second for nothing.
const cardsEl = ref(null)

const scrollToCard = async (planet) => {
  if (!statusOf(planet)) return
  // Open it on the way. The disc carries the planet's alert count, and scrolling
  // to a closed lid would answer a question with the same question.
  open.value[planet.id] = true
  await nextTick()
  cardsEl.value
    ?.querySelector(`[data-planet="${planet.id}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

const alertCount = computed(() => empireAlertCount.value)
</script>

<template>
  <div class="hs-empire">
    <!-- Where, which planets, how many — three things about the empire, and on a
         desktop line they are three things in that order, left to right. The
         `hs-empire-head__top` wrapper that used to hold two of them apart from
         the discs is gone: it split the header into a text line and a disc line,
         which is a split only a phone needs. The head itself is the row now, and
         on a phone it is the column: everything centred, one under the other.
         Who is no longer among them — the commander is the first card. -->
    <div class="hs-empire-head">
      <!-- Which system this empire is in. Kept as one span so star, name and
           class wrap together instead of breaking apart mid-phrase. -->
      <span v-if="homeSystem" class="hs-empire-sys">
        <span class="hs-empire-sys__star">☀️</span>
        <span class="hs-empire-sys__name">{{ homeSystem.name }}</span>
        <span class="hs-empire-sys__class">{{ starClassLabel(homeSystem.starClass) }}</span>
      </span>

      <!-- Every planet in the system. Both meters are off: a blackout is already
           an alarm row and therefore already inside the badge, and the shield has
           its own meter on the card the disc scrolls to. One number per disc is
           what makes the band scannable. -->
      <div v-if="planets.length" class="hs-empire-fleet">
        <div v-for="planet in planets" :key="planet.id" class="hs-empire-fleet__slot">
          <HsPlanetMarker
            :planet="planet"
            :selected="planet.id === activePlanetId"
            :disabled="!statusOf(planet)"
            :badge="statusOf(planet)?.alerts || null"
            :badge-tone="badgeTone(planet)"
            :battery="false"
            :shield="false"
            @select="scrollToCard(planet)"
          />
        </div>
      </div>

      <!-- Pipe-form messages need the count as the third argument; passing it
           only as a named param always picks the singular branch. -->
      <span class="hs-empire-summary">
        {{ t('hawkStar.empire.summaryPlanets', { n: empireStatus.length }, empireStatus.length) }}
        <template v-if="alertCount > 0">
          · <span class="hs-empire-summary-alert">{{ t('hawkStar.empire.summaryAlerts', { n: alertCount }, alertCount) }}</span>
        </template>
      </span>

    </div>

    <!-- Global research applies to every planet, so it sits above the cards
         rather than on one of them. It is also the only build the Activity feed
         never shows, because that walks the planets and this does not live on
         one. The jump goes to the HOME comm center (slot 6): the server does not
         record which planet ordered the research, and home is the one planet
         guaranteed to have the tile. -->
    <div v-if="empireResearch.length" class="hs-empire-research">
      <span class="hs-empire-research-tag">{{ t('hawkStar.empire.researchLabel') }}</span>
      <button
        v-for="r in empireResearch"
        :key="r.id"
        class="hs-empire-research-row"
        @click="jumpTo(homePlanetId, 6)"
      >
        <span class="hs-empire-row-icon">{{ r.icon }}</span>
        <span class="hs-empire-row-text">
          <span class="hs-empire-row-label">{{ t('hawkStar.empire.rowBuilding', { name: r.name, level: r.level }) }}</span>
          <span v-if="pct(r.startedAt, r.endsAt) !== null" class="hs-empire-row-bar">
            <span class="hs-empire-row-bar-fill" :style="{ width: pct(r.startedAt, r.endsAt) + '%' }" />
          </span>
        </span>
        <span class="hs-empire-row-time">{{ formatTime(remSec(r.endsAt)) }}</span>
      </button>
    </div>

    <div ref="cardsEl" class="hs-empire-cards">
      <!-- The commander, first in the stack and one card, not two: the profile
           and the dev panel are both "you rather than the empire", and a second
           head for the cheats only made the board look like it had two owners.
           It wears the commander — portrait as the head's icon, name as its
           title — which is what the crest above the board used to do and could
           never do well: a face and a name are not a control, and nobody clicks
           them expecting a form. As a card head with a caret, they are. -->
      <!-- The card is bordered in the disposition, and it is the only card here
           whose colour says something about *you* rather than about a planet.
           It belongs on the outside because the disposition is not a detail of
           the profile form: it decides whether anybody can raid you at all, and
           a fact that big should not need the card opened to be read. Green,
           grey, red — the same three colours the row inside uses and the same
           ones the galaxy card gives a foreign commander, so one look means the
           same thing wherever it lands. -->
      <section
        class="hs-empire-card hs-empire-card--commander"
        :class="[`hs-empire-card--disp-${playerDisposition}`, { 'hs-empire-card--open': isOpen('profile') }]"
      >
        <button
          class="hs-empire-cardhead"
          :aria-expanded="isOpen('profile')"
          @click="toggleCard('profile')"
        >
          <span class="hs-empire-cardhead__icon">{{ playerPortrait }}</span>
          <span class="hs-empire-cardhead__title">{{ playerName || '—' }}</span>
          <Transition name="hs-saved">
            <span v-if="savedFlash" class="hs-empire-cardhead__saved">✓ gespeichert</span>
          </Transition>
          <span class="hs-empire-cardhead__caret">▾</span>
        </button>

        <div v-if="isOpen('profile')" class="hs-empire-cardbody">
          <HsProfilePanel @saved="flashSaved" />
          <HsSettingsPanel />
        </div>
      </section>

      <div
        v-for="p in empireStatus"
        :key="p.planetId"
        :data-planet="p.planetId"
        class="hs-empire-card"
        :class="[`hs-empire-card--${cardTone(p)}`, { 'hs-empire-card--open': isOpen(p.planetId) }]"
      >
        <!-- Head: who this is, the one-word verdict, and the caret. It used to
             be a jump to the planet's grid — it folds the card now, like every
             other head on the board. Nothing is lost: every meter and every row
             inside is a jump of its own, and a head that both jumped away and
             folded in place would have been two controls wearing one hat. -->
        <button
          class="hs-empire-cardhead"
          :aria-expanded="isOpen(p.planetId)"
          @click="toggleCard(p.planetId)"
        >
          <span class="hs-empire-cardhead__icon">{{ planetIcon(p.type) }}</span>
          <span class="hs-empire-cardhead__title">{{ p.name }}</span>
          <!-- A word, not a 🏠 with the meaning hidden in a title. Same chip the
               planet list and the grid strip use, so "this is home" looks the
               same wherever you meet it. -->
          <span v-if="p.isHome" class="hs-chip hs-chip--home hs-empire-home">{{ t('hawkStar.solar.homeBase') }}</span>
          <!-- Stays visible when the card is shut, which is the point of shutting
               one: a closed lid still says ALARM. -->
          <span class="hs-empire-state" :class="`hs-empire-state--${stateBadge(p).cls}`">
            {{ t('hawkStar.empire.' + stateBadge(p).key) }}
          </span>
          <!-- How MANY notices are folded away, in the same pill the disc in the
               header wears, with the same count behind it (`p.alerts`) and the
               same tone rule. The word says what is wrong, the number says how
               much of it there is — a shut card that reads "ALARM 4" is worth
               opening before one that reads "ALARM 1". -->
          <span
            v-if="p.alerts > 0"
            class="hs-empire-cardhead__alerts"
            :class="`hs-empire-cardhead__alerts--${cardTone(p) === 'alarm' ? 'alarm' : 'warn'}`"
            :title="t('hawkStar.empire.summaryAlerts', { n: p.alerts }, p.alerts)"
          >{{ p.alerts }}</span>
          <span class="hs-empire-cardhead__caret">▾</span>
        </button>

        <!-- The two meters that decide whether the planet runs and whether it is
             protected. A missing building is a greyed dash, never a gap — "this
             colony has no shield" is the thing worth spotting.
             OUTSIDE the fold on purpose: a battery at 8 % is a fact you want off
             a shut card, not something to go looking for, and the state badge
             above cannot say it — a planet can be building away happily on a
             battery that runs out in two hours. Two bars are cheap enough to
             carry on every lid. -->
        <div class="hs-empire-meters">
          <div class="hs-empire-meter" @click="jumpTo(p.planetId, 4)">
            <span class="hs-empire-meter-icon" :class="{ 'hs-empire-meter-icon--off': !p.battery }">🔋</span>
            <template v-if="p.battery">
              <span class="hs-empire-bar">
                <span
                  class="hs-empire-bar-fill"
                  :class="`hs-empire-bar-fill--${meterLevel(p.battery.pct)}`"
                  :style="{ width: Math.min(100, p.battery.pct) + '%' }"
                />
              </span>
              <span class="hs-empire-meter-val">{{ Math.round(p.battery.pct) }} %</span>
              <span v-if="!p.battery.down" class="hs-empire-meter-holds">{{ holds(p.battery.hours) }}</span>
            </template>
            <span v-else class="hs-empire-meter-none">{{ t('hawkStar.empire.noReactor') }}</span>
          </div>

          <div class="hs-empire-meter" @click="jumpTo(p.planetId, 1)">
            <span class="hs-empire-meter-icon" :class="{ 'hs-empire-meter-icon--off': !p.shield }">🛡️</span>
            <template v-if="p.shield">
              <span class="hs-empire-bar">
                <span
                  class="hs-empire-bar-fill"
                  :class="`hs-empire-bar-fill--${meterLevel(p.shield.pct)}`"
                  :style="{ width: Math.min(100, p.shield.pct) + '%' }"
                />
              </span>
              <span class="hs-empire-meter-val">{{ Math.round(p.shield.pct) }} %</span>
              <span v-if="p.shield.pct > 0" class="hs-empire-meter-holds">{{ holds(p.shield.hours) }}</span>
            </template>
            <span v-else class="hs-empire-meter-none">{{ t('hawkStar.empire.noShield') }}</span>
          </div>
        </div>

        <template v-if="isOpen(p.planetId)">
          <!-- Every row is a jump. Alarms first, then what is idle,
               then the timers. -->
          <ul class="hs-empire-rows">
            <li v-for="row in p.rows" :key="row.id">
              <button
                class="hs-empire-row"
                :class="`hs-empire-row--${row.kind}`"
                :title="row.titleKey ? t(row.titleKey) : ''"
                @click="jumpTo(p.planetId, row.slot)"
              >
                <span class="hs-empire-row-icon">{{ row.icon }}</span>
                <span class="hs-empire-row-text">
                  <span class="hs-empire-row-label">{{ rowLabel(row) }}</span>
                  <span v-if="pct(row.startedAt, row.endsAt) !== null" class="hs-empire-row-bar">
                    <span class="hs-empire-row-bar-fill" :style="{ width: pct(row.startedAt, row.endsAt) + '%' }" />
                  </span>
                </span>
                <span v-if="row.endsAt" class="hs-empire-row-time">{{ formatTime(remSec(row.endsAt)) }}</span>
                <span v-else class="hs-empire-row-go">›</span>
              </button>
            </li>
            <li v-if="p.moreRunning > 0" class="hs-empire-more">
              {{ t('hawkStar.empire.moreRunning', { n: p.moreRunning }) }}
            </li>
            <li v-if="!p.rows.length && !p.lastRaid" class="hs-empire-quiet">{{ t('hawkStar.empire.quiet') }}</li>
          </ul>

          <!-- The last attack this planet took. History, not a task, so it sits at
               the foot of the card — the same place the galaxy card keeps its
               battle log. Red while it is fresh, grey once it is an old grudge. -->
          <button
            v-if="p.lastRaid"
            class="hs-empire-raid"
            :class="{ 'hs-empire-raid--fresh': p.lastRaid.fresh }"
            :title="t('hawkStar.empire.raidHint')"
            @click="jumpTo(p.planetId, 1)"
          >
            <span class="hs-empire-raid-icon">{{ p.lastRaid.portrait || '👤' }}</span>
            <span class="hs-empire-raid-text">
              <span class="hs-empire-raid-head">
                ⚔️ {{ p.lastRaid.attacker }} · {{ raidOutcome(p.lastRaid) }} · {{ ago(p.lastRaid.foughtAt) }}
              </span>
              <!-- Plunder is the part worth spelling out: what is gone, and how
                   much of it. An empty haul on a plunder order is a finding too —
                   the silo was bare or the planet was still on cooldown. -->
              <span v-if="p.lastRaid.plundered" class="hs-empire-raid-loot">
                <template v-if="lootItems(p.lastRaid).length">
                  {{ t('hawkStar.empire.raidLooted') }}
                  <span v-for="l in lootItems(p.lastRaid)" :key="l.res" class="hs-empire-raid-item">
                    {{ l.icon }} {{ l.amount }}
                  </span>
                </template>
                <template v-else>{{ t('hawkStar.empire.raidNoLoot') }}</template>
              </span>
            </span>
          </button>
        </template>
      </div>

      <!-- Colonies whose state has not arrived yet simply are not here -->
      <div v-if="!empireStatus.length" class="hs-empire-empty">{{ t('hawkStar.empire.loading') }}</div>

      <!-- The early-game guide, as the last card in the grid: the planet cards
           answer "what needs me now", this one answers "what comes next". A card
           like every other now, head and caret and all — it used to be the one
           thing in the grid that was always unfolded, which made it the loudest
           item on the board for exactly as long as you least needed a lecture.
           The step count rides on the lid, so shut it still says how far along
           you are. It removes itself once every step is ticked, so a settled
           empire keeps the board clean — hence the `v-if` out here as well: an
           empty card would still draw a head. -->
      <section
        v-if="!onboardingComplete"
        class="hs-empire-card hs-empire-card--guide"
        :class="{ 'hs-empire-card--open': isOpen('onboarding') }"
      >
        <button
          class="hs-empire-cardhead"
          :aria-expanded="isOpen('onboarding')"
          @click="toggleCard('onboarding')"
        >
          <!-- `short`, not `title`: the title is a full sentence of welcome and
               on a half-width lid it was an ellipsis with two words in front of
               it. The sentence is still said — inside the card, where there is a
               line to say it on. -->
          <span class="hs-empire-cardhead__icon">🧭</span>
          <span class="hs-empire-cardhead__title">{{ t('hawkStar.tile.onboarding.short') }}</span>
          <span class="hs-empire-cardhead__count">{{ onboardingDoneCount }} / {{ onboardingSteps.length }}</span>
          <span class="hs-empire-cardhead__caret">▾</span>
        </button>

        <div v-if="isOpen('onboarding')" class="hs-empire-cardbody">
          <HsOnboardingPanel />
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-empire {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

// Phone first: a centred column, one item under the other, because none of the
// four survives being squeezed onto a 360 px line. From 640 px it is a single
// row — crest, system, discs, count — which is the shape the header was always
// after and never had while a wrapper held three of the four apart.
//
// `flex-wrap` stays off in the column: wrapping a column means a SECOND column,
// which is never what is wanted here. It is turned on only in the row, where it
// is what lets the profile panel take its own line below.
.hs-empire-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  padding: 0.5rem 0.15rem;

  @media (min-width: 640px) {
    flex-direction: row;
    flex-wrap: wrap;
    text-align: left;
    gap: 0.35rem 0.6rem;
  }
}

// ── Saved flash transition ────────────────────────────────────────────────────
.hs-saved-enter-active, .hs-saved-leave-active { transition: opacity 0.2s; }
.hs-saved-enter-from,   .hs-saved-leave-to     { opacity: 0; }

// Star, name and class travel together — a line break between "Solux" and
// "Orangener Zwerg" reads as two unrelated labels.
.hs-empire-sys {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
}
.hs-empire-sys__star  { font-size: 0.8rem; align-self: center; }
.hs-empire-sys__name  { font-size: 0.72rem; font-weight: 700; color: rgba(255,255,255,0.75); }
.hs-empire-sys__class {
  font-size: 0.54rem;
  color: rgba(253,230,138,0.55);
  white-space: nowrap;
}

// Discs and nothing else, so the line has one job and a seven-planet system
// still fits on a phone. It wraps rather than scrolling — a header you have to
// drag sideways is a header you stop reading.
.hs-empire-fleet {
  display: flex;
  flex-wrap: wrap;
	flex-grow: 1;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: var(--hs-r-md);
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
}

// Content width, not equal shares: the planet-grid strip is the whole system on
// a fixed rhythm under a chip line, this one is however many planets the system
// happens to hold and centres what it has.
.hs-empire-fleet__slot {
  --hs-pl-size: 1.75rem;

  flex: none;
  display: flex;
  justify-content: center;

  @media (min-width: 640px) { --hs-pl-size: 2rem; }
}
// Last on the row and pushed to its far end — but only on the row: in the
// column `margin-left: auto` would shove the count against the right edge of a
// header whose every other item is centred.
.hs-empire-summary {
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;

  @media (min-width: 640px) { margin-left: auto; }
}
.hs-empire-summary-alert { color: var(--hs-danger-muted); font-weight: 700; }

// Empire-wide, so it gets its own strip above the planet cards rather than a
// column — it belongs to no planet and must not read as if it did.
.hs-empire-research {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0.35rem 0.5rem;
  border-radius: var(--hs-r-lg);
  border: 1px solid rgba(129, 140, 248, 0.25);
  background: rgba(99, 102, 241, 0.08);
}
.hs-empire-research-tag {
  flex: none;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #c4b5fd;
}
.hs-empire-research-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  min-width: 10rem;
  padding: 0.15rem 0.3rem;
  border: 0;
  border-radius: 4px;
  background: none;
  cursor: pointer;
  text-align: left;

  &:hover { background: var(--hs-glass-lg); }

  .hs-empire-row-label { color: rgba(255, 255, 255, 0.8); }
}

// Two columns above 720 px, one below — but columns, not a grid. A grid puts
// its items in ROWS, and a row is as tall as the tallest thing in it: unfold the
// card on the left and the shut one beside it grows a hand's width of empty
// space under it, while everything on the next row is pushed down past the fold.
// Every card here folds, so that was not an edge case, it was the normal state
// of the board.
//
// Multi-column has no rows to be trapped in. Each column is its own stack: open
// one card and only the cards under it in that column move. The trade is the
// reading order — top-to-bottom per column rather than left-to-right per row —
// and that the browser rebalances when a card's height changes, so a card can
// change columns. For a board of independent cards that is the right trade.
.hs-empire-cards {
  column-gap: 0.6rem;
  // Swallows the bottom margin of whichever card ends each column — the spacing
  // between cards belongs between them, not under the last one.
  margin-bottom: -0.6rem;

  @media (min-width: 720px) { column-count: 2; }
}

// One card for the commander, one per planet, one for the guide — the same
// object every time, half the board wide on a desktop, and shut until you say
// otherwise.
//
// `break-inside: avoid` is what keeps a card whole: without it the column would
// happily tear one in half at the bottom of the left column and finish it at the
// top of the right. The gap between cards is a margin rather than the container's
// `row-gap`, because a multi-column container has no rows to space out.
//
// No `overflow: hidden` to clip the head's corners, tempting as that is: the
// profile's portrait picker is an absolutely positioned popover inside a body
// and would be cut off by it. The head rounds its own corners instead.
.hs-empire-card {
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  margin-bottom: 0.6rem;
  display: flex;
  flex-direction: column;
  border-radius: var(--hs-r-lg);
  border: 1px solid var(--hs-line-md);
  background: var(--hs-glass-sm);

  &--alarm { border-color: var(--hs-danger-border-card); background: var(--hs-danger-bg-card); }
  &--warn  { border-color: rgba(250, 204, 21, 0.28); }

  // The guide keeps the blue tint it had as a loose panel: it is not a planet
  // and not the commander, and the colour is how you know that at a glance.
  &--guide {
    border-color: rgba(80, 120, 255, 0.2);
    background: rgba(80, 120, 255, 0.07);
  }

  // The commander wears their standing. Border only, no fill: `--alarm` owns
  // the tinted-background language on this board and it means "a planet needs
  // you now", which a disposition never does — it is a standing, not an event.
  // Hostile in particular must not read as an alarm about yourself.
  &--disp-friendly { border-color: rgba(52, 211, 153, 0.4); }
  &--disp-neutral  { border-color: rgba(148, 163, 184, 0.4); }
  &--disp-hostile  { border-color: rgba(248, 113, 113, 0.45); }

  &--open .hs-empire-cardhead__caret { transform: rotate(180deg); color: rgba(255, 255, 255, 0.7); }
}

.hs-empire-cardhead {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 0;
  border-radius: var(--hs-r-lg);
  background: var(--hs-glass-xs);
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;

  &:hover { background: var(--hs-glass-lg); }

  // Rounded on all four corners only when the head IS the whole card. A planet
  // card keeps its meters under a shut head, so `:last-child` — not the open
  // state — is what decides this, and it stays right whatever moves in or out
  // of the fold next.
  &:not(:last-child) { border-radius: var(--hs-r-lg) var(--hs-r-lg) 0 0; }
}
.hs-empire-cardhead__icon { font-size: 1.05rem; line-height: 1; flex: none; }
.hs-empire-cardhead__title {
  min-width: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Only ever on the profile card, and only for a second and a half after a save.
// `margin-left: auto` rather than a flex title: the planet heads put their state
// badge at the far end with the same trick, and both must sit in the same place.
.hs-empire-cardhead__saved {
  margin-left: auto;
  flex: none;
  font-size: 0.55rem;
  font-weight: 600;
  color: rgba(52, 211, 153, 0.85);
  letter-spacing: 0.03em;
  white-space: nowrap;
}

// How far through the checklist you are, on the guide's lid — the one number
// worth keeping visible on a card that is shut by default.
.hs-empire-cardhead__count {
  margin-left: auto;
  flex: none;
  font-size: 0.6rem;
  font-weight: 700;
  color: rgba(150, 180, 255, 0.75);
  font-variant-numeric: tabular-nums;
}

// How many notices are folded away. The same pill the header's planet disc
// wears — same count, same two tones — because it is the same number, and a
// reader should not have to learn it twice. Tabular figures so a column of lids
// does not jitter between one and two digits.
.hs-empire-cardhead__alerts {
  flex: none;
  min-width: 0.95rem;
  padding: 0 4px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 0.5rem;
  font-weight: 700;
  line-height: 0.95rem;
  text-align: center;
  font-variant-numeric: tabular-nums;

  &--alarm { color: #fff;    background: rgba(239, 68, 68, 0.95);  border-color: rgba(252, 165, 165, 0.6); }
  &--warn  { color: #1c1917; background: rgba(251, 191, 36, 0.95); border-color: rgba(253, 230, 138, 0.6); }
}

// Last thing on every head, so "this folds" is always in the same corner.
.hs-empire-cardhead__caret {
  margin-left: auto;
  flex: none;
  font-size: 0.6rem;
  line-height: 1;
  color: rgba(255, 255, 255, 0.35);
  transition: transform 0.2s, color 0.2s;

  // Whatever sits at the far end of a head already claimed the `auto`; a second
  // one here would split the gap and set the caret adrift.
  .hs-empire-state + &,
  .hs-empire-cardhead__alerts + &,
  .hs-empire-cardhead__saved + &,
  .hs-empire-cardhead__count + & { margin-left: 0; }
}

// The bodies that need padding of their own: the commander's (a form) and the
// guide's (a list). Planet cards have none — their meters and rows bring their
// own padding and simply stop being rendered when the card is shut.
//
// The hairline under a head lives on whatever follows it rather than on the head
// itself: a shut planet card still has its meters below the lid and still wants
// the line, and only the thing that is actually there knows that.
.hs-empire-cardbody {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.6rem 0.7rem;
  border-top: 1px solid var(--hs-line-sm);
}
// The chip carries its own look; the head only decides it must not be the thing
// that gives way when the planet name is long.
.hs-empire-home { flex: none; }
.hs-empire-state {
  margin-left: auto;
  flex: none;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;

  &--alarm { color: var(--hs-danger-muted); background: var(--hs-danger-bg-cost); }
  &--warn  { color: var(--hs-warn-text);    background: rgba(250, 204, 21, 0.14); }
  &--busy  { color: #c7d2fe;                background: rgba(129, 140, 248, 0.16); }
  // Quieter than warn on purpose: an empty build queue is a nudge, not a fault,
  // and it must not compete with a storage that has actually stopped producing.
  &--idle  { color: #cbd5e1;                background: rgba(148, 163, 184, 0.16); }
  &--ok    { color: var(--hs-ok-muted);     background: var(--hs-ok-bg-dim); }
}

// On every planet card, open or shut. The line above separates it from the lid;
// the one below separates it from the rows, and goes away when there are no rows
// under it — a card that ends on a hairline looks like it was cut off.
.hs-empire-meters {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.45rem 0.6rem;
  border-top: 1px solid var(--hs-line-sm);
  border-bottom: 1px solid var(--hs-line-xs);

  &:last-child { border-bottom: 0; }
}
.hs-empire-meter {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;

  &:hover .hs-empire-meter-val { color: #fff; }
}
.hs-empire-meter-icon {
  font-size: 0.72rem;
  line-height: 1;
  flex: none;

  // An emoji ignores `color`, so a missing building is greyed out instead.
  &--off { filter: grayscale(1); opacity: 0.5; }
}
.hs-empire-bar {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 5px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.hs-empire-bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s linear;

  &--ok    { background: #38bdf8; }
  &--low   { background: var(--hs-warn); }
  &--empty { background: var(--hs-danger); }
}
.hs-empire-meter-val {
  flex: none;
  width: 2.6rem;
  text-align: right;
  font-size: 0.6rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
}
.hs-empire-meter-holds {
  flex: none;
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}
.hs-empire-meter-none {
  flex: 1;
  font-size: 0.58rem;
  color: rgba(255, 255, 255, 0.3);
}

.hs-empire-rows {
  list-style: none;
  margin: 0;
  padding: 0.3rem 0.35rem 0.45rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hs-empire-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.25rem 0.3rem;
  border: 0;
  border-left: 2px solid transparent;
  border-radius: 4px;
  background: none;
  cursor: pointer;
  text-align: left;

  &:hover { background: var(--hs-glass-lg); }

  &--alarm   { border-left-color: var(--hs-danger); }
  &--warn    { border-left-color: var(--hs-warn); }
  &--running { border-left-color: rgba(255, 255, 255, 0.14); }
}
.hs-empire-row-icon { font-size: 0.78rem; line-height: 1; flex: none; }
.hs-empire-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-empire-row-label {
  font-size: 0.63rem;
  line-height: 1.25;
  color: rgba(255, 255, 255, 0.8);
}
.hs-empire-row--alarm .hs-empire-row-label   { color: var(--hs-danger-muted); font-weight: 600; }
.hs-empire-row--warn  .hs-empire-row-label   { color: rgba(255, 255, 255, 0.72); }
.hs-empire-row--running .hs-empire-row-label { color: rgba(255, 255, 255, 0.55); }

.hs-empire-row-bar {
  display: block;
  height: 2px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.hs-empire-row-bar-fill {
  display: block;
  height: 100%;
  background: rgba(129, 140, 248, 0.7);
  transition: width 0.3s linear;
}

.hs-empire-row-time {
  flex: none;
  font-size: 0.58rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.hs-empire-row-go {
  flex: none;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.25);
}

// Sits below the rows and outside them: a battle is the one thing on the card
// that already happened and cannot be acted on any more.
.hs-empire-raid {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  width: 100%;
  padding: 0.35rem 0.6rem;
  border: 0;
  border-top: 1px solid var(--hs-line-xs);
  background: rgba(0, 0, 0, 0.18);
  cursor: pointer;
  text-align: left;

  &:hover { background: rgba(0, 0, 0, 0.28); }

  // Recent means "this is still news"; after a day it fades to a record. Same
  // rule the galaxy card's ⚔️ badge follows.
  &--fresh {
    background: var(--hs-danger-bg-cost);
    &:hover { background: rgba(248, 113, 113, 0.22); }
  }
}
.hs-empire-raid-icon { font-size: 0.85rem; line-height: 1.2; flex: none; }
.hs-empire-raid-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.hs-empire-raid-head {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.5);
}
.hs-empire-raid--fresh .hs-empire-raid-head {
  color: var(--hs-danger-muted);
  font-weight: 600;
}
.hs-empire-raid-loot {
  font-size: 0.58rem;
  color: rgba(255, 255, 255, 0.4);
}
.hs-empire-raid-item {
  margin-left: 0.25rem;
  font-weight: 700;
  color: var(--hs-danger-muted);
  font-variant-numeric: tabular-nums;
}

.hs-empire-more,
.hs-empire-quiet {
  padding: 0.2rem 0.35rem;
  font-size: 0.57rem;
  color: rgba(255, 255, 255, 0.3);
}

.hs-empire-empty {
  break-inside: avoid;
  padding: 1.5rem 0.5rem;
  text-align: center;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.35);
}
</style>
