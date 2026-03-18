<script setup>
import { computed } from 'vue'
import { GALAXY_SYSTEMS } from '../hawkStarGalaxyMock.js'

const homeSystem = computed(() => GALAXY_SYSTEMS.find(s => s.home))
const planets    = computed(() => homeSystem.value?.planets ?? [])

const PLANET_TYPE_ICON = {
  rock:  '🪨',
  gas:   '🌀',
  ice:   '🧊',
  lava:  '🌋',
  ocean: '🌊',
}

const STAR_CLASS_LABEL = { G: 'Yellow Dwarf', K: 'Orange Dwarf', M: 'Red Dwarf', F: 'White Star' }

const STATE_COLOR = {
  own:         '#60a5fa',
  uncolonized: '#6b7280',
  enemy:       '#f87171',
  ally:        '#34d399',
}

const STATE_LABEL = {
  own:         'Colony',
  uncolonized: 'Free',
  enemy:       'Enemy',
  ally:        'Allied',
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
        :class="`hs-solar-tile--${planet.state}`"
      >
        <span class="hs-solar-tile-icon">{{ PLANET_TYPE_ICON[planet.type] ?? '🪐' }}</span>
        <span class="hs-solar-tile-name">
          {{ planet.name }}
          <span v-if="planet.isHome" class="hs-solar-home-tag">home</span>
        </span>
        <span class="hs-solar-tile-state" :style="{ color: STATE_COLOR[planet.state] }">
          {{ STATE_LABEL[planet.state] }}
        </span>
        <span v-if="planet.owner" class="hs-solar-tile-owner">{{ planet.owner }}</span>
        <span v-else-if="planet.slots !== null" class="hs-solar-tile-slots">{{ planet.slots }} slots</span>
      </div>

    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-solar {
  flex: 1;
  min-width: 0;
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
    border-radius: var(--hs-r-md);
  }

  // Sun
  &--sun {
    border-color: rgba(253, 230, 138, 0.3);
    background: rgba(253, 230, 138, 0.05);
  }

  // Planet states
  &--own         { border-color: rgba(96, 165, 250, 0.25); }
  &--enemy       { border-color: rgba(248, 113, 113, 0.2); background: rgba(248,113,113,0.04); }
  &--ally        { border-color: rgba(52, 211, 153, 0.2); }
  &--uncolonized { border-color: var(--hs-line-lg); }
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

.hs-solar-tile-owner {
  font-size: 0.5rem;
  color: rgba(255,255,255,0.3);
  text-align: center;
}

.hs-solar-tile-slots {
  font-size: 0.5rem;
  color: rgba(255,255,255,0.28);
  text-align: center;
}
</style>
