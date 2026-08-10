<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES, BUILDINGS } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'
import HsDockPanel from '~/components/hawk-star/HsDockPanel.vue'
import HsNotificationPanel from '~/components/hawk-star/HsNotificationPanel.vue'
import HsProfilePanel from '~/components/hawk-star/HsProfilePanel.vue'
import HsAllResourcePanel from '~/components/hawk-star/HsAllResourcePanel.vue'
import HsPowerBattery from '~/components/hawk-star/HsPowerBattery.vue'
import HsRecruitPanel from '~/components/hawk-star/HsRecruitPanel.vue'
import HsAnomalyPanel from '~/components/hawk-star/HsAnomalyPanel.vue'

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
  staffDelta,
  isOffline,
  freeWorkers,
  batteryCharge,
  starMapLevel,
  playerColonizedPlanets,
  playerScannedPlanets,
  cargoDeliveries,
  systemContacts,
  homeSystemId,
  homePlanetId,
  activePlanetId,
  currentLevelDef,
  remainingSec,
  formatTime,
  buildProgressStyle,
  planetType,
  // conversions
  conversionQueues,
  conversionTime,
  canConvert,
  startConversion,
  remainingConversionSec,
  conversionProgressStyle,
} = useHawkStar()

const { t } = useI18n()

const isSpacebaseTile    = computed(() => activeTileType.value?.id === 'spacebase')
const isHightechTile     = computed(() => activeTileType.value?.id === 'hightech')
const isDockTile         = computed(() => activeTileType.value?.id === 'dock')
const isEnergyTile       = computed(() => activeTileType.value?.id === 'energy')
const isBaseTile         = computed(() => activeTileType.value?.id === 'base')
const isAnomalyTile      = computed(() => activeTileType.value?.id === 'anomaly')
const isHomePlanet       = computed(() => activePlanetId.value === homePlanetId.value)

const hightechBuildings = computed(() => {
  if (!isHightechTile.value) return []
  return buildingsForActiveSlot.value.filter(b => BUILDINGS[b.id]?.conversions?.length > 0)
})

// Only facilities that actually stand on the planet offer a recipe.
const availableConversions = computed(() =>
  hightechBuildings.value
    .filter(b => getLevel(b.id) > 0)
    .flatMap(b => (BUILDINGS[b.id]?.conversions ?? []).map((recipe, index) => ({
      ...recipe,
      index,
      buildingId: b.id,
      key: `${b.id}_${index}`,
    })))
)

// The running job for a recipe, if any — drives the fill inside its button.
const queueFor = (buildingId, recipeIndex) =>
  conversionQueues.value.find(q => q.buildingId === buildingId && q.recipeIndex === recipeIndex) ?? null

// ── Onboarding checklist ──────────────────────────────────────────────────────
// Permanent guide on the base tile. Each step ticks itself off from real state,
// so it doubles as a progress overview once the early game is behind you.
// A foreign system counts once it is fully scanned — the home system is scanned
// from the start and must not tick this off.
const foreignSystemScanned = computed(() =>
  Object.entries(systemContacts.value).some(([sysId, c]) =>
    c?.scanState === 'scanned' && String(sysId) !== String(homeSystemId.value)
  )
)

const onboardingSteps = computed(() => [
  { key: 'step1', done: getLevel('command_center') >= 1 },
  // The home planet starts at 1 population — anything above it came from recruiting.
  { key: 'step2', done: (playerResources.value.population ?? 0) >= 2 },
  { key: 'step3', done: getLevel('power_plant') >= 1 && (batteryCharge.value ?? 0) > 0 },
  { key: 'step4', done: getLevel('metal_mine') >= 1 && getLevel('crystal_drill') >= 1 },
  { key: 'step5', done: starMapLevel.value >= 1 },
  // playerScannedPlanets is seeded with the home planet — only a foreign one counts
  { key: 'step6', done: playerScannedPlanets.value.some(id => id !== homePlanetId.value) },
  // You start with one settlement, so only the second one is an achievement.
  { key: 'step7', done: playerColonizedPlanets.value.length > 1 },
  { key: 'step8', done: cargoDeliveries.value > 0 },
  { key: 'step9', done: foreignSystemScanned.value },
])

const onboardingDoneCount = computed(() => onboardingSteps.value.filter(s => s.done).length)

</script>

<template>
  <!-- Profile -->
  <HsProfilePanel v-if="activePanel === 'profile'" />

  <!-- Activity -->
  <HsNotificationPanel v-else-if="activePanel === 'notifications'" />

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

    <!-- Population recruitment — base tile -->
    <HsRecruitPanel v-if="isBaseTile" />

    <!-- Passing events — anomaly tile (has no buildings of its own) -->
    <HsAnomalyPanel v-if="isAnomalyTile" />

    <div class="hs-building-list">
      <div
        v-for="bDef in buildingsForActiveSlot"
        :key="bDef.id"
        class="hs-building-row"
        :class="{ 'hs-building-row--offline': isOffline(bDef.id) }"
      >
        <!-- Icon + level badge -->
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">{{ bDef.icon }}</span>
          <span v-if="getLevel(bDef.id) > 0" class="hs-level-badge">Lv{{ getLevel(bDef.id) }}</span>
        </div>

        <!-- Info block -->
        <div class="hs-building-info">
          <div class="hs-building-name">{{ t('hawkStar.buildings.' + bDef.id + '.name') }}</div>
          <div v-if="currentLevelDef(bDef.id)" class="hs-building-stats">
            <span v-for="(amt, resId) in currentLevelDef(bDef.id).production" :key="resId">{{ RESOURCES[resId]?.icon }} +{{ amt }}/m</span>
            <span v-if="currentLevelDef(bDef.id).energyDrain">⚡ -{{ currentLevelDef(bDef.id).energyDrain }}</span>
            <span v-if="currentLevelDef(bDef.id).staffDrain">👥 {{ currentLevelDef(bDef.id).staffDrain }}</span>
          </div>
          <div class="hs-building-effect">
            <template v-if="nextLevelDef(bDef.id)">
              {{ getLevel(bDef.id) === 0 ? '' : '→ ' }}{{ t('hawkStar.buildings.' + bDef.id + '.lv' + nextLevelDef(bDef.id).level) }}
            </template>
            <template v-else>{{ t('hawkStar.tile.maxLevel') }}</template>
          </div>

          <!-- Cost row -->
          <div
            v-if="nextLevelDef(bDef.id) && !isBuildingInProgress(bDef.id) && (Object.keys(nextLevelDef(bDef.id).cost).length || staffDelta(bDef.id) > 0 || nextLevelDef(bDef.id).energyDrain > 0)"
            class="hs-cost-row"
          >
            <span
              v-if="nextLevelDef(bDef.id).energyDrain > 0"
              class="hs-cost-tag"
              :class="hasEnoughPower(bDef.id) ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >⚡ -{{ nextLevelDef(bDef.id).energyDrain }}</span>
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
                  :key="playerBuildings[bDef.id].buildEndsAt"
                  class="hs-progress-fill"
                  :style="buildProgressStyle(bDef.id)"
                />
              </div>
              <span class="hs-progress-time">{{ formatTime(remainingSec(playerBuildings[bDef.id].buildEndsAt)) }}</span>
            </div>
          </template>
        </div>

        <!-- Action button -->
        <div class="hs-building-action">
          <template v-if="isBuildingInProgress(bDef.id)">
            <span class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
          </template>
          <template v-else-if="isOffline(bDef.id)">
            <span class="hs-status-offline">{{ t('hawkStar.tile.statusOffline') }}</span>
          </template>
          <template v-else-if="!nextLevelDef(bDef.id)">
            <span class="hs-status-max">{{ t('hawkStar.tile.statusMax') }}</span>
          </template>
          <template v-else-if="isBuildingLocked(bDef.id)">
            <span class="hs-status-locked">
              {{ lockedRequirementInfo(bDef.id) ? t('hawkStar.tile.lockedRequires', { name: t('hawkStar.buildings.' + lockedRequirementInfo(bDef.id).building + '.name'), level: lockedRequirementInfo(bDef.id).level }) : t('hawkStar.tile.lockedGeneric') }}
            </span>
          </template>
          <template v-else>
            <div class="hs-btn-wrap">
              <button
                class="hs-btn-build"
                :class="{ 'hs-btn-build--disabled': !canBuild(bDef.id) }"
                :disabled="!canBuild(bDef.id)"
                @click.stop="startBuild(bDef.id)"
              >{{ BUILDINGS[bDef.id]?.global ? t('hawkStar.tile.btnResearch') : getLevel(bDef.id) === 0 ? t('hawkStar.tile.btnBuild') : t('hawkStar.tile.btnUpgrade') }}</button>
              <span class="hs-build-time">⏱ {{ formatTime(nextLevelDef(bDef.id).buildTime) }}</span>
              <span v-if="!hasEnoughPower(bDef.id)" class="hs-no-power">{{ t('hawkStar.tile.needPower') }}</span>
              <span v-if="!hasEnoughStaff(bDef.id)" class="hs-no-staff">{{ t('hawkStar.tile.needStaff') }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>


    <div v-if="buildingsForActiveSlot.length === 0 && !isSpacebaseTile && !isAnomalyTile" class="hs-empty">
      {{ t('hawkStar.tile.selectTile') }}
    </div>

    <!-- ── High-Tech conversion section ── -->
    <div v-if="isHightechTile && hightechBuildings.length" class="hs-conv-section">
      <div class="hs-conv-section-title">{{ t('hawkStar.tile.convTitle') }}</div>

      <div v-if="availableConversions.length === 0" class="hs-conv-empty">
        {{ t('hawkStar.tile.convEmptyNoRefinery') }}
      </div>

      <div class="hs-conv-list">
        <div v-for="recipe in availableConversions" :key="recipe.key" class="hs-conv-row">
          <!-- Input → Output -->
          <div class="hs-conv-formula">
            <span
              v-for="(amt, resId) in recipe.input"
              :key="resId"
              class="hs-conv-res"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-conv-res--ok' : 'hs-conv-res--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
            <span class="hs-conv-arrow">→</span>
            <span
              v-for="(amt, resId) in recipe.output"
              :key="resId"
              class="hs-conv-res hs-conv-res--out"
            >{{ RESOURCES[resId]?.icon }} {{ t('hawkStar.res.' + resId) }}</span>
          </div>

          <!-- One button. It fills up while the job runs and shows the time left. -->
          <button
            class="hs-btn-convert"
            :class="{ 'hs-btn-convert--running': queueFor(recipe.buildingId, recipe.index) }"
            :disabled="!canConvert(recipe.buildingId, recipe.index)"
            @click="startConversion(recipe.buildingId, recipe.index, 1)"
          >
            <span
              v-if="queueFor(recipe.buildingId, recipe.index)"
              class="hs-btn-convert__fill"
              :style="conversionProgressStyle(queueFor(recipe.buildingId, recipe.index))"
            />
            <span class="hs-btn-convert__label">
              <template v-if="queueFor(recipe.buildingId, recipe.index)">
                {{ formatTime(remainingConversionSec(queueFor(recipe.buildingId, recipe.index))) }}
                <span v-if="queueFor(recipe.buildingId, recipe.index).remaining > 0" class="hs-btn-convert__queued">
                  +{{ queueFor(recipe.buildingId, recipe.index).remaining }}
                </span>
              </template>
              <template v-else>
                ⚡ {{ t('hawkStar.tile.btnConvert') }}
                <span class="hs-btn-convert__dur">{{ formatTime(conversionTime(recipe.buildingId, recipe.index)) }}</span>
              </template>
            </span>
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="isHightechTile && !hightechBuildings.length" class="hs-conv-empty">
      {{ t('hawkStar.tile.convEmptyNoFacility') }}
    </div>

    <!-- Onboarding checklist — permanent on the home planet's base tile -->
    <div v-if="isBaseTile && isHomePlanet" class="hs-onboarding">
      <div class="hs-onboarding-head">
        <span class="hs-onboarding-title">{{ t('hawkStar.tile.onboarding.title') }}</span>
        <span class="hs-onboarding-count">{{ onboardingDoneCount }} / {{ onboardingSteps.length }}</span>
      </div>
      <ul class="hs-onboarding-steps">
        <li
          v-for="step in onboardingSteps"
          :key="step.key"
          :class="{ 'hs-onboarding-step--done': step.done }"
        >
          <span class="hs-onboarding-check">{{ step.done ? '✓' : '' }}</span>
          <span class="hs-onboarding-text">{{ t('hawkStar.tile.onboarding.' + step.key) }}</span>
        </li>
      </ul>
    </div>

  </div>
</template>


<style lang="scss" scoped>
.hs-onboarding {
  background: rgba(80, 120, 255, 0.07);
  border: 1px solid rgba(80, 120, 255, 0.2);
  border-radius: var(--hs-r-md);
  padding: 0.7rem 0.9rem;
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hs-onboarding-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.hs-onboarding-title {
  font-size: 0.68rem;
  font-weight: 700;
  color: rgba(150, 180, 255, 0.9);
  letter-spacing: 0.03em;
}

.hs-onboarding-count {
  font-size: 0.66rem;
  font-weight: 700;
  color: rgba(150, 180, 255, 0.75);
  font-variant-numeric: tabular-nums;
}

.hs-onboarding-steps {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.67rem;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.45;
  }
}

.hs-onboarding-check {
  flex: none;
  width: 0.85rem;
  height: 0.85rem;
  margin-top: 0.12rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(150, 180, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  line-height: 1;
  color: transparent;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.hs-onboarding-step--done {
  color: rgba(255, 255, 255, 0.32);

  .hs-onboarding-check {
    background: rgba(52, 211, 153, 0.2);
    border-color: rgba(52, 211, 153, 0.55);
    color: #6ee7b7;
  }
  .hs-onboarding-text { text-decoration: line-through; }
}

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

.hs-building-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.6rem;
  transition: background 0.3s, border-color 0.3s, opacity 0.3s;

  @media (min-width: 640px) {
    gap: 0.75rem;
    padding: 0.75rem;
  }

  &--offline {
    background: var(--hs-danger-bg);
    border-color: var(--hs-danger-border);
    opacity: 0.75;
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
.hs-building-stats  {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;

  span {
    font-size: 0.6rem;
    color: var(--hs-ok);
    background: var(--hs-ok-bg);
    padding: 1px 5px;
    border-radius: 4px;
  }
}
.hs-building-effect { font-size: 0.68rem; opacity: 0.5; margin-top: 2px; }

.hs-cost-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }

.hs-cost-tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;

  &--ok { background: var(--hs-ok-bg);        color: var(--hs-ok-muted); }
  &--no { background: var(--hs-danger-bg-cost); color: var(--hs-danger-muted); }
}

.hs-progress-row   { display: flex; align-items: center; gap: 0.5rem; margin-top: 6px; }
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

.hs-building-action { flex-shrink: 0; }

.hs-btn-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.hs-build-time { font-size: 0.6rem; color: rgba(255,255,255,0.4); white-space: nowrap; }
.hs-no-power   { font-size: 0.6rem; color: var(--hs-danger); white-space: nowrap; }
.hs-no-staff   { font-size: 0.6rem; color: var(--hs-staff);  white-space: nowrap; }

.hs-btn-build {
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
.hs-status-locked   { font-size: 0.62rem; font-weight: 600; color: rgba(255,255,255,0.25); white-space: nowrap; text-align: right; }

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

.hs-conv-list { display: flex; flex-direction: column; gap: 0.375rem; }

.hs-conv-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--hs-glass-sm);
  border: 1px solid var(--hs-line-sm);
  border-radius: var(--hs-r-md);
  padding: 0.5rem 0.6rem;
}

.hs-conv-formula {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.hs-conv-res {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;

  &--ok  { background: var(--hs-ok-bg);          color: var(--hs-ok-muted); }
  &--no  { background: var(--hs-danger-bg-cost);  color: var(--hs-danger-muted); }
  &--out { background: rgba(139,92,246,0.12);     color: rgba(167,139,250,0.9); }
}

.hs-conv-arrow { font-size: 0.7rem; opacity: 0.4; }

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
  flex-shrink: 0;
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

  // While a job runs the button stays clickable to queue another one
  &--running {
    border-color: rgba(139,92,246,0.7);
    &:disabled { opacity: 0.6; }
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
