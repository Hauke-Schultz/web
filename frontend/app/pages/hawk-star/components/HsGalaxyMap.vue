<script setup>
import { ref, computed, watch } from 'vue'
import { useHawkStar } from '../useHawkStar.js'
import { GALAXY_SYSTEMS, TRADE_ROUTES } from '../hawkStarGalaxyMock.js'

const {
  starMapLevel,
  galaxyProbeLevel,
  playerProbedSystems, activeGalaxyProbes,
  sendGalaxyProbe, remainingProbeSec, probeProgressStyle,
  formatTime,
} = useHawkStar()

// ── Visibility helpers ──────────────────────────────────────────────────────

// A system dot appears on the map when star map level is high enough.
const isVisible  = (sys) => sys.minLevel <= starMapLevel.value

// Planet count + state is known once a probe has arrived (or it's home).
const isProbed   = (sys) => sys.home || playerProbedSystems.value.includes(sys.id)
const isProbing  = (sys) => !!activeGalaxyProbes.value.find(p => p.systemId === sys.id)
const canProbe   = (sys) =>
  galaxyProbeLevel.value > 0 &&
  !isProbed(sys) &&
  !isProbing(sys) &&
  activeGalaxyProbes.value.length < galaxyProbeLevel.value

// The state shown on the map dot.
const effectiveState = (sys) => isProbed(sys) ? sys.state : 'unknown'

// ── Derived collections ─────────────────────────────────────────────────────

const visibleSystems = computed(() => GALAXY_SYSTEMS.filter(isVisible))

const visibleRoutes = computed(() => {
  if (starMapLevel.value < 2) return []
  const ids = new Set(visibleSystems.value.map(s => s.id))
  return TRADE_ROUTES
    .filter(([a, b]) => ids.has(a) && ids.has(b))
    .map(([a, b]) => ({
      a: GALAXY_SYSTEMS.find(s => s.id === a),
      b: GALAXY_SYSTEMS.find(s => s.id === b),
    }))
})

// How many more systems the next star map level would reveal.
const nextUnlock = computed(() => {
  const next = starMapLevel.value + 1
  if (next > 3) return null
  const count = GALAXY_SYSTEMS.filter(s => s.minLevel === next).length
  return count > 0 ? { level: next, count } : null
})

// ── Selection ───────────────────────────────────────────────────────────────

const selected = ref(null)

const selectSystem = (sys) => {
  selected.value = selected.value?.id === sys.id ? null : sys
}

// Clear selection if the selected system scrolls out of visibility.
watch(visibleSystems, (systems) => {
  if (selected.value && !systems.find(s => s.id === selected.value.id)) {
    selected.value = null
  }
})

// ── Label maps ──────────────────────────────────────────────────────────────

const STATE_LABEL = {
  own:         'Your Colony',
  uncolonized: 'Uncolonized',
  enemy:       'Enemy Territory',
  ally:        'Allied',
  unknown:     'Unknown',
}

const STATE_ICON = {
  own:         '🌍',
  uncolonized: '🪐',
  enemy:       '⚠️',
  ally:        '🤝',
  unknown:     '❓',
}

const STAR_CLASS_COLOR = { G: '#fde68a', K: '#fdba74', M: '#f87171', F: '#93c5fd' }
</script>

<template>
  <div class="hs-galaxy">

    <!-- Map canvas -->
    <div class="hs-galaxy-map" @click.self="selected = null">

      <!-- Trade route SVG overlay (lv2+) -->
      <svg v-if="visibleRoutes.length" class="hs-galaxy-svg" aria-hidden="true">
        <line
          v-for="route in visibleRoutes"
          :key="`${route.a.id}-${route.b.id}`"
          :x1="`${route.a.x}%`" :y1="`${route.a.y}%`"
          :x2="`${route.b.x}%`" :y2="`${route.b.y}%`"
          class="hs-route-line"
        />
      </svg>

      <!-- System nodes -->
      <button
        v-for="sys in visibleSystems"
        :key="sys.id"
        class="hs-system"
        :class="[
          `hs-system--${effectiveState(sys)}`,
          { 'hs-system--home': sys.home, 'hs-system--selected': selected?.id === sys.id },
        ]"
        :style="{ left: `${sys.x}%`, top: `${sys.y}%` }"
        @click.stop="selectSystem(sys)"
      >
        <!-- Star glow ring (color = star class) -->
        <span
          class="hs-system-star"
          :style="{ '--star-color': STAR_CLASS_COLOR[sys.starClass] ?? '#fff' }"
        />
        <span class="hs-system-dot" />
        <span class="hs-system-name">{{ sys.name }}</span>
      </button>

      <!-- Fog of war upgrade hint -->
      <div v-if="nextUnlock" class="hs-fog-hint">
        🔭 Star Map Lv{{ nextUnlock.level }} reveals {{ nextUnlock.count }} more
        system{{ nextUnlock.count > 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Legend -->
    <div class="hs-galaxy-legend">
      <span class="hs-legend-item hs-legend--own">● Your Colony</span>
      <span class="hs-legend-item hs-legend--ally">● Allied</span>
      <span class="hs-legend-item hs-legend--uncolonized">● Uncolonized</span>
      <span class="hs-legend-item hs-legend--enemy">● Enemy</span>
      <span class="hs-legend-item hs-legend--unknown">● Unknown</span>
      <span v-if="starMapLevel >= 2" class="hs-legend-item hs-legend--route">── Trade Route</span>
    </div>

    <!-- System detail card -->
    <Transition name="hs-slide">
      <div v-if="selected" class="hs-system-card">
        <div class="hs-card-header">
          <span class="hs-card-icon">{{ STATE_ICON[effectiveState(selected)] }}</span>
          <div class="hs-card-title">
            <span class="hs-card-name">{{ selected.name }}</span>
            <span class="hs-card-meta">
              {{ selected.starClass }}-class star
              · <span v-if="isProbed(selected)">{{ selected.planets.length }} planet{{ selected.planets.length > 1 ? 's' : '' }}</span>
                <span v-else class="hs-card-unknown-count">? planets</span>
            </span>
            <span class="hs-card-state" :class="`hs-card-state--${effectiveState(selected)}`">
              {{ STATE_LABEL[effectiveState(selected)] }}
            </span>
          </div>
          <button class="hs-card-close" @click="selected = null">✕</button>
        </div>

        <!-- Probe in flight -->
        <div v-if="isProbing(selected)" class="hs-card-probing">
          <div class="hs-card-probe-bar" :style="probeProgressStyle(selected.id)" />
          <span class="hs-card-probing-icon">🔭</span>
          <span>Probe en route · {{ formatTime(remainingProbeSec(selected.id)) }}</span>
        </div>

        <!-- Not probed, not probing -->
        <div v-else-if="!isProbed(selected)" class="hs-card-unprobed">
          <span class="hs-card-unprobed-text">System not yet surveyed</span>
          <button
            v-if="canProbe(selected)"
            class="hs-card-probe-btn"
            @click="sendGalaxyProbe(selected.id)"
          >🔭 Send Probe</button>
          <span v-else-if="galaxyProbeLevel === 0" class="hs-card-probe-hint">Build Galaxy Probe to send a probe</span>
          <span v-else class="hs-card-probe-hint">All probes busy ({{ activeGalaxyProbes.length }}/{{ galaxyProbeLevel }})</span>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style lang="scss" scoped>
$c-own:         #60a5fa;
$c-ally:        #34d399;
$c-enemy:       #f87171;
$c-uncolonized: #6b7280;
$c-unknown:     #374151;

.hs-galaxy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

// ── Map canvas ────────────────────────────────────────────────────────────────
.hs-galaxy-map {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background:
    radial-gradient(ellipse 60% 50% at 45% 55%, rgba(59,130,246,0.07) 0%, transparent 70%),
    radial-gradient(ellipse 40% 35% at 75% 30%, rgba(139,92,246,0.05) 0%, transparent 60%),
    radial-gradient(ellipse 30% 25% at 20% 70%, rgba(52,211,153,0.04) 0%, transparent 60%),
    linear-gradient(160deg, #060612, #080818 60%, #060610);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  overflow: hidden;

  // Static star field
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(1px 1px at  7%  11%, rgba(255,255,255,0.55) 0%, transparent 100%),
      radial-gradient(1px 1px at 19%  44%, rgba(255,255,255,0.30) 0%, transparent 100%),
      radial-gradient(1px 1px at 31%  78%, rgba(255,255,255,0.45) 0%, transparent 100%),
      radial-gradient(1px 1px at 56%  17%, rgba(255,255,255,0.60) 0%, transparent 100%),
      radial-gradient(1px 1px at 67%  63%, rgba(255,255,255,0.30) 0%, transparent 100%),
      radial-gradient(1px 1px at 78%  91%, rgba(255,255,255,0.50) 0%, transparent 100%),
      radial-gradient(1px 1px at 89%  36%, rgba(255,255,255,0.40) 0%, transparent 100%),
      radial-gradient(1px 1px at 14%  83%, rgba(255,255,255,0.35) 0%, transparent 100%),
      radial-gradient(1px 1px at 93%  71%, rgba(255,255,255,0.50) 0%, transparent 100%),
      radial-gradient(1px 1px at 33%   8%, rgba(255,255,255,0.45) 0%, transparent 100%),
      radial-gradient(1px 1px at 47%  53%, rgba(255,255,255,0.20) 0%, transparent 100%),
      radial-gradient(1px 1px at 72%  15%, rgba(255,255,255,0.55) 0%, transparent 100%),
      radial-gradient(1px 1px at  4%  59%, rgba(255,255,255,0.30) 0%, transparent 100%),
      radial-gradient(1px 1px at 85%  49%, rgba(255,255,255,0.40) 0%, transparent 100%),
      radial-gradient(1px 1px at 61%  87%, rgba(255,255,255,0.35) 0%, transparent 100%),
      radial-gradient(1px 1px at 43%  33%, rgba(255,255,255,0.25) 0%, transparent 100%),
      radial-gradient(1px 1px at 25%  67%, rgba(255,255,255,0.40) 0%, transparent 100%),
      radial-gradient(1px 1px at 95%  10%, rgba(255,255,255,0.35) 0%, transparent 100%);
    pointer-events: none;
  }

  // Fog of war vignette at edges
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 75% at 50% 50%, transparent 55%, rgba(4,4,14,0.7) 100%);
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
  z-index: 1;
}

.hs-route-line {
  stroke: rgba(96,165,250,0.18);
  stroke-width: 1;
  stroke-dasharray: 4 6;
}

// ── System nodes ──────────────────────────────────────────────────────────────
.hs-system {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;

  &:hover .hs-system-dot  { transform: scale(1.5); }
  &:hover .hs-system-star { opacity: 0.8; transform: scale(1.6); }

  &--selected .hs-system-dot  { transform: scale(1.6); }
  &--selected .hs-system-star { opacity: 1; transform: scale(1.9); }

  &--home .hs-system-dot {
    width: 13px;
    height: 13px;
    animation: hs-pulse-home 2.5s ease-in-out infinite;
  }

  // Dot color per effective state
  &--own         { color: $c-own; }
  &--ally        { color: $c-ally; }
  &--enemy       { color: $c-enemy; }
  &--uncolonized { color: $c-uncolonized; }
  &--unknown     { color: $c-unknown; }
}

.hs-system-star {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--star-color, #fff) 0%, transparent 70%);
  opacity: 0.25;
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
}

.hs-system-dot {
  position: relative;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: currentColor;
  transition: transform 0.15s, box-shadow 0.15s;
  flex-shrink: 0;
  box-shadow: 0 0 4px currentColor;
}

.hs-system-name {
  font-size: 0.5rem;
  color: rgba(255,255,255,0.55);
  white-space: nowrap;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  pointer-events: none;
  letter-spacing: 0.02em;
}

@keyframes hs-pulse-home {
  0%, 100% { box-shadow: 0 0 4px $c-own, 0 0 0 0 rgba(96,165,250,0.5); }
  50%       { box-shadow: 0 0 8px $c-own, 0 0 0 7px rgba(96,165,250,0); }
}

// ── Fog of war hint ───────────────────────────────────────────────────────────
.hs-fog-hint {
  position: absolute;
  bottom: 0.625rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  font-size: 0.58rem;
  color: rgba(255,255,255,0.28);
  background: rgba(0,0,0,0.45);
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

// ── Legend ────────────────────────────────────────────────────────────────────
.hs-galaxy-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem 1rem;
  padding: 0 0.25rem;
}

.hs-legend-item     { font-size: 0.6rem; color: rgba(255,255,255,0.4); }
.hs-legend--own         { color: $c-own; }
.hs-legend--ally        { color: $c-ally; }
.hs-legend--enemy       { color: $c-enemy; }
.hs-legend--uncolonized { color: $c-uncolonized; }
.hs-legend--unknown     { color: $c-unknown; }
.hs-legend--route       { color: rgba(96,165,250,0.4); }

// ── System detail card ────────────────────────────────────────────────────────
.hs-system-card {
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  padding: 0.75rem;
}

.hs-card-header {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  margin-bottom: 0.625rem;
}

.hs-card-icon  { font-size: 1.4rem; flex-shrink: 0; line-height: 1.2; }
.hs-card-title { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.hs-card-name  { font-size: 0.875rem; font-weight: 700; color: #fff; }
.hs-card-meta  { font-size: 0.6rem; color: rgba(255,255,255,0.35); }
.hs-card-state {
  font-size: 0.62rem;
  font-weight: 600;
  &--own         { color: $c-own; }
  &--ally        { color: $c-ally; }
  &--enemy       { color: $c-enemy; }
  &--uncolonized { color: $c-uncolonized; }
  &--unknown     { color: rgba(255,255,255,0.3); }
}

.hs-card-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: rgba(255,255,255,0.25);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 2px 4px;
  &:hover { color: rgba(255,255,255,0.65); }
}

// ── Unknown planet count ──────────────────────────────────────────────────────
.hs-card-unknown-count { color: rgba(255,255,255,0.25); font-style: italic; }

// ── Probe in flight ───────────────────────────────────────────────────────────
.hs-card-probing {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--hs-r-md);
  border: 1px solid rgba(251,191,36,0.25);
  background: rgba(251,191,36,0.05);
  font-size: 0.65rem;
  color: rgba(251,191,36,0.85);
}

.hs-card-probe-bar {
  position: absolute;
  bottom: 0; left: 0;
  height: 2px; width: 100%;
  background: rgba(251,191,36,0.5);
  transform-origin: left;
  animation: hs-probe-fill linear forwards;
}

@keyframes hs-probe-fill {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.hs-card-probing-icon { font-size: 0.875rem; flex-shrink: 0; }

// ── Not probed ────────────────────────────────────────────────────────────────
.hs-card-unprobed {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
}

.hs-card-unprobed-text {
  font-size: 0.62rem;
  color: rgba(255,255,255,0.28);
  font-style: italic;
}

.hs-card-probe-btn {
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border-radius: var(--hs-r-md);
  border: 1px solid rgba(251,191,36,0.35);
  background: rgba(251,191,36,0.08);
  color: rgba(251,191,36,0.9);
  font-size: 0.65rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(251,191,36,0.18);
    border-color: rgba(251,191,36,0.6);
  }
}

.hs-card-probe-hint {
  font-size: 0.58rem;
  color: rgba(255,255,255,0.2);
  font-style: italic;
}

// ── Slide transition ──────────────────────────────────────────────────────────
.hs-slide-enter-active,
.hs-slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.hs-slide-enter-from,
.hs-slide-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
