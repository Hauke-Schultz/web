<script setup>
// ── The standing head of the galaxy side column ───────────────────────────────
// The column used to be empty until a system was picked, which made the landing
// state of the whole view a chart and a hole. What belongs there is the answer
// to the two questions a player actually opens the galaxy with: what have I got
// in the air, and what has been fought lately.
//
// It stays up with a system card open underneath it, not only while nothing is
// selected: both lists are player-wide — a flight and a feud are not properties
// of the system under the cursor — and a fleet three hours from home is the last
// thing that should disappear because you clicked a star to read about it.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsBattleLog from '~/components/hawk-star/HsBattleLog.vue'

const props = defineProps({
  // "Pick a system on the chart" is only true while none is picked. The panel is
  // permanent; the invitation is not.
  showHint: { type: Boolean, default: true },
})

const {
  allFlights,
  planetLabel,
  flightProgress,
  flightRemainingSec,
  recentBattles,
  formatTime,
} = useHawkStar()

const { t } = useI18n()

// Icon and name per kind. The icons are the ones the dock already uses for the
// units themselves, so a pip, a dock row and this list all name the same thing.
const FLIGHT_KIND = {
  recon:      { icon: '🛸',  key: 'flightRecon' },
  colony:     { icon: '🚀',  key: 'flightColony' },
  cargo:      { icon: '📦',  key: 'flightCargo' },
  cargo_back: { icon: '📦',  key: 'flightCargoBack' },
  spy:        { icon: '🕵️', key: 'flightSpy' },
  satellite:  { icon: '📡',  key: 'flightSatellite' },
  raid:       { icon: '⚔️',  key: 'flightRaid' },
  raid_back:  { icon: '⚔️',  key: 'flightRaidBack' },
}

const kindOf = (fl) => FLIGHT_KIND[fl.kind] ?? { icon: '🛰️', key: 'flightRecon' }

// Both ends by name, plus the target's system when the flight actually leaves
// home — inside one system the system name on every row is noise.
const flights = computed(() => allFlights.value.map((fl) => {
  const from = planetLabel(fl.fromPlanetId)
  const to   = planetLabel(fl.toPlanetId)
  const kind = kindOf(fl)
  return {
    ...fl,
    icon:   kind.icon,
    label:  t(`hawkStar.galaxy.${kind.key}`),
    from:   from.planet,
    to:     to.planet,
    system: from.systemId !== to.systemId ? to.system : '',
  }
}))

// A raid is the one flight whose size is part of the news: two corvettes and
// eight corvettes are different events on the same lane.
const isFleet = (fl) => fl.kind === 'raid' || fl.kind === 'raid_back'

const barStyle = (fl) => ({ width: `${Math.round(flightProgress(fl) * 100)}%` })
</script>

<template>
  <div class="hs-galaxy-overview">
    <div class="hs-galaxy-card-header">
      <div>
        <div class="hs-galaxy-card-name">{{ t('hawkStar.galaxy.overviewTitle') }}</div>
        <div v-if="props.showHint" class="hs-galaxy-card-meta">{{ t('hawkStar.galaxy.overviewHint') }}</div>
      </div>
    </div>

    <!-- ── In the air ────────────────────────────────────────────────────────
         Sorted by arrival, so the list reads as a schedule: the top row is the
         next thing that is going to happen to you.
    -->
    <div class="hs-flight-list">
      <div class="hs-flight-list-title">🚀 {{ t('hawkStar.galaxy.flightsTitle') }}</div>

      <div
        v-for="fl in flights"
        :key="fl.id"
        class="hs-flight"
        :class="`hs-flight--${fl.kind}`"
      >
        <span class="hs-flight-icon">{{ fl.icon }}</span>

        <div class="hs-flight-body">
          <div class="hs-flight-head">
            <span class="hs-flight-kind">{{ fl.label }}</span>
            <span v-if="isFleet(fl)" class="hs-flight-ships">🚀 {{ fl.ships }}</span>
            <!-- The order flies sealed, so it is a property of the flight and
                 not something that can still be changed from here. -->
            <span v-if="fl.kind === 'raid'" class="hs-flight-order">
              {{ fl.order === 'plunder' ? '💰' : '⚡' }}
            </span>
            <span class="hs-flight-time">{{ formatTime(flightRemainingSec(fl)) }}</span>
          </div>

          <div class="hs-flight-route">
            <span class="hs-flight-end">{{ fl.from }}</span>
            <span class="hs-flight-arrow">→</span>
            <span class="hs-flight-end hs-flight-end--target">{{ fl.to }}</span>
            <span v-if="fl.system" class="hs-flight-sys">{{ fl.system }}</span>
          </div>

          <div class="hs-flight-bar"><span :style="barStyle(fl)" /></div>
        </div>
      </div>

      <div v-if="!flights.length" class="hs-flight-empty">
        {{ t('hawkStar.galaxy.flightsNone') }}
      </div>
    </div>

    <!-- ── What has been fought ──────────────────────────────────────────────
         The same block the system card carries, only unfiltered: every battle
         from either seat, whoever it was with.
    -->
    <HsBattleLog :entries="recentBattles" show-system />
    <div v-if="!recentBattles.length" class="hs-flight-empty hs-flight-empty--battles">
      ⚔️ {{ t('hawkStar.galaxy.battlesNone') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Same glass card as the system panel it stands in for — this is the column's
// resting state, not a different kind of surface.
.hs-galaxy-overview {
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  padding: 0.625rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hs-galaxy-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.hs-galaxy-card-name { font-size: 0.82rem; font-weight: 700; color: #fff; }
.hs-galaxy-card-meta { font-size: 0.58rem; color: rgba(255,255,255,0.3); margin-top: 1px; }

// ── Flights ───────────────────────────────────────────────────────────────────
.hs-flight-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hs-flight-list-title {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: rgba(255,255,255,0.5);
  margin-bottom: 0.1rem;
}

// Bordered on the left in the colour of what is flying — the same reading the
// battle log uses, and the same colours the chart gives its lanes.
.hs-flight {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  border-radius: var(--hs-r-sm);
  border-left: 2px solid rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.03);

  &--recon      { border-left-color: rgba(125,211,252,0.6); }
  &--colony     { border-left-color: rgba(52,211,153,0.6); }
  &--cargo,
  &--cargo_back { border-left-color: rgba(251,191,36,0.6); }
  &--spy,
  &--satellite  { border-left-color: rgba(167,139,250,0.6); }
  &--raid,
  &--raid_back  { border-left-color: rgba(248,113,113,0.7); }
}

.hs-flight-icon { font-size: 0.75rem; line-height: 1.2; flex: none; }

.hs-flight-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.hs-flight-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem;
  font-size: 0.58rem;
}

.hs-flight-kind  { font-weight: 700; color: rgba(255,255,255,0.85); }
.hs-flight-ships { color: rgba(248,113,113,0.85); font-variant-numeric: tabular-nums; }
.hs-flight-order { font-size: 0.55rem; }

.hs-flight-time {
  margin-left: auto;
  font-size: 0.55rem;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.6);
  white-space: nowrap;
}

.hs-flight-route {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem;
  font-size: 0.52rem;
  color: rgba(255,255,255,0.45);
}

.hs-flight-end          { color: rgba(255,255,255,0.55); }
.hs-flight-end--target  { color: rgba(255,255,255,0.8); font-weight: 600; }
.hs-flight-arrow        { color: rgba(255,255,255,0.3); }
.hs-flight-sys          { color: rgba(255,255,255,0.3); }

// The bar is the only place the flight's own geometry shows up — how far along
// it is, from the server's two timestamps rather than a distance re-derived here.
.hs-flight-bar {
  height: 2px;
  border-radius: 1px;
  background: rgba(255,255,255,0.08);
  overflow: hidden;

  span {
    display: block;
    height: 100%;
    border-radius: 1px;
    background: rgba(255,255,255,0.45);
    transition: width 1s linear;
  }
}

.hs-flight-empty {
  font-size: 0.55rem;
  color: rgba(255,255,255,0.3);
  font-style: italic;
  padding: 0.2rem 0.1rem;

  &--battles {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255,255,255,0.08);
    font-style: normal;
  }
}
</style>
