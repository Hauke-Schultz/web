<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

definePageMeta({ hideHeader: true })

// ── Resources ─────────────────────────────────────────────
const resources = ref({
  population: 5,
  metal:      50,
  crystal:    20,
  energy:     30,
})

// ── Building definitions ───────────────────────────────────
const BUILDINGS = {
  // Tile 5 – Base
  kommandozentrale: {
    name:      'Kommandozentrale',
    tile:      5,
    cost:      {},
    buildTime: 10,
    unique:    true,
    effect:    'Schaltet Bergbau-Kachel frei',
    onComplete: (state) => { state.tiles[1].unlocked = true },
  },
  quartiere: {
    name:      'Quartiere',
    tile:      5,
    cost:      { metal: 30 },
    buildTime: 30,
    unique:    false,
    effect:    '+2 Bevölkerung max.',
    onComplete: (state) => { resources.value.population += 2 },
  },
  energiegenerator: {
    name:      'Energiegenerator',
    tile:      5,
    cost:      { crystal: 10 },
    buildTime: 20,
    unique:    true,
    effect:    '+2 Energie / Tick',
    production: { energy: 2 },
  },
  // Tile 2 – Bergbau
  metallmine: {
    name:      'Metallmine',
    tile:      2,
    cost:      { energy: 10 },
    buildTime: 15,
    unique:    false,
    effect:    '+3 Metall / Tick',
    production: { metal: 3 },
  },
  kristallbohrer: {
    name:      'Kristallbohrer',
    tile:      2,
    cost:      { metal: 20 },
    buildTime: 25,
    unique:    true,
    effect:    '+2 Kristall / Tick',
    production: { crystal: 2 },
  },
}

// ── Tile state ────────────────────────────────────────────
// tiles indexed 0–8, tile 5 = index 4 (center of 3x3)
const TILE_DEFS = [
  { id: 1, label: '?',        type: null,    unlocked: false },
  { id: 2, label: 'Bergbau',  type: 'mine',  unlocked: false },
  { id: 3, label: '?',        type: null,    unlocked: false },
  { id: 4, label: '?',        type: null,    unlocked: false },
  { id: 5, label: 'Basis',    type: 'base',  unlocked: true  },
  { id: 6, label: '?',        type: null,    unlocked: false },
  { id: 7, label: '?',        type: null,    unlocked: false },
  { id: 8, label: '?',        type: null,    unlocked: false },
  { id: 9, label: '?',        type: null,    unlocked: false },
]

const tiles = ref(TILE_DEFS.map(t => ({ ...t })))

// ── Active tile ───────────────────────────────────────────
const activeTileId = ref(5)
const activeTile   = computed(() => tiles.value.find(t => t.id === activeTileId.value))

const selectTile = (tile) => {
  if (!tile.unlocked) return
  activeTileId.value = tile.id
}

// ── Buildings placed ──────────────────────────────────────
// { id, key, name, built: bool, buildEnd: timestamp | null }
const placed = ref([])
let placedCtr = 0

const placedOnTile = (tileId) =>
  placed.value.filter(b => BUILDINGS[b.key].tile === tileId)

const isBuilt = (key) => placed.value.some(b => b.key === key && b.built)
const isBuilding = (key) => placed.value.some(b => b.key === key && !b.built)

const canAfford = (cost) => {
  for (const [res, amt] of Object.entries(cost)) {
    if ((resources.value[res] ?? 0) < amt) return false
  }
  return true
}

const buildingsForTile = (tileId) =>
  Object.entries(BUILDINGS)
    .filter(([, def]) => def.tile === tileId)
    .map(([key, def]) => ({ key, ...def }))

const startBuild = (key) => {
  const def = BUILDINGS[key]
  if (!def) return
  if (def.unique && (isBuilt(key) || isBuilding(key))) return
  if (!canAfford(def.cost)) return

  // Deduct cost
  for (const [res, amt] of Object.entries(def.cost)) {
    resources.value[res] -= amt
  }

  const id = placedCtr++
  placed.value.push({
    id,
    key,
    name:     def.name,
    built:    false,
    buildEnd: Date.now() + def.buildTime * 1000,
  })
}

// ── Timer display ─────────────────────────────────────────
const now = ref(Date.now())
const remainingSec = (buildEnd) => Math.max(0, Math.ceil((buildEnd - now.value) / 1000))
const formatTime = (sec) => sec >= 60
  ? `${Math.floor(sec / 60)}m ${sec % 60}s`
  : `${sec}s`

// ── Production tick ───────────────────────────────────────
const production = computed(() => {
  const prod = { metal: 0, crystal: 0, energy: 0 }
  for (const b of placed.value) {
    if (!b.built) continue
    const p = BUILDINGS[b.key]?.production
    if (!p) continue
    for (const [res, amt] of Object.entries(p)) {
      prod[res] = (prod[res] ?? 0) + amt
    }
  }
  return prod
})

// ── Tick loop ─────────────────────────────────────────────
let tickInterval = null

const tick = () => {
  now.value = Date.now()

  // Complete finished buildings
  for (const b of placed.value) {
    if (!b.built && b.buildEnd <= now.value) {
      b.built = true
      const def = BUILDINGS[b.key]
      if (def?.onComplete) def.onComplete({ tiles: tiles.value })
    }
  }

  // Production
  const prod = production.value
  for (const [res, amt] of Object.entries(prod)) {
    resources.value[res] = (resources.value[res] ?? 0) + amt
  }
}

onMounted(() => {
  tickInterval = setInterval(tick, 1000)
})

onUnmounted(() => {
  clearInterval(tickInterval)
})

// ── Helpers ───────────────────────────────────────────────
const RES_ICONS = {
  population: '👥',
  metal:      '⛏️',
  crystal:    '💎',
  energy:     '⚡',
}

const TILE_ICONS = {
  base: '🏛️',
  mine: '⛏️',
}
</script>

<template>
  <div class="hs-page">

    <!-- Resource bar -->
    <div class="hs-resources">
      <div v-for="(icon, key) in RES_ICONS" :key="key" class="hs-res-card">
        <span class="hs-res-icon">{{ icon }}</span>
        <span class="hs-res-label">{{ key === 'population' ? 'Pop' : key }}</span>
        <span class="hs-res-value">{{ Math.floor(resources[key]) }}</span>
        <span v-if="key !== 'population' && production[key]" class="hs-res-prod">
          +{{ production[key] }}/s
        </span>
      </div>
    </div>

    <!-- Planet grid 3x3 -->
    <div class="hs-grid">
      <div
        v-for="tile in tiles"
        :key="tile.id"
        class="hs-tile"
        :class="{
          'hs-tile--locked':  !tile.unlocked,
          'hs-tile--active':  tile.unlocked && activeTileId === tile.id,
          'hs-tile--unlocked': tile.unlocked && activeTileId !== tile.id,
        }"
        @click="selectTile(tile)"
      >
        <span class="hs-tile-icon">{{ tile.unlocked ? (TILE_ICONS[tile.type] ?? '?') : '🔒' }}</span>
        <span class="hs-tile-label">{{ tile.unlocked ? tile.label : '???' }}</span>
        <div class="hs-tile-dots">
          <span
            v-for="b in placedOnTile(tile.id)"
            :key="b.id"
            class="hs-dot"
            :class="b.built ? 'hs-dot--done' : 'hs-dot--building'"
          />
        </div>
      </div>
    </div>

    <!-- Tile detail panel -->
    <div class="hs-panel">
      <h2 class="hs-panel-title">{{ activeTile?.label ?? '–' }}</h2>

      <div class="hs-building-list">
        <div
          v-for="bDef in buildingsForTile(activeTileId)"
          :key="bDef.key"
          class="hs-building-row"
        >
          <!-- Status icon -->
          <div class="hs-building-status" :class="isBuilt(bDef.key) ? 'hs-building-status--done' : ''">
            <span v-if="isBuilt(bDef.key)">✅</span>
            <span v-else-if="isBuilding(bDef.key)" style="animation: pulse 1s infinite;">🔨</span>
            <span v-else>🏗️</span>
          </div>

          <!-- Info -->
          <div class="hs-building-info">
            <div class="hs-building-name">{{ bDef.name }}</div>
            <div class="hs-building-effect">{{ bDef.effect }}</div>

            <!-- Cost tags -->
            <div v-if="!isBuilt(bDef.key) && !isBuilding(bDef.key) && Object.keys(bDef.cost).length" class="hs-cost-row">
              <span
                v-for="(amt, res) in bDef.cost"
                :key="res"
                class="hs-cost-tag"
                :class="(resources[res] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
              >{{ RES_ICONS[res] }} {{ amt }}</span>
            </div>

            <!-- Build progress bar -->
            <template v-if="isBuilding(bDef.key)">
              <div
                v-for="b in placed.filter(p => p.key === bDef.key && !p.built)"
                :key="b.id"
                class="hs-progress-row"
              >
                <div class="hs-progress-track">
                  <div
                    class="hs-progress-fill"
                    :style="{ width: `${100 - (remainingSec(b.buildEnd) / BUILDINGS[b.key].buildTime) * 100}%` }"
                  />
                </div>
                <span class="hs-progress-time">{{ formatTime(remainingSec(b.buildEnd)) }}</span>
              </div>
            </template>
          </div>

          <!-- Action -->
          <div class="hs-building-action">
            <button
              v-if="!isBuilt(bDef.key) && !isBuilding(bDef.key)"
              class="hs-btn-build"
              :class="{ 'hs-btn-build--disabled': !canAfford(bDef.cost) }"
              :disabled="!canAfford(bDef.cost)"
              @click.stop="startBuild(bDef.key)"
            >Bauen</button>
            <span v-else-if="isBuilt(bDef.key)" class="hs-status-done">Fertig</span>
            <span v-else class="hs-status-building">Im Bau</span>
          </div>
        </div>
      </div>

      <div v-if="buildingsForTile(activeTileId).length === 0" class="hs-empty">
        Noch keine Aktionen verfügbar
      </div>
    </div>

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
.hs-res-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.5; }
.hs-res-value { font-size: 1rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.hs-res-prod  { font-size: 0.65rem; color: #4ade80; font-variant-numeric: tabular-nums; }

/* ── Planet grid 3×3 ─────────────────────────────────────── */
.hs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  width: 300px;
  margin-bottom: 1.5rem;
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

.hs-tile--locked {
  background: rgba(255,255,255,0.03);
  border-color: rgba(255,255,255,0.05);
  opacity: 0.4;
  cursor: not-allowed;
}

.hs-tile--unlocked {
  background: rgba(255,255,255,0.07);
  border-color: rgba(255,255,255,0.12);
}
.hs-tile--unlocked:hover {
  background: rgba(255,255,255,0.12);
}

.hs-tile--active {
  background: rgba(99,102,241,0.35);
  border-color: rgba(129,140,248,0.6);
  box-shadow: 0 0 20px rgba(99,102,241,0.2);
}

.hs-tile-icon  { font-size: 1.5rem; }
.hs-tile-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.05em; opacity: 0.7; }

.hs-tile-dots { display: flex; gap: 3px; margin-top: 2px; }
.hs-dot { width: 6px; height: 6px; border-radius: 50%; }
.hs-dot--done     { background: #4ade80; }
.hs-dot--building { background: #facc15; animation: pulse 1s ease-in-out infinite; }

/* ── Detail panel ─────────────────────────────────────────── */
.hs-panel {
  width: 100%;
  max-width: 28rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 1rem;
  padding: 1rem;
}

.hs-panel-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.55;
  margin-bottom: 0.75rem;
  color: #fff;
}

.hs-building-list { display: flex; flex-direction: column; gap: 0.5rem; }

.hs-building-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
}

.hs-building-status {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: rgba(255,255,255,0.05);
  font-size: 1rem;
}
.hs-building-status--done { background: rgba(74,222,128,0.15); }

.hs-building-info { flex: 1; min-width: 0; }
.hs-building-name   { font-size: 0.875rem; font-weight: 600; line-height: 1.2; }
.hs-building-effect { font-size: 0.7rem; opacity: 0.5; margin-top: 2px; }

.hs-cost-row { display: flex; gap: 0.5rem; margin-top: 0.375rem; }
.hs-cost-tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 6px;
}
.hs-cost-tag--ok { background: rgba(74,222,128,0.15); color: #86efac; }
.hs-cost-tag--no { background: rgba(248,113,113,0.15); color: #fca5a5; }

.hs-progress-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
}
.hs-progress-track {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 9999px;
  overflow: hidden;
}
.hs-progress-fill {
  height: 100%;
  background: #facc15;
  border-radius: 9999px;
  transition: width 1s linear;
}
.hs-progress-time { font-size: 0.65rem; color: #fde047; font-variant-numeric: tabular-nums; width: 3rem; text-align: right; }

.hs-building-action { flex-shrink: 0; }

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
}
.hs-btn-build:hover:not(:disabled) { background: #818cf8; }
.hs-btn-build--disabled {
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.3);
  cursor: not-allowed;
}

.hs-status-done     { font-size: 0.75rem; font-weight: 600; color: #4ade80; }
.hs-status-building { font-size: 0.75rem; font-weight: 600; color: #facc15; }

.hs-empty { text-align: center; padding: 1rem; opacity: 0.3; font-size: 0.875rem; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
</style>
