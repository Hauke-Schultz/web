<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TILE_TYPES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const props = defineProps({
  activePanel: { type: String, default: null },
})
const emit = defineEmits(['update:activePanel'])

const { t } = useI18n()

const {
  planetName,
  planetType,
  PLANET_TYPES,
  playerSlots,
  activeSlot,
  activePlanetId,
  homePlanetId,
  selectSlot,
  slotsOnSlot,
  unlockRequirement,
  getLevel,
  allPlanetStates,
  notifications,
  playerPortrait,
  playerName,
  batteryCharge,
  gridDown,
  recruitPool,
  recruitPoolMax,
  shieldCharge,
  hasAnomaly,
} = useHawkStar()

const currentPlanetType = computed(() => PLANET_TYPES[planetType.value])

// The base tile marks itself as the home base — that is where the onboarding
// checklist lives, and a colony's base tile stays a plain "Base".
const isHomePlanet = computed(() => activePlanetId.value === homePlanetId.value)

const tileLabel = (slot) => {
  if (!slot.unlocked || !slot.tileType) return '???'
  if (slot.tileType === 'base' && isHomePlanet.value) return 'Home Base'
  return TILE_TYPES[slot.tileType]?.name
}

// Top-edge status bar per tile: battery % on the energy tile, recruit pool on
// base, shield strength on defense. Only the shield also prints its number —
// it fades slowly and costs crystal to top up, so the exact value is what
// decides whether a click is worth it right now.
const tileStatus = (slot) => {
  if (!slot.unlocked) return null
  if (slot.tileType === 'energy' && getLevel('power_plant') > 0) {
    const pct = Math.round(batteryCharge.value ?? 0)
    return { kind: gridDown.value ? 'empty' : pct < 20 ? 'low' : 'battery', pct }
  }
  if (slot.tileType === 'base') {
    const max = recruitPoolMax.value || 1
    return { kind: 'recruit', pct: Math.min(100, ((recruitPool.value ?? 0) / max) * 100) }
  }
  // null while the planet has no finished shield generator
  if (slot.tileType === 'defense' && shieldCharge.value != null) {
    const pct = Math.round(shieldCharge.value)
    return {
      kind:    pct <= 0 ? 'shield-empty' : pct < 20 ? 'shield-low' : 'shield',
      pct,
      showPct: true,
    }
  }
  return null
}

// ── Panel tile counts ─────────────────────────────────────────────────────────
const inProgressCount = computed(() => {
  let count = 0
  for (const [_pid, pstate] of Object.entries(allPlanetStates.value)) {
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

const dockInfo = computed(() => {
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return { inventory: [], dots: [] }

  const ship = (count, building) => ({ count: count ?? 0, building: !!building })
  const inventory = []
  if ((dock.reconDroneInventory  ?? 0) > 0 || dock.reconDroneBuild)  inventory.push({ icon: '🛸', ...ship(dock.reconDroneInventory,  dock.reconDroneBuild) })
  if ((dock.colonyShipInventory  ?? 0) > 0 || dock.colonyShipBuild)  inventory.push({ icon: '🚀', ...ship(dock.colonyShipInventory,  dock.colonyShipBuild) })

  const missions = (dock.activeDroneMissions?.length    ?? 0)
                 + (dock.activeColonyMissions?.length    ?? 0)
  const dots = Array.from({ length: missions }, () => 'mission')

  return { inventory, dots }
})

// ── Unified selection ─────────────────────────────────────────────────────────
const togglePanel = (panel) => {
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
	    <!-- Planet info tile -->
	    <div
		    class="hs-tile"
		    :class="{
					'hs-tile--active': activePanel === 'resources',
					'hs-tile--unlocked': activePanel !== 'resources',
					[`hs-tile-type--${planetType}`]: true
				}"
		    @click="togglePanel('resources')"
	    >
		    <div class="hs-tile-main">
			    <span class="hs-tile-icon">{{ currentPlanetType?.icon ?? '🪐' }}</span>
			    <span class="hs-tile-label">{{ planetName }}</span>
		    </div>
		    <div class="hs-tile-dots" />
	    </div>

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

      <!-- Profile tile -->
      <div
        class="hs-tile hs-tile--profile"
        :class="{ 'hs-tile--active': activePanel === 'profile', 'hs-tile--unlocked': activePanel !== 'profile' }"
        @click="togglePanel('profile')"
      >
        <div class="hs-tile-main hs-tile-main--profile">
          <span class="hs-tile-icon">{{ playerPortrait }}</span>
          <div class="hs-tile-profile-info">
            <span class="hs-tile-label">{{ playerName || '—' }}</span>
          </div>
        </div>
        <div class="hs-tile-dots" />
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
        <div
          v-if="tileStatus(slot)"
          class="hs-tile-bar"
          :class="`hs-tile-bar--${tileStatus(slot).kind}`"
        >
          <div class="hs-tile-bar__fill" :style="{ width: tileStatus(slot).pct + '%' }" />
          <span v-if="tileStatus(slot).showPct" class="hs-tile-bar__pct">
            {{ tileStatus(slot).pct }}%
          </span>
        </div>
        <div class="hs-tile-main">
          <span class="hs-tile-icon">
            {{ slot.unlocked && slot.tileType ? TILE_TYPES[slot.tileType]?.icon : (slot.unlocked ? '?' : '🔒') }}
          </span>
          <span class="hs-tile-label">
            {{ tileLabel(slot) }}
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
          <template v-else-if="slot.tileType === 'dock'">
            <span
              v-for="item in dockInfo.inventory"
              :key="item.icon"
              class="hs-dock-inv"
              :class="{ 'hs-dock-inv--building': item.building }"
            >{{ item.icon }}{{ item.count }}</span>
            <span
              v-for="(type, i) in dockInfo.dots"
              :key="'d' + i"
              class="hs-dot"
              :class="type === 'building' ? 'hs-dot--building' : 'hs-dot--mission'"
            />
          </template>
          <!-- The anomaly tile holds no buildings — the dot means "something is waiting" -->
          <template v-else-if="slot.tileType === 'anomaly'">
            <span v-if="hasAnomaly" class="hs-dot hs-dot--anomaly" />
          </template>
          <template v-else>
            <span
              v-for="b in slotsOnSlot(slot.slot)"
              :key="b.id"
              class="hs-dot"
              :class="b.building ? 'hs-dot--building' : b.offline ? 'hs-dot--offline' : 'hs-dot--done'"
            />
          </template>
        </div>
      </div>

    </div>
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
  position: relative;
  overflow: hidden;
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

  &--empty {
    background: transparent;
    border-color: transparent;
    cursor: default;
    pointer-events: none;
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

// Top-edge status bar (battery / recruit pool)
.hs-tile-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  z-index: 1;
  pointer-events: none;
}
.hs-tile-bar__fill {
  height: 100%;
  transition: width 0.4s ease, background 0.3s ease;
  background: #10b981;
}
.hs-tile-bar--low     .hs-tile-bar__fill { background: #f59e0b; }
.hs-tile-bar--recruit .hs-tile-bar__fill { background: #a78bfa; }

// Empty battery: fill is 0 %, so pulse the whole bar red to signal the blackout.
.hs-tile-bar--empty {
  background: rgba(239, 68, 68, 0.5);
  animation: pulse 1.5s ease-in-out infinite;
}

// Shield — same blue as HsShieldPanel. An empty shield is NOT a blackout (it has
// no side effect on the planet), so it stays a plain red bar and never pulses.
.hs-tile-bar--shield       .hs-tile-bar__fill { background: #38bdf8; }
.hs-tile-bar--shield-low   .hs-tile-bar__fill { background: #f59e0b; }
.hs-tile-bar--shield-empty { background: rgba(239, 68, 68, 0.35); }

.hs-tile-bar__pct {
  position: absolute;
  top: 5px;
  right: 5px;
  font-size: 0.5rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.5);
}
.hs-tile-bar--shield       .hs-tile-bar__pct { color: rgba(186, 230, 253, 0.75); }
.hs-tile-bar--shield-low   .hs-tile-bar__pct { color: rgba(253, 230, 138, 0.85); }
.hs-tile-bar--shield-empty .hs-tile-bar__pct { color: rgba(252, 165, 165, 0.9); }

.hs-tile-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.hs-tile-profile-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.hs-tile-profile-disp {
  font-size: 0.52rem;
  font-weight: 600;
  white-space: nowrap;
  text-transform: capitalize;

  &--friendly { color: #34d399; }
  &--neutral  { color: #94a3b8; }
  &--hostile  { color: #f87171; }
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

.hs-tile-type {
  font-size: 0.6rem;
	line-height: 1;
  white-space: nowrap;

  &--terrestrial { color: #86efac; border-color: rgba(134,239,172,0.35); background: rgba(134,239,172,0.08); }
  &--volcanic    { color: #fca5a5; border-color: rgba(252,165,165,0.35); background: rgba(252,165,165,0.08); }
  &--frozen      { color: #93c5fd; border-color: rgba(147,197,253,0.35); background: rgba(147,197,253,0.08); }
  &--ocean       { color: #67e8f9; border-color: rgba(103,232,249,0.35); background: rgba(103,232,249,0.08); }
}

.hs-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;

  &--done     { background: var(--hs-ok); }
  &--building { background: var(--hs-warn); animation: pulse 1.2s ease-in-out infinite; }
  &--offline  { background: var(--hs-danger); animation: pulse 1.5s ease-in-out infinite; }
  &--mission  { background: #60a5fa; animation: pulse 1.4s ease-in-out infinite; }
  &--anomaly  { background: #818cf8; animation: pulse 1.1s ease-in-out infinite; }
}

.hs-dock-inv {
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;

  &--building {
    color: var(--hs-warn);
    animation: pulse 1.2s ease-in-out infinite;
  }
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
