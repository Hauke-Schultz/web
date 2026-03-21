<script setup>
import { computed } from 'vue'
import { TILE_TYPES } from '../hawkStarConfig.js'
import {resetGame, useHawkStar} from '../useHawkStar.js'

const {
  playerName,
  planetName,
  planetType,
  PLANET_TYPES,
  playerSlots,
  activeSlot,
  selectSlot,
  slotsOnSlot,
  unlockRequirement,
  getLevel,
  homePlanetId,
  activePlanetId,
} = useHawkStar()

const currentPlanetType = computed(() => PLANET_TYPES[planetType.value])
</script>

<template>
  <div class="hs-planet-wrap">
    <div class="hs-planet-header">
      <span class="hs-player-name">{{ playerName }}</span>
      <span class="hs-planet-name">
        🪐 {{ planetName }}
        <span v-if="activePlanetId !== homePlanetId" class="hs-planet-colony-badge">colony</span>
      </span>
      <span
        v-if="currentPlanetType"
        class="hs-planet-type-badge"
        :class="`hs-planet-type-badge--${planetType}`"
        :title="currentPlanetType.description"
      >{{ currentPlanetType.icon }} {{ currentPlanetType.name }}</span>
    </div>
    <div class="hs-grid">
    <div
      v-for="slot in playerSlots"
      :key="slot.slot"
      class="hs-tile"
      :class="{
        'hs-tile--locked':   !slot.unlocked,
        'hs-tile--active':   slot.unlocked && activeSlot === slot.slot,
        'hs-tile--unlocked': slot.unlocked && activeSlot !== slot.slot,
      }"
      @click="selectSlot(slot)"
    >
      <span class="hs-tile-icon">
        {{ slot.unlocked && slot.tileType ? TILE_TYPES[slot.tileType]?.icon : (slot.unlocked ? '?' : '🔒') }}
      </span>
      <span class="hs-tile-label">
        {{ slot.unlocked && slot.tileType ? TILE_TYPES[slot.tileType]?.name : '???' }}
      </span>
      <template v-if="!slot.unlocked && unlockRequirement(slot.slot)">
        <span
          class="hs-tile-unlock"
          :class="getLevel(unlockRequirement(slot.slot).building.id) >= unlockRequirement(slot.slot).level ? 'hs-tile-unlock--done' : ''"
          :title="`Build ${unlockRequirement(slot.slot).building.name} to Level ${unlockRequirement(slot.slot).level}`"
        >{{ unlockRequirement(slot.slot).building.icon }} Lv{{ unlockRequirement(slot.slot).level }}</span>
      </template>
      <div class="hs-tile-dots">
        <span
          v-for="b in slotsOnSlot(slot.slot)"
          :key="b.id"
          class="hs-dot"
          :class="b.building ? 'hs-dot--building' : b.offline ? 'hs-dot--offline' : 'hs-dot--done'"
        />
      </div>
    </div>
  </div>

	  <button class="hs-nav-reset" title="Reset game (clears save)" @click="resetGame">
		  ↺ Reset Game
	  </button>
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

.hs-planet-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.hs-player-name {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #a5b4fc;
  white-space: nowrap;
}

.hs-planet-name {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.6;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.hs-planet-colony-badge {
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #34d399;
  background: rgba(52,211,153,0.15);
  border: 1px solid rgba(52,211,153,0.35);
  padding: 1px 5px;
  border-radius: 999px;
}

.hs-planet-type-badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
  cursor: default;

  &--terrestrial {
    color: #86efac;
    border-color: rgba(134, 239, 172, 0.35);
    background: rgba(134, 239, 172, 0.08);
  }
  &--volcanic {
    color: #fca5a5;
    border-color: rgba(252, 165, 165, 0.35);
    background: rgba(252, 165, 165, 0.08);
  }
  &--frozen {
    color: #93c5fd;
    border-color: rgba(147, 197, 253, 0.35);
    background: rgba(147, 197, 253, 0.08);
  }
  &--ocean {
    color: #67e8f9;
    border-color: rgba(103, 232, 249, 0.35);
    background: rgba(103, 232, 249, 0.08);
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
  aspect-ratio: 1;
  border-radius: var(--hs-r-md);
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
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

.hs-tile-icon  { font-size: 1.5rem; }
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
  gap: 3px;
  margin-top: 2px;
  min-height: 8px;
}

.hs-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;

  &--done     { background: var(--hs-ok); }
  &--building { background: var(--hs-warn); animation: pulse 1.2s ease-in-out infinite; }
  &--offline  { background: var(--hs-danger); animation: pulse 1.5s ease-in-out infinite; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

.hs-nav-reset {
	padding: 0.25rem 0.15rem;
	border-radius: var(--hs-r-md);
	border: 1px solid rgba(255, 255, 255, 0.08);
	background: none;
	color: rgba(255, 255, 255, 0.2);
	font-size: 0.65rem;
	cursor: pointer;
	transition: color 0.15s, border-color 0.15s;

	&:hover {
		color: var(--hs-danger);
		border-color: var(--hs-danger-border);
	}
}
</style>
