<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TILE_TYPES, BUILDINGS } from '~/utils/hawkStarConfig.js'
import { useHawkStar, refreshPlanetState } from '~/composables/useHawkStar.js'
import HsPlanetMarker from '~/components/hawk-star/HsPlanetMarker.vue'

const props = defineProps({
  activePanel: { type: String, default: null },
})
const emit = defineEmits(['update:activePanel'])

const { t } = useI18n()

const {
  planetType,
  playerSlots,
  activeSlot,
  activePlanetId,
  homePlanetId,
  selectSlot,
  slotsOnSlot,
  unlockRequirement,
  getLevel,
  allPlanetStates,
  playerPortrait,
  playerName,
  batteryCharge,
  gridDown,
  recruitPool,
  recruitPoolMax,
  shieldCharge,
  hasAnomaly,
  foreignSatellites,
  conversionQueues,
  homeSystem,
  starMapLevel,
  setActivePlanet,
  effectivePlanetState,
  getPlanetName,
  meterLevel,
  batteryLevelOf,
  PLANET_TYPES,
} = useHawkStar()

// A 30-minute conversion was invisible from the grid: the tile holding the
// refinery looked exactly as idle as one with nothing running. One blue dot per
// running queue, on whichever tile the building actually sits — conversions
// stopped being a High-Tech privilege long ago (med station on base, plasma
// compressor in the tech center, the shaft/array pair on mining).
const conversionsOnSlot = (slot) => {
  const tileType = playerSlots.value.find(s => s.slot === slot)?.tileType
  if (!tileType) return 0
  return conversionQueues.value.filter(q => BUILDINGS[q.buildingId]?.tileType === tileType).length
}

// The base tile of the home planet is labelled "Home Base"; a colony's base
// tile stays a plain "Base". Purely a label — the tile itself is the same.
const isHomePlanet = computed(() => activePlanetId.value === homePlanetId.value)

// A parcel counts as developed once something stands on it. The dock and the
// anomaly tile hold no buildings of their own, so they are developed the moment
// they open — there is nothing further to put there. The placeholder tiles
// (warship bay, orbit) never are, which is honest: nothing can be built on them
// yet, and the grid should say so rather than flatter them.
const isBuilt = (slot) => {
  if (!slot.unlocked) return false
  if (slot.tileType === 'dock' || slot.tileType === 'anomaly') return true
  return slotsOnSlot(slot.slot).length > 0
}

// A tile that is locked because you are standing on the wrong planet, not
// because something still has to be built. The two look the same on the grid
// and mean opposite things — one is a to-do, the other never will be — so the
// chip has to say which.
const lockedToHome = (slot) => !!slot.homeOnly && !isHomePlanet.value

const tileLabel = (slot) => {
  // The reason goes where the name would be. `???` is the right label for a tile
  // you have not reached yet — it is a question the game will answer — and the
  // wrong one for a tile that is simply somewhere else, which has no answer
  // coming and only one thing worth saying.
  if (lockedToHome(slot)) return t('hawkStar.tile.homeOnly')
  if (!slot.unlocked || !slot.tileType) return '???'
  if (slot.tileType === 'base' && isHomePlanet.value) return 'Home Base'
  return TILE_TYPES[slot.tileType]?.name
}

// Top-edge status bar per tile: battery % on the energy tile, recruit pool on
// base, shield strength on defense. Only the shield also prints its number —
// it fades slowly and costs crystal to top up, so the exact value is what
// decides whether a click is worth it right now.
const tileStatus = (slot) => {
  if (!slot.unlocked) return null
  if (slot.tileType === 'energy' && getLevel('power_plant') > 0) {
    const pct = Math.round(batteryCharge.value ?? 0)
    return { kind: gridDown.value ? 'empty' : pct < 20 ? 'low' : 'battery', pct }
  }
  if (slot.tileType === 'base') {
    const max = recruitPoolMax.value || 1
    return { kind: 'recruit', pct: Math.min(100, ((recruitPool.value ?? 0) / max) * 100) }
  }
  // null while the planet has no finished shield generator
  if (slot.tileType === 'defense' && shieldCharge.value != null) {
    const pct = Math.round(shieldCharge.value)
    return {
      kind:    pct <= 0 ? 'shield-empty' : pct < 20 ? 'shield-low' : 'shield',
      pct,
      showPct: true,
    }
  }
  return null
}

const dockInfo = computed(() => {
  const dock = allPlanetStates.value[activePlanetId.value]?.dock
  if (!dock) return { inventory: [], dots: [] }

  const ship = (count, building) => ({ count: count ?? 0, building: !!building })

  // Every unit type the dock can hold, in the order they unlock. A chip appears
  // once one is parked or on the way — the tile is where you look to decide
  // whether a mission is even possible, so a missing type reads as "none".
  const UNITS = [
    { icon: '🛸', inv: 'reconDroneInventory',   build: 'reconDroneBuild'   },
    { icon: '🚀', inv: 'colonyShipInventory',   build: 'colonyShipBuild'   },
    { icon: '📦', inv: 'cargoDroneInventory',   build: 'cargoDroneBuild'   },
    { icon: '🕵️', inv: 'spyDroneInventory',     build: 'spyDroneBuild'     },
    { icon: '📡', inv: 'spySatelliteInventory', build: 'spySatelliteBuild' },
    { icon: '⚔️', inv: 'corvetteInventory',     build: 'corvetteBuild'     },
  ]

  const inventory = UNITS
    .filter(u => (dock[u.inv] ?? 0) > 0 || dock[u.build])
    .map(u => ({ icon: u.icon, ...ship(dock[u.inv], dock[u.build]) }))

  // One dot per flight in progress. Cargo counts both legs — a drone on its way
  // home is still out there and still blocks a rebuild.
  const missions = (dock.activeDroneMissions?.length     ?? 0)
                 + (dock.activeColonyMissions?.length    ?? 0)
                 + (dock.activeCargoMissions?.length     ?? 0)
                 + (dock.returningCargoMissions?.length  ?? 0)
                 + (dock.activeSpyMissions?.length       ?? 0)
  const dots = Array.from({ length: missions }, () => 'mission')

  return { inventory, dots }
})

// ── The planet strip ──────────────────────────────────────────────────────────
// A row of the system's planets over the grid, so switching colonies costs one
// tap instead of a trip through the Solar System view and back. It is the same
// marker the orbit map draws — same disc, same battery ring, same shield bubble
// — because a colony in blackout has to look the same wherever you meet it.
//
// Gated on Star Map Lv1, the same research that opens the Solar System view:
// before that you have not surveyed the system and the other planets are not
// yours to know about, so the strip is just a nameplate for where you are.
// After it, the strip is the system, and the empire is at most four planets —
// which is why this can be a row and not a menu.
const stripPlanets = computed(() => {
  const all = homeSystem.value?.planets ?? []
  if (starMapLevel.value >= 1) return all
  const here = all.find(p => p.id === activePlanetId.value)
  return here ? [here] : []
})

// Only a planet you hold is somewhere to *go*. The rest still show — a free
// world you have scanned is worth seeing from here — but they are pictures.
const canSwitchTo = (planet) => effectivePlanetState(planet) === 'own'

// ── What the strip is pointing at ─────────────────────────────────────────────
// The row is discs and nothing else — four names side by side in this width
// would each be three letters and tell you nothing. The planet you are standing
// on gets a line of its own underneath instead, with room for a readable name
// and the same chips the Solar System's planet list prints under an open row.
//
// This is also where the marker's own decorations went. HOME BASE is a word
// here rather than a 🏠 the size of a full stop, and the battery is a number
// rather than a ring — both were unreadable at strip size, and drawing them in
// two places at once made the smaller copy the one you had to squint at.
const activePlanet = computed(() =>
  (homeSystem.value?.planets ?? []).find(p => p.id === activePlanetId.value) ?? null
)

const activePlanetName = computed(() =>
  allPlanetStates.value[activePlanetId.value]
    ? getPlanetName(activePlanetId.value)
    : (activePlanet.value?.name ?? '—')
)

// Facts about where you are standing, in the order you would ask for them: who
// it is to you, what kind of world, how much room, and then the two meters that
// decide whether it is working at all. Built as a list rather than as markup so
// the row can stay one v-for and the order lives in one place — and kept short,
// because it has to fit beside the name on one line at the grid's width.
const activePlanetChips = computed(() => {
  const chips = []
  const planet = activePlanet.value

  if (isHomePlanet.value) chips.push({ key: 'home', cls: 'hs-chip--home', text: t('hawkStar.solar.homeBase') })

  if (planetType.value) {
    chips.push({ key: 'type', text: `${PLANET_TYPES[planetType.value]?.icon ?? '🪐'} ${planetType.value}` })
  }
  if (planet?.slots != null) {
    chips.push({ key: 'slots', text: `${planet.slots} ${t('hawkStar.solar.slots')}` })
  }
  // No 🛠 Dock chip here, unlike the Solar System's list. This row has one line
  // to work with, and the dock is the least urgent thing on it — the dock tile
  // is right there on the grid underneath, three rows down.

  // A planet with no power plant has no battery to report — that is not the
  // same as a flat one, so it gets no chip rather than a 0 %.
  const bat = batteryCharge.value
  if (bat != null) {
    chips.push({
      key:  'battery',
      cls:  `hs-chip--meter hs-chip--battery-${batteryLevelOf(activePlanetId.value)}`,
      text: `${gridDown.value ? '⚠️' : '🔋'} ${Math.round(bat)}%`,
    })
  }
  const shd = shieldCharge.value
  if (shd != null) {
    chips.push({
      key:  'shield',
      cls:  `hs-chip--meter hs-chip--shield-${meterLevel(Math.round(shd))}`,
      text: `🛡️ ${Math.round(shd)}%`,
    })
  }
  return chips
})

// A colony the game has not loaded yet has no slots, no resources and no grid
// to draw — pull it in first, exactly as the Solar System view does, or the
// switch lands on an empty planet.
const goToPlanet = async (planet) => {
  if (!canSwitchTo(planet) || planet.id === activePlanetId.value) return
  if (!allPlanetStates.value[planet.id]) await refreshPlanetState(planet.id)
  setActivePlanet(planet.id)
  emit('update:activePanel', null)
}

// ── Unified selection ─────────────────────────────────────────────────────────
const togglePanel = (panel) => {
  activeSlot.value = null
  emit('update:activePanel', props.activePanel === panel ? null : panel)
}

const onSelectSlot = (slot) => {
  selectSlot(slot)
  emit('update:activePanel', null)
}
</script>

<template>
  <div class="hs-planet-wrap">

    <!-- The header band: who you are, and where in the system you are standing.
         Neither is a parcel of land, so both sit above the surface rather than
         inside it — which also leaves the grid a clean 3 × 4. -->
    <div class="hs-planet-head">
      <!-- The crest: portrait over name. The name used to set this tile's width
           and pushed the planets out of the row — it is under the avatar now, in
           whatever the tile has left, clipped with an ellipsis. Enough to
           recognise your own name by, never enough to steal the row. The full
           string stays on the tooltip and in the profile panel. -->
      <div
        class="hs-tile hs-tile--profile"
        :class="{ 'hs-tile--active': activePanel === 'profile', 'hs-tile--unlocked': activePanel !== 'profile' }"
        :title="playerName || '—'"
        :aria-label="playerName || '—'"
        @click="togglePanel('profile')"
      >
        <span class="hs-tile-icon">{{ playerPortrait }}</span>
        <span class="hs-tile-user">{{ playerName || '—' }}</span>
      </div>

      <div v-if="stripPlanets.length" class="hs-strip">
        <!-- Discs only. The badge and the charge ring the orbit map draws on
             them are switched off here — the line underneath says both, in
             words and in numbers. -->
        <div class="hs-strip__row">
          <!-- The slot takes the equal share, the disc keeps its own size inside
               it. Sizing the marker itself with `flex: 1 1 0` would let the flex
               algorithm override its width and stretch a circle into an ellipse. -->
          <div v-for="planet in stripPlanets" :key="planet.id" class="hs-strip__slot">
            <HsPlanetMarker
              :planet="planet"
              :selected="planet.id === activePlanetId"
              :disabled="!canSwitchTo(planet) || planet.id === activePlanetId"
              :battery="false"
              :shield="false"
              @select="goToPlanet(planet)"
            />
          </div>
        </div>

        <!-- Where you are standing, named and tagged. -->
        <div class="hs-strip__detail">
          <span class="hs-strip__name">{{ activePlanetName }}</span>
          <div class="hs-strip__chips">
            <span
              v-for="chip in activePlanetChips"
              :key="chip.key"
              class="hs-chip"
              :class="chip.cls"
            >{{ chip.text }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- The planet's surface: one piece of ground, twelve parcels on it -->
    <div class="hs-grid" :class="`hs-grid--${planetType}`">
      <div
        v-for="slot in playerSlots"
        :key="slot.slot"
        class="hs-tile"
        :class="{
          'hs-tile--locked':   !slot.unlocked,
          'hs-tile--active':   slot.unlocked && activeSlot === slot.slot,
          'hs-tile--unlocked': slot.unlocked && activeSlot !== slot.slot,
          'hs-tile--built':    isBuilt(slot) && activeSlot !== slot.slot,
        }"
        @click="onSelectSlot(slot)"
      >
        <div
          v-if="tileStatus(slot)"
          class="hs-tile-bar"
          :class="`hs-tile-bar--${tileStatus(slot).kind}`"
        >
          <div class="hs-tile-bar__fill" :style="{ width: tileStatus(slot).pct + '%' }" />
          <span v-if="tileStatus(slot).showPct" class="hs-tile-bar__pct">
            {{ tileStatus(slot).pct }}%
          </span>
        </div>
        <div class="hs-tile-main">
          <span class="hs-tile-icon">
            {{ slot.unlocked && slot.tileType ? TILE_TYPES[slot.tileType]?.icon : (slot.unlocked ? '?' : '🔒') }}
          </span>
          <span
            class="hs-tile-label"
            :class="{ 'hs-tile-label--home': lockedToHome(slot) }"
            :title="lockedToHome(slot) ? t('hawkStar.tile.homeOnlyHint') : null"
          >
            {{ tileLabel(slot) }}
          </span>
        </div>
        <div class="hs-tile-dots">
          <!-- Wrong planet, not "not yet": nothing you build here will ever open
               it, so it must not wear a build requirement. The reason is in the
               label instead — see `tileLabel`. -->
          <template v-if="lockedToHome(slot)" />
          <template v-else-if="!slot.unlocked && unlockRequirement(slot.slot)">
            <span
              class="hs-tile-unlock"
              :class="getLevel(unlockRequirement(slot.slot).building.id) >= unlockRequirement(slot.slot).level ? 'hs-tile-unlock--done' : ''"
              :title="`Build ${unlockRequirement(slot.slot).building.name} to Level ${unlockRequirement(slot.slot).level}`"
            >{{ unlockRequirement(slot.slot).building.icon }} Lv{{ unlockRequirement(slot.slot).level }}</span>
          </template>
          <template v-else-if="slot.tileType === 'dock'">
            <!-- Five unit types can be in the dock at once, so the chips wrap
                 two per line instead of stacking the tile out of shape. -->
            <div v-if="dockInfo.inventory.length" class="hs-dock-inv-list">
              <span
                v-for="item in dockInfo.inventory"
                :key="item.icon"
                class="hs-dock-inv"
                :class="{ 'hs-dock-inv--building': item.building }"
              >{{ item.icon }}{{ item.count }}</span>
            </div>
            <span
              v-for="(type, i) in dockInfo.dots"
              :key="'d' + i"
              class="hs-dot"
              :class="type === 'building' ? 'hs-dot--building' : 'hs-dot--mission'"
            />
          </template>
          <!-- The anomaly tile holds no buildings — the dot means "something is waiting" -->
          <template v-else-if="slot.tileType === 'anomaly'">
            <span v-if="hasAnomaly" class="hs-dot hs-dot--anomaly" />
          </template>
          <template v-else>
            <!-- Somebody else's satellite is parked over this planet. It reaches
                 the grid from the same place the panel gets it, and it is empty
                 unless an `orbital_defense` is standing: the building IS the
                 sensor, so an undefended colony still shows nothing. -->
            <span
              v-for="n in (slot.tileType === 'defense' ? foreignSatellites.length : 0)"
              :key="'bogey' + n"
              class="hs-dot hs-dot--bogey"
              :title="t('hawkStar.tile.bogey', { n: foreignSatellites.length })"
            />
            <span
              v-for="b in slotsOnSlot(slot.slot)"
              :key="b.id"
              class="hs-dot"
              :class="b.building ? 'hs-dot--building' : b.offline ? 'hs-dot--offline' : 'hs-dot--done'"
            />
            <!-- One per running conversion on this tile -->
            <span
              v-for="n in conversionsOnSlot(slot.slot)"
              :key="'conv' + n"
              class="hs-dot hs-dot--conversion"
              :title="t('hawkStar.tile.convRunning')"
            />
          </template>
        </div>
      </div>

    </div>
  </div>
</template>

<style lang="scss" scoped>
.hs-planet-wrap {
  // The ground's width, declared once. The header band and the grid are one
  // column and have to end on the same line — hard-coding 336 px in two places
  // is how they drift apart the next time the tile raster is retuned.
  --hs-ground-w: 100%;

  // Left alone at `stretch`: an item with an explicit cross-size is not stretched
  // and lands at the start anyway, and `flex-start` here would make the column
  // shrink-to-fit — which the children's `width: 100%` on a phone resolves against.
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  @media (min-width: 640px) {
    --hs-ground-w: 336px;
    flex-shrink: 0;
  }
}

// ── The planet's surface ─────────────────────────────────────────────────────
// One piece of ground with twelve parcels on it, rather than twelve separate
// controls. The gap between tiles is the whole trick: it is where the ground
// shows through, and it is what makes the grid read as land instead of as a
// button panel. The type sets the palette; `--accent` is an rgb triplet so
// every use downstream can pick its own alpha.
.hs-grid {
  --ground: #16202a;
  --accent: 148, 163, 184;

  &--terrestrial   { --ground: #16241a; --accent:  74, 222, 128; }
  &--volcanic      { --ground: #251310; --accent: 251, 146,  60; }
  &--frozen        { --ground: #17242e; --accent: 125, 211, 252; }
  &--ocean         { --ground: #0f1f2e; --accent:  56, 189, 248; }
  &--uninhabitable { --ground: #1b1b1d; --accent: 148, 163, 184; }

  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
  padding: 0.45rem;
  width: var(--hs-ground-w);
  border-radius: var(--hs-r-lg);
  border: 1px solid rgba(var(--accent), 0.14);
  background:
    // Survey lines — the ground needs a scale, or the gradient reads as fog
    repeating-linear-gradient(0deg,  rgba(255,255,255,0.022) 0 1px, transparent 1px 26px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.022) 0 1px, transparent 1px 26px),
    // The star is up and to the left, so the ground is lit from there and falls
    // away towards the far edge
    radial-gradient(ellipse 130% 90% at 30% -15%, rgba(var(--accent), 0.16), transparent 62%),
    linear-gradient(170deg, var(--ground), #0a0d13 92%);
  box-shadow: inset 0 0 40px rgba(0,0,0,0.45);

  @media (min-width: 640px) {
    gap: 0.45rem;
    padding: 0.5rem;
  }
}

// ── The parcels ──────────────────────────────────────────────────────────────
// Scoped under .hs-grid so the crest above keeps the plain glass look — it is a
// player badge, not a piece of the planet.
.hs-grid .hs-tile {
  // A raster wants equal cells — without a floor, a row whose tiles carry no
  // dots collapses shorter than its neighbours and the ground stops looking
  // surveyed.
  min-height: 3.3rem;
  border-radius: var(--hs-r-sm);

  // Raw ground: no frame at all, the surface reads straight through. Land you
  // have not opened up yet — not a control that failed to light up.
  &--locked {
    background: rgba(0,0,0,0.3);
    border-color: rgba(255,255,255,0.035);
    opacity: 0.5;
  }

  // Surveyed and cleared, nothing standing on it. Dashed, the way a plot is
  // pegged out before anything is poured.
  &--unlocked {
    background: rgba(255,255,255,0.035);
    border: 1px dashed rgba(var(--accent), 0.3);

    &:hover {
      background: rgba(var(--accent), 0.1);
      border-color: rgba(var(--accent), 0.55);
    }
  }

  // Developed — something stands here. Solid frame and a lit face, so a glance
  // down the grid counts how far the colony has actually got.
  &--built {
    background: linear-gradient(180deg, rgba(var(--accent), 0.17), rgba(var(--accent), 0.05));
    border: 1px solid rgba(var(--accent), 0.42);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.09);

    &:hover {
      background: linear-gradient(180deg, rgba(var(--accent), 0.26), rgba(var(--accent), 0.09));
      border-color: rgba(var(--accent), 0.65);
    }
  }

  // Last, so the selection outranks every ground state above it.
  &--active {
    background: var(--hs-active-bg);
    border: 1px solid var(--hs-active-border);
    box-shadow: 0 0 20px var(--hs-active-glow);
  }
}

// Row 1 belongs to the profile alone. Without the span, auto-placement would
// push the first two building slots up into the empty cells and shear the whole
// 3 × 4 block sideways.
.hs-tile {
  position: relative;
  overflow: hidden;
  border-radius: var(--hs-r-md);
  border: 1px solid transparent;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
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

// Top-edge status bar (battery / recruit pool)
.hs-tile-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  z-index: 1;
  pointer-events: none;
}
.hs-tile-bar__fill {
  height: 100%;
  transition: width 0.4s ease, background 0.3s ease;
  background: #10b981;
}
.hs-tile-bar--low     .hs-tile-bar__fill { background: #f59e0b; }
.hs-tile-bar--recruit .hs-tile-bar__fill { background: #a78bfa; }

// Empty battery: fill is 0 %, so pulse the whole bar red to signal the blackout.
.hs-tile-bar--empty {
  background: rgba(239, 68, 68, 0.5);
  animation: pulse 1.5s ease-in-out infinite;
}

// Shield — same blue as HsShieldPanel. An empty shield is NOT a blackout (it has
// no side effect on the planet), so it stays a plain red bar and never pulses.
.hs-tile-bar--shield       .hs-tile-bar__fill { background: #38bdf8; }
.hs-tile-bar--shield-low   .hs-tile-bar__fill { background: #f59e0b; }
.hs-tile-bar--shield-empty { background: rgba(239, 68, 68, 0.35); }

.hs-tile-bar__pct {
  position: absolute;
  top: 5px;
  right: 5px;
  font-size: 0.5rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.5);
}
.hs-tile-bar--shield       .hs-tile-bar__pct { color: rgba(186, 230, 253, 0.75); }
.hs-tile-bar--shield-low   .hs-tile-bar__pct { color: rgba(253, 230, 138, 0.85); }
.hs-tile-bar--shield-empty .hs-tile-bar__pct { color: rgba(252, 165, 165, 0.9); }

// ── Header band ──────────────────────────────────────────────────────────────
// Crest on the left, the system's planets filling the rest. Two things that are
// about the player and the position rather than about the ground, so they share
// one bar above it.
.hs-planet-head {
  display: flex;
  align-items: stretch;
  gap: 0.4rem;
  width: var(--hs-ground-w);
  min-width: 0;
}

// The crest — a player badge above the ground, not a parcel in it. Narrow and
// square now: it is an icon that opens a panel, and the strip beside it needs
// every pixel this row can give it.
.hs-tile--profile {
  flex: none;
  width: 2.6rem;
  // Overrides .hs-tile's row: portrait on top, name under it.
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0.3rem 0.2rem;

  @media (min-width: 640px) { width: 2.9rem; }
}

// Deliberately tiny and deliberately clipped. The tile is fixed at the width
// that keeps the planet strip beside it usable, so the name gets whatever is
// left and an ellipsis for the rest — `min-width: 0` is what lets it shrink
// inside the flex column at all, without which it would push the tile wider.
.hs-tile-user {
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  font-size: 0.42rem;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: 0.02em;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.55);

  @media (min-width: 640px) { font-size: 0.46rem; }
}

// ── The planet strip ─────────────────────────────────────────────────────────
// Same frame as the Solar System's header band, because it says the same kind of
// thing: this is the system you are in. Two stacked parts — the discs you can
// travel between, and a line naming the one you are on.
.hs-strip {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  padding: 0.35rem 0.45rem;
  border-radius: var(--hs-r-md);
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-lg);
}

// Equal shares rather than content width, so the discs sit on a fixed rhythm and
// the row never reflows as planets are revealed.
.hs-strip__row {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
}

.hs-strip__slot {
  --hs-pl-size: 1.85rem;

  flex: 1 1 0;
  min-width: 0;
  display: flex;
  justify-content: center;

  @media (min-width: 640px) { --hs-pl-size: 2.1rem; }
}

// ── Where you are standing ───────────────────────────────────────────────────
.hs-strip__detail {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.35rem;
  min-width: 0;
}

.hs-strip__name {
  flex: none;
  max-width: 100%;
  overflow: hidden;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(196,181,253,0.95);
}

// Same shape as .hs-plist__chips on the Solar System screen — it is the same
// row of facts about the same planet, so it wraps the same way rather than
// scrolling or clipping.
.hs-strip__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.22rem;
  min-width: 0;
}

// One planet is a nameplate, not a choice: before Star Map Lv1 the lone disc
// sits next to its name instead of centred over a row it does not fill.
.hs-strip:has(.hs-strip__slot:only-child) {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}
.hs-strip:has(.hs-strip__slot:only-child) .hs-strip__slot {
  flex: none;
}
.hs-strip:has(.hs-strip__slot:only-child) .hs-strip__detail {
  flex: 1 1 auto;
}

.hs-tile-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.hs-tile-icon  { font-size: 1.25rem; line-height: 1; }
.hs-tile-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.04em; opacity: 0.7; }
// A statement about where you are standing, not progress towards anything —
// cool blue rather than the neutral grey the other locked tiles wear, and full
// opacity, because it is the only thing this tile has to say.
.hs-tile-label--home { color: rgba(125, 211, 252, 0.9); opacity: 1; }

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
  flex-direction: column;
  gap: 3px;
  align-items: center;
  min-width: 8px;
}

.hs-tile-lock { font-size: 0.65rem; opacity: 0.6; }

.hs-tile-type {
  font-size: 0.6rem;
	line-height: 1;
  white-space: nowrap;

  &--terrestrial { color: #86efac; border-color: rgba(134,239,172,0.35); background: rgba(134,239,172,0.08); }
  &--volcanic    { color: #fca5a5; border-color: rgba(252,165,165,0.35); background: rgba(252,165,165,0.08); }
  &--frozen      { color: #93c5fd; border-color: rgba(147,197,253,0.35); background: rgba(147,197,253,0.08); }
  &--ocean       { color: #67e8f9; border-color: rgba(103,232,249,0.35); background: rgba(103,232,249,0.08); }
}

.hs-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;

  &--done     { background: var(--hs-ok); }
  &--building { background: var(--hs-warn); animation: pulse 1.2s ease-in-out infinite; }
  &--offline  { background: var(--hs-danger); animation: pulse 1.5s ease-in-out infinite; }
  &--mission  { background: #60a5fa; animation: pulse 1.4s ease-in-out infinite; }
  &--anomaly  { background: #818cf8; animation: pulse 1.1s ease-in-out infinite; }
  // A running conversion. Sky blue rather than the mission blue next to it, and
  // slower than every other pulse — a 30-minute job should breathe, not blink
  // for attention the way an offline building does.
  &--conversion { background: #38bdf8; animation: pulse 2s ease-in-out infinite; }

  // A foreign satellite overhead. Red like an offline building, because both are
  // alarms — but it sits on the same tile as one, so it needs to be told apart
  // at 6 px: the halo and the fastest blink on the grid do that. It is also the
  // only dot here that is somebody else's doing, and it should read that way.
  &--bogey {
    background: #ef4444;
    box-shadow: 0 0 5px rgba(239,68,68,0.9);
    animation: pulse 0.8s ease-in-out infinite;
  }
}

// The dots column is a vertical stack, which was fine for two ship types. With
// all five it would grow the whole grid row, so the chips wrap inside it —
// bottom-aligned (`wrap-reverse`), so a short list sits next to the label.
.hs-dock-inv-list {
  display: flex;
  flex-wrap: wrap-reverse;
  justify-content: flex-end;
  gap: 2px 3px;
  max-width: 2.9rem;
}

.hs-dock-inv {
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;

  &--building {
    color: var(--hs-warn);
    animation: pulse 1.2s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
</style>
