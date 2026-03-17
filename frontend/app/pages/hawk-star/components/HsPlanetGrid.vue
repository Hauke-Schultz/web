<script setup>
import { TILE_TYPES } from '../hawkStarConfig.js'
import { useHawkStar } from '../useHawkStar.js'

const {
  playerSlots,
  activeSlot,
  selectSlot,
  slotsOnSlot,
  unlockRequirement,
  getLevel,
} = useHawkStar()
</script>

<template>
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
</template>

<style lang="scss" scoped>
.hs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  flex-shrink: 0;
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
</style>
