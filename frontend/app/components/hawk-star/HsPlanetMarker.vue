<script setup>
import { computed } from 'vue'
import { useHawkStar } from '~/composables/useHawkStar.js'

// One planet, drawn as a planet. The disc, its type glyph, the 🏠 badge, the
// battery ring around it and the shield bubble over it — everything that is
// true of the body itself and nothing about where it is drawn. The orbit map
// hangs it on a rotating box, the strip over the planet grid lines four of them
// up in a row, and neither has to know how a shield looks.
//
// It reads its own state from the composable rather than taking a dozen props:
// two callers passing eight props each is how the map ends up showing a charge
// the strip does not. The parent only says *which* planet and whether it is the
// selected one — the two facts the parent alone knows.
const props = defineProps({
  planet:   { type: Object, required: true },
  selected: { type: Boolean, default: false },
  // A planet you cannot go to. The strip shows the whole system, but only the
  // planets you hold are somewhere to switch *to* — the rest are there to be
  // looked at, and a disc that lifts under the cursor promises otherwise.
  disabled: { type: Boolean, default: false },
  // The two meters, each switchable. Both are the orbit map's by right: there a
  // marker is alone with its planet and the ring and the bubble are the only
  // place its charge is written down. In the planet-grid strip they are not —
  // the chip line under the discs prints `🔋 84%` and `🛡️ 60%` in figures, and
  // a 3 px ring and a soft aura beside that are only smaller, less legible
  // second copies of the same two numbers.
  battery: { type: Boolean, default: true },
  shield:  { type: Boolean, default: true },
  // A count in the corner — the Empire board's notices. Null draws nothing, so
  // a quiet planet is a bare disc rather than a zero. It reuses the corner the
  // 🏠 badge vacated, which is the right place for it: a number pinned to the
  // planet it belongs to, readable at a glance, which is the whole thing the
  // 🏠 failed at.
  badge:     { type: [Number, String], default: null },
  badgeTone: { type: String, default: 'alarm' },
})

const emit = defineEmits(['select'])

const {
  homePlanetId,
  activePlanetId,
  allPlanetStates,
  effectivePlanetState,
  planetIcon,
  shieldChargeOf,
  batteryChargeOf,
  gridDownOn,
  batteryLevelOf,
} = useHawkStar()

const id     = computed(() => props.planet?.id)
const state  = computed(() => effectivePlanetState(props.planet))
const isHome = computed(() => id.value === homePlanetId.value)
const glyph  = computed(() => planetIcon(props.planet))

// A planet whose state was never fetched has no meters to draw — not empty
// ones. Missing data and a flat battery must not look the same.
const known = computed(() => !!allPlanetStates.value[id.value])

const markerClass = computed(() => [
  `hs-pl--${state.value}`,
  isHome.value                     ? 'hs-pl--home'     : '',
  props.selected                   ? 'hs-pl--selected' : '',
  id.value === activePlanetId.value ? 'hs-pl--active'  : '',
])

// ── Meters ────────────────────────────────────────────────────────────────────
// Drawn as what they physically are: the battery as a charge ring around the
// planet, the shield as the bubble surrounding it. Both are null without the
// building, so a planet with no power plant wears no ring at all.
const round = (v) => (v == null ? null : Math.round(v))

const batteryPct = computed(() => round(batteryChargeOf(id.value)))
const shieldPct  = computed(() => round(shieldChargeOf(id.value)))

const BATTERY_COLOR = { ok: '#10b981', low: '#f59e0b', empty: '#f59e0b', down: '#ef4444' }

const batteryStyle = computed(() => {
  if (!props.battery || !known.value || batteryPct.value === null) return null
  const deg = Math.max(0, Math.min(100, batteryPct.value)) * 3.6
  const col = BATTERY_COLOR[batteryLevelOf(id.value)]
  return {
    background: `conic-gradient(from -90deg, ${col} 0deg ${deg}deg, rgba(255,255,255,0.10) ${deg}deg 360deg)`,
  }
})

// A shield at 0 % draws nothing at all — an unshielded planet should look bare,
// not like it is wearing an empty bubble.
const shieldStyle = computed(() => {
  if (!props.shield || !known.value || shieldPct.value === null || shieldPct.value <= 0) return null
  const f = shieldPct.value / 100
  return {
    background:  `radial-gradient(circle, rgba(56,189,248,0) 54%, rgba(56,189,248,${(0.06 + f * 0.30).toFixed(3)}) 100%)`,
    borderColor: `rgba(56,189,248,${(0.12 + f * 0.48).toFixed(3)})`,
  }
})
</script>

<template>
  <button
    class="hs-pl"
    :class="markerClass"
    :disabled="disabled"
    :aria-label="planet.name"
    @click="emit('select', planet)"
  >
    <span v-if="shieldStyle" class="hs-pl__shield" :style="shieldStyle" />
    <span
      v-if="batteryStyle"
      class="hs-pl__battery"
      :class="{ 'hs-pl__battery--down': gridDownOn(id) }"
      :style="batteryStyle"
    />
    <span class="hs-pl__glyph">{{ glyph }}</span>
    <span v-if="badge" class="hs-pl__badge" :class="`hs-pl__badge--${badgeTone}`">{{ badge }}</span>
  </button>
</template>

<style lang="scss" scoped>
// --hs-pl-size defaults to 100 %, which is what the orbit map wants: it sizes the
// marker through the rotating box it hangs on. Anywhere else, set the property
// on any ancestor — it inherits, so the strip can size its discs from a media
// query instead of threading a length through as a prop.
.hs-pl {
  position: relative;
  width:  var(--hs-pl-size, 100%);
  height: var(--hs-pl-size, 100%);
  flex: none;
  overflow: visible;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(10,12,24,0.92);
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

  // Only an enabled marker lifts. Written as :not(:disabled) rather than as a
  // `transform: none` under :disabled, because that would outrank --selected's
  // own scale and the planet you are standing on would shrink under the cursor.
  &:hover:not(:disabled) { transform: scale(1.14); }

  // Nothing to go to: it still shows its state, it just stops offering.
  &:disabled { cursor: default; }

  &--own          { border-color: rgba(96,165,250,0.65);  box-shadow: 0 0 10px rgba(96,165,250,0.18); }
  &--enemy        { border-color: rgba(248,113,113,0.65); box-shadow: 0 0 10px rgba(248,113,113,0.15); }
  &--ally         { border-color: rgba(52,211,153,0.6); }
  &--uncolonized  { border-color: rgba(255,255,255,0.28); }
  &--unknown      { border-color: rgba(255,255,255,0.1);  background: rgba(10,12,24,0.7); }
  &--scanning     { border-color: rgba(251,191,36,0.7);   box-shadow: 0 0 10px rgba(251,191,36,0.2); }
  &--colonizing   { border-color: rgba(96,165,250,0.6); }
  &--uninhabitable{ border-color: rgba(75,75,75,0.5);     opacity: 0.55; }

  // The home base is an "own" planet like every colony, so this brighter ring is
  // the only thing on the disc that separates the two. It used to be backed by a
  // 🏠 in the corner, at half the size of the glyph it sat on — unreadable where
  // it mattered, and redundant now that both screens carry a HOME chip.
  &--home {
    border-color: rgba(147,197,253,0.95);
    box-shadow: 0 0 16px rgba(96,165,250,0.35);
  }

  // Deliberately restrained. The ring used to be a 2 px halo plus a 22 px glow on
  // a disc already blown up to 1.16 — fine on the orbit map, where a marker has a
  // whole orbit to itself, but in the strip four of them sit a few pixels apart
  // and the selected one pushed its neighbours around. A 1 px ring against the
  // unselected border is enough contrast to find it; the lift only has to say
  // "this one is in front".
  &--selected {
    transform: scale(1.06);
    border-color: var(--hs-active-border);
    box-shadow: 0 0 0 1px var(--hs-active-border), 0 0 10px var(--hs-active-glow);

    &:hover:not(:disabled) { transform: scale(1.12); }
  }
}

.hs-pl__glyph {
  position: relative;
  z-index: 1;
  font-size: 0.95rem;
  line-height: 1;

  @media (min-width: 640px) { font-size: 1.2rem; }
}

// Sits half off the disc, which the marker's `overflow: visible` allows. Tabular
// figures so a row of them does not jitter between 1 and 2 digits.
.hs-pl__badge {
  position: absolute;
  top: -5px;
  right: -6px;
  z-index: 2;
  min-width: 0.85rem;
  padding: 0 3px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 0.45rem;
  font-weight: 700;
  line-height: 0.85rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
  pointer-events: none;

  &--alarm { color: #fff;     background: rgba(239, 68, 68, 0.95);  border-color: rgba(252, 165, 165, 0.6); }
  &--warn  { color: #1c1917;  background: rgba(251, 191, 36, 0.95); border-color: rgba(253, 230, 138, 0.6); }
}

// The battery is drawn as what it is — a charge ring around the planet. The
// mask cuts the conic gradient down to a 3 px band at the outer edge.
.hs-pl__battery {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  pointer-events: none;
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
          mask: radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));

  // A blackout stops the whole planet — the one meter worth shouting about.
  &--down { animation: hs-meter-pulse 1.5s ease-in-out infinite; }
}

@keyframes hs-meter-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}

// The shield is the bubble around the planet; its opacity is the charge, so a
// planet without one simply looks bare instead of wearing an empty ring.
.hs-pl__shield {
  position: absolute;
  inset: -9px;
  border: 1px solid transparent;
  border-radius: 50%;
  pointer-events: none;
  transition: background 0.4s ease, border-color 0.4s ease;
}
</style>
