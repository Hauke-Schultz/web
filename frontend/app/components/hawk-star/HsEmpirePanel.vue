<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsOnboardingPanel from '~/components/hawk-star/HsOnboardingPanel.vue'

const emit = defineEmits(['go-planet'])

const { t } = useI18n()
const {
  empireStatus,
  empireAlertCount,
  empireResearch,
  focusPlanetTile,
  homePlanetId,
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
  return { key: 'stateOk', cls: 'ok' }
}

// The jump is the point of the board: set the planet AND the tile, then turn
// the page to the planet view. A finding you cannot act on from where it is
// shown is only half an answer.
const jumpTo = (planetId, slot) => {
  if (!focusPlanetTile(planetId, slot)) return
  emit('go-planet')
}

const alertCount = computed(() => empireAlertCount.value)
</script>

<template>
  <div class="hs-empire">
    <div class="hs-empire-head">
      <span class="hs-empire-icon">🏛️</span>
      <h2 class="hs-empire-title">{{ t('hawkStar.empire.title') }}</h2>
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

    <div class="hs-empire-cards">
      <div
        v-for="p in empireStatus"
        :key="p.planetId"
        class="hs-empire-card"
        :class="`hs-empire-card--${cardTone(p)}`"
      >
        <!-- Head: who this is, and the one-word verdict -->
        <button class="hs-empire-cardhead" @click="jumpTo(p.planetId, 5)">
          <span class="hs-empire-planeticon">{{ planetIcon(p.type) }}</span>
          <span class="hs-empire-planetname">{{ p.name }}</span>
          <span v-if="p.isHome" class="hs-empire-home" :title="t('hawkStar.solar.home')">🏠</span>
          <span class="hs-empire-state" :class="`hs-empire-state--${stateBadge(p).cls}`">
            {{ t('hawkStar.empire.' + stateBadge(p).key) }}
          </span>
        </button>

        <!-- The two meters that decide whether the planet runs and whether it
             is protected. A missing building is a greyed dash, never a gap —
             "this colony has no shield" is the thing worth spotting. -->
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
      </div>

      <!-- Colonies whose state has not arrived yet simply are not here -->
      <div v-if="!empireStatus.length" class="hs-empire-empty">{{ t('hawkStar.empire.loading') }}</div>

      <!-- The early-game guide, as the last card in the grid: the planet cards
           answer "what needs me now", this one answers "what comes next". It is
           a grid item like the rest, so it takes half the width on desktop and
           fills the gap next to an odd number of planets. It removes itself
           once every step is ticked, so a settled empire keeps the board clean. -->
      <HsOnboardingPanel />
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
  overflow-y: auto;
}

.hs-empire-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.15rem;
}
.hs-empire-icon  { font-size: 1.25rem; }
.hs-empire-title { font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0; }
.hs-empire-summary {
  margin-left: auto;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
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

// Four planets at most, so the grid never needs more than two columns to stay
// readable — and one column below 720 px.
.hs-empire-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.6rem;

  @media (min-width: 720px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.hs-empire-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--hs-r-lg);
  border: 1px solid var(--hs-line-md);
  background: var(--hs-glass-sm);
  overflow: hidden;

  &--alarm { border-color: var(--hs-danger-border-card); background: var(--hs-danger-bg-card); }
  &--warn  { border-color: rgba(250, 204, 21, 0.28); }
}

.hs-empire-cardhead {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 0;
  border-bottom: 1px solid var(--hs-line-sm);
  background: var(--hs-glass-xs);
  cursor: pointer;
  text-align: left;

  &:hover { background: var(--hs-glass-lg); }
}
.hs-empire-planeticon { font-size: 1.05rem; line-height: 1; flex: none; }
.hs-empire-planetname {
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hs-empire-home { font-size: 0.65rem; opacity: 0.75; flex: none; }
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
  &--ok    { color: var(--hs-ok-muted);     background: var(--hs-ok-bg-dim); }
}

.hs-empire-meters {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--hs-line-xs);
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
  padding: 1.5rem 0.5rem;
  text-align: center;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.35);
}
</style>
