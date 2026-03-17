<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RESOURCES, TILE_TYPES, PLANET_GRID, BUILDINGS } from './hawkStarConfig.js'

definePageMeta({ hideHeader: true })

// ── Player state (maps directly to DB tables) ──────────────
// player_resources: { resourceId → amount }
const playerResources = ref({
  population: 15,
  metal:      200,
  crystal:    80,
  energy:     0,
})

// player_planet_slots: { slot → unlocked }
const playerSlots = ref(
  PLANET_GRID.map(s => ({ ...s, unlocked: s.startsUnlocked }))
)

// player_buildings: { buildingId → { level, buildEndsAt } }
// level 0 = not built yet
const playerBuildings = ref(
  Object.fromEntries(
    Object.keys(BUILDINGS).map(id => [id, { level: 0, buildEndsAt: /** @type {number|null} */ (null) }])
  )
)

// ── Active tile ────────────────────────────────────────────
const activeSlot = ref(5)

const activeSlotDef = computed(() =>
  playerSlots.value.find(s => s.slot === activeSlot.value)
)

const activeTileType = computed(() =>
  activeSlotDef.value?.tileType ? TILE_TYPES[activeSlotDef.value.tileType] : null
)

const selectSlot = (slot) => {
  if (!slot.unlocked) return
  activeSlot.value = slot.slot
}

// ── Building helpers ───────────────────────────────────────
// Returns buildings for the currently active tile type
const buildingsForActiveSlot = computed(() => {
  if (!activeTileType.value) return []
  return Object.values(BUILDINGS).filter(b => b.tileType === activeTileType.value.id)
})

// Current built level (0 = not built)
const getLevel = (id) => playerBuildings.value[id]?.level ?? 0

// Is a build/upgrade in progress?
const isBuildingInProgress = (id) => {
  const b = playerBuildings.value[id]
  return b?.buildEndsAt !== null
}

// Next level definition (null = max level reached)
const nextLevelDef = (id) => {
  const currentLevel = getLevel(id)
  return BUILDINGS[id]?.levels[currentLevel] ?? null
}

const canAfford = (cost) => {
  for (const [res, amt] of Object.entries(cost)) {
    if ((playerResources.value[res] ?? 0) < amt) return false
  }
  return true
}

// Check if adding this building's drain would keep net energy >= 0.
// Upgrades only check the delta (new drain - current drain).
// Buildings with no drain (power plants) are always allowed.
const hasEnoughPower = (id) => {
  const next = nextLevelDef(id)
  if (!next?.energyDrain) return true
  const currentDrain = getLevel(id) > 0
    ? (BUILDINGS[id]?.levels[getLevel(id) - 1]?.energyDrain ?? 0)
    : 0
  const deltaDrain = next.energyDrain - currentDrain
  return production.value.energy - deltaDrain >= 0
}

// Effective level for drain calculation:
// a building currently being constructed/upgraded already reserves its next level's drain.
const effectiveLevel = (state) => state.buildEndsAt ? state.level + 1 : state.level

// Total workers assigned (includes buildings currently being built/upgraded)
const totalStaffDrain = computed(() => {
  let drain = 0
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    const lvl = effectiveLevel(state)
    if (lvl === 0) continue
    drain += BUILDINGS[id]?.levels[lvl - 1]?.staffDrain ?? 0
  }
  return drain
})

// Free workers = max population (playerResources.population) minus currently assigned
const freeWorkers = computed(() => playerResources.value.population - totalStaffDrain.value)

// Check if assigning delta staff for next level would stay >= 0.
// Upgrades only check the delta (new staffDrain - current staffDrain).
const hasEnoughStaff = (id) => {
  const next = nextLevelDef(id)
  if (!next?.staffDrain) return true
  const currentDrain = getLevel(id) > 0
    ? (BUILDINGS[id]?.levels[getLevel(id) - 1]?.staffDrain ?? 0)
    : 0
  const deltaDrain = next.staffDrain - currentDrain
  return freeWorkers.value - deltaDrain >= 0
}

// All buildings except command_center require it to be built first
const commandCenterBuilt = computed(() => playerBuildings.value['command_center']?.level >= 1)

// Additional workers needed for the next level (delta, not total)
const staffDelta = (id) => {
  const next = nextLevelDef(id)
  if (!next?.staffDrain) return 0
  const current = getLevel(id) > 0 ? (BUILDINGS[id]?.levels[getLevel(id) - 1]?.staffDrain ?? 0) : 0
  return next.staffDrain - current
}

const canBuild = (id) =>
  (id === 'command_center' || commandCenterBuilt.value) &&
  canAfford(nextLevelDef(id)?.cost ?? {}) &&
  hasEnoughPower(id) &&
  hasEnoughStaff(id)

const startBuild = (id) => {
  const next = nextLevelDef(id)
  if (!next) return
  if (isBuildingInProgress(id)) return
  if (!canBuild(id)) return

  for (const [res, amt] of Object.entries(next.cost)) {
    playerResources.value[res] -= amt
  }
  playerBuildings.value[id].buildEndsAt = Date.now() + next.buildTime * 1000
}

// ── Production & energy balance ────────────────────────────
// Gross resource production (metal, crystal, energy output from power buildings)
const grossProduction = computed(() => {
  const prod = {}
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    if (state.level === 0) continue
    const levelDef = BUILDINGS[id]?.levels[state.level - 1]
    for (const [res, amt] of Object.entries(levelDef?.production ?? {})) {
      prod[res] = (prod[res] ?? 0) + amt
    }
  }
  return prod
})

// Total energy drained (includes buildings currently being built/upgraded)
const totalEnergyDrain = computed(() => {
  let drain = 0
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    const lvl = effectiveLevel(state)
    if (lvl === 0) continue
    drain += BUILDINGS[id]?.levels[lvl - 1]?.energyDrain ?? 0
  }
  return drain
})

// Net production shown in UI: energy = output - drain, others unchanged
const production = computed(() => ({
  ...grossProduction.value,
  energy: (grossProduction.value.energy ?? 0) - totalEnergyDrain.value,
}))

// True if colony is in energy deficit
const energyDeficit = computed(() => production.value.energy < 0)

// ── Storage caps ───────────────────────────────────────────
// Base storage when no mine/drill is built yet
const BASE_STORAGE = { metal: 100, crystal: 50 }

const maxStorage = computed(() => {
  const caps = { ...BASE_STORAGE }
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    if (state.level === 0) continue
    const storage = BUILDINGS[id]?.levels[state.level - 1]?.storageCapacity ?? {}
    for (const [res, cap] of Object.entries(storage)) {
      caps[res] = (caps[res] ?? 0) + cap
    }
  }
  return caps
})

// ── Slot dot indicators (built / in-progress) ─────────────
const slotsOnSlot = (slot) => {
  const tileType = playerSlots.value.find(s => s.slot === slot)?.tileType
  if (!tileType) return []
  return Object.values(BUILDINGS)
    .filter(b => b.tileType === tileType)
    .map(b => ({
      id:      b.id,
      level:   getLevel(b.id),
      building: isBuildingInProgress(b.id),
    }))
    .filter(b => b.level > 0 || b.building)
}

// ── Tick loop ──────────────────────────────────────────────
const now = ref(Date.now())
let tickInterval = null

const remainingSec = (buildEndsAt) =>
  Math.max(0, Math.ceil((buildEndsAt - now.value) / 1000))

const formatTime = (sec) =>
  sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`

const tick = () => {
  now.value = Date.now()

  // Complete finished builds
  for (const [id, state] of Object.entries(playerBuildings.value)) {
    if (!state.buildEndsAt || state.buildEndsAt > now.value) continue

    state.level += 1
    state.buildEndsAt = null

    const levelDef = BUILDINGS[id]?.levels[state.level - 1]

    // Unlock slots
    if (levelDef?.unlocks) {
      for (const { slot } of levelDef.unlocks) {
        const s = playerSlots.value.find(ps => ps.slot === slot)
        if (s) s.unlocked = true
      }
    }

    // Population bonus
    if (levelDef?.popBonus) {
      playerResources.value.population += levelDef.popBonus
    }
  }

  // Production tick — net values (energy already has drain subtracted)
  for (const [res, amt] of Object.entries(production.value)) {
    const newVal = Math.max(0, (playerResources.value[res] ?? 0) + amt)
    const cap = maxStorage.value[res]
    playerResources.value[res] = cap !== undefined ? Math.min(newVal, cap) : newVal
  }
}

onMounted(() => { tickInterval = setInterval(tick, 1000) })
onUnmounted(() => { clearInterval(tickInterval) })
</script>

<template>
  <div class="hs-page">

    <!-- Resource bar -->
    <div class="hs-resources">
      <div
        v-for="res in RESOURCES"
        :key="res.id"
        class="hs-res-card"
        :class="{
          'hs-res-card--deficit': (res.id === 'energy' && energyDeficit) || (res.id === 'population' && freeWorkers < 0)
        }"
      >
        <span class="hs-res-icon">{{ res.icon }}</span>
        <span class="hs-res-label">{{ res.name }}</span>
        <!-- big value: free/net for energy+pop, current amount for metal+crystal -->
        <span
          class="hs-res-value"
          :class="{
            'hs-res-value--deficit': (res.id === 'energy' && energyDeficit) || (res.id === 'population' && freeWorkers < 0)
          }"
        >
          <template v-if="res.id === 'energy'">{{ production.energy > 0 ? `+${production.energy}` : production.energy }}</template>
          <template v-else-if="res.id === 'population'">{{ freeWorkers > 0 ? `+${freeWorkers}` : freeWorkers }}</template>
          <template v-else>{{ Math.floor(playerResources[res.id]) }}</template>
        </span>
        <!-- small line: max/total context -->
        <span
          v-if="res.id === 'energy'"
          class="hs-res-prod"
          :class="energyDeficit ? 'hs-res-prod--neg' : 'hs-res-prod--pos'"
        >{{ production.energy }}/{{ grossProduction.energy ?? 0 }}</span>
        <span
          v-else-if="res.id === 'population'"
          class="hs-res-prod"
          :class="freeWorkers < 0 ? 'hs-res-prod--neg' : ''"
        >{{ freeWorkers }}/{{ playerResources[res.id] }}</span>
        <span
          v-else
          class="hs-res-prod"
          :class="production[res.id] > 0 ? 'hs-res-prod--pos' : ''"
        >
          {{ production[res.id] ? `+${production[res.id]}/s` : '' }}
          <template v-if="maxStorage[res.id]"> · /{{ maxStorage[res.id] }}</template>
        </span>
      </div>
    </div>

    <!-- Grid + Panel side by side -->
    <div class="hs-main">

    <!-- Planet grid 3×3 -->
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
        <div class="hs-tile-dots">
          <span
            v-for="b in slotsOnSlot(slot.slot)"
            :key="b.id"
            class="hs-dot"
            :class="b.building ? 'hs-dot--building' : 'hs-dot--done'"
          />
        </div>
      </div>
    </div>

    <!-- Tile detail panel -->
    <div class="hs-panel">
      <div class="hs-panel-header">
        <span class="hs-panel-icon">{{ activeTileType?.icon ?? '?' }}</span>
        <h2 class="hs-panel-title">{{ activeTileType?.name ?? 'Select a tile' }}</h2>
        <span class="hs-panel-desc">{{ activeTileType?.description ?? '' }}</span>
      </div>

      <div class="hs-building-list">
        <div
          v-for="bDef in buildingsForActiveSlot"
          :key="bDef.id"
          class="hs-building-row"
        >
          <!-- Icon + level badge -->
          <div class="hs-building-icon-wrap">
            <span class="hs-building-icon">{{ bDef.icon }}</span>
            <span
              v-if="getLevel(bDef.id) > 0"
              class="hs-level-badge"
            >Lv{{ getLevel(bDef.id) }}</span>
          </div>

          <!-- Info block -->
          <div class="hs-building-info">
            <div class="hs-building-name">{{ bDef.name }}</div>

            <!-- Show next level effect or "max level" -->
            <div class="hs-building-effect">
              <template v-if="nextLevelDef(bDef.id)">
                {{ getLevel(bDef.id) === 0 ? '' : '→ ' }}{{ nextLevelDef(bDef.id).effect }}
              </template>
              <template v-else>
                Max level reached
              </template>
            </div>

            <!-- Cost row -->
            <div
              v-if="nextLevelDef(bDef.id) && !isBuildingInProgress(bDef.id) && (Object.keys(nextLevelDef(bDef.id).cost).length || staffDelta(bDef.id) > 0)"
              class="hs-cost-row"
            >
              <span
		              v-if="staffDelta(bDef.id) > 0"
		              class="hs-cost-tag"
		              :class="freeWorkers >= staffDelta(bDef.id) ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
              >👥 {{ staffDelta(bDef.id) }}</span>
              <span
                v-for="(amt, resId) in nextLevelDef(bDef.id).cost"
                :key="resId"
                class="hs-cost-tag"
                :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
              >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
            </div>

            <!-- Progress bar -->
            <template v-if="isBuildingInProgress(bDef.id)">
              <div class="hs-progress-row">
                <div class="hs-progress-track">
                  <div
                    class="hs-progress-fill"
                    :style="{
                      width: `${100 - (remainingSec(playerBuildings[bDef.id].buildEndsAt) / BUILDINGS[bDef.id].levels[getLevel(bDef.id)].buildTime) * 100}%`
                    }"
                  />
                </div>
                <span class="hs-progress-time">{{ formatTime(remainingSec(playerBuildings[bDef.id].buildEndsAt)) }}</span>
              </div>
            </template>
          </div>

          <!-- Action button -->
          <div class="hs-building-action">
            <template v-if="isBuildingInProgress(bDef.id)">
              <span class="hs-status-building">Building…</span>
            </template>
            <template v-else-if="!nextLevelDef(bDef.id)">
              <span class="hs-status-max">MAX</span>
            </template>
            <template v-else>
              <div class="hs-btn-wrap">
                <button
                  class="hs-btn-build"
                  :class="{ 'hs-btn-build--disabled': !canBuild(bDef.id) }"
                  :disabled="!canBuild(bDef.id)"
                  @click.stop="startBuild(bDef.id)"
                >{{ getLevel(bDef.id) === 0 ? 'Build' : 'Upgrade' }}</button>
                <span v-if="!hasEnoughPower(bDef.id)" class="hs-no-power">⚡ Need power</span>
                <span v-if="!hasEnoughStaff(bDef.id)" class="hs-no-staff">👥 Need staff</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div v-if="buildingsForActiveSlot.length === 0" class="hs-empty">
        Select an unlocked tile to manage buildings
      </div>
    </div>

    </div> <!-- hs-main -->

  </div>
</template>

<style scoped>
/* ── Page ─────────────────────────────────────────────────── */
.hs-page {
  min-height: 100dvh;
  background: linear-gradient(to bottom, #0a0a1a, #0d1a2e);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem;
  color: #fff;
  user-select: none;
}

/* ── Resource bar ─────────────────────────────────────────── */
.hs-resources {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  width: 100%;
  max-width: 28rem;
  margin-bottom: 1.5rem;
}
.hs-res-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.75rem;
  padding: 0.5rem 0.25rem;
}
.hs-res-icon  { font-size: 1.25rem; line-height: 1; }
.hs-res-label { font-size: 0.6rem; text-transform: capitalize; opacity: 0.5; }
.hs-res-value { font-size: 1rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.hs-res-value--deficit { color: #f87171; }
.hs-res-prod          { font-size: 0.6rem; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.35); }
.hs-res-prod--pos     { color: #4ade80; }
.hs-res-prod--neg     { color: #f87171; }
.hs-res-card--deficit { border-color: rgba(248,113,113,0.5); background: rgba(248,113,113,0.08); }

/* ── Main layout: grid + panel side by side ───────────────── */
.hs-main {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  width: 100%;
  max-width: 52rem;
}

/* ── Planet grid 3×3 ─────────────────────────────────────── */
.hs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  width: 220px;
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
.hs-tile--locked   { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05); opacity: 0.4; cursor: not-allowed; }
.hs-tile--unlocked { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); }
.hs-tile--unlocked:hover { background: rgba(255,255,255,0.12); }
.hs-tile--active   { background: rgba(99,102,241,0.35); border-color: rgba(129,140,248,0.6); box-shadow: 0 0 20px rgba(99,102,241,0.2); }

.hs-tile-icon  { font-size: 1.5rem; }
.hs-tile-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.04em; opacity: 0.7; }

.hs-tile-dots { display: flex; gap: 3px; margin-top: 2px; min-height: 8px; }
.hs-dot { width: 6px; height: 6px; border-radius: 50%; }
.hs-dot--done     { background: #4ade80; }
.hs-dot--building { background: #facc15; animation: pulse 1.2s ease-in-out infinite; }

/* ── Detail panel ─────────────────────────────────────────── */
.hs-panel {
  flex: 1;
  min-width: 0;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 1rem;
  padding: 1rem;
}
.hs-panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.hs-panel-icon  { font-size: 1.25rem; }
.hs-panel-title { font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0; flex: 1; }
.hs-panel-desc  { font-size: 0.65rem; opacity: 0.4; }

/* ── Building rows ────────────────────────────────────────── */
.hs-building-list { display: flex; flex-direction: column; gap: 0.5rem; }
.hs-building-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 0.75rem;
  padding: 0.75rem;
}

.hs-building-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.06);
  border-radius: 0.5rem;
}
.hs-building-icon  { font-size: 1.1rem; }
.hs-level-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 0.55rem;
  font-weight: 700;
  background: #6366f1;
  color: #fff;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.4;
}

.hs-building-info   { flex: 1; min-width: 0; }
.hs-building-name   { font-size: 0.825rem; font-weight: 600; }
.hs-building-effect { font-size: 0.68rem; opacity: 0.5; margin-top: 2px; }

.hs-cost-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.hs-cost-tag { font-size: 0.65rem; padding: 2px 6px; border-radius: 5px; }
.hs-cost-tag--ok { background: rgba(74,222,128,0.15); color: #86efac; }
.hs-cost-tag--no { background: rgba(248,113,113,0.15); color: #fca5a5; }

.hs-progress-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 6px; }
.hs-progress-track { flex: 1; height: 4px; background: rgba(255,255,255,0.1); border-radius: 9999px; overflow: hidden; }
.hs-progress-fill { height: 100%; background: #facc15; border-radius: 9999px; transition: width 1s linear; }
.hs-progress-time { font-size: 0.65rem; color: #fde047; font-variant-numeric: tabular-nums; width: 3.5rem; text-align: right; flex-shrink: 0; }

.hs-building-action { flex-shrink: 0; }
.hs-btn-wrap   { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.hs-no-power   { font-size: 0.6rem; color: #f87171; white-space: nowrap; }
.hs-no-staff   { font-size: 0.6rem; color: #fb923c; white-space: nowrap; }
.hs-btn-build {
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  background: #6366f1;
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.hs-btn-build:hover:not(:disabled) { background: #818cf8; }
.hs-btn-build--disabled { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.3); cursor: not-allowed; }

.hs-status-building { font-size: 0.7rem; font-weight: 600; color: #facc15; white-space: nowrap; }
.hs-status-max      { font-size: 0.7rem; font-weight: 700; color: #a78bfa; letter-spacing: 0.05em; }

.hs-empty { text-align: center; padding: 1.5rem; opacity: 0.25; font-size: 0.875rem; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
</style>
