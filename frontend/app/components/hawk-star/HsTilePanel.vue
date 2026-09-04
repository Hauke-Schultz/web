<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES, BUILDINGS } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsDockPanel from '~/components/hawk-star/HsDockPanel.vue'
import HsNotificationPanel from '~/components/hawk-star/HsNotificationPanel.vue'
import HsAllResourcePanel from '~/components/hawk-star/HsAllResourcePanel.vue'
import HsPowerBattery from '~/components/hawk-star/HsPowerBattery.vue'
import HsShieldPanel from '~/components/hawk-star/HsShieldPanel.vue'
import HsRecruitPanel from '~/components/hawk-star/HsRecruitPanel.vue'
import HsOrbitDefensePanel from '~/components/hawk-star/HsOrbitDefensePanel.vue'
import HsAnomalyPanel from '~/components/hawk-star/HsAnomalyPanel.vue'
import HsSalvagePanel from '~/components/hawk-star/HsSalvagePanel.vue'

defineProps({ activePanel: { type: String, default: null } })

const {
  playerResources,
  playerBuildings,
  activeTileType,
  buildingsForActiveSlot,
  getLevel,
  isBuildingInProgress,
  isBuildingLocked,
  lockedRequirementInfo,
  nextLevelDef,
  canBuild,
  startBuild,
  hasEnoughPower,
  hasEnoughStaff,
  energyDelta,
  staffDelta,
  isOffline,
  freeWorkers,
  hasOrbitalDefense,
  stockOf,
  remainingSec,
  formatTime,
  buildProgressStyle,
  planetType,
  // conversions
  conversionQueues,
  conversionTime,
  canConvert,
  maxConversionRuns,
  startConversion,
  remainingConversionSec,
  conversionProgressStyle,
} = useHawkStar()

const { t } = useI18n()

const isSpacebaseTile    = computed(() => activeTileType.value?.id === 'spacebase')
const isHightechTile     = computed(() => activeTileType.value?.id === 'hightech')
const isDockTile         = computed(() => activeTileType.value?.id === 'dock')
const isEnergyTile       = computed(() => activeTileType.value?.id === 'energy')
const isDefenseTile      = computed(() => activeTileType.value?.id === 'defense')
const isBaseTile         = computed(() => activeTileType.value?.id === 'base')
const isAnomalyTile      = computed(() => activeTileType.value?.id === 'anomaly')
const isSalvageTile      = computed(() => activeTileType.value?.id === 'salvage')

// Recipes are no longer a High-Tech privilege: the med station sits on the base
// tile and the plasma compressor in the tech center. Any tile showing a building
// with conversions gets the section — the tile id is not the deciding factor.
const conversionBuildings = computed(() =>
  buildingsForActiveSlot.value.filter(b => BUILDINGS[b.id]?.conversions?.length > 0)
)

const outputOf = (recipe) => {
  const [resId, amount] = Object.entries(recipe.output ?? {})[0] ?? []
  return { resId, amount: amount ?? 0, icon: RESOURCES[resId]?.icon ?? '•' }
}

// Only facilities that actually stand on the planet offer a recipe.
const availableConversions = computed(() =>
  conversionBuildings.value
    .filter(b => getLevel(b.id) > 0)
    .flatMap(b => (BUILDINGS[b.id]?.conversions ?? []).map((recipe, index) => ({
      ...recipe,
      index,
      buildingId: b.id,
      key: `${b.id}_${index}`,
      // The one thing this recipe makes, lifted out of `output` — every recipe
      // in the catalogue has exactly one, and the row is built around it the way
      // a building row is built around its building: its icon is the row's icon,
      // its name the row's title. Resolved here rather than in the template so
      // the row can name it three times without three lookups.
      out: outputOf(recipe),
    })))
    // Recipes may carry planetTypes of their own — the smelter uses it so that
    // only this planet's exclusive raw is on offer. Filtered after the map on
    // purpose: `index` is the position in the FULL array and is what lands in
    // hs_conversion_queues, so re-indexing here would make a running batch
    // deliver a different recipe's goods.
    .filter(r => !r.planetTypes || r.planetTypes.includes(planetType.value))
)

// The running batch for a recipe, if any — drives the fill inside its button
// and locks both the stepper and the button until it delivers.
const queueFor = (buildingId, recipeIndex) =>
  conversionQueues.value.find(q => q.buildingId === buildingId && q.recipeIndex === recipeIndex) ?? null

// ── ×N order picker ───────────────────────────────────────────────────────────
// Every recipe takes 30 minutes, so one run per click made refining a chore of
// coming back rather than a decision. The count is ordered and paid for up
// front, then the facility works the whole batch and delivers it in one piece:
// ×4 = two hours, then four units. The recipe stays locked for that whole time,
// which is what keeps four units per two hours the ceiling.
const orderCount = ref({})

const isLocked = (recipe) => !!queueFor(recipe.buildingId, recipe.index)

const countFor = (recipe) => {
  const max = maxConversionRuns(recipe.buildingId, recipe.index)
  // Clamped on read, so a count picked while rich stays valid after spending.
  // A locked recipe keeps showing the size of the batch that is running.
  const running = queueFor(recipe.buildingId, recipe.index)
  if (running) return running.runs ?? 1
  return Math.max(1, Math.min(orderCount.value[recipe.key] ?? 1, Math.max(1, max)))
}

const setCount = (recipe, delta) => {
  if (isLocked(recipe)) return
  const max = Math.max(1, maxConversionRuns(recipe.buildingId, recipe.index))
  orderCount.value[recipe.key] = Math.max(1, Math.min(countFor(recipe) + delta, max))
}

const canRaise = (recipe) =>
  !isLocked(recipe) && countFor(recipe) < maxConversionRuns(recipe.buildingId, recipe.index)

</script>

<template>
  <!-- Activity -->
  <HsNotificationPanel v-if="activePanel === 'notifications'" />

  <!-- Resources -->
  <HsAllResourcePanel v-else-if="activePanel === 'resources'" />

  <!-- Dock slot -->
  <HsDockPanel v-else-if="isDockTile" />


  <!-- Building panel -->
  <div v-else class="hs-panel">
    <div class="hs-panel-header">
      <span class="hs-panel-icon">{{ activeTileType?.icon ?? '?' }}</span>
      <h2 class="hs-panel-title">{{ activeTileType ? t('hawkStar.tiles.' + activeTileType.id + '.name') : t('hawkStar.tile.selectTile') }}</h2>
      <span class="hs-panel-desc">{{ activeTileType ? t('hawkStar.tiles.' + activeTileType.id + '.desc') : '' }}</span>
    </div>

    <!-- Power battery — grid uptime, shown on the energy tile once a power plant exists -->
    <HsPowerBattery v-if="isEnergyTile && getLevel('power_plant') > 0" />

    <!-- Orbital defense — what a foreign spy satellite dies of. Only visible
         with the building, because the building is the sensor: without it the
         planet cannot tell that anything is up there.

         ABOVE the shield, and deliberately: a satellite overhead is something
         happening TO you right now and it is what the fire-control game opens
         into, while the shield below is a meter that only ever drifts. The one
         that can demand an answer goes first. -->
    <HsOrbitDefensePanel v-if="isDefenseTile && hasOrbitalDefense" />

    <!-- Planetary shield — defense tile, once a generator stands. Same meter as
         the battery, but each click is paid for in crystal. -->
    <HsShieldPanel v-if="isDefenseTile && getLevel('shield_generator') > 0" />

    <!-- Population recruitment — base tile -->
    <HsRecruitPanel v-if="isBaseTile" />

    <!-- Passing events — anomaly tile (has no buildings of its own) -->
    <HsAnomalyPanel v-if="isAnomalyTile" />

    <!-- Salvage fishing. It sits INSIDE the building panel, not instead of it:
         the tile now also carries the smelter, so it needs the ordinary build
         rows and recipe section underneath. Same arrangement as the recruit
         panel on the base tile. -->
    <HsSalvagePanel v-if="isSalvageTile" />

    <div class="hs-building-list">
      <div
        v-for="bDef in buildingsForActiveSlot"
        :key="bDef.id"
        class="hs-building-row"
        :class="{ 'hs-building-row--offline': isOffline(bDef.id) }"
      >
        <!-- Left column — what the building is right now: icon, level, description -->
        <div class="hs-building-ident">
          <div class="hs-building-icon-wrap">
            <span class="hs-building-icon">{{ bDef.icon }}</span>
            <span v-if="getLevel(bDef.id) > 0" class="hs-level-badge">Lv{{ getLevel(bDef.id) }}</span>
          </div>

          <div class="hs-building-info">
            <div class="hs-building-name">{{ t('hawkStar.buildings.' + bDef.id + '.name') }}</div>
            <div class="hs-building-desc">{{ t('hawkStar.buildings.' + bDef.id + '.desc') }}</div>
          </div>
        </div>

        <!-- Right column — the deal: what it costs, the button, what you get and how long it takes -->
        <div class="hs-building-action">
          <!-- Under construction: the bar replaces cost + button -->
          <template v-if="isBuildingInProgress(bDef.id)">
            <span class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
            <div class="hs-progress-row">
              <div class="hs-progress-track">
                <div
                  :key="playerBuildings[bDef.id].buildEndsAt"
                  class="hs-progress-fill"
                  :style="buildProgressStyle(bDef.id)"
                />
              </div>
              <span class="hs-progress-time">{{ formatTime(remainingSec(playerBuildings[bDef.id].buildEndsAt)) }}</span>
            </div>
          </template>

          <template v-else-if="isOffline(bDef.id)">
            <span class="hs-status-offline">{{ t('hawkStar.tile.statusOffline') }}</span>
          </template>

          <template v-else-if="!nextLevelDef(bDef.id)">
            <span class="hs-status-max">{{ t('hawkStar.tile.statusMax') }}</span>
            <span class="hs-building-effect">{{ t('hawkStar.tile.maxLevel') }}</span>
          </template>

          <template v-else-if="isBuildingLocked(bDef.id)">
            <span class="hs-status-locked">
              {{ lockedRequirementInfo(bDef.id) ? t('hawkStar.tile.lockedRequires', { name: t('hawkStar.buildings.' + lockedRequirementInfo(bDef.id).building + '.name'), level: lockedRequirementInfo(bDef.id).level }) : t('hawkStar.tile.lockedGeneric') }}
            </span>
          </template>

          <template v-else>
            <!-- Cost -->
            <div
              v-if="Object.keys(nextLevelDef(bDef.id).cost).length || staffDelta(bDef.id) > 0 || nextLevelDef(bDef.id).energyDrain > 0"
              class="hs-cost-row"
            >
<!-- Paid once, out of the planet's stock. `stockOf` rather than
                   playerResources so a cost in a player-wide currency reads
                   correctly if one is ever introduced. -->
              <span
                v-for="(amt, resId) in nextLevelDef(bDef.id).cost"
                :key="resId"
                class="hs-cost-tag"
                :class="stockOf(resId) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
                :title="t('hawkStar.tile.costOnce')"
              >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
              <!-- Not paid but tied up, and only the DIFFERENCE to the level
                   below: an upgrade asks for what it adds. -->
              <span
                v-if="energyDelta(bDef.id) > 0"
                class="hs-cost-tag"
                :class="hasEnoughPower(bDef.id) ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
                :title="t('hawkStar.tile.costEnergy')"
              >⚡ {{ energyDelta(bDef.id) }}</span>
              <span
                v-if="staffDelta(bDef.id) > 0"
                class="hs-cost-tag"
                :class="freeWorkers >= staffDelta(bDef.id) ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
                :title="t('hawkStar.tile.costStaff')"
              >👥 {{ staffDelta(bDef.id) }}</span>
            </div>

            <!-- Button -->
            <button
              class="hs-btn-build"
              :class="{ 'hs-btn-build--disabled': !canBuild(bDef.id) }"
              :disabled="!canBuild(bDef.id)"
              @click.stop="startBuild(bDef.id)"
            >{{ BUILDINGS[bDef.id]?.global ? t('hawkStar.tile.btnResearch') : getLevel(bDef.id) === 0 ? t('hawkStar.tile.btnBuild') : t('hawkStar.tile.btnUpgrade') }}</button>

            <!-- What you get, and how long it takes -->
            <div class="hs-building-effect">
              <span class="hs-build-time">⏱ {{ formatTime(nextLevelDef(bDef.id).buildTime) }}</span>
              <span class="hs-effect-text">{{ t('hawkStar.buildings.' + bDef.id + '.lv' + nextLevelDef(bDef.id).level) }}</span>
            </div>

            <span v-if="!hasEnoughPower(bDef.id)" class="hs-no-power">{{ t('hawkStar.tile.needPower') }}</span>
            <span v-if="!hasEnoughStaff(bDef.id)" class="hs-no-staff">{{ t('hawkStar.tile.needStaff') }}</span>
          </template>
        </div>
      </div>
    </div>


    <div v-if="buildingsForActiveSlot.length === 0 && !isSpacebaseTile && !isAnomalyTile" class="hs-empty">
      {{ t('hawkStar.tile.selectTile') }}
    </div>

    <!-- ── Conversion section — shown wherever a built facility offers a recipe ── -->
    <div v-if="availableConversions.length" class="hs-conv-section">
      <div class="hs-conv-section-title">{{ t('hawkStar.tile.convTitle') }}</div>

      <div class="hs-conv-list">
        <div v-for="recipe in availableConversions" :key="recipe.key" class="hs-conv-row">
          <!-- Built like `hs-building-ident`, and for the same reason: a recipe
               is a thing you make, so it gets the product's icon in a tile and
               the product's name as its title, with the price underneath as the
               quiet second line. It used to be a formula reading left to right
               into an arrow, so the first thing you met was a cost you had not
               yet decided to pay and the answer to "what am I doing here" was on
               the far end of it.

               Both figures are for the ORDER, not for one run: the picker sets
               what you are about to buy, and per-unit numbers right where the
               money is were quietly asking you to do the multiplication
               yourself. Same rule the dock's corvette costs follow. -->
          <div class="hs-conv-ident">
            <!-- No batch badge on the tile: the title already says `+2
                 Duraplatte`, and a `×2` beside it is the same fact told twice
                 in two different units. -->
            <div class="hs-conv-icon-wrap">
              <span class="hs-conv-icon">{{ recipe.out.icon }}</span>
            </div>

            <div class="hs-conv-info">
              <!-- The amount carries the decision: "+1200 Metall" is what makes
                   a duraplate worth spending, the bare name never did. -->
              <div class="hs-conv-name">
                +{{ recipe.out.amount * countFor(recipe) }} {{ t('hawkStar.res.' + recipe.out.resId) }}
              </div>
              <div class="hs-conv-cost">
                <span class="hs-conv-arrow">←</span>
                <span
                  v-for="(amt, resId) in recipe.input"
                  :key="resId"
                  class="hs-conv-res"
                  :class="stockOf(resId) >= amt * countFor(recipe) ? 'hs-conv-res--ok' : 'hs-conv-res--no'"
                >{{ RESOURCES[resId]?.icon }} {{ amt * countFor(recipe) }}</span>
              </div>
            </div>
          </div>

          <!-- The picker and the button travel together. Loose in the row they
               could wrap onto separate lines, which is the last thing you want
               of two controls you use in one motion: set ×3, then press. -->
          <div class="hs-conv-actions">
            <!-- How many units this batch makes. Paid for up front, delivered
                 together at the end — and frozen at that number while it runs. -->
            <div
              class="hs-conv-count"
              :class="{ 'hs-conv-count--locked': isLocked(recipe) }"
              :title="isLocked(recipe) ? t('hawkStar.tile.convCountLocked') : t('hawkStar.tile.convCountHint')"
            >
              <button
                class="hs-conv-count__btn"
                :disabled="isLocked(recipe) || countFor(recipe) <= 1"
                @click="setCount(recipe, -1)"
              >−</button>
              <span class="hs-conv-count__value">×{{ countFor(recipe) }}</span>
              <button
                class="hs-conv-count__btn"
                :disabled="!canRaise(recipe)"
                @click="setCount(recipe, 1)"
              >+</button>
            </div>

            <!-- One button. It fills over the whole batch and shows the time left.
                 While a batch runs the recipe is locked — no second order, so the
                 facility can never be made to produce faster than one batch. -->
            <button
              class="hs-btn-convert"
              :class="{ 'hs-btn-convert--running': queueFor(recipe.buildingId, recipe.index) }"
              :disabled="!canConvert(recipe.buildingId, recipe.index)"
              :title="queueFor(recipe.buildingId, recipe.index)
                ? t('hawkStar.tile.convBatchRunning', { n: countFor(recipe) })
                : t('hawkStar.tile.convOrder', { n: countFor(recipe), time: formatTime(conversionTime(recipe.buildingId, recipe.index) * countFor(recipe)) })"
              @click="startConversion(recipe.buildingId, recipe.index, countFor(recipe))"
            >
              <span
                v-if="queueFor(recipe.buildingId, recipe.index)"
                class="hs-btn-convert__fill"
                :style="conversionProgressStyle(queueFor(recipe.buildingId, recipe.index))"
              />
              <span class="hs-btn-convert__label">
                <template v-if="queueFor(recipe.buildingId, recipe.index)">
                  <!-- On one line: inside a nowrap slot the newlines around an
                       interpolation collapse into spaces that count toward the
                       seven characters. -->
                  <span class="hs-btn-convert__time">{{ formatTime(remainingConversionSec(queueFor(recipe.buildingId, recipe.index))) }}</span>
                  <span v-if="(queueFor(recipe.buildingId, recipe.index).runs ?? 1) > 1" class="hs-btn-convert__queued">
                    ×{{ queueFor(recipe.buildingId, recipe.index).runs }}
                  </span>
                </template>
                <template v-else>
                  ⚡ {{ t('hawkStar.tile.btnConvert') }}
                  <span class="hs-btn-convert__time hs-btn-convert__dur">{{ formatTime(conversionTime(recipe.buildingId, recipe.index) * countFor(recipe)) }}</span>
                </template>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- The High-Tech tile keeps its two hints, because conversion is that tile's
         whole purpose: refinery buildable but not built vs. planet type has none. -->
    <div v-else-if="isHightechTile && conversionBuildings.length" class="hs-conv-empty">
      {{ t('hawkStar.tile.convEmptyNoRefinery') }}
    </div>
    <div v-else-if="isHightechTile" class="hs-conv-empty">
      {{ t('hawkStar.tile.convEmptyNoFacility') }}
    </div>

  </div>
</template>


<style lang="scss" scoped>
.hs-panel {
  flex: 1;
  min-width: 0;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-glass-2xl);
  border-radius: var(--hs-r-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.hs-panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--hs-line-sm);
}

.hs-panel-icon  { font-size: 1.25rem; }
.hs-panel-title { font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0; flex: 1; }
.hs-panel-desc  { font-size: 0.65rem; opacity: 0.4; }

.hs-building-list { display: flex; flex-direction: column; gap: 0.5rem; }

// Two columns: left = what the building is, right = what building it costs and gives.
// Stacked below 640px, side by side above it with a divider between them.
.hs-building-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.6rem;
  transition: background 0.3s, border-color 0.3s, opacity 0.3s;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: stretch;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  &--offline {
    background: var(--hs-danger-bg);
    border-color: var(--hs-danger-border);
    opacity: 0.75;
  }
}

.hs-building-ident {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;

  @media (min-width: 640px) {
    gap: 0.75rem;
  }
}

.hs-building-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hs-glass-lg);
  border-radius: var(--hs-r-sm);
}

.hs-building-icon { font-size: 1.1rem; }

.hs-level-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 0.55rem;
  font-weight: 700;
  background: var(--hs-accent);
  color: #fff;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.4;
}

.hs-building-info   { flex: 1; min-width: 0; }
.hs-building-name   { font-size: 0.825rem; font-weight: 600; }
.hs-building-desc   { font-size: 0.68rem; opacity: 0.45; margin-top: 2px; line-height: 1.35; }

// Time and effect flow as one wrapping text line, so a long effect string keeps
// filling the column instead of pushing the clock onto a line of its own.
.hs-building-effect {
  font-size: 0.62rem;
  line-height: 1.4;
  opacity: 0.55;

  @media (min-width: 640px) { text-align: right; }

  .hs-build-time::after { content: ' · '; }
}

.hs-cost-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;

  @media (min-width: 640px) { justify-content: flex-end; }
}

.hs-cost-tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;

  &--ok { background: var(--hs-ok-bg);        color: var(--hs-ok-muted); }
  &--no { background: var(--hs-danger-bg-cost); color: var(--hs-danger-muted); }
}

.hs-progress-row   { display: flex; align-items: center; gap: 0.5rem; width: 100%; }
.hs-progress-track { flex: 1; height: 4px; background: var(--hs-glass-3xl); border-radius: 9999px; overflow: hidden; }

.hs-progress-fill {
  height: 100%;
  background: var(--hs-warn);
  border-radius: 9999px;
}

.hs-progress-time {
  font-size: 0.65rem;
  color: var(--hs-warn-text);
  font-variant-numeric: tabular-nums;
  width: 3.5rem;
  text-align: right;
  flex-shrink: 0;
}

.hs-building-action {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: stretch;

  @media (min-width: 640px) {
    width: 12.5rem;
    align-items: flex-end;
    padding-left: 0.75rem;
    border-left: 1px solid var(--hs-line-sm);
  }
}

.hs-build-time { font-size: 0.6rem; color: rgba(255,255,255,0.5); white-space: nowrap; font-variant-numeric: tabular-nums; }
.hs-no-power   { font-size: 0.6rem; color: var(--hs-danger); white-space: nowrap; }
.hs-no-staff   { font-size: 0.6rem; color: var(--hs-staff);  white-space: nowrap; }

@media (min-width: 640px) {
  .hs-no-power, .hs-no-staff { text-align: right; }
}

.hs-btn-build {
  width: 100%;
  padding: 0.375rem 0.75rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--hs-accent);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;

  &:hover:not(:disabled) { background: var(--hs-accent-hover); }

  &--disabled {
    background: var(--hs-glass-xl);
    color: rgba(255, 255, 255, 0.3);
    cursor: not-allowed;
  }
}

.hs-status-building { font-size: 0.7rem; font-weight: 600; color: var(--hs-warn);         white-space: nowrap; }
.hs-status-max      { font-size: 0.7rem; font-weight: 700; color: var(--hs-accent-badge);  letter-spacing: 0.05em; }
.hs-status-offline  { font-size: 0.7rem; font-weight: 700; color: var(--hs-danger);        white-space: nowrap; animation: pulse 1.5s ease-in-out infinite; }
// Wraps rather than running off the row: the hint is a sentence now
// ("Benötigt Power Plant Lv1"), and the longest building name plus the longest
// verb does not fit one line of a half-width panel on a phone. A second line is
// the mild failure; nowrap's is text spilling past the tile.
.hs-status-locked   { font-size: 0.62rem; font-weight: 600; color: rgba(255,255,255,0.25); text-align: right; text-wrap: balance; }

.hs-empty { text-align: center; padding: 1.5rem; opacity: 0.25; font-size: 0.875rem; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

// ── High-Tech conversion section ──────────────────────────────────────────────
.hs-conv-section {
  margin-top: 0.875rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--hs-line-sm);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hs-conv-section-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

// One column. Two were tried and given up: the panel is capped at about 30 rem
// (`hs-main` at 52 rem minus the planet grid's fixed 336 px), so a two-column
// card is ~13 rem — narrow enough that the ident stacks and the picker and the
// button need a line each. Full width buys the recipe a single line for what it
// makes and what it costs, and one line for the two controls. That is shorter
// per recipe than two columns of four-line cards, and it reads left to right.
.hs-conv-list { display: flex; flex-direction: column; gap: 0.375rem; }

// A column of two lines: the recipe, then its controls. They do not share a line
// because ident plus picker plus button is wider than the panel — the row would
// wrap anyway, and a wrap you have designed is not a wrap.
.hs-conv-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.5rem 0.6rem;
}

// The same parts as `hs-building-ident` — icon tile, then what it is — but on
// ONE line: a recipe is a short sentence ("+2 Duraplatte ← 🪨 480 💧 8") and a
// building's two-line name-over-description shape gave it a second line it had
// nothing to put on. A recipe and a building are both "a thing this tile can
// give you", and reading them the same way is most of what makes the panel
// legible; that likeness is in the icon tile and the type, not in the count of
// lines.
.hs-conv-ident {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.hs-conv-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hs-glass-lg);
  border-radius: var(--hs-r-sm);
}

.hs-conv-icon { font-size: 1.1rem; }

// Product and price on one line. `wrap` is the escape hatch for a phone narrow
// enough that they genuinely cannot share one, not the plan.
.hs-conv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem 0.5rem;
}

.hs-conv-name {
  font-size: 0.825rem;
  font-weight: 600;
  color: rgba(196, 181, 253, 0.95);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

// The price, right behind the product it buys and quieter than it: chips, not
// type. It is what the title costs, not what the row is about.
.hs-conv-cost {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.hs-conv-res {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  &--ok  { background: var(--hs-ok-bg);          color: var(--hs-ok-muted); }
  &--no  { background: var(--hs-danger-bg-cost);  color: var(--hs-danger-muted); }
}

.hs-conv-arrow { font-size: 0.7rem; opacity: 0.4; }

// Picker and button, on the row's second line and pushed to its end. They were
// two loose items in a wrapping row once, so the row was free to put them on
// different lines — and did, whenever the button's own width changed. `wrap` is
// kept as the escape hatch for a phone too narrow for both.
.hs-conv-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

// ×N picker — deliberately quiet next to the purple convert button: it sets the
// order, the button is the one that spends.
.hs-conv-count {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1px;
  border-radius: var(--hs-r-sm);
  border: 1px solid var(--hs-line-sm);
  background: var(--hs-glass-sm);
  overflow: hidden;

  // Locked while the batch runs — the number stays readable (it is the size of
  // the running order), only the two steppers go dead.
  &--locked { opacity: 0.45; }
}

.hs-conv-count__btn {
  width: 1.35rem;
  padding: 0.3rem 0;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  color: rgba(255,255,255,0.7);
  background: transparent;
  border: 0;
  cursor: pointer;

  &:hover:not(:disabled) { background: var(--hs-glass-lg); color: #fff; }
  &:disabled { opacity: 0.25; cursor: not-allowed; }
}

.hs-conv-count__value {
  min-width: 1.75rem;
  text-align: center;
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.8);
}

.hs-conv-empty {
  text-align: center;
  padding: 0.75rem;
  opacity: 0.25;
  font-size: 0.75rem;
  font-style: italic;
}

// The button doubles as the progress bar: __fill grows underneath the label.
.hs-btn-convert {
  position: relative;
  overflow: hidden;
  // Its own size and no more: at full panel width the picker and the button
  // share the line comfortably, so a button that grew would only be a wide
  // purple bar with a word floating in the middle of it.
  flex: none;
  min-width: 7.5rem;
  padding: 0.4rem 0.7rem;
  border-radius: var(--hs-r-sm);
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid rgba(139,92,246,0.45);
  background: rgba(139,92,246,0.12);
  color: rgba(167,139,250,0.95);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: rgba(139,92,246,0.25);
    border-color: rgba(139,92,246,0.7);
  }

  &:active:not(:disabled) { transform: translateY(1px); }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  // A running batch always disables the button — the recipe is locked until it
  // delivers. It must still read as "working", not as "unavailable", so it keeps
  // its lit border and a much softer dim than a genuinely blocked button.
  &--running {
    border-color: rgba(139,92,246,0.7);
    &:disabled { opacity: 0.75; cursor: default; }
  }
}

.hs-btn-convert__fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(139,92,246,0.35);
  transition: width 0.4s linear;
  pointer-events: none;
}

.hs-btn-convert__label {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  font-variant-numeric: tabular-nums;
}

// The one part of the label whose width changes — "1h" one click, "1h 30m" the
// next, and a running batch counting down every second. Left to size itself it
// resized the button, which resized the row, which on a narrow panel bumped the
// whole thing onto another line while your cursor was still on the ×N stepper.
//
// A fixed slot ends that: seven characters is `12h 30m`, and the longest a batch
// can actually be is four runs of two hours. Anything a dev time factor stretches
// past that ellipsises rather than moving the furniture — the full string is on
// the button's own tooltip either way.
.hs-btn-convert__time {
  display: inline-block;
  width: 7ch;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hs-btn-convert__dur {
  font-weight: 500;
  opacity: 0.5;
}

.hs-btn-convert__queued {
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(167,139,250,0.25);
  font-size: 0.6rem;
}
</style>
