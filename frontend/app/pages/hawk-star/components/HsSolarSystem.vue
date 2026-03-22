<script setup>
import { ref, computed } from 'vue'
import { PLANET_TYPES, MOCK_TYPE_TO_PLANET_TYPE, RESOURCES, UNIT_COSTS } from '../hawkStarConfig.js'
import { useHawkStar } from '../useHawkStar.js'

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
  // freighters
  freighterBayLevel,
  freighterInventory,
  freighterBuild,
  activeFreighterMissions,
  freighterBuildTime,
  freighterCargoCapacity,
  canBuildFreighter,
  buildFreighter,
  sendFreighter,
  freighterFlightTimeBetween,
  remainingFreighterSec,
  freighterProgressStyle,
  freighterBuildProgressStyle,
  getPlanetName,
  getPlanetResources,
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
const TRANSPORTABLE = Object.keys(RESOURCES).filter(r => r !== 'energy' && r !== 'population')

const freighterDest  = ref(null)   // selected destination planet id
const freighterCargo = ref({})     // { resourceId: amount }

// Reset cargo when source or destination changes
const selectFreighterDest = (planetId) => {
  freighterDest.value  = planetId
  freighterCargo.value = {}
}

const freighterCargoTotal = computed(() =>
  Object.values(freighterCargo.value).reduce((a, b) => a + b, 0)
)

const sourcePlanetResources = computed(() =>
  selectedPlanetId.value ? getPlanetResources(selectedPlanetId.value) : {}
)

const transportableResources = computed(() =>
  TRANSPORTABLE.filter(r => Math.floor(sourcePlanetResources.value[r] ?? 0) > 0)
)

const maxForResource = (res) => {
  const available = Math.floor(sourcePlanetResources.value[res] ?? 0)
  const currentOther = Object.entries(freighterCargo.value)
    .filter(([r]) => r !== res)
    .reduce((a, [, v]) => a + v, 0)
  return Math.min(available, freighterCargoCapacity.value - currentOther)
}

const clampCargo = (res) => {
  const max = maxForResource(res)
  if ((freighterCargo.value[res] ?? 0) > max) {
    freighterCargo.value[res] = max
  }
}

const isFreighterEnRoute = (planetId) =>
  activeFreighterMissions.value.some(m => m.toPlanetId === planetId || m.fromPlanetId === planetId)

const doSendFreighter = () => {
  if (!freighterDest.value) return
  const cargo = Object.fromEntries(
    Object.entries(freighterCargo.value).filter(([, v]) => v > 0)
  )
  sendFreighter(selectedPlanetId.value, freighterDest.value, cargo)
  freighterDest.value  = null
  freighterCargo.value = {}
}

const ownedPlanets = computed(() =>
  (homeSystem.value?.planets ?? []).filter(p =>
    p.id === homePlanetId.value || playerColonizedPlanets.value.includes(p.id)
  )
)

const freighterMissionsForPlanet = (planetId) =>
  activeFreighterMissions.value.filter(m => m.fromPlanetId === planetId || m.toPlanetId === planetId)

const cargoSummary = (cargo) =>
  Object.entries(cargo)
    .filter(([, v]) => v > 0)
    .map(([r, v]) => `${RESOURCES[r]?.icon ?? r} ${v}`)
    .join(' ')
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

    <!-- ── Freighter Panel ──────────────────────────────────────────────── -->
    <div v-if="freighterBayLevel > 0" class="hs-freighter-panel">

      <!-- Header row -->
      <div class="hs-freighter-header">
        <span class="hs-freighter-title">🚢 Frachter</span>
        <span class="hs-freighter-count">{{ freighterInventory }} verfügbar</span>

        <!-- Build button -->
        <button
          v-if="canBuildFreighter"
          class="hs-freighter-build-btn"
          @click="buildFreighter"
        >Bauen {{ formatTime(freighterBuildTime) }}</button>

        <!-- Build in progress -->
        <template v-else-if="freighterBuild">
          <div class="hs-freighter-build-bar">
            <div class="hs-freighter-build-bar-fill" :style="freighterBuildProgressStyle" />
          </div>
          <span class="hs-freighter-build-timer">{{ formatTime(Math.max(0, Math.ceil((freighterBuild.endsAt - Date.now()) / 1000))) }}</span>
        </template>

        <!-- Can't afford -->
        <span v-else class="hs-freighter-build-hint">
          Kosten: ⚙️ {{ UNIT_COSTS.freighter.cost.metal }} 💎 {{ UNIT_COSTS.freighter.cost.crystal }}
        </span>
      </div>

      <!-- Active missions -->
      <div
        v-for="m in activeFreighterMissions"
        :key="m.id"
        class="hs-freighter-mission"
      >
        <div class="hs-freighter-mission-bar">
          <div class="hs-freighter-mission-bar-fill" :style="freighterProgressStyle(m.id)" />
        </div>
        <span class="hs-freighter-mission-route">
          🚢 {{ getPlanetName(m.fromPlanetId) }} → {{ getPlanetName(m.toPlanetId) }}
        </span>
        <span class="hs-freighter-mission-timer">{{ formatTime(remainingFreighterSec(m.id)) }}</span>
        <span class="hs-freighter-mission-cargo">{{ cargoSummary(m.cargo) }}</span>
      </div>

      <!-- New mission form (when an own planet is selected + freighter available) -->
      <div
        v-if="selectedPlanetId && freighterInventory > 0"
        class="hs-freighter-new"
      >
        <div class="hs-freighter-new-title">
          Neuer Flug von <strong>{{ getPlanetName(selectedPlanetId) }}</strong>
        </div>

        <!-- Destination picker -->
        <div class="hs-freighter-dest-row">
          <span class="hs-freighter-label">Ziel:</span>
          <button
            v-for="p in ownedPlanets.filter(p => p.id !== selectedPlanetId)"
            :key="p.id"
            class="hs-freighter-dest-btn"
            :class="{ 'hs-freighter-dest-btn--active': freighterDest === p.id }"
            @click="selectFreighterDest(p.id)"
          >{{ p.name }}</button>
        </div>

        <!-- Cargo selection -->
        <template v-if="freighterDest">
          <div class="hs-freighter-capacity">
            Fracht: {{ freighterCargoTotal }} / {{ freighterCargoCapacity }}
          </div>

          <div
            v-for="res in transportableResources"
            :key="res"
            class="hs-freighter-cargo-row"
          >
            <span class="hs-freighter-cargo-icon">{{ RESOURCES[res].icon }}</span>
            <span class="hs-freighter-cargo-name">{{ RESOURCES[res].name }}</span>
            <span class="hs-freighter-cargo-avail">{{ Math.floor(sourcePlanetResources[res] ?? 0) }}</span>
            <input
              class="hs-freighter-cargo-input"
              type="number"
              min="0"
              :max="maxForResource(res)"
              :value="freighterCargo[res] ?? 0"
              @input="freighterCargo[res] = Math.min(Math.max(0, Number($event.target.value)), maxForResource(res)); clampCargo(res)"
            />
          </div>

          <div v-if="transportableResources.length === 0" class="hs-freighter-empty-hint">
            Keine transportierbaren Rohstoffe auf diesem Planeten.
          </div>

          <button
            v-if="freighterCargoTotal > 0"
            class="hs-freighter-send-btn"
            @click="doSendFreighter"
          >
            🚀 Absenden → {{ getPlanetName(freighterDest) }}
            ({{ formatTime(freighterFlightTimeBetween(selectedPlanetId, freighterDest)) }})
          </button>
        </template>
      </div>

      <div v-else-if="freighterBayLevel > 0 && freighterInventory === 0 && !freighterBuild" class="hs-freighter-hint">
        Baue einen Frachter, um Rohstoffe zwischen Kolonien zu transportieren.
      </div>
      <div v-else-if="freighterBayLevel > 0 && freighterInventory > 0 && !selectedPlanetId" class="hs-freighter-hint">
        Wähle einen eigenen Planeten aus, um einen Frachter zu beladen.
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

// ── Freighter panel ───────────────────────────────────────────────────────────
.hs-freighter-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid rgba(52,211,153,0.18);
  border-radius: var(--hs-r-md);
  padding: 0.625rem 0.75rem;
}

.hs-freighter-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.hs-freighter-title {
  font-size: 0.65rem;
  font-weight: 700;
  color: rgba(52,211,153,0.9);
}

.hs-freighter-count {
  font-size: 0.58rem;
  color: rgba(255,255,255,0.55);
  font-variant-numeric: tabular-nums;
}

.hs-freighter-build-btn {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: var(--hs-r-sm);
  font-size: 0.52rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(52,211,153,0.35);
  background: rgba(52,211,153,0.08);
  color: rgba(52,211,153,0.9);
  &:hover { background: rgba(52,211,153,0.18); border-color: rgba(52,211,153,0.6); }
}

.hs-freighter-build-bar {
  margin-left: auto;
  position: relative;
  width: 80px;
  height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  overflow: hidden;
}

.hs-freighter-build-bar-fill {
  position: absolute;
  inset: 0;
  background: rgba(52,211,153,0.5);
  transform-origin: left;
  animation: hs-bar-fill linear forwards;
}

.hs-freighter-build-timer {
  font-size: 0.5rem;
  color: rgba(52,211,153,0.8);
  font-variant-numeric: tabular-nums;
}

.hs-freighter-build-hint {
  margin-left: auto;
  font-size: 0.48rem;
  color: rgba(255,255,255,0.25);
}

// Active mission row
.hs-freighter-mission {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  background: rgba(52,211,153,0.04);
  border: 1px solid rgba(52,211,153,0.12);
  border-radius: var(--hs-r-sm);
  overflow: hidden;
}

.hs-freighter-mission-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: 100%;
  background: rgba(255,255,255,0.05);
}

.hs-freighter-mission-bar-fill {
  position: absolute;
  inset: 0;
  background: rgba(52,211,153,0.45);
  transform-origin: left;
  animation: hs-bar-fill linear forwards;
}

.hs-freighter-mission-route {
  font-size: 0.55rem;
  color: rgba(255,255,255,0.7);
  flex: 1;
}

.hs-freighter-mission-timer {
  font-size: 0.52rem;
  color: rgba(52,211,153,0.85);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.hs-freighter-mission-cargo {
  font-size: 0.48rem;
  color: rgba(255,255,255,0.35);
}

// New mission form
.hs-freighter-new {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--hs-r-sm);
}

.hs-freighter-new-title {
  font-size: 0.55rem;
  color: rgba(255,255,255,0.55);

  strong { color: rgba(255,255,255,0.8); }
}

.hs-freighter-dest-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.hs-freighter-label {
  font-size: 0.52rem;
  color: rgba(255,255,255,0.4);
}

.hs-freighter-dest-btn {
  padding: 2px 7px;
  border-radius: var(--hs-r-sm);
  font-size: 0.5rem;
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

.hs-freighter-capacity {
  font-size: 0.52rem;
  color: rgba(255,255,255,0.45);
  font-variant-numeric: tabular-nums;
}

.hs-freighter-cargo-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.hs-freighter-cargo-icon {
  font-size: 0.75rem;
  line-height: 1;
  width: 1rem;
  text-align: center;
}

.hs-freighter-cargo-name {
  flex: 1;
  font-size: 0.52rem;
  color: rgba(255,255,255,0.6);
}

.hs-freighter-cargo-avail {
  font-size: 0.48rem;
  color: rgba(255,255,255,0.3);
  font-variant-numeric: tabular-nums;
  min-width: 2rem;
  text-align: right;
}

.hs-freighter-cargo-input {
  width: 4rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: var(--hs-r-sm);
  color: rgba(255,255,255,0.85);
  font-size: 0.52rem;
  padding: 2px 5px;
  text-align: right;
  font-variant-numeric: tabular-nums;

  &:focus {
    outline: none;
    border-color: rgba(52,211,153,0.4);
  }

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button { opacity: 1; }
}

.hs-freighter-send-btn {
  align-self: flex-start;
  margin-top: 0.2rem;
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

.hs-freighter-empty-hint,
.hs-freighter-hint {
  font-size: 0.5rem;
  color: rgba(255,255,255,0.22);
  font-style: italic;
}

</style>
