<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TILE_TYPES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsAllResourcePanel from "~/components/hawk-star/HsAllResourcePanel.vue";

const props = defineProps({
  activePanel: { type: String, default: null },
})
const emit = defineEmits(['update:activePanel'])

const { t } = useI18n()

const {
  playerName,
  planetName,
  planetType,
  PLANET_TYPES,
  playerSlots,
  activeSlot,
  selectSlot,
  slotsOnSlot,
  unlockRequirement,
  getLevel,
  homePlanetId,
  activePlanetId,
  allPlanetStates,
  notifications,
  now,
  planetHasDock,
} = useHawkStar()

const currentPlanetType = computed(() => PLANET_TYPES[planetType.value])

// ── Panel tile counts ─────────────────────────────────────────────────────────
const inProgressCount = computed(() => {
  let count = 0
  for (const [_pid, pstate] of Object.entries(allPlanetStates.value)) {
    for (const bstate of Object.values(pstate.buildings ?? {})) {
      if (bstate.buildEndsAt) count++
    }
    const dock = pstate.dock
    if (dock) {
      const shipKeys = ['reconDroneBuild','galaxyProbeBuild','colonyShipBuild','warshipBuild','freighterBuild']
      for (const key of shipKeys) { if (dock[key]) count++ }
      count += (dock.activeDroneMissions?.length ?? 0)
      count += (dock.activeGalaxyProbes?.length ?? 0)
      count += (dock.activeColonyMissions?.length ?? 0)
      count += (dock.activeFreighterMissions?.length ?? 0)
    }
    count += (pstate.conversionQueues?.length ?? 0)
  }
  return count
})

const doneCount    = computed(() => notifications.value.length)
const dockUnlocked = computed(() => planetHasDock(activePlanetId.value))

// ── Unified selection ─────────────────────────────────────────────────────────
const togglePanel = (panel) => {
  if (panel === 'dock' && !dockUnlocked.value) return
  activeSlot.value = null
  emit('update:activePanel', props.activePanel === panel ? null : panel)
}

const onSelectSlot = (slot) => {
  selectSlot(slot)
  emit('update:activePanel', null)
}
</script>

<template>
  <div class="hs-planet-wrap">
    <div class="hs-grid">

      <!-- Panel tiles (row 1) -->
      <div
        class="hs-tile"
        :class="{ 'hs-tile--active': activePanel === 'notifications', 'hs-tile--unlocked': activePanel !== 'notifications' }"
        @click="togglePanel('notifications')"
      >
        <div class="hs-tile-main">
          <span class="hs-tile-icon">🔔</span>
          <span class="hs-tile-label">{{ t('hawkStar.panel.tabActivity') }}</span>
        </div>
        <div class="hs-tile-dots">
          <span v-if="inProgressCount > 0" class="hs-notif-badge hs-notif-badge--active">{{ inProgressCount }}</span>
          <span v-if="doneCount > 0" class="hs-notif-badge hs-notif-badge--done">{{ doneCount }}</span>
        </div>
      </div>

<div
        class="hs-tile"
        :class="{
          'hs-tile--active':   activePanel === 'dock',
          'hs-tile--unlocked': dockUnlocked && activePanel !== 'dock',
          'hs-tile--locked':   !dockUnlocked,
        }"
        @click="togglePanel('dock')"
      >
        <div class="hs-tile-main">
          <span class="hs-tile-icon">🚀</span>
          <span class="hs-tile-label">{{ t('hawkStar.panel.tabDock') }}</span>
        </div>
        <div class="hs-tile-dots">
          <span v-if="!dockUnlocked" class="hs-tile-lock">🔒</span>
        </div>
      </div>

      <!-- Planet slots (rows 2–4) -->
      <div
        v-for="slot in playerSlots"
        :key="slot.slot"
        class="hs-tile"
        :class="{
          'hs-tile--locked':   !slot.unlocked,
          'hs-tile--active':   slot.unlocked && activeSlot === slot.slot,
          'hs-tile--unlocked': slot.unlocked && activeSlot !== slot.slot,
        }"
        @click="onSelectSlot(slot)"
      >
        <div class="hs-tile-main">
          <span class="hs-tile-icon">
            {{ slot.unlocked && slot.tileType ? TILE_TYPES[slot.tileType]?.icon : (slot.unlocked ? '?' : '🔒') }}
          </span>
          <span class="hs-tile-label">
            {{ slot.unlocked && slot.tileType ? TILE_TYPES[slot.tileType]?.name : '???' }}
          </span>
        </div>
        <div class="hs-tile-dots">
          <template v-if="!slot.unlocked && unlockRequirement(slot.slot)">
            <span
              class="hs-tile-unlock"
              :class="getLevel(unlockRequirement(slot.slot).building.id) >= unlockRequirement(slot.slot).level ? 'hs-tile-unlock--done' : ''"
              :title="`Build ${unlockRequirement(slot.slot).building.name} to Level ${unlockRequirement(slot.slot).level}`"
            >{{ unlockRequirement(slot.slot).building.icon }} Lv{{ unlockRequirement(slot.slot).level }}</span>
          </template>
          <span
            v-for="b in slotsOnSlot(slot.slot)"
            :key="b.id"
            class="hs-dot"
            :class="b.building ? 'hs-dot--building' : b.offline ? 'hs-dot--offline' : 'hs-dot--done'"
          />
        </div>
      </div>

    </div>
    <HsAllResourcePanel />
  </div>
</template>

<style lang="scss" scoped>
.hs-planet-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  @media (min-width: 640px) {
    flex-shrink: 0;
  }
}

.hs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  width: 100%;

  @media (min-width: 640px) {
    width: 320px;
  }
}

.hs-tile {
  border-radius: var(--hs-r-md);
  border: 1px solid transparent;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;

  &--locked {
    background: var(--hs-glass-xs);
    border-color: var(--hs-line-xs);
    cursor: not-allowed;
  }

  &--unlocked {
    background: var(--hs-glass-xl);
    border-color: var(--hs-line-xl);

    &:hover { background: var(--hs-glass-4xl); }
  }

  &--active {
    background: var(--hs-active-bg);
    border-color: var(--hs-active-border);
    box-shadow: 0 0 20px var(--hs-active-glow);
  }
}

.hs-tile-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.hs-tile-icon  { font-size: 1.25rem; line-height: 1; }
.hs-tile-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.04em; opacity: 0.7; }

.hs-tile-unlock {
  font-size: 0.55rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
  background: var(--hs-glass-lg);
  border: 1px solid var(--hs-line-lg);
  border-radius: 4px;
  padding: 1px 5px;
  white-space: nowrap;

  &--done {
    color: var(--hs-ok);
    border-color: var(--hs-ok-border);
    background: var(--hs-ok-bg-dim);
  }
}

.hs-tile-dots {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  min-width: 8px;
}

.hs-tile-lock { font-size: 0.65rem; opacity: 0.6; }

.hs-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;

  &--done     { background: var(--hs-ok); }
  &--building { background: var(--hs-warn); animation: pulse 1.2s ease-in-out infinite; }
  &--offline  { background: var(--hs-danger); animation: pulse 1.5s ease-in-out infinite; }
}

.hs-notif-badge {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.1rem 0.3rem;
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

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
</style>
