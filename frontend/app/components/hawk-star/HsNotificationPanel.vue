<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { BUILDINGS } from '~/utils/hawkStarConfig.js'
import { GALAXY_SYSTEMS } from '~/utils/hawkStarGalaxyMock.js'

const { t } = useI18n()

const {
  allPlanetStates,
  notifications,
  dismissNotification,
  now,
  formatTime,
  homeSystem,
} = useHawkStar()

const collapsed = ref(true)

// ── Helpers ────────────────────────────────────────────────
const planetName = (planetId) =>
  allPlanetStates.value[planetId]?.planetName
  ?? homeSystem.value?.planets.find(p => p.id === planetId)?.name
  ?? planetId

const systemName = (systemId) =>
  GALAXY_SYSTEMS.find(s => s.id === systemId)?.name ?? systemId

const pct = (startedAt, endsAt) => {
  if (!startedAt || !endsAt) return 0
  return Math.min(100, Math.max(0, (now.value - startedAt) / (endsAt - startedAt) * 100))
}

const remSec = (endsAt) => Math.max(0, Math.ceil((endsAt - now.value) / 1000))

// ── In-progress items (live, computed from allPlanetStates) ─
const inProgressItems = computed(() => {
  const items = []

  for (const [pid, pstate] of Object.entries(allPlanetStates.value)) {
    const pname = pstate.planetName

    // Buildings
    for (const [bid, bstate] of Object.entries(pstate.buildings ?? {})) {
      if (!bstate.buildEndsAt) continue
      const bDef = BUILDINGS[bid]
      if (!bDef) continue
      const targetLevel = bstate.level + 1
      items.push({
        id:       `prog_bld_${pid}_${bid}`,
        type:     'building',
        icon:     '🏗️',
        title:    t('hawkStar.notifications.buildingTitle', { name: bDef.name, level: targetLevel }),
        subtitle: pname,
        remSec:   remSec(bstate.buildEndsAt),
        pct:      pct(bstate.buildStartedAt, bstate.buildEndsAt),
        priority: 2,
      })
    }

    const dock = pstate.dock
    if (dock) {
      // Ship builds
      const shipBuilds = [
        { key: 'reconDroneBuild',  labelKey: 'hawkStar.notifications.droneBuilding',    icon: '🛸' },
        { key: 'galaxyProbeBuild', labelKey: 'hawkStar.notifications.probeBuilding',    icon: '🔭' },
        { key: 'colonyShipBuild',  labelKey: 'hawkStar.notifications.colonyBuilding',   icon: '🚀' },
        { key: 'warshipBuild',     labelKey: 'hawkStar.notifications.warshipBuilding',  icon: '⚔️' },
        { key: 'freighterBuild',   labelKey: 'hawkStar.notifications.freighterBuilding',icon: '📦' },
      ]
      for (const { key, labelKey, icon } of shipBuilds) {
        const build = dock[key]
        if (!build) continue
        items.push({
          id:       `prog_${key}_${pid}`,
          type:     'ship',
          icon:     '🛠️',
          title:    t(labelKey),
          subtitle: t('hawkStar.notifications.shipDock', { planet: pname }),
          remSec:   remSec(build.endsAt),
          pct:      pct(build.startedAt, build.endsAt),
          priority: 3,
        })
      }

      // Active missions
      for (const m of dock.activeDroneMissions ?? []) {
        items.push({
          id:       `prog_drone_${pid}_${m.planetId}`,
          type:     'mission',
          icon:     '🛸',
          title:    `Recon Drone → ${planetName(m.planetId)}`,
          subtitle: t('hawkStar.notifications.missionFrom', { planet: pname }),
          remSec:   remSec(m.endsAt),
          pct:      pct(m.startedAt, m.endsAt),
          priority: 1,
        })
      }

      for (const m of dock.activeGalaxyProbes ?? []) {
        items.push({
          id:       `prog_probe_${pid}_${m.systemId}`,
          type:     'mission',
          icon:     '🔭',
          title:    `Galaxy Probe → ${systemName(m.systemId)}`,
          subtitle: t('hawkStar.notifications.missionFrom', { planet: pname }),
          remSec:   remSec(m.endsAt),
          pct:      pct(m.startedAt, m.endsAt),
          priority: 1,
        })
      }

      for (const m of dock.activeColonyMissions ?? []) {
        items.push({
          id:       `prog_colony_${pid}_${m.planetId}`,
          type:     'mission',
          icon:     '🚀',
          title:    `Colony Ship → ${planetName(m.planetId)}`,
          subtitle: t('hawkStar.notifications.missionFrom', { planet: pname }),
          remSec:   remSec(m.endsAt),
          pct:      pct(m.startedAt, m.endsAt),
          priority: 1,
        })
      }

      for (const m of dock.activeFreighterMissions ?? []) {
        items.push({
          id:       `prog_freight_${pid}_${m.id}`,
          type:     'mission',
          icon:     '📦',
          title:    `Freighter → ${planetName(m.toPlanetId)}`,
          subtitle: t('hawkStar.notifications.missionFrom', { planet: pname }),
          remSec:   remSec(m.endsAt),
          pct:      pct(m.startedAt, m.endsAt),
          priority: 1,
        })
      }

      // Conversions
      for (const q of pstate.conversionQueues ?? []) {
        const bDef = BUILDINGS[q.buildingId]
        if (!bDef) continue
        const recipe = bDef.conversions?.[q.recipeIndex]
        if (!recipe) continue
        items.push({
          id:       `prog_conv_${pid}_${q.buildingId}_${q.recipeIndex}`,
          type:     'conversion',
          icon:     '⚗️',
          title:    bDef.name,
          subtitle: q.remaining > 0
            ? `${pname} · ${t('hawkStar.notifications.conversionRemaining', { n: q.remaining + 1 })}`
            : pname,
          remSec:   remSec(q.endsAt),
          pct:      null,
          priority: 4,
        })
      }
    }
  }

  items.sort((a, b) => a.priority - b.priority || a.remSec - b.remSec)
  return items
})

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const formatTs = (ts) => {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const doneCount     = computed(() => notifications.value.length)
const progressCount = computed(() => inProgressItems.value.length)
const totalCount    = computed(() => doneCount.value + progressCount.value)
</script>

<template>
  <div class="hs-notif" :class="{ 'hs-notif--empty': totalCount === 0 }">
    <!-- Header -->
    <button class="hs-notif-header" @click="collapsed = !collapsed">
      <span class="hs-notif-title">
        {{ t('hawkStar.notifications.header') }}
        <span v-if="progressCount > 0" class="hs-notif-badge hs-notif-badge--active">{{ progressCount }} {{ t('hawkStar.notifications.badgeActive') }}</span>
        <span v-if="doneCount > 0" class="hs-notif-badge hs-notif-badge--done">{{ doneCount }} {{ t('hawkStar.notifications.badgeDone') }}</span>
      </span>
      <span class="hs-notif-toggle">{{ collapsed ? '▸' : '▾' }}</span>
    </button>

    <div v-if="!collapsed" class="hs-notif-body">
      <!-- Done notifications -->
      <div
        v-for="n in notifications"
        :key="n.id"
        class="hs-notif-item hs-notif-item--done"
      >
        <span class="hs-notif-item-icon">{{ n.icon }}</span>
        <div class="hs-notif-item-text">
          <span class="hs-notif-item-label">{{ n.labelKey ? t(n.labelKey, n.labelParams ?? {}) : n.label }}</span>
          <span class="hs-notif-item-sub">
            {{ n.planetName }}<template v-if="n.details"> · {{ n.details }}</template>
          </span>
          <span class="hs-notif-item-ts">{{ formatTs(n.timestamp) }}</span>
        </div>
        <button class="hs-notif-dismiss" :title="t('hawkStar.notifications.dismiss')" @click="dismissNotification(n.id)">×</button>
      </div>

      <!-- In-progress items -->
      <div
        v-for="item in inProgressItems"
        :key="item.id"
        class="hs-notif-item"
        :class="`hs-notif-item--${item.type}`"
      >
        <span class="hs-notif-item-icon">{{ item.icon }}</span>
        <div class="hs-notif-item-text">
          <span class="hs-notif-item-label">{{ item.title }}</span>
          <span class="hs-notif-item-sub">{{ item.subtitle }}</span>
          <div v-if="item.pct !== null" class="hs-notif-bar">
            <div class="hs-notif-bar-fill" :style="{ width: item.pct + '%' }" />
          </div>
        </div>
        <span class="hs-notif-countdown">{{ formatTime(item.remSec) }}</span>
      </div>

      <!-- Empty state -->
      <div v-if="totalCount === 0" class="hs-notif-empty">
        {{ t('hawkStar.notifications.empty') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-notif {
  width: 100%;
  max-width: 52rem;
  border-radius: var(--hs-r-md, 0.5rem);
  border: 1px solid rgba(100, 130, 220, 0.15);
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
	margin-bottom: 0.875rem;

  &--empty {
    border-color: rgba(100, 130, 220, 0.08);
  }
}

.hs-notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.45rem 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: color 0.15s;

  &:hover { color: rgba(255, 255, 255, 0.8); }
}

.hs-notif-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.hs-notif-toggle {
  font-size: 0.65rem;
  opacity: 0.5;
}

.hs-notif-badge {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  letter-spacing: 0;

  &--active {
    background: rgba(80, 140, 255, 0.15);
    color: rgba(120, 180, 255, 0.9);
    border: 1px solid rgba(80, 140, 255, 0.25);
  }

  &--done {
    background: rgba(80, 220, 120, 0.15);
    color: rgba(80, 220, 120, 0.9);
    border: 1px solid rgba(80, 220, 120, 0.25);
  }
}

.hs-notif-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-top: 1px solid rgba(100, 130, 220, 0.1);
}

.hs-notif-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.1s;

  &:hover { background: rgba(255, 255, 255, 0.04); }

  &--done {
    background: rgba(80, 220, 120, 0.04);
    border-left: 2px solid rgba(80, 220, 120, 0.3);
    padding-left: calc(0.75rem - 2px);
  }

  &--mission {
    border-left: 2px solid rgba(80, 140, 255, 0.3);
    padding-left: calc(0.75rem - 2px);
  }

  &--building {
    border-left: 2px solid rgba(200, 140, 60, 0.4);
    padding-left: calc(0.75rem - 2px);
  }

  &--ship {
    border-left: 2px solid rgba(140, 80, 200, 0.4);
    padding-left: calc(0.75rem - 2px);
  }

  &--conversion {
    border-left: 2px solid rgba(60, 180, 180, 0.4);
    padding-left: calc(0.75rem - 2px);
  }
}

.hs-notif-item-icon {
  font-size: 0.95rem;
  line-height: 1;
  flex-shrink: 0;
}

.hs-notif-item-text {
  display: flex;
	gap: 0 1rem;
	min-width: 0;
	justify-content: space-between;
	align-items: flex-end;
	flex-wrap: wrap;
	width: 100%;
}

.hs-notif-item-label {
  font-size: 0.75rem;
	flex-grow: 2;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hs-notif-item-sub {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.35);
}

.hs-notif-item-ts {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.2);
  font-variant-numeric: tabular-nums;
}

.hs-notif-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
	width: 100%;
}

.hs-notif-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(80, 140, 255, 0.6), rgba(140, 80, 255, 0.6));
  border-radius: 2px;
  transition: width 0.5s linear;
}

.hs-notif-countdown {
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.hs-notif-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.25);
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.1rem;
  flex-shrink: 0;
  transition: color 0.15s;

  &:hover { color: rgba(255, 80, 80, 0.7); }
}

.hs-notif-empty {
  padding: 0.6rem 0.75rem;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.2);
  font-style: italic;
}
</style>
