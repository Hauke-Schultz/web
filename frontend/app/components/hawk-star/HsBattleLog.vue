<script setup>
// ── A list of battles, read from our chair ────────────────────────────────────
// The same block appears twice in the galaxy view: at the foot of a system card
// (every battle fought with the commanders who live there) and on the overview
// panel (the last few battles anywhere). One component, because the entry is a
// dense little thing — direction, outcome, fleet bill, both meters, the haul —
// and two copies of it would drift apart the first time one of them is tuned.
//
// Entries arrive already merged and sorted; this only renders them.
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { RESOURCES } from '~/utils/hawkStarConfig.js'

const props = defineProps({
  entries: { type: Array, default: () => [] },
  // The card already says which system it is. A player-wide list does not, so
  // the planet name alone would be a name with no place attached.
  showSystem: { type: Boolean, default: false },
  title: { type: String, default: '' },
})

const { now } = useHawkStar()
const { t } = useI18n()

// 🎯 our fleet went out, 🛡️ theirs came in. Combined with won/lost this is the
// whole headline: our win, our loss, their win, their loss.
const logIcon = (e) => e.role === 'attacker' ? '🎯' : '🛡️'

// `won` in a report always means the ATTACKER won, so from the defender's chair
// `won: true` is the loss. This is the only place that translation happens.
const logOutcome = (e) => {
  if (e.role === 'attacker') {
    return e.won ? t('hawkStar.galaxy.raidLogWon') : t('hawkStar.galaxy.raidLogFailed')
  }
  return e.won ? t('hawkStar.galaxy.raidLogLost') : t('hawkStar.galaxy.raidLogHeld')
}

const agoLabel = (ts) => {
  const hours = Math.floor((now.value - ts) / 3600000)
  return hours < 1  ? t('hawkStar.galaxy.raidJustNow')
       : hours < 24 ? t('hawkStar.galaxy.raidHoursAgo', { n: hours })
       : t('hawkStar.galaxy.raidDaysAgo', { n: Math.floor(hours / 24) })
}

// Before/after rather than a delta, so the drop itself is visible.
const meter = (before, after) => `${Math.round(before)} → ${Math.round(after)} %`

// A planet with neither generator nor reactor reads 0 → 0 on both meters, which
// is not a measurement but the absence of one. Say so instead of printing zeros.
const hasMeters = (e) => e.shieldBefore > 0 || e.batteryBefore > 0

const lootItems = (e) => Object.entries(e.loot ?? {})
  .filter(([, n]) => n > 0)
  .map(([key, n]) => ({ key, n, icon: RESOURCES[key]?.icon ?? '📦', name: RESOURCES[key]?.name ?? key }))

const heading = () => props.title || t('hawkStar.galaxy.raidLogTitle')
</script>

<template>
  <!-- Always open: it is history, not a control, and that is exactly why it sits
       at the foot of whatever it belongs to. -->
  <div v-if="entries.length" class="hs-raid-log">
    <div class="hs-raid-log-title">⚔️ {{ heading() }}</div>

    <div
      v-for="e in entries"
      :key="e.id"
      class="hs-raid-log-entry"
      :class="[
        e.role === 'attacker' ? 'hs-raid-log-entry--out' : 'hs-raid-log-entry--in',
        { 'hs-raid-log-entry--good': e.role === 'attacker' ? e.won : !e.won },
      ]"
    >
      <div class="hs-raid-log-head">
        <span class="hs-raid-log-icon">{{ logIcon(e) }}</span>
        <span class="hs-raid-log-target">{{ e.planetName }}</span>
        <span v-if="showSystem && e.systemName" class="hs-raid-log-system">{{ e.systemName }}</span>
        <!-- Named on every line: several commanders can share a system, and the
             list does not sit under anybody's row. -->
        <span class="hs-raid-log-foe">{{ e.foePortrait }} {{ e.foeName }}</span>
        <span class="hs-raid-log-outcome">{{ logOutcome(e) }}</span>
        <span class="hs-raid-log-when">{{ agoLabel(e.foughtAt) }}</span>
      </div>

      <div class="hs-raid-log-stats">
        <!-- The fleet's own bill — hulls sent, hulls shot down -->
        <span class="hs-raid-log-stat" :title="t('hawkStar.galaxy.raidLogFleetHint')">
          🚀 {{ e.ships }}<span v-if="e.lost" class="hs-raid-log-loss"> −{{ e.lost }}</span>
        </span>
        <span class="hs-raid-log-stat" :title="t('hawkStar.galaxy.raidLogFirepowerHint')">
          💥 {{ e.firepower }}
        </span>
        <!-- and what it did on the ground -->
        <template v-if="hasMeters(e)">
          <span
            v-if="e.shieldBefore > 0"
            class="hs-raid-log-stat hs-raid-log-stat--shield"
            :title="t('hawkStar.galaxy.raidLogShieldHint')"
          >🛡️ {{ meter(e.shieldBefore, e.shieldAfter) }}</span>
          <span
            v-if="e.batteryBefore > 0"
            class="hs-raid-log-stat hs-raid-log-stat--battery"
            :title="t('hawkStar.galaxy.raidLogBatteryHint')"
          >🔋 {{ meter(e.batteryBefore, e.batteryAfter) }}</span>
        </template>
        <span v-else class="hs-raid-log-stat hs-raid-log-stat--bare">
          {{ t('hawkStar.galaxy.raidLogNoMeters') }}
        </span>
      </div>

      <!-- Booty. A plunder order that came home empty is worth showing too — the
           silo was already bare or on cooldown. -->
      <div v-if="e.order === 'plunder'" class="hs-raid-log-loot">
        <template v-if="lootItems(e).length">
          <span class="hs-raid-log-loot-label">
            {{ e.role === 'attacker'
                ? t('hawkStar.galaxy.raidLogLootGained')
                : t('hawkStar.galaxy.raidLogLootLost') }}
          </span>
          <span
            v-for="item in lootItems(e)"
            :key="item.key"
            class="hs-raid-log-loot-item"
            :title="item.name"
          >{{ item.icon }} {{ item.n }}</span>
        </template>
        <span v-else class="hs-raid-log-loot-empty">
          💰 {{ t('hawkStar.galaxy.raidLogNoLoot') }}
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Separated from whatever sits above it by a rule: it is history, not a control.
// Each entry is bordered on the side that flew — amber on the left for our
// sorties, red for theirs.
.hs-raid-log {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.hs-raid-log-title {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: rgba(255,255,255,0.5);
  margin-bottom: 0.1rem;
}

.hs-raid-log-entry {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.3rem 0.4rem;
  border-radius: var(--hs-r-sm);
  border-left: 2px solid;
  background: rgba(255,255,255,0.03);

  &--out { border-left-color: rgba(251,191,36,0.6); }
  &--in  { border-left-color: rgba(248,113,113,0.6); }
}

.hs-raid-log-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem;
  font-size: 0.58rem;
}

.hs-raid-log-icon   { font-size: 0.62rem; }
.hs-raid-log-target { font-weight: 700; color: rgba(255,255,255,0.85); }
.hs-raid-log-system { color: rgba(255,255,255,0.35); }
.hs-raid-log-foe    { color: rgba(255,255,255,0.45); }

// Green when the fight went our way, whichever chair we sat in — attacking and
// winning, or being attacked and holding.
.hs-raid-log-outcome {
  font-weight: 600;
  color: rgba(248,113,113,0.85);

  .hs-raid-log-entry--good & { color: rgba(52,211,153,0.9); }
}

.hs-raid-log-when {
  margin-left: auto;
  font-size: 0.52rem;
  color: rgba(255,255,255,0.35);
  white-space: nowrap;
}

.hs-raid-log-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: 0.52rem;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.55);
}

.hs-raid-log-stat {
  white-space: nowrap;

  &--shield  { color: rgba(56,189,248,0.8); }
  &--battery { color: rgba(251,191,36,0.8); }
  &--bare    { color: rgba(255,255,255,0.3); font-style: italic; }
}

.hs-raid-log-loss { color: rgba(248,113,113,0.9); font-weight: 700; }

.hs-raid-log-loot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  font-size: 0.52rem;
  font-variant-numeric: tabular-nums;
}

// The same haul is a gain or a loss depending on which fleet carried it off.
.hs-raid-log-loot-item {
  font-weight: 700;
  color: rgba(52,211,153,0.9);

  .hs-raid-log-entry--in & { color: rgba(248,113,113,0.9); }
}

.hs-raid-log-loot-label { color: rgba(255,255,255,0.4); }
.hs-raid-log-loot-empty { color: rgba(255,255,255,0.3); }
</style>
