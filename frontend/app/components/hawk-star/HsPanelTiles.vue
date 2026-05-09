<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'

const props = defineProps({
  activePanel: { type: String, default: null },
})
const emit = defineEmits(['update:activePanel'])

const { t } = useI18n()
const {
  allPlanetStates,
  notifications,
  now,
  activePlanetId,
  planetHasDock,
  homeSystem,
} = useHawkStar()

const remSec = (endsAt) => Math.max(0, Math.ceil((endsAt - now.value) / 1000))

const inProgressCount = computed(() => {
  let count = 0
  for (const [pid, pstate] of Object.entries(allPlanetStates.value)) {
    for (const bstate of Object.values(pstate.buildings ?? {})) {
      if (bstate.buildEndsAt) count++
    }
    const dock = pstate.dock
    if (dock) {
      const shipKeys = ['reconDroneBuild','colonyShipBuild']
      for (const key of shipKeys) { if (dock[key]) count++ }
      count += (dock.activeDroneMissions?.length ?? 0)
      count += (dock.activeColonyMissions?.length ?? 0)
    }
    count += (pstate.conversionQueues?.length ?? 0)
  }
  return count
})

const doneCount = computed(() => notifications.value.length)

const dockUnlocked = computed(() => planetHasDock(activePlanetId.value))

const toggle = (panel) => {
  if (panel === 'dock' && !dockUnlocked.value) return
  emit('update:activePanel', props.activePanel === panel ? null : panel)
}
</script>

<template>
  <div class="hs-panel-tiles">

    <div
      class="hs-tile"
      :class="{ 'hs-tile--active': activePanel === 'notifications', 'hs-tile--unlocked': activePanel !== 'notifications' }"
      @click="toggle('notifications')"
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
      :class="{ 'hs-tile--active': activePanel === 'settings', 'hs-tile--unlocked': activePanel !== 'settings' }"
      @click="toggle('settings')"
    >
      <div class="hs-tile-main">
        <span class="hs-tile-icon">⚙️</span>
        <span class="hs-tile-label">{{ t('hawkStar.panel.tabSettings') }}</span>
      </div>
      <div class="hs-tile-dots" />
    </div>

    <div
      class="hs-tile"
      :class="{
        'hs-tile--active':   activePanel === 'dock',
        'hs-tile--unlocked': dockUnlocked && activePanel !== 'dock',
        'hs-tile--locked':   !dockUnlocked,
      }"
      @click="toggle('dock')"
    >
      <div class="hs-tile-main">
        <span class="hs-tile-icon">🚀</span>
        <span class="hs-tile-label">{{ t('hawkStar.panel.tabDock') }}</span>
      </div>
      <div class="hs-tile-dots">
        <span v-if="!dockUnlocked" class="hs-tile-lock">🔒</span>
      </div>
    </div>

  </div>
</template>

<style lang="scss" scoped>
.hs-panel-tiles {
  display: flex;
  gap: 0.375rem;
  width: 100%;
  margin-bottom: 0.5rem;
}

.hs-tile {
  flex: 1;
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

.hs-tile-dots {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  min-width: 8px;
}

.hs-tile-lock { font-size: 0.65rem; opacity: 0.6; }

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
</style>
