<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsCommLog from '~/components/hawk-star/HsCommLog.vue'

const {
  playerColonizedPlanets,
  homeSystemId,
  now,
  formatTime,
  interstellarCommLevel,
  systemContacts,
  canScanSystem,
  scanSystem,
  galaxySystems,
} = useHawkStar()

const { t } = useI18n()

// ── System order: home system always first ────────────────────────────────────
const sortedSystems = computed(() => {
  const home = galaxySystems.value.find(s => s.id === homeSystemId.value)
  const rest = galaxySystems.value.filter(s => s.id !== homeSystemId.value)
  return home ? [home, ...rest] : [...galaxySystems.value]
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const STAR_CLASS_ICON = { G: '☀️', K: '🟠', M: '🔴', F: '⚪' }

const isHome = (sys) => sys.id === homeSystemId.value

const isInhabited = (sys) =>
  (sys.factions?.length > 0) || sys.planets.some(p => p.owner)

const contactOf = (sysId) =>
  systemContacts.value[sysId] ?? { scanState: 'unscanned', scanEndsAt: null }

// Home system is always treated as scanned (it's the player's own)
const resolvedScanState = (sys) =>
  isHome(sys) ? 'scanned' : contactOf(sys.id).scanState

const scanRemaining = (sysId) => {
  const c = contactOf(sysId)
  return c.scanEndsAt ? Math.max(0, Math.ceil((c.scanEndsAt - now.value) / 1000)) : 0
}

const ownedCount = (sys, factionName) =>
  sys.planets.filter(p => p.owner === factionName).length

// ── Selection — home system pre-selected ──────────────────────────────────────
const selectedId = ref(homeSystemId.value)
const selected   = computed(() => galaxySystems.value.find(s => s.id === selectedId.value) ?? null)

const selectSystem = (sys) => {
  selectedId.value = selectedId.value === sys.id ? null : sys.id
}

// Card only visible when home or fully scanned
const showCard = (sys) => isHome(sys) || resolvedScanState(sys) === 'scanned'

// ── Tile CSS classes ───────────────────────────────────────────────────────────
const tileClass = (sys) => {
  const st = resolvedScanState(sys)
  return [
    isHome(sys)                          ? 'hs-galaxy-tile--home'      :
    st === 'scanning'                    ? 'hs-galaxy-tile--scanning'   :
    st === 'scanned' && isInhabited(sys) ? 'hs-galaxy-tile--inhabited'  :
    st === 'scanned'                     ? 'hs-galaxy-tile--scanned'    :
                                           'hs-galaxy-tile--unknown',
    selectedId.value === sys.id ? 'hs-galaxy-tile--selected' : '',
  ]
}
</script>

<template>
  <div class="hs-galaxy">

    <!-- ── System tile row ──────────────────────────────────────────────────── -->
    <div class="hs-galaxy-orbit">
      <div
        v-for="sys in sortedSystems"
        :key="sys.id"
        class="hs-galaxy-tile"
        :class="tileClass(sys)"
        @click="selectSystem(sys)"
      >
        <!-- HOME -->
        <template v-if="isHome(sys)">
          <span class="hs-galaxy-tile-icon">{{ STAR_CLASS_ICON[sys.starClass] ?? '⭐' }}</span>
          <span class="hs-galaxy-tile-name">{{ sys.name }}</span>
          <span class="hs-galaxy-tile-state hs-galaxy-tile-state--own">{{ t('hawkStar.galaxy.stateColony') }}</span>
        </template>

        <!-- SCANNING -->
        <template v-else-if="resolvedScanState(sys) === 'scanning'">
          <span class="hs-galaxy-tile-icon hs-pulse-scan">📶</span>
          <span class="hs-galaxy-tile-name">{{ sys.name }}</span>
          <span class="hs-galaxy-tile-state hs-galaxy-tile-state--scanning">{{ t('hawkStar.comm.scanning') }}</span>
          <span class="hs-galaxy-tile-timer">{{ formatTime(scanRemaining(sys.id)) }}</span>
        </template>

        <!-- SCANNED -->
        <template v-else-if="resolvedScanState(sys) === 'scanned'">
          <span class="hs-galaxy-tile-icon">
            {{ isInhabited(sys) ? (sys.factions?.[0]?.portrait ?? '👤') : (STAR_CLASS_ICON[sys.starClass] ?? '⭐') }}
          </span>
          <span class="hs-galaxy-tile-name">{{ sys.name }}</span>
          <span v-if="isInhabited(sys)" class="hs-galaxy-tile-state hs-galaxy-tile-state--inhabited">
            {{ sys.factions?.[0]?.name ?? '?' }}
          </span>
          <span v-else class="hs-galaxy-tile-state hs-galaxy-tile-state--free">
            {{ t('hawkStar.galaxy.stateUncolonized') }}
          </span>
        </template>

        <!-- UNSCANNED -->
        <template v-else>
          <span class="hs-galaxy-tile-icon">❓</span>
          <span class="hs-galaxy-tile-name">{{ sys.name }}</span>
          <span class="hs-galaxy-tile-unknown">{{ t('hawkStar.comm.unscanned') }}</span>
          <button
            v-if="canScanSystem(sys.id)"
            class="hs-galaxy-scan-btn"
            @click.stop="scanSystem(sys.id)"
          >📶 <span class="hs-galaxy-scan-btn__label">{{ t('hawkStar.comm.scanSystem') }}</span></button>
          <span v-else-if="interstellarCommLevel < 1" class="hs-galaxy-tile-locked">🔒</span>
        </template>
      </div>
    </div>

    <!-- ── Card + Comm Log side by side ─────────────────────────────────────── -->
    <Transition name="hs-slide">
      <div v-if="selected && showCard(selected)" class="hs-galaxy-panel">

        <!-- System card -->
        <div class="hs-galaxy-card">
          <div class="hs-galaxy-card-header">
            <div>
              <div class="hs-galaxy-card-name">{{ selected.name }}</div>
              <div class="hs-galaxy-card-meta">
                {{ t('hawkStar.galaxy.starMeta', { cls: selected.starClass, n: selected.planets.length }) }}
              </div>
            </div>
            <button class="hs-galaxy-card-close" @click="selectedId = null">✕</button>
          </div>

          <!-- Faction list (inhabited foreign systems) -->
          <div v-if="!isHome(selected) && isInhabited(selected)" class="hs-comm-section">
            <div class="hs-faction-list">
              <div v-for="faction in selected.factions ?? []" :key="faction.name" class="hs-faction-row">
                <span class="hs-faction-portrait">{{ faction.portrait }}</span>
                <div class="hs-faction-info">
                  <span class="hs-faction-name">{{ faction.name }}</span>
                  <span class="hs-faction-count">{{ ownedCount(selected, faction.name) }} 🪐</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Planet list -->
          <ul class="hs-planet-list">
            <li v-for="planet in selected.planets" :key="planet.id" class="hs-planet-item">
              <span class="hs-planet-name">{{ planet.name }}</span>
              <span
                v-if="playerColonizedPlanets.includes(planet.id)"
                class="hs-planet-tag hs-planet-tag--own"
              >{{ t('hawkStar.galaxy.stateColony') }}</span>
              <span
                v-else-if="planet.owner"
                class="hs-planet-tag hs-planet-tag--owner"
              >{{ planet.owner }}</span>
            </li>
          </ul>
        </div>

        <!-- Comm Log -->
        <div class="hs-galaxy-comm-wrap">
          <HsCommLog :system-id="selected.id" />
        </div>

      </div>
    </Transition>

  </div>
</template>

<style lang="scss" scoped>
.hs-galaxy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

// ── Tile row ──────────────────────────────────────────────────────────────────
.hs-galaxy-orbit {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.25rem;

  @media (min-width: 640px) {
    gap: 0.375rem;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}

// ── Tiles ─────────────────────────────────────────────────────────────────────
.hs-galaxy-tile {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
  border-radius: var(--hs-r-md);
  flex-shrink: 0;
  width: 2.25rem;
  padding: 0.4rem 0.1rem;
  cursor: pointer;
  transition: width 0.25s ease, background 0.15s;
  user-select: none;

  @media (min-width: 640px) {
    width: 5.5rem;
    padding: 0.625rem 0.375rem;
  }

  &--home      { border-color: rgba(96,165,250,0.6);   background: rgba(96,165,250,0.07); }
  &--unknown   { border-color: rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); }
  &--scanning  { border-color: rgba(251,191,36,0.55);  background: rgba(251,191,36,0.05); }
  &--scanned   { border-color: rgba(255,255,255,0.18); }
  &--inhabited { border-color: rgba(52,211,153,0.4);   background: rgba(52,211,153,0.04); }

  &--selected {
    outline: 2px solid var(--hs-active-border) !important;
    box-shadow: 0 0 20px var(--hs-active-glow) !important;
    outline-offset: -1px;
  }

  &:hover { background: rgba(255,255,255,0.04); }
}

// Mobile: selected tile expands
@media (max-width: 639px) {
  .hs-galaxy-tile--selected {
    flex: 1;
    width: auto;
    padding: 0.5rem 0.25rem;
  }

  .hs-galaxy-tile:not(.hs-galaxy-tile--selected) {
    .hs-galaxy-tile-name,
    .hs-galaxy-tile-state,
    .hs-galaxy-tile-unknown,
    .hs-galaxy-tile-timer,
    .hs-galaxy-tile-locked,
    .hs-galaxy-scan-btn { display: none; }
  }
}

// ── Tile content ──────────────────────────────────────────────────────────────
.hs-galaxy-tile-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.hs-galaxy-tile-name {
  font-size: 0.55rem;
  font-weight: 600;
  color: rgba(255,255,255,0.75);
  text-align: center;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.hs-galaxy-tile-state {
  font-size: 0.5rem;
  font-weight: 600;
  text-align: center;

  &--own      { color: rgba(96,165,250,0.85); }
  &--scanning { color: rgba(251,191,36,0.85); }
  &--inhabited{ color: rgba(52,211,153,0.85); }
  &--free     { color: rgba(107,114,128,0.75); }
}

.hs-galaxy-tile-timer {
  font-size: 0.5rem;
  font-weight: 700;
  color: rgba(251,191,36,0.9);
  font-variant-numeric: tabular-nums;
}

.hs-galaxy-tile-unknown {
  font-size: 0.48rem;
  color: rgba(255,255,255,0.2);
  font-style: italic;
}

.hs-galaxy-tile-locked {
  font-size: 0.6rem;
  opacity: 0.4;
}

// ── Scan button (inside tile) ─────────────────────────────────────────────────
.hs-galaxy-scan-btn {
  margin-top: 1px;
  padding: 2px 5px;
  border-radius: var(--hs-r-sm);
  font-size: 0.48rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(251,191,36,0.35);
  background: rgba(251,191,36,0.08);
  color: rgba(251,191,36,0.9);
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: rgba(251,191,36,0.18); border-color: rgba(251,191,36,0.6); }
}

.hs-galaxy-scan-btn__label {
  @media (max-width: 639px) { display: none; }
}

// ── Scan pulse animation ──────────────────────────────────────────────────────
@keyframes hs-pulse-scan {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

.hs-pulse-scan { animation: hs-pulse-scan 1.2s ease-in-out infinite; }

// ── Panel: card + comm log side by side ──────────────────────────────────────
.hs-galaxy-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: stretch;
    gap: 1rem;

    .hs-galaxy-card    { flex: 1; min-width: 0; }
    .hs-galaxy-comm-wrap { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  }
}

// ── System card ───────────────────────────────────────────────────────────────
.hs-galaxy-card {
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  padding: 0.625rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hs-galaxy-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.hs-galaxy-card-name { font-size: 0.82rem; font-weight: 700; color: #fff; }
.hs-galaxy-card-meta { font-size: 0.58rem; color: rgba(255,255,255,0.3); margin-top: 1px; }

.hs-galaxy-card-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: rgba(255,255,255,0.25);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 2px 4px;
  &:hover { color: rgba(255,255,255,0.65); }
}

// ── Comm section ──────────────────────────────────────────────────────────────
.hs-comm-section {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-faction-list { display: flex; flex-direction: column; gap: 0.25rem; }

.hs-faction-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.375rem;
  background: rgba(52,211,153,0.05);
  border: 1px solid rgba(52,211,153,0.12);
  border-radius: var(--hs-r-sm);
}

.hs-faction-portrait { font-size: 1rem; line-height: 1; }

.hs-faction-info {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.hs-faction-name  { font-size: 0.7rem; font-weight: 600; color: rgba(255,255,255,0.85); }
.hs-faction-count { font-size: 0.55rem; color: rgba(255,255,255,0.35); }

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
  padding: 0.2rem 0.375rem;
  border-radius: var(--hs-r-sm);
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
}

.hs-planet-name {
  flex: 1;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.75);
}

.hs-planet-tag {
  font-size: 0.52rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;

  &--own   { background: rgba(96,165,250,0.12); color: rgba(96,165,250,0.85); }
  &--owner { background: rgba(52,211,153,0.1);  color: rgba(52,211,153,0.8); }
}

// ── Slide transition ──────────────────────────────────────────────────────────
.hs-slide-enter-active,
.hs-slide-leave-active { transition: opacity 0.2s, transform 0.2s; }
.hs-slide-enter-from,
.hs-slide-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
