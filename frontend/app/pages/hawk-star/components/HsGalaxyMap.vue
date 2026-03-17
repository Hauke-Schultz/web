<script setup>
import { ref, computed } from 'vue'
import { useHawkStar } from '../useHawkStar.js'

const { starMapLevel, reconDroneLevel, planetName } = useHawkStar()

// ── Static mock galaxy data ─────────────────────────────────────────────────
// x/y are percentages within the map container (0–100).
// minLevel = minimum star map level required to see this system.
// state:  own | uncolonized | enemy | ally
const SYSTEMS = [
  { id: 'kepler',  name: 'Kepler Prime', x: 50, y: 49, home: true,  state: 'own',         owner: null,     planets: 1, minLevel: 0 },
  { id: 'vega9',   name: 'Vega-9',       x: 37, y: 30, home: false, state: 'uncolonized', owner: null,     planets: 2, minLevel: 1 },
  { id: 'arix',    name: 'Arix Prime',   x: 64, y: 27, home: false, state: 'enemy',       owner: 'Zarkon', planets: 1, minLevel: 1 },
  { id: 'nebula3', name: 'Nebula-3',     x: 71, y: 57, home: false, state: 'uncolonized', owner: null,     planets: 3, minLevel: 1 },
  { id: 'tartus',  name: 'Tartus IV',    x: 33, y: 64, home: false, state: 'uncolonized', owner: null,     planets: 2, minLevel: 1 },
  { id: 'solaris', name: 'Solaris',      x: 21, y: 38, home: false, state: 'uncolonized', owner: null,     planets: 1, minLevel: 2 },
  { id: 'kronos',  name: 'Kronos VI',    x: 80, y: 35, home: false, state: 'enemy',       owner: 'Vexar',  planets: 2, minLevel: 2 },
  { id: 'dusk',    name: 'Dusk System',  x: 18, y: 75, home: false, state: 'uncolonized', owner: null,     planets: 1, minLevel: 2 },
  { id: 'helix',   name: 'Helix-7',      x: 58, y: 80, home: false, state: 'ally',        owner: 'Asha',   planets: 3, minLevel: 2 },
  { id: 'andor',   name: 'Andor Belt',   x: 84, y: 68, home: false, state: 'uncolonized', owner: null,     planets: 2, minLevel: 3 },
  { id: 'rift',    name: 'Rift Delta',   x: 13, y: 18, home: false, state: 'enemy',       owner: 'Zarkon', planets: 1, minLevel: 3 },
  { id: 'oberon',  name: 'Oberon',       x: 44, y: 12, home: false, state: 'enemy',       owner: 'Vexar',  planets: 2, minLevel: 3 },
]

// Trade route connections shown at star map lv2+
const TRADE_ROUTES = [
  ['kepler', 'vega9'],
  ['kepler', 'nebula3'],
  ['kepler', 'helix'],
  ['vega9',  'solaris'],
  ['nebula3','kronos'],
]

const selected = ref(null)

const visibleSystems = computed(() =>
  SYSTEMS.filter(s => s.minLevel <= starMapLevel.value)
)

const visibleRoutes = computed(() => {
  if (starMapLevel.value < 2) return []
  const ids = new Set(visibleSystems.value.map(s => s.id))
  return TRADE_ROUTES.filter(([a, b]) => ids.has(a) && ids.has(b))
})

const systemById = (id) => SYSTEMS.find(s => s.id === id)

const selectSystem = (sys) => {
  selected.value = selected.value?.id === sys.id ? null : sys
}

const stateLabel = {
  own:         'Your Colony',
  uncolonized: 'Uncolonized',
  enemy:       'Enemy Territory',
  ally:        'Allied',
}

const nextUnlock = computed(() => {
  const nextLevel = starMapLevel.value + 1
  const count = SYSTEMS.filter(s => s.minLevel === nextLevel).length
  return count > 0 ? { level: nextLevel, count } : null
})
</script>

<template>
  <div class="hs-galaxy">

    <!-- Map -->
    <div class="hs-galaxy-map" @click.self="selected = null">

      <!-- SVG layer for trade routes -->
      <svg v-if="visibleRoutes.length" class="hs-galaxy-svg">
        <line
          v-for="([a, b]) in visibleRoutes"
          :key="`${a}-${b}`"
          :x1="`${systemById(a).x}%`"
          :y1="`${systemById(a).y}%`"
          :x2="`${systemById(b).x}%`"
          :y2="`${systemById(b).y}%`"
          class="hs-route-line"
        />
      </svg>

      <!-- System nodes -->
      <button
        v-for="sys in visibleSystems"
        :key="sys.id"
        class="hs-system"
        :class="[
          `hs-system--${sys.state}`,
          { 'hs-system--selected': selected?.id === sys.id, 'hs-system--home': sys.home }
        ]"
        :style="{ left: `${sys.x}%`, top: `${sys.y}%` }"
        @click.stop="selectSystem(sys)"
      >
        <span class="hs-system-dot" />
        <span class="hs-system-name">{{ sys.name }}</span>
      </button>

      <!-- Fog of war hint -->
      <div v-if="nextUnlock" class="hs-fog-hint">
        🔭 Upgrade Star Map to Lv{{ nextUnlock.level }} to reveal {{ nextUnlock.count }} more system{{ nextUnlock.count > 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Legend -->
    <div class="hs-galaxy-legend">
      <span class="hs-legend-item hs-legend--own">● Your Colony</span>
      <span class="hs-legend-item hs-legend--ally">● Allied</span>
      <span class="hs-legend-item hs-legend--uncolonized">● Uncolonized</span>
      <span class="hs-legend-item hs-legend--enemy">● Enemy</span>
      <span v-if="starMapLevel >= 2" class="hs-legend-item hs-legend--route">── Trade Route</span>
    </div>

    <!-- System detail card -->
    <Transition name="hs-slide">
      <div v-if="selected" class="hs-system-card">
        <div class="hs-card-header">
          <span class="hs-card-icon">
            <span v-if="selected.state === 'own'">🌍</span>
            <span v-else-if="selected.state === 'enemy'">⚠️</span>
            <span v-else-if="selected.state === 'ally'">🤝</span>
            <span v-else>🪐</span>
          </span>
          <div>
            <div class="hs-card-name">{{ selected.name }}</div>
            <div class="hs-card-state" :class="`hs-card-state--${selected.state}`">{{ stateLabel[selected.state] }}</div>
          </div>
          <button class="hs-card-close" @click="selected = null">✕</button>
        </div>
        <div class="hs-card-body">
          <div class="hs-card-stat">
            <span class="hs-card-stat-label">Planets</span>
            <span class="hs-card-stat-val">{{ selected.planets }}</span>
          </div>
          <div v-if="selected.owner" class="hs-card-stat">
            <span class="hs-card-stat-label">Controlled by</span>
            <span class="hs-card-stat-val" :class="`hs-card-state--${selected.state}`">{{ selected.owner }}</span>
          </div>
          <div v-if="selected.home" class="hs-card-stat">
            <span class="hs-card-stat-label">Planet</span>
            <span class="hs-card-stat-val">{{ planetName }}</span>
          </div>
          <div v-if="reconDroneLevel === 0 && !selected.home" class="hs-card-note">
            Build Recon Drones for detailed intel
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style lang="scss" scoped>
// ── Color tokens ──────────────────────────────────────────────────────────────
$c-own:         #60a5fa;
$c-ally:        #34d399;
$c-enemy:       #f87171;
$c-uncolonized: #6b7280;

.hs-galaxy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

// ── Map canvas ─────────────────────────────────────────────────────────────────
.hs-galaxy-map {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background:
    radial-gradient(ellipse 60% 50% at 45% 55%, rgba(59, 130, 246, 0.06) 0%, transparent 70%),
    radial-gradient(ellipse 40% 35% at 75% 30%, rgba(139, 92, 246, 0.05) 0%, transparent 60%),
    linear-gradient(to bottom, #050510, #080818);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  overflow: hidden;

  // CSS star field
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(1px 1px at  8%  12%, rgba(255,255,255,0.5) 0%, transparent 100%),
      radial-gradient(1px 1px at 23%  44%, rgba(255,255,255,0.3) 0%, transparent 100%),
      radial-gradient(1px 1px at 41%  78%, rgba(255,255,255,0.4) 0%, transparent 100%),
      radial-gradient(1px 1px at 56%  19%, rgba(255,255,255,0.6) 0%, transparent 100%),
      radial-gradient(1px 1px at 68%  63%, rgba(255,255,255,0.3) 0%, transparent 100%),
      radial-gradient(1px 1px at 77%  91%, rgba(255,255,255,0.5) 0%, transparent 100%),
      radial-gradient(1px 1px at 89%  37%, rgba(255,255,255,0.4) 0%, transparent 100%),
      radial-gradient(1px 1px at 15%  83%, rgba(255,255,255,0.3) 0%, transparent 100%),
      radial-gradient(1px 1px at 92%  72%, rgba(255,255,255,0.5) 0%, transparent 100%),
      radial-gradient(1px 1px at 32%   8%, rgba(255,255,255,0.4) 0%, transparent 100%),
      radial-gradient(1px 1px at 48%  55%, rgba(255,255,255,0.2) 0%, transparent 100%),
      radial-gradient(1px 1px at 73%  16%, rgba(255,255,255,0.5) 0%, transparent 100%),
      radial-gradient(1px 1px at  5%  60%, rgba(255,255,255,0.3) 0%, transparent 100%),
      radial-gradient(1px 1px at 85%  50%, rgba(255,255,255,0.4) 0%, transparent 100%),
      radial-gradient(1px 1px at 62%  88%, rgba(255,255,255,0.3) 0%, transparent 100%);
    pointer-events: none;
  }
}

// ── SVG trade routes ──────────────────────────────────────────────────────────
.hs-galaxy-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.hs-route-line {
  stroke: rgba(96, 165, 250, 0.2);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

// ── System nodes ──────────────────────────────────────────────────────────────
.hs-system {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;

  &:hover .hs-system-dot {
    transform: scale(1.4);
    box-shadow: 0 0 10px currentColor;
  }

  &--selected .hs-system-dot {
    transform: scale(1.5);
    box-shadow: 0 0 12px currentColor;
  }

  &--home .hs-system-dot {
    width: 14px;
    height: 14px;
    animation: hs-pulse-home 2.5s ease-in-out infinite;
  }

  // State colors
  &--own         { color: $c-own; }
  &--ally        { color: $c-ally; }
  &--enemy       { color: $c-enemy; }
  &--uncolonized { color: $c-uncolonized; }
}

.hs-system-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  transition: transform 0.15s, box-shadow 0.15s;
  flex-shrink: 0;
}

.hs-system-name {
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}

@keyframes hs-pulse-home {
  0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.6); }
  50%       { box-shadow: 0 0 0 6px rgba(96, 165, 250, 0); }
}

// ── Fog of war hint ───────────────────────────────────────────────────────────
.hs-fog-hint {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
  pointer-events: none;
}

// ── Legend ────────────────────────────────────────────────────────────────────
.hs-galaxy-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0 0.25rem;
}

.hs-legend-item {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.45);
}

.hs-legend--own         { color: $c-own; }
.hs-legend--ally        { color: $c-ally; }
.hs-legend--enemy       { color: $c-enemy; }
.hs-legend--uncolonized { color: $c-uncolonized; }
.hs-legend--route       { color: rgba(96, 165, 250, 0.4); }

// ── System detail card ────────────────────────────────────────────────────────
.hs-system-card {
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  padding: 0.75rem;
}

.hs-card-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 0.5rem;
}

.hs-card-icon  { font-size: 1.5rem; flex-shrink: 0; }
.hs-card-name  { font-size: 0.9rem; font-weight: 700; color: #fff; }
.hs-card-state {
  font-size: 0.65rem;
  margin-top: 1px;

  &--own         { color: $c-own; }
  &--ally        { color: $c-ally; }
  &--enemy       { color: $c-enemy; }
  &--uncolonized { color: $c-uncolonized; }
}

.hs-card-close {
  margin-left: auto;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 4px;

  &:hover { color: rgba(255, 255, 255, 0.7); }
}

.hs-card-body {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
}

.hs-card-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hs-card-stat-label { font-size: 0.55rem; opacity: 0.4; text-transform: uppercase; letter-spacing: 0.05em; }
.hs-card-stat-val   { font-size: 0.8rem; font-weight: 600; color: #fff; }

.hs-card-note {
  width: 100%;
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
  margin-top: 2px;
}

// ── Slide transition ──────────────────────────────────────────────────────────
.hs-slide-enter-active,
.hs-slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.hs-slide-enter-from,
.hs-slide-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
