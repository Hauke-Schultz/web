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

<style scoped>
.hs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  flex-shrink: 0;
}
.hs-tile {
  aspect-ratio: 1;
  border-radius: 0.75rem;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.hs-tile--locked   { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05); cursor: not-allowed; }
.hs-tile--unlocked { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); }
.hs-tile--unlocked:hover { background: rgba(255,255,255,0.12); }
.hs-tile--active   { background: rgba(99,102,241,0.35); border-color: rgba(129,140,248,0.6); box-shadow: 0 0 20px rgba(99,102,241,0.2); }

.hs-tile-icon  { font-size: 1.5rem; }
.hs-tile-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.04em; opacity: 0.7; }
.hs-tile-unlock {
  font-size: 0.55rem;
  font-weight: 600;
  color: rgba(255,255,255,0.35);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 1px 5px;
  white-space: nowrap;
}
.hs-tile-unlock--done {
  color: #4ade80;
  border-color: rgba(74,222,128,0.3);
  background: rgba(74,222,128,0.08);
}

.hs-tile-dots { display: flex; gap: 3px; margin-top: 2px; min-height: 8px; }
.hs-dot { width: 6px; height: 6px; border-radius: 50%; }
.hs-dot--done     { background: #4ade80; }
.hs-dot--building { background: #facc15; animation: pulse 1.2s ease-in-out infinite; }
.hs-dot--offline  { background: #f87171; animation: pulse 1.5s ease-in-out infinite; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
</style>
