<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { GALAXY_SYSTEMS } from '~/utils/hawkStarGalaxyMock.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const { playerColonizedPlanets, homeSystemId } = useHawkStar()

const { t } = useI18n()

// ── Effective planet state ───────────────────────────────────────────────────
const planetState = (planet) =>
  playerColonizedPlanets.value.includes(planet.id) ? 'own' : planet.state

// ── Selection ───────────────────────────────────────────────────────────────
const selected = ref(GALAXY_SYSTEMS.find(s => s.id === homeSystemId.value) ?? null)

const selectSystem = (sys) => {
  selected.value = selected.value?.id === sys.id ? null : sys
}

// ── Constants ────────────────────────────────────────────────────────────────
const STAR_CLASS_COLOR = { G: '#fde68a', K: '#fdba74', M: '#f87171', F: '#93c5fd' }

const planetStateLabel = (state) => ({
  own:         t('hawkStar.galaxy.stateColony'),
  uncolonized: t('hawkStar.galaxy.stateUncolonized'),
  enemy:       t('hawkStar.galaxy.stateEnemy'),
  ally:        t('hawkStar.galaxy.stateAllied'),
})[state] ?? state

const PLANET_TYPE_ICON = {
  rock:  '🪨',
  gas:   '🌫️',
  ice:   '🧊',
  lava:  '🌋',
  ocean: '🌊',
}
</script>

<template>
  <div class="hs-galaxy">

    <!-- Map canvas -->
    <div class="hs-galaxy-map" @click.self="selected = null">

      <!-- System nodes -->
      <div
        v-for="sys in GALAXY_SYSTEMS"
        :key="sys.id"
        class="hs-system"
        :class="[
          { 'hs-system--home': sys.home, 'hs-system--selected': selected?.id === sys.id },
        ]"
        :style="{ left: `${sys.x}%`, top: `${sys.y}%` }"
        @click.stop="selectSystem(sys)"
      >
        <span
          class="hs-system-star"
          :style="{ '--star-color': STAR_CLASS_COLOR[sys.starClass] ?? '#fff' }"
        />
        <span class="hs-system-dot" />
        <span class="hs-system-name">{{ sys.name }}</span>
      </div>

    </div>

    <!-- System detail card -->
    <Transition name="hs-slide">
      <div v-if="selected" class="hs-system-card">
        <div class="hs-card-header">
          <div class="hs-card-title">
            <span class="hs-card-name">{{ selected.name }}</span>
            <span class="hs-card-meta">{{ t('hawkStar.galaxy.starMeta', { cls: selected.starClass, n: selected.planets.length }) }}</span>
          </div>
          <button class="hs-card-close" @click="selected = null">✕</button>
        </div>

        <ul class="hs-planet-list">
          <li
            v-for="planet in selected.planets"
            :key="planet.id"
            class="hs-planet-item"
            :class="`hs-planet--${planetState(planet)}`"
          >
            <span class="hs-planet-icon">{{ PLANET_TYPE_ICON[planet.type] ?? '🪐' }}</span>
            <span class="hs-planet-name">{{ planet.name }}</span>
            <span class="hs-planet-state">{{ planetStateLabel(planetState(planet)) }}</span>
          </li>
        </ul>
      </div>
    </Transition>

  </div>
</template>

<style lang="scss" scoped>
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

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 75% at 50% 50%, transparent 55%, rgba(4,4,14,0.7) 100%);
    pointer-events: none;
  }
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
  user-select: none;
  color: rgba(255,255,255,0.6);

  &:hover .hs-system-dot  { transform: scale(1.5); }
  &:hover .hs-system-star { opacity: 0.8; transform: scale(1.6); }

  &--selected .hs-system-dot  { transform: scale(1.6); }
  &--selected .hs-system-star { opacity: 1; transform: scale(1.9); }

  &--home .hs-system-dot {
    width: 13px;
    height: 13px;
    background: $c-own;
    box-shadow: 0 0 4px $c-own;
    animation: hs-pulse-home 2.5s ease-in-out infinite;
  }
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

.hs-card-title { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.hs-card-name  { font-size: 0.875rem; font-weight: 700; color: #fff; }
.hs-card-meta  { font-size: 0.6rem; color: rgba(255,255,255,0.35); }

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

// ── Planet list ───────────────────────────────────────────────────────────────
.hs-planet-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hs-planet-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.375rem;
  border-radius: var(--hs-r-sm);
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
}

.hs-planet-icon  { font-size: 0.75rem; flex-shrink: 0; }
.hs-planet-name  { flex: 1; font-size: 0.65rem; color: rgba(255,255,255,0.75); }
.hs-planet-state { font-size: 0.55rem; font-weight: 600; }

.hs-planet--own         .hs-planet-state { color: $c-own; }
.hs-planet--ally        .hs-planet-state { color: $c-ally; }
.hs-planet--enemy       .hs-planet-state { color: $c-enemy; }
.hs-planet--uncolonized .hs-planet-state { color: $c-uncolonized; }

// ── Slide transition ──────────────────────────────────────────────────────────
.hs-slide-enter-active,
.hs-slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.hs-slide-enter-from,
.hs-slide-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
