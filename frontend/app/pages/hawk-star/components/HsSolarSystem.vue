<script setup>
import { computed } from 'vue'
import { GALAXY_SYSTEMS } from '../hawkStarGalaxyMock.js'
import { useHawkStar } from '../useHawkStar.js'

const {
  reconDroneLevel, colonyShipLevel,
  playerScannedPlanets, playerColonizedPlanets,
  reconDroneInventory, reconDroneBuild,
  activeDroneMissions, droneBuildTime,
  canBuildDrone, buildReconDrone,
  canSendDrone, sendReconDrone,
  remainingDroneSec, droneProgressStyle, droneBuildProgressStyle,
  colonyShipInventory, colonyShipBuild,
  activeColonyMissions, colonyShipBuildTime,
  canBuildColonyShip, buildColonyShip,
  canSendColonyShip, sendColonyShip,
  remainingColonySec, colonyProgressStyle, colonyShipBuildProgressStyle,
  formatTime, UNIT_COSTS,
} = useHawkStar()

const homeSystem = computed(() => GALAXY_SYSTEMS.find(s => s.home))
const planets    = computed(() => homeSystem.value?.planets ?? [])

const isScanned    = (id) => playerScannedPlanets.value.includes(id)
const isColonized  = (id) => playerColonizedPlanets.value.includes(id)
const isDroneEnRoute = (id) => !!activeDroneMissions.value.find(m => m.planetId === id)
const isColonizing   = (id) => !!activeColonyMissions.value.find(m => m.planetId === id)

// Effective state per planet
const effectivePlanetState = (planet) => {
  if (planet.isHome || isColonized(planet.id)) return 'own'
  if (isColonizing(planet.id)) return 'colonizing'
  if (isScanned(planet.id)) return planet.state
  if (isDroneEnRoute(planet.id)) return 'scanning'
  return 'unknown'
}

const tileClass = (planet) => `hs-solar-tile--${effectivePlanetState(planet)}`

const PLANET_TYPE_ICON = { rock: '🪨', gas: '🌀', ice: '🧊', lava: '🌋', ocean: '🌊' }
const STAR_CLASS_LABEL = { G: 'Yellow Dwarf', K: 'Orange Dwarf', M: 'Red Dwarf', F: 'White Star' }

const STATE_COLOR = {
  own: '#60a5fa', uncolonized: '#6b7280', enemy: '#f87171', ally: '#34d399',
}
const STATE_LABEL = {
  own: 'Colony', uncolonized: 'Free', enemy: 'Enemy', ally: 'Allied',
}

const planetIcon = (planet) => {
  const state = effectivePlanetState(planet)
  if (state === 'own')       return PLANET_TYPE_ICON[planet.type] ?? '🪐'
  if (state === 'colonizing') return '🚀'
  if (state === 'scanning')   return '🛸'
  if (state === 'unknown')    return '❓'
  // scanned
  return PLANET_TYPE_ICON[planet.type] ?? '🪐'
}

const droneBuildCost = UNIT_COSTS.recon_drone.cost
const colonyBuildCost = UNIT_COSTS.colony_ship.cost
</script>

<template>
  <div class="hs-solar">
    <div class="hs-solar-orbit">

      <!-- Sun tile -->
      <div class="hs-solar-tile hs-solar-tile--sun">
        <span class="hs-solar-tile-icon">☀️</span>
        <span class="hs-solar-tile-name">{{ homeSystem?.name }}</span>
        <span class="hs-solar-tile-sub">{{ STAR_CLASS_LABEL[homeSystem?.starClass] ?? homeSystem?.starClass }}</span>
      </div>

      <!-- Orbit connector (desktop only) -->
      <div class="hs-solar-connector" aria-hidden="true" />

      <!-- Planet tiles -->
      <div
        v-for="planet in planets"
        :key="planet.id"
        class="hs-solar-tile"
        :class="tileClass(planet)"
      >
        <!-- Drone flight progress bar -->
        <div
          v-if="isDroneEnRoute(planet.id)"
          class="hs-solar-progress-bar hs-solar-progress-bar--drone"
          :style="droneProgressStyle(planet.id)"
        />

        <!-- Colony ship flight progress bar -->
        <div
          v-else-if="isColonizing(planet.id)"
          class="hs-solar-progress-bar hs-solar-progress-bar--colony"
          :style="colonyProgressStyle(planet.id)"
        />

        <!-- Icon -->
        <span class="hs-solar-tile-icon">{{ planetIcon(planet) }}</span>

        <!-- Name -->
        <span class="hs-solar-tile-name">
          {{ planet.name }}
          <span v-if="planet.isHome" class="hs-solar-home-tag">home</span>
        </span>

        <!-- Own / colonized -->
        <template v-if="effectivePlanetState(planet) === 'own'">
          <span class="hs-solar-tile-state" :style="{ color: STATE_COLOR.own }">
            {{ STATE_LABEL.own }}
          </span>
          <span v-if="planet.slots !== null" class="hs-solar-tile-slots">{{ planet.slots }} slots</span>
        </template>

        <!-- Colony ship en route -->
        <template v-else-if="isColonizing(planet.id)">
          <span class="hs-solar-tile-scanning-label" style="color: rgba(96,165,250,0.8)">Colonizing…</span>
          <span class="hs-solar-tile-timer">{{ formatTime(remainingColonySec(planet.id)) }}</span>
        </template>

        <!-- Scanned but not (yet) own -->
        <template v-else-if="isScanned(planet.id)">
          <span class="hs-solar-tile-state" :style="{ color: STATE_COLOR[planet.state] }">
            {{ STATE_LABEL[planet.state] }}
          </span>
          <span v-if="planet.owner" class="hs-solar-tile-owner">{{ planet.owner }}</span>
          <!-- Colonize button for free planets -->
          <button
            v-if="canSendColonyShip(planet.id)"
            class="hs-solar-action-btn hs-solar-action-btn--colony"
            @click="sendColonyShip(planet.id)"
          >🚀 Colonize</button>
          <span
            v-else-if="planet.state === 'uncolonized' && colonyShipLevel > 0 && colonyShipInventory === 0"
            class="hs-solar-tile-hint"
          >build colony ship</span>
        </template>

        <!-- Drone en route -->
        <template v-else-if="isDroneEnRoute(planet.id)">
          <span class="hs-solar-tile-scanning-label">Drone en route…</span>
          <span class="hs-solar-tile-timer">{{ formatTime(remainingDroneSec(planet.id)) }}</span>
        </template>

        <!-- Unknown: send drone or hint -->
        <template v-else>
          <span class="hs-solar-tile-unknown-label">Unknown</span>
          <button
            v-if="canSendDrone(planet.id)"
            class="hs-solar-action-btn hs-solar-action-btn--drone"
            @click="sendReconDrone(planet.id)"
          >🛸 Send Drone</button>
          <span v-else-if="reconDroneLevel === 0" class="hs-solar-tile-hint">needs Space Base</span>
          <span v-else-if="reconDroneInventory === 0" class="hs-solar-tile-hint">no drones</span>
          <span v-else class="hs-solar-tile-hint">busy</span>
        </template>

      </div>
    </div>

    <!-- Status bar: Drone section -->
    <div class="hs-solar-status">

      <!-- Drone hangar -->
      <div
        class="hs-solar-status-item"
        :class="reconDroneLevel > 0 ? 'hs-solar-status--active' : 'hs-solar-status--locked'"
      >
        <span>🛸 Drones</span>
        <span class="hs-solar-status-sub">
          <template v-if="reconDroneLevel === 0">Space Base needed</template>
          <template v-else>{{ reconDroneInventory }} ready</template>
        </span>
        <!-- Build drone button -->
        <button
          v-if="reconDroneLevel > 0 && !reconDroneBuild"
          class="hs-solar-build-btn"
          :class="{ 'hs-solar-build-btn--disabled': !canBuildDrone }"
          :disabled="!canBuildDrone"
          @click="buildReconDrone"
        >
          Build ({{ droneBuildCost.metal }}⚙️ {{ droneBuildCost.crystal }}💎 · {{ formatTime(droneBuildTime) }})
        </button>
        <!-- Building in progress -->
        <span v-else-if="reconDroneBuild" class="hs-solar-building-indicator">
          <span class="hs-solar-build-bar" :style="droneBuildProgressStyle" />
          Building…
        </span>
      </div>

      <!-- Active drone missions -->
      <div
        v-if="activeDroneMissions.length > 0"
        class="hs-solar-status-item hs-solar-status--scanning"
      >
        🛸 {{ activeDroneMissions.length }} mission{{ activeDroneMissions.length > 1 ? 's' : '' }} active
      </div>

      <!-- Colony ship dock -->
      <div
        class="hs-solar-status-item"
        :class="colonyShipLevel > 0 ? 'hs-solar-status--active' : 'hs-solar-status--locked'"
      >
        <span>🚀 Colony Ships</span>
        <span class="hs-solar-status-sub">
          <template v-if="colonyShipLevel === 0">Space Base needed</template>
          <template v-else>{{ colonyShipInventory }} ready</template>
        </span>
        <!-- Build ship button -->
        <button
          v-if="colonyShipLevel > 0 && !colonyShipBuild"
          class="hs-solar-build-btn"
          :class="{ 'hs-solar-build-btn--disabled': !canBuildColonyShip }"
          :disabled="!canBuildColonyShip"
          @click="buildColonyShip"
        >
          Build ({{ colonyBuildCost.metal }}⚙️ {{ colonyBuildCost.crystal }}💎 · {{ formatTime(colonyShipBuildTime) }})
        </button>
        <!-- Building in progress -->
        <span v-else-if="colonyShipBuild" class="hs-solar-building-indicator">
          <span class="hs-solar-build-bar hs-solar-build-bar--colony" :style="colonyShipBuildProgressStyle" />
          Building…
        </span>
      </div>

    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-solar {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

// ── Orbit row ────────────────────────────────────────────────────────────────
.hs-solar-orbit {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.375rem;

  @media (min-width: 640px) {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 0;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}

// ── Orbit connector line (desktop only) ─────────────────────────────────────
.hs-solar-connector {
  display: none;

  @media (min-width: 640px) {
    display: block;
    flex-shrink: 0;
    width: 1.25rem;
    align-self: center;
    height: 1px;
    background: linear-gradient(to right, rgba(253,230,138,0.4), rgba(255,255,255,0.1));
  }
}

// ── Tiles ────────────────────────────────────────────────────────────────────
.hs-solar-tile {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0.5rem 0.375rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);

  @media (min-width: 640px) {
    flex-shrink: 0;
    width: 5.5rem;
    padding: 0.625rem 0.375rem;
  }

  &--sun         { border-color: rgba(253,230,138,0.3); background: rgba(253,230,138,0.05); }
  &--own         { border-color: rgba(96,165,250,0.25); }
  &--enemy       { border-color: rgba(248,113,113,0.2); background: rgba(248,113,113,0.04); }
  &--ally        { border-color: rgba(52,211,153,0.2); }
  &--uncolonized { border-color: var(--hs-line-lg); }
  &--unknown     { border-color: rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
  &--scanning    { border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.04); }
  &--colonizing  { border-color: rgba(96,165,250,0.3); background: rgba(96,165,250,0.04); }
}

// ── Progress bars ────────────────────────────────────────────────────────────
.hs-solar-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: 100%;
  transform-origin: left;
  animation: hs-bar-fill linear forwards;

  &--drone  { background: rgba(251,191,36,0.5); }
  &--colony { background: rgba(96,165,250,0.5); }
}

@keyframes hs-bar-fill {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

// ── Tile content ─────────────────────────────────────────────────────────────
.hs-solar-tile-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.hs-solar-tile-name {
  font-size: 0.58rem;
  font-weight: 600;
  color: rgba(255,255,255,0.8);
  text-align: center;
  line-height: 1.3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hs-solar-home-tag {
  font-size: 0.48rem;
  background: var(--hs-accent);
  color: #fff;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 700;
}

.hs-solar-tile-sub {
  font-size: 0.52rem;
  color: rgba(253,230,138,0.5);
  text-align: center;
}

.hs-solar-tile-state {
  font-size: 0.52rem;
  font-weight: 600;
  text-align: center;
}

.hs-solar-tile-owner,
.hs-solar-tile-slots {
  font-size: 0.5rem;
  color: rgba(255,255,255,0.28);
  text-align: center;
}

.hs-solar-tile-unknown-label {
  font-size: 0.52rem;
  color: rgba(255,255,255,0.2);
  font-style: italic;
}

.hs-solar-tile-scanning-label {
  font-size: 0.52rem;
  color: rgba(251,191,36,0.7);
}

.hs-solar-tile-timer {
  font-size: 0.52rem;
  color: rgba(251,191,36,0.9);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.hs-solar-tile-hint {
  font-size: 0.48rem;
  color: rgba(255,255,255,0.15);
  font-style: italic;
}

// ── Action buttons on tiles ───────────────────────────────────────────────────
.hs-solar-action-btn {
  margin-top: 1px;
  padding: 2px 6px;
  border-radius: var(--hs-r-sm);
  font-size: 0.5rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;

  &--drone {
    border: 1px solid rgba(251,191,36,0.35);
    background: rgba(251,191,36,0.08);
    color: rgba(251,191,36,0.85);
    &:hover { background: rgba(251,191,36,0.18); border-color: rgba(251,191,36,0.6); }
  }

  &--colony {
    border: 1px solid rgba(96,165,250,0.35);
    background: rgba(96,165,250,0.08);
    color: rgba(96,165,250,0.9);
    &:hover { background: rgba(96,165,250,0.18); border-color: rgba(96,165,250,0.6); }
  }
}

// ── Status bar ───────────────────────────────────────────────────────────────
.hs-solar-status {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: flex-start;
}

.hs-solar-status-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding: 0.3rem 0.625rem;
  border-radius: var(--hs-r-md);
  border: 1px solid var(--hs-line-lg);
  background: var(--hs-glass-sm);
  font-size: 0.62rem;
  font-weight: 600;

  &.hs-solar-status--active   { border-color: rgba(96,165,250,0.3); color: rgba(255,255,255,0.8); }
  &.hs-solar-status--locked   { color: rgba(255,255,255,0.25); font-style: italic; }
  &.hs-solar-status--scanning { border-color: rgba(251,191,36,0.35); color: rgba(251,191,36,0.85); }
}

.hs-solar-status-sub {
  font-size: 0.55rem;
  font-weight: 400;
  opacity: 0.6;
}

// ── Build button in status bar ────────────────────────────────────────────────
.hs-solar-build-btn {
  padding: 2px 8px;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(251,191,36,0.35);
  background: rgba(251,191,36,0.08);
  color: rgba(251,191,36,0.85);
  font-size: 0.52rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: rgba(251,191,36,0.18);
    border-color: rgba(251,191,36,0.6);
  }

  &--disabled, &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

// ── Build-in-progress indicator ───────────────────────────────────────────────
.hs-solar-building-indicator {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 2px 8px;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(251,191,36,0.25);
  background: rgba(251,191,36,0.05);
  font-size: 0.52rem;
  color: rgba(251,191,36,0.7);
  font-style: italic;
}

.hs-solar-build-bar {
  position: absolute;
  bottom: 0; left: 0;
  height: 2px; width: 100%;
  background: rgba(251,191,36,0.5);
  transform-origin: left;
  animation: hs-bar-fill linear forwards;

  &--colony { background: rgba(96,165,250,0.5); }
}
</style>
