<script setup>
import { ref, computed, watch } from 'vue'
import { PLANET_TYPES, MOCK_TYPE_TO_PLANET_TYPE, RESOURCES } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const {
	playerName,
	reconDroneLevel, colonyShipLevel,
  playerScannedPlanets, playerColonizedPlanets,
  reconDroneInventory, colonyShipInventory,
  activeDroneMissions,
  canSendDrone, sendReconDrone,
  remainingDroneSec, droneProgressStyle,
  droneFlightTimeBetween,
  activeColonyMissions,
  canSendColonyShip, sendColonyShip,
  remainingColonySec, colonyProgressStyle,
  colonyFlightTimeBetween,
  homeSystem, homePlanetId,
  activePlanetId, setActivePlanet,
  formatTime,
  playerResources,
  // warships
  warshipBayLevel,
  warshipInventory,
  // galaxy probes
  galaxyProbeLevel,
  galaxyProbeInventory,
  // freighters
  freighterInventory,
  activeFreighterMissions,
  freighterCargoCapacity,
  sendFreighter,
  freighterFlightTimeBetween,
  remainingFreighterSec,
  freighterProgressStyle,
  planetHasDock,
} = useHawkStar()

const planets = computed(() => homeSystem.value?.planets ?? [])

const isScanned      = (id) => playerScannedPlanets.value.includes(id)
const isColonized    = (id) => playerColonizedPlanets.value.includes(id)
const isDroneEnRoute = (id) => !!activeDroneMissions.value.find(m => m.planetId === id)
const isColonizing   = (id) => !!activeColonyMissions.value.find(m => m.planetId === id)

const effectivePlanetState = (planet) => {
  if (planet.id === homePlanetId.value || isColonized(planet.id)) return 'own'
  if (isColonizing(planet.id)) return 'colonizing'
  if (isScanned(planet.id)) return planet.state
  if (isDroneEnRoute(planet.id)) return 'scanning'
  return 'unknown'
}

// ── Selection ─────────────────────────────────────────────
const selectedPlanetId = ref(null)

const toggleSelect = (planet) => {
  if (effectivePlanetState(planet) !== 'own') return
  selectedPlanetId.value = selectedPlanetId.value === planet.id ? null : planet.id
  setActivePlanet(planet.id)
}

const selectedIsOwn = computed(() => selectedPlanetId.value !== null)

const tileClass = (planet) => [
  `hs-solar-tile--${effectivePlanetState(planet)}`,
  selectedPlanetId.value === planet.id ? 'hs-solar-tile--selected' : '',
]

const flightTime = (targetPlanetId) =>
  selectedPlanetId.value
    ? droneFlightTimeBetween(selectedPlanetId.value, targetPlanetId)
    : 0

const colonyTime = (targetPlanetId) =>
  selectedPlanetId.value
    ? colonyFlightTimeBetween(selectedPlanetId.value, targetPlanetId)
    : 0

const planetTypeIcon = (mockType) => {
  const key = MOCK_TYPE_TO_PLANET_TYPE[mockType]
  return PLANET_TYPES[key]?.icon ?? '🪐'
}
const STAR_CLASS_LABEL = { G: 'Yellow Dwarf', K: 'Orange Dwarf', M: 'Red Dwarf', F: 'White Star' }

const STATE_COLOR = {
  own: '#60a5fa', uncolonized: '#6b7280', enemy: '#f87171', ally: '#34d399',
}
const STATE_LABEL = {
  own: 'Colony', uncolonized: 'Free', enemy: 'Enemy', ally: 'Allied',
}

const planetIcon = (planet) => {
  const state = effectivePlanetState(planet)
  if (state === 'colonizing') return '🚀'
  if (state === 'scanning')   return '🛸'
  if (state === 'unknown')    return '❓'
  return planetTypeIcon(planet.type)
}

// ── Freighter helpers ────────────────────────────────────────────────────────
const CARGO_EXCLUDED = ['population', 'energy']

const freighterCargo = ref({})

const loadableResources = computed(() =>
  Object.values(RESOURCES).filter(r =>
    !CARGO_EXCLUDED.includes(r.id) && (playerResources.value[r.id] ?? 0) > 0
  )
)

const freighterCargoTotal = computed(() =>
  Object.values(freighterCargo.value).reduce((s, v) => s + (Number(v) || 0), 0)
)

const cargoMax  = (resId) => Math.min(Math.floor(playerResources.value[resId] ?? 0), freighterCargoCapacity.value)
const cargoStep = (resId) => cargoMax(resId) >= 20 ? 10 : 1
const stepCargo = (resId, delta) => {
  const cur       = freighterCargo.value[resId] ?? 0
  const remaining = freighterCargoCapacity.value - freighterCargoTotal.value
  const step      = delta > 0 ? Math.min(cargoStep(resId), remaining) : cargoStep(resId)
  freighterCargo.value[resId] = Math.min(Math.max(0, cur + delta * step), cargoMax(resId))
}

const isFreighterEnRoute = (planetId) =>
  activeFreighterMissions.value.some(m => m.toPlanetId === planetId || m.fromPlanetId === planetId)

const ownedPlanets = computed(() =>
  (homeSystem.value?.planets ?? []).filter(p =>
    p.id === homePlanetId.value || playerColonizedPlanets.value.includes(p.id)
  )
)

const freighterDest = ref(null)

// ── Dock panel tab ────────────────────────────────────────────────────────────
const dockTab = ref(null)

const doSendFreighter = () => {
  if (!freighterDest.value) return
  const cargo = Object.fromEntries(
    Object.entries(freighterCargo.value).filter(([, v]) => v > 0)
  )
  sendFreighter(activePlanetId.value, freighterDest.value, cargo)
  freighterDest.value  = null
  freighterCargo.value = {}
}
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
        @click="toggleSelect(planet)"
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

        <!-- Freighter en-route indicator -->
        <div
          v-else-if="isFreighterEnRoute(planet.id)"
          class="hs-solar-progress-bar hs-solar-progress-bar--freighter"
        />

        <!-- Icon -->
        <span class="hs-solar-tile-icon">{{ planetIcon(planet) }}</span>

        <!-- Name -->
        <span class="hs-solar-tile-name">
          {{ planet.name }}
        </span>

        <!-- Own / colonized -->
        <template v-if="effectivePlanetState(planet) === 'own'">
          <span class="hs-solar-tile-state" :style="{ color: STATE_COLOR.own }">
            {{ playerName }}
          </span>
	        <span v-if="planet.id === activePlanetId" class="hs-solar-active-tag">active</span>
          <span v-if="planet.slots !== null" class="hs-solar-tile-slots">{{ planet.slots }} slots</span>
          <!-- Unit counts when selected -->
          <div v-if="selectedPlanetId === planet.id" class="hs-solar-tile-units">
            <span v-if="reconDroneLevel > 0">🛸 {{ reconDroneInventory }}</span>
            <span v-if="colonyShipLevel > 0">🚀 {{ colonyShipInventory }}</span>
          </div>
          <!-- Dock indicator -->
          <span v-if="planetHasDock(planet.id)" class="hs-solar-tile-dock">🛠</span>
          <!-- Incoming freighter missions -->
          <div
            v-for="m in activeFreighterMissions.filter(m => m.toPlanetId === planet.id)"
            :key="m.id"
            class="hs-solar-tile-freighter-mission"
          >
            <div class="hs-solar-tile-freighter-bar">
              <div class="hs-solar-tile-freighter-bar-fill" :style="freighterProgressStyle(m.id)" />
            </div>
            <span class="hs-solar-tile-freighter-timer">🚢 {{ formatTime(remainingFreighterSec(m.id)) }}</span>
          </div>
          <!-- Freighter destination button -->
          <button
            v-if="freighterInventory > 0 && planet.id !== activePlanetId && planetHasDock(planet.id)"
            class="hs-freighter-dest-btn"
            :class="{ 'hs-freighter-dest-btn--active': freighterDest === planet.id }"
            @click.stop="freighterDest = freighterDest === planet.id ? null : planet.id"
          >{{ freighterDest === planet.id ? '✓ Ziel' : 'Ziel' }}</button>
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
          <!-- Colonize button: only visible when a base is selected -->
          <template v-if="selectedIsOwn && canSendColonyShip(planet.id)">
            <button
              class="hs-solar-action-btn hs-solar-action-btn--colony"
              @click.stop="sendColonyShip(planet.id, selectedPlanetId)"
            >🚀 Colonize</button>
            <span class="hs-solar-tile-flight-time">{{ formatTime(colonyTime(planet.id)) }}</span>
          </template>
          <span
            v-else-if="selectedIsOwn && planet.state === 'uncolonized' && colonyShipLevel > 0 && colonyShipInventory === 0"
            class="hs-solar-tile-hint"
          >build colony ship</span>
        </template>

        <!-- Drone en route -->
        <template v-else-if="isDroneEnRoute(planet.id)">
          <span class="hs-solar-tile-scanning-label">Drone en route…</span>
          <span class="hs-solar-tile-timer">{{ formatTime(remainingDroneSec(planet.id)) }}</span>
        </template>

        <!-- Unknown: send drone button only visible when a base is selected -->
        <template v-else>
          <span class="hs-solar-tile-unknown-label">Unknown</span>
          <template v-if="selectedIsOwn && canSendDrone(planet.id)">
            <button
              class="hs-solar-action-btn hs-solar-action-btn--drone"
              @click.stop="sendReconDrone(planet.id, selectedPlanetId)"
            >🛸 Send Drone</button>
            <span class="hs-solar-tile-flight-time">{{ formatTime(flightTime(planet.id)) }}</span>
          </template>
        </template>

      </div>
    </div>

    <!-- ── Dock Panel ────────────────────────────────────────────────────── -->
    <div
      v-if="reconDroneLevel > 0 || galaxyProbeLevel > 0 || colonyShipLevel > 0 || warshipBayLevel > 0 || freighterInventory > 0"
      class="hs-dock-panel"
    >
      <!-- Left: navigation -->
      <nav class="hs-dock-nav">
        <button
          v-if="reconDroneLevel > 0 || galaxyProbeLevel > 0 || colonyShipLevel > 0"
          class="hs-dock-nav-item"
          :class="{ 'hs-dock-nav-item--active': dockTab === 'probes' }"
          @click="dockTab = dockTab === 'probes' ? null : 'probes'"
        >
          <span class="hs-dock-nav-icon">🛸</span>
          <span class="hs-dock-nav-label">Sonden</span>
          <span class="hs-dock-nav-count">{{ reconDroneInventory + galaxyProbeInventory + colonyShipInventory }}</span>
        </button>
        <button
          v-if="freighterInventory > 0"
          class="hs-dock-nav-item"
          :class="{ 'hs-dock-nav-item--active': dockTab === 'freighter' }"
          @click="dockTab = dockTab === 'freighter' ? null : 'freighter'"
        >
          <span class="hs-dock-nav-icon">🚢</span>
          <span class="hs-dock-nav-label">Frachter</span>
          <span class="hs-dock-nav-count">{{ freighterInventory }}</span>
        </button>
        <button
          v-if="warshipBayLevel > 0"
          class="hs-dock-nav-item"
          :class="{ 'hs-dock-nav-item--active': dockTab === 'warship' }"
          @click="dockTab = dockTab === 'warship' ? null : 'warship'"
        >
          <span class="hs-dock-nav-icon">⚔️</span>
          <span class="hs-dock-nav-label">Krieg</span>
          <span class="hs-dock-nav-count">{{ warshipInventory }}</span>
        </button>
      </nav>

      <!-- Right: detail -->
      <div v-if="dockTab" class="hs-dock-detail">

        <!-- Sonden & Schiffe -->
        <template v-if="dockTab === 'probes'">
          <span class="hs-dock-detail-title">Sonden & Schiffe</span>
          <div class="hs-dock-unit-list">
            <div v-if="reconDroneLevel > 0" class="hs-dock-unit-row">
              <span class="hs-dock-unit-icon">🛸</span>
              <span class="hs-dock-unit-name">Recon Drone</span>
              <span class="hs-dock-unit-count">{{ reconDroneInventory }}</span>
            </div>
            <div v-if="galaxyProbeLevel > 0" class="hs-dock-unit-row">
              <span class="hs-dock-unit-icon">🔭</span>
              <span class="hs-dock-unit-name">Galaxy Probe</span>
              <span class="hs-dock-unit-count">{{ galaxyProbeInventory }}</span>
            </div>
            <div v-if="colonyShipLevel > 0" class="hs-dock-unit-row">
              <span class="hs-dock-unit-icon">🚀</span>
              <span class="hs-dock-unit-name">Colony Ship</span>
              <span class="hs-dock-unit-count">{{ colonyShipInventory }}</span>
            </div>
          </div>
        </template>

        <!-- Frachter Cargo Panel -->
        <template v-else-if="dockTab === 'freighter'">
          <div class="hs-freighter-cargo-header">
            <span class="hs-freighter-cargo-title">🚢 Frachter beladen</span>
            <span class="hs-freighter-cargo-cap" :class="freighterCargoTotal > freighterCargoCapacity ? 'hs-freighter-cargo-cap--over' : ''">{{ freighterCargoTotal }} / {{ freighterCargoCapacity }}</span>
          </div>
          <div v-if="loadableResources.length === 0" class="hs-freighter-cargo-empty">Keine Ressourcen verfügbar</div>
          <div class="hs-freighter-cargo-grid">
            <div v-for="res in loadableResources" :key="res.id" class="hs-freighter-cargo-tile" :class="{ 'hs-freighter-cargo-tile--loaded': (freighterCargo[res.id] ?? 0) > 0 }">
              <span class="hs-freighter-cargo-tile__icon">{{ res.icon }}</span>
              <div class="hs-freighter-cargo-tile__info">
                <span class="hs-freighter-cargo-tile__name">{{ res.name }}</span>
                <span class="hs-freighter-cargo-tile__avail">{{ Math.floor(playerResources[res.id] ?? 0) }}</span>
              </div>
              <div class="hs-stepper hs-stepper--cargo">
                <button class="hs-stepper__btn" :disabled="(freighterCargo[res.id] ?? 0) <= 0" @click.stop="stepCargo(res.id, -1)">−</button>
                <span class="hs-stepper__val">{{ freighterCargo[res.id] ?? 0 }}</span>
                <button class="hs-stepper__btn" :disabled="(freighterCargo[res.id] ?? 0) >= cargoMax(res.id) || freighterCargoTotal >= freighterCargoCapacity" @click.stop="stepCargo(res.id, 1)">+</button>
              </div>
            </div>
          </div>
          <div class="hs-freighter-dest-row">
            <button
              v-for="p in ownedPlanets.filter(op => op.id !== activePlanetId && planetHasDock(op.id))"
              :key="p.id"
              class="hs-freighter-dest-btn"
              :class="{ 'hs-freighter-dest-btn--active': freighterDest === p.id }"
              @click="freighterDest = freighterDest === p.id ? null : p.id"
            >{{ p.name }}</button>
          </div>
          <button v-if="freighterDest" class="hs-freighter-send-btn" @click="doSendFreighter">
            🚀 Absenden → {{ ownedPlanets.find(p => p.id === freighterDest)?.name }}
            ({{ formatTime(freighterFlightTimeBetween(activePlanetId, freighterDest)) }})
          </button>
        </template>

        <!-- Warship Fleet -->
        <template v-else-if="dockTab === 'warship'">
          <span class="hs-dock-detail-title">Kriegsflotte</span>
          <div class="hs-dock-unit-list">
            <div class="hs-dock-unit-row">
              <span class="hs-dock-unit-icon">⚔️</span>
              <span class="hs-dock-unit-name">Hawk Frigate</span>
              <span class="hs-dock-unit-count">{{ warshipInventory }}</span>
            </div>
          </div>
        </template>

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
  &--own         { border-color: rgba(96,165,250,0.25); cursor: pointer; }
  &--enemy       { border-color: rgba(248,113,113,0.2); background: rgba(248,113,113,0.04); }
  &--ally        { border-color: rgba(52,211,153,0.2); }
  &--uncolonized { border-color: var(--hs-line-lg); }
  &--unknown     { border-color: rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
  &--scanning    { border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.04); }
  &--colonizing  { border-color: rgba(96,165,250,0.3); background: rgba(96,165,250,0.04); }

  &--selected {
    outline: 2px solid rgba(96,165,250,0.55);
    outline-offset: -1px;
    background: rgba(96,165,250,0.07);
  }
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

  &--drone     { background: rgba(251,191,36,0.5); }
  &--colony   { background: rgba(96,165,250,0.5); }
  &--freighter { background: rgba(52,211,153,0.4); }
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

.hs-solar-active-tag {
  font-size: 0.48rem;
  background: rgba(52,211,153,0.25);
  color: #34d399;
  border: 1px solid rgba(52,211,153,0.4);
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

.hs-solar-tile-dock {
  font-size: 0.65rem;
  line-height: 1;
  opacity: 0.7;
}

.hs-solar-tile-freighter-mission {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.hs-solar-tile-freighter-bar {
  position: relative;
  width: 100%;
  height: 2px;
  background: rgba(255,255,255,0.08);
  border-radius: 1px;
  overflow: hidden;
}

.hs-solar-tile-freighter-bar-fill {
  position: absolute;
  inset: 0;
  background: rgba(52,211,153,0.5);
  transform-origin: left;
  animation: hs-bar-fill linear forwards;
}

.hs-solar-tile-freighter-timer {
  font-size: 0.48rem;
  color: rgba(52,211,153,0.85);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
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

.hs-solar-tile-units {
  display: flex;
  gap: 0.35rem;
  margin-top: 2px;
  font-size: 0.5rem;
  color: rgba(255,255,255,0.55);
  font-weight: 600;
}

.hs-solar-tile-flight-time {
  font-size: 0.48rem;
  color: rgba(251,191,36,0.65);
  font-variant-numeric: tabular-nums;
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

// ── Dock panel ────────────────────────────────────────────────────────────────
.hs-dock-panel {
  display: flex;
  flex-direction: row;
  background: var(--hs-glass-sm);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--hs-r-md);
  overflow: hidden;
  min-height: 4rem;
}

.hs-dock-nav {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid rgba(255,255,255,0.07);
}

.hs-dock-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.55rem 0.6rem;
  cursor: pointer;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.4);
  transition: background 0.15s, color 0.15s;
  min-width: 3.75rem;

  &:last-child { border-bottom: none; }
  &:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7); }
  &--active { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); }
}

.hs-dock-nav-icon { font-size: 0.95rem; line-height: 1; }

.hs-dock-nav-label {
  font-size: 0.48rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hs-dock-nav-count {
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.hs-dock-detail {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hs-dock-detail-title {
  font-size: 0.58rem;
  font-weight: 700;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hs-dock-unit-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.hs-dock-unit-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.hs-dock-unit-icon { font-size: 0.8rem; line-height: 1; }

.hs-dock-unit-name {
  flex: 1;
  font-size: 0.58rem;
  color: rgba(255,255,255,0.55);
}

.hs-dock-unit-count {
  font-size: 0.65rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.8);
}

// ── Freighter cargo (now inside dock detail) ───────────────────────────────────

.hs-freighter-cargo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hs-freighter-cargo-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
}

.hs-freighter-cargo-cap {
  font-size: 0.65rem;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.35);

  &--over { color: var(--hs-danger); }
}

.hs-freighter-cargo-empty {
  font-size: 0.68rem;
  opacity: 0.3;
  font-style: italic;
  text-align: center;
  padding: 0.4rem 0;
}

.hs-freighter-cargo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.375rem;
}

.hs-freighter-cargo-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0.4rem 0.3rem 0.35rem;
  background: var(--hs-glass-lg);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-sm);
  transition: border-color 0.15s, background 0.15s;

  &--loaded {
    border-color: rgba(52,211,153,0.4);
    background: rgba(52,211,153,0.07);
  }
}

.hs-freighter-cargo-tile__icon { font-size: 1.05rem; line-height: 1; }

.hs-freighter-cargo-tile__info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.hs-freighter-cargo-tile__name {
  font-size: 0.52rem;
  opacity: 0.45;
  text-transform: capitalize;
  line-height: 1;
  text-align: center;
}

.hs-freighter-cargo-tile__avail {
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

// ── Stepper control ───────────────────────────────────────────────────────────
.hs-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--hs-line-sm);
  border-radius: 6px;
  overflow: hidden;

  &--cargo {
    width: 100%;
    margin-top: 2px;
    border-color: rgba(52,211,153,0.25);
  }
}

.hs-stepper__btn {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hs-glass-lg);
  border: none;
  color: rgba(255,255,255,0.7);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  user-select: none;

  &:hover:not(:disabled) { background: var(--hs-glass-xl); color: #fff; }
  &:disabled { opacity: 0.25; cursor: not-allowed; }
}

.hs-stepper__val {
  flex: 1;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: var(--hs-glass-sm);
  padding: 0 2px;
  line-height: 1.5rem;
  min-width: 1.5rem;
}

// ── Freighter dest row + send ─────────────────────────────────────────────────
.hs-freighter-dest-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.hs-freighter-dest-btn {
  padding: 2px 8px;
  border-radius: var(--hs-r-sm);
  font-size: 0.52rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.55);
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.25); }

  &--active {
    border-color: rgba(52,211,153,0.5);
    background: rgba(52,211,153,0.1);
    color: rgba(52,211,153,0.95);
  }
}

.hs-freighter-send-btn {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: var(--hs-r-sm);
  font-size: 0.52rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(52,211,153,0.4);
  background: rgba(52,211,153,0.1);
  color: rgba(52,211,153,0.95);
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(52,211,153,0.2); border-color: rgba(52,211,153,0.7); }
}

</style>
