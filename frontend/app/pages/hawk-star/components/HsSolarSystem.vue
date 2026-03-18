<script setup>
import { computed } from 'vue'
import { GALAXY_SYSTEMS } from '../hawkStarGalaxyMock.js'
import { useHawkStar } from '../useHawkStar.js'

const {
  reconDroneLevel, colonyShipLevel,
  playerScannedPlanets, activeScan, remainingScanSec, scanProgressStyle,
  startScan, formatTime,
} = useHawkStar()

const homeSystem = computed(() => GALAXY_SYSTEMS.find(s => s.home))
const planets    = computed(() => homeSystem.value?.planets ?? [])

const isScanned   = (id) => playerScannedPlanets.value.includes(id)
const isScanning  = (id) => activeScan.value?.planetId === id
const canScan     = (id) => reconDroneLevel.value > 0 && !activeScan.value && !isScanned(id)

// Tile modifier class
const tileClass = (planet) => {
  if (planet.isHome || isScanned(planet.id)) return `hs-solar-tile--${planet.state}`
  if (isScanning(planet.id))                 return 'hs-solar-tile--scanning'
  return 'hs-solar-tile--unknown'
}

const PLANET_TYPE_ICON = { rock: '🪨', gas: '🌀', ice: '🧊', lava: '🌋', ocean: '🌊' }
const STAR_CLASS_LABEL = { G: 'Yellow Dwarf', K: 'Orange Dwarf', M: 'Red Dwarf', F: 'White Star' }

const STATE_COLOR = {
  own: '#60a5fa', uncolonized: '#6b7280', enemy: '#f87171', ally: '#34d399',
}
const STATE_LABEL = {
  own: 'Colony', uncolonized: 'Free', enemy: 'Enemy', ally: 'Allied',
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
      >
        <!-- Scanning progress bar -->
        <div
          v-if="isScanning(planet.id)"
          class="hs-solar-scan-bar"
          :style="scanProgressStyle"
        />

        <!-- Icon -->
        <span class="hs-solar-tile-icon">
          {{ planet.isHome || isScanned(planet.id) ? (PLANET_TYPE_ICON[planet.type] ?? '🪐') : (isScanning(planet.id) ? '🔭' : '❓') }}
        </span>

        <!-- Name -->
        <span class="hs-solar-tile-name">
          {{ planet.name }}
          <span v-if="planet.isHome" class="hs-solar-home-tag">home</span>
        </span>

        <!-- Scanned: state + owner/slots -->
        <template v-if="planet.isHome || isScanned(planet.id)">
          <span class="hs-solar-tile-state" :style="{ color: STATE_COLOR[planet.state] }">
            {{ STATE_LABEL[planet.state] }}
          </span>
          <span v-if="planet.owner" class="hs-solar-tile-owner">{{ planet.owner }}</span>
          <span v-else-if="planet.slots !== null" class="hs-solar-tile-slots">{{ planet.slots }} slots</span>
        </template>

        <!-- Scanning: countdown -->
        <template v-else-if="isScanning(planet.id)">
          <span class="hs-solar-tile-scanning-label">Scanning…</span>
          <span class="hs-solar-tile-timer">{{ formatTime(remainingScanSec) }}</span>
        </template>

        <!-- Unknown: scan button -->
        <template v-else>
          <span class="hs-solar-tile-unknown-label">Unknown</span>
          <button
            v-if="canScan(planet.id)"
            class="hs-solar-scan-btn"
            @click="startScan(planet.id)"
          >Scan</button>
          <span v-else-if="reconDroneLevel === 0" class="hs-solar-tile-hint">needs probe</span>
          <span v-else class="hs-solar-tile-hint">busy</span>
        </template>

      </div>

    </div>

    <!-- Status bar -->
    <div class="hs-solar-status">
      <span
        class="hs-solar-status-item"
        :class="reconDroneLevel > 0 ? 'hs-solar-status--active' : 'hs-solar-status--locked'"
      >
        🛸 Probes
        <span class="hs-solar-status-sub">{{ reconDroneLevel > 0 ? `Lv${reconDroneLevel}` : 'Space Base needed' }}</span>
      </span>
      <span
        class="hs-solar-status-item"
        :class="colonyShipLevel > 0 ? 'hs-solar-status--active' : 'hs-solar-status--locked'"
      >
        🚀 Colony Ships
        <span class="hs-solar-status-sub">{{ colonyShipLevel > 0 ? `Lv${colonyShipLevel}` : 'Space Base needed' }}</span>
      </span>
      <span v-if="activeScan" class="hs-solar-status-item hs-solar-status--scanning">
        🔭 Scanning · {{ formatTime(remainingScanSec) }}
      </span>
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
}

// ── Scan progress bar (CSS animation, same pattern as build progress) ────────
.hs-solar-scan-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: 100%;
  background: rgba(251,191,36,0.5);
  transform-origin: left;
  animation: hs-scan-fill linear forwards;
}

@keyframes hs-scan-fill {
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

// ── Scan button ──────────────────────────────────────────────────────────────
.hs-solar-scan-btn {
  margin-top: 1px;
  padding: 2px 8px;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(251,191,36,0.35);
  background: rgba(251,191,36,0.08);
  color: rgba(251,191,36,0.85);
  font-size: 0.52rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(251,191,36,0.18);
    border-color: rgba(251,191,36,0.6);
  }
}

// ── Status bar ───────────────────────────────────────────────────────────────
.hs-solar-status {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.hs-solar-status-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
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
</style>
