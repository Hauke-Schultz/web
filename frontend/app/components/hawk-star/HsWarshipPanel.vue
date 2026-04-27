<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RESOURCES, UNIT_COSTS } from '~/utils/hawkStarConfig.js'
import { useHawkStar } from '~/composables/useHawkStar.js'

const {
  playerResources,
  formatTime,
  warshipBayLevel,
  warships,
  warshipInventory,
  warshipBuild,
  warshipBuildTime,
  canBuildWarship,
  buildWarship,
  warshipBuildProgressStyle,
  equipDrive,
  unequipDrive,
  equipWeapon,
  unequipWeapon,
  fleetInOrbit,
  shipHasPowerCell,
  deployToOrbit,
  recallFromOrbit,
} = useHawkStar()

const { t } = useI18n()

const availableOrdnance = computed(() =>
  Object.values(RESOURCES).filter(r => r.weapon && !r.drive && (playerResources.value[r.id] ?? 0) > 0)
)

const availableDriveCells = computed(() =>
  Object.values(RESOURCES).filter(r => r.drive && (playerResources.value[r.id] ?? 0) > 0)
)
</script>

<template>
  <div class="hs-panel">

    <div class="hs-panel-header">
      <span class="hs-panel-icon">⚔️</span>
      <h2 class="hs-panel-title">{{ t('hawkStar.tiles.warship_bay.name') }}</h2>
      <span class="hs-panel-desc">{{ t('hawkStar.tiles.warship_bay.desc') }}</span>
    </div>

    <!-- Build row -->
    <div class="hs-building-list">
      <div class="hs-building-row">
        <div class="hs-building-icon-wrap">
          <span class="hs-building-icon">⚔️</span>
          <span v-if="warshipInventory > 0" class="hs-level-badge hs-level-badge--warship">{{ warshipInventory }}</span>
        </div>
        <div class="hs-building-info">
          <div class="hs-building-name">
            {{ t('hawkStar.dock.warship') }}
            <span v-if="fleetInOrbit.length" class="hs-orbit-count">+{{ fleetInOrbit.length }}🛰</span>
          </div>
          <div class="hs-building-effect">{{ t('hawkStar.dock.warshipDesc') }}</div>
          <div v-if="!warshipBuild" class="hs-cost-row">
            <span
              v-for="(amt, resId) in UNIT_COSTS.warship.cost"
              :key="resId"
              class="hs-cost-tag"
              :class="(playerResources[resId] ?? 0) >= amt ? 'hs-cost-tag--ok' : 'hs-cost-tag--no'"
            >{{ RESOURCES[resId]?.icon }} {{ amt }}</span>
          </div>
          <div v-if="warshipBuild" class="hs-progress-row">
            <div class="hs-progress-track">
              <div :key="warshipBuild.endsAt" class="hs-progress-fill hs-progress-fill--warship" :style="warshipBuildProgressStyle" />
            </div>
            <span class="hs-progress-time">{{ formatTime(Math.max(0, Math.ceil((warshipBuild.endsAt - Date.now()) / 1000))) }}</span>
          </div>
        </div>
        <div class="hs-building-action">
          <span v-if="warshipBuild" class="hs-status-building">{{ t('hawkStar.tile.statusBuilding') }}</span>
          <div v-else class="hs-btn-wrap">
            <button
              class="hs-btn-build"
              :class="{ 'hs-btn-build--disabled': !canBuildWarship }"
              :disabled="!canBuildWarship"
              @click.stop="buildWarship()"
            >{{ t('hawkStar.dock.btnBuild') }}</button>
            <span class="hs-build-time">⏱ {{ formatTime(warshipBuildTime) }}</span>
            <span v-if="warshipInventory >= warshipBayLevel" class="hs-build-time">{{ t('hawkStar.dock.slotsFull', { n: warshipBayLevel }) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Hangar -->
    <div v-if="warships.length" class="hs-warship-section">
      <span class="hs-warship-section-label">🔧 {{ t('hawkStar.dock.sectionHangar') }}</span>
      <div class="hs-warship-fleet">
        <div v-for="ship in warships" :key="ship.id" class="hs-warship-card">
          <div class="hs-warship-card-header">
            <span class="hs-warship-card-icon">{{ ship.icon }}</span>
            <span class="hs-warship-card-name">{{ ship.name }}</span>
            <span class="hs-warship-card-class">{{ t('hawkStar.warships.' + ship.classId + '.desc') }}</span>
            <button
              class="hs-orbit-btn"
              :class="{ 'hs-orbit-btn--disabled': !shipHasPowerCell(ship) }"
              :disabled="!shipHasPowerCell(ship)"
              :title="shipHasPowerCell(ship) ? t('hawkStar.dock.toOrbit') : t('hawkStar.dock.needPowerCell')"
              @click.stop="deployToOrbit(ship.id)"
            >{{ t('hawkStar.dock.toOrbit') }}</button>
          </div>
          <div class="hs-warship-card-stats">
            <span class="hs-warship-stat" title="Hull">🛡 {{ ship.hull }}/{{ ship.hullMax }}</span>
            <span class="hs-warship-stat" :class="ship.drive?.[0]?.shield ? 'hs-warship-stat--boosted' : ''" title="Shield">🔵 {{ ship.shield + (ship.drive?.[0]?.shield ?? 0) }}/{{ ship.shieldMax + (ship.drive?.[0]?.shield ?? 0) }}</span>
            <span class="hs-warship-stat" :class="ship.drive?.[0]?.speed ? 'hs-warship-stat--boosted' : ''" title="Speed">⚡ {{ ship.speed + (ship.drive?.[0]?.speed ?? 0) }}</span>
            <span v-if="ship.weapons.some(w => w)" class="hs-warship-stat hs-warship-stat--atk" :title="t('hawkStar.dock.totalDamage')">⚔ {{ ship.weapons.reduce((s, w) => s + (w?.damage ?? 0), 0) }}</span>
          </div>
          <!-- Drive -->
          <div class="hs-warship-weapons">
            <span class="hs-warship-weapons-label">🔋 {{ t('hawkStar.dock.drive') }}</span>
            <div class="hs-warship-weapon-slots">
              <div
                class="hs-warship-weapon-slot hs-warship-weapon-slot--drive"
                :class="ship.drive?.[0] ? 'hs-warship-weapon-slot--equipped' : 'hs-warship-weapon-slot--empty'"
              >
                <template v-if="ship.drive?.[0]">
                  <span class="hs-warship-slot-item">{{ ship.drive[0].icon }} {{ ship.drive[0].name }}</span>
                  <span class="hs-warship-slot-stats">+{{ ship.drive[0].shield }}🔵 +{{ ship.drive[0].speed }}⚡</span>
                  <button class="hs-warship-unequip-btn" @click.stop="unequipDrive(ship.id)">✕</button>
                </template>
                <template v-else>
                  <span class="hs-warship-weapon-slot-empty-label">{{ t('hawkStar.dock.noDrive') }}</span>
                  <div v-if="availableDriveCells.length" class="hs-warship-equip-row">
                    <button
                      v-for="cell in availableDriveCells"
                      :key="cell.id"
                      class="hs-warship-equip-btn hs-warship-equip-btn--drive"
                      @click.stop="equipDrive(ship.id, cell.id)"
                    >{{ cell.icon }} {{ cell.name }} <span class="hs-warship-equip-count">({{ Math.floor(playerResources[cell.id] ?? 0) }})</span></button>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <!-- Weapons -->
          <div class="hs-warship-weapons">
            <span class="hs-warship-weapons-label">⚔️ {{ t('hawkStar.dock.weapons') }}</span>
            <div class="hs-warship-weapon-slots">
              <div
                v-for="(weapon, idx) in ship.weapons"
                :key="idx"
                class="hs-warship-weapon-slot"
                :class="weapon ? 'hs-warship-weapon-slot--equipped' : 'hs-warship-weapon-slot--empty'"
              >
                <template v-if="weapon">
                  <span class="hs-warship-slot-item">{{ weapon.icon }} {{ weapon.name }}</span>
                  <span class="hs-warship-slot-stats">⚔ {{ weapon.damage }} | {{ Math.round(weapon.accuracy * 100) }}% | AP{{ weapon.armorPiercing }}</span>
                  <button class="hs-warship-unequip-btn" @click.stop="unequipWeapon(ship.id, idx)">✕</button>
                </template>
                <template v-else>
                  <span class="hs-warship-weapon-slot-empty-label">{{ t('hawkStar.dock.emptySlot') }}</span>
                  <div v-if="availableOrdnance.length" class="hs-warship-equip-row">
                    <button
                      v-for="ord in availableOrdnance"
                      :key="ord.id"
                      class="hs-warship-equip-btn"
                      @click.stop="equipWeapon(ship.id, idx, ord.id)"
                    >{{ ord.icon }} {{ ord.name }} <span class="hs-warship-equip-count">({{ Math.floor(playerResources[ord.id] ?? 0) }})</span></button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Orbit fleet -->
    <div v-if="fleetInOrbit.length" class="hs-warship-section hs-warship-section--orbit">
      <span class="hs-warship-section-label">🛰 Orbit</span>
      <div class="hs-warship-fleet">
        <div v-for="ship in fleetInOrbit" :key="ship.id" class="hs-warship-card hs-warship-card--orbit">
          <div class="hs-warship-card-header">
            <span class="hs-warship-card-icon">{{ ship.icon }}</span>
            <span class="hs-warship-card-name">{{ ship.name }}</span>
            <span class="hs-warship-card-class">{{ t('hawkStar.warships.' + ship.classId + '.desc') }}</span>
            <button class="hs-recall-btn" @click.stop="recallFromOrbit(ship.id)">{{ t('hawkStar.dock.hangar') }}</button>
          </div>
          <div class="hs-warship-card-stats">
            <span class="hs-warship-stat" title="Hull">🛡 {{ ship.hull }}/{{ ship.hullMax }}</span>
            <span class="hs-warship-stat" :class="ship.drive?.[0]?.shield ? 'hs-warship-stat--boosted' : ''" title="Shield">🔵 {{ ship.shield + (ship.drive?.[0]?.shield ?? 0) }}/{{ ship.shieldMax + (ship.drive?.[0]?.shield ?? 0) }}</span>
            <span class="hs-warship-stat" :class="ship.drive?.[0]?.speed ? 'hs-warship-stat--boosted' : ''" title="Speed">⚡ {{ ship.speed + (ship.drive?.[0]?.speed ?? 0) }}</span>
            <span v-if="ship.weapons.some(w => w)" class="hs-warship-stat hs-warship-stat--atk">⚔ {{ ship.weapons.reduce((s, w) => s + (w?.damage ?? 0), 0) }}</span>
          </div>
          <div class="hs-warship-weapons">
            <span class="hs-warship-weapons-label">🔋 {{ t('hawkStar.dock.drive') }}</span>
            <div class="hs-warship-weapon-slots">
              <div class="hs-warship-weapon-slot hs-warship-weapon-slot--drive" :class="ship.drive?.[0] ? 'hs-warship-weapon-slot--equipped' : 'hs-warship-weapon-slot--empty'">
                <template v-if="ship.drive?.[0]">
                  <span class="hs-warship-slot-item">{{ ship.drive[0].icon }} {{ ship.drive[0].name }}</span>
                  <span class="hs-warship-slot-stats">+{{ ship.drive[0].shield }}🔵 +{{ ship.drive[0].speed }}⚡</span>
                </template>
                <span v-else class="hs-warship-weapon-slot-empty-label">— no drive —</span>
              </div>
            </div>
          </div>
          <div class="hs-warship-weapons">
            <span class="hs-warship-weapons-label">⚔️ {{ t('hawkStar.dock.weapons') }}</span>
            <div class="hs-warship-weapon-slots">
              <div
                v-for="(weapon, idx) in ship.weapons"
                :key="idx"
                class="hs-warship-weapon-slot"
                :class="weapon ? 'hs-warship-weapon-slot--equipped' : 'hs-warship-weapon-slot--empty'"
              >
                <template v-if="weapon">
                  <span class="hs-warship-slot-item">{{ weapon.icon }} {{ weapon.name }}</span>
                  <span class="hs-warship-slot-stats">⚔ {{ weapon.damage }} | {{ Math.round(weapon.accuracy * 100) }}% | AP{{ weapon.armorPiercing }}</span>
                </template>
                <span v-else class="hs-warship-weapon-slot-empty-label">— empty —</span>
              </div>
            </div>
          </div>
        </div>
      </div>
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
  gap: 0.5rem;
}

.hs-panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

  @media (min-width: 640px) { gap: 0.75rem; padding: 0.75rem; }
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
  background: #f87171;
  color: #fff;
  padding: 1px 4px;
  border-radius: 4px;
  line-height: 1.4;

  &--warship { background: #f87171; color: #fff; }
}

.hs-building-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hs-building-name   { font-size: 0.825rem; font-weight: 600; display: flex; align-items: baseline; gap: 0.35rem; flex-wrap: wrap; }
.hs-building-effect { font-size: 0.68rem; opacity: 0.5; }
.hs-building-action { flex-shrink: 0; }

.hs-orbit-count { font-size: 0.6rem; color: rgba(52,211,153,0.85); font-weight: 400; }

.hs-cost-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }

.hs-cost-tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 5px;
  &--ok { background: var(--hs-ok-bg);          color: var(--hs-ok-muted); }
  &--no { background: var(--hs-danger-bg-cost);  color: var(--hs-danger-muted); }
}

.hs-progress-row   { display: flex; align-items: center; gap: 0.5rem; margin-top: 6px; }
.hs-progress-track { flex: 1; height: 4px; background: var(--hs-glass-3xl); border-radius: 9999px; overflow: hidden; }
.hs-progress-fill  { height: 100%; border-radius: 9999px; }
.hs-progress-time  { font-size: 0.65rem; color: var(--hs-warn-text); font-variant-numeric: tabular-nums; width: 3.5rem; text-align: right; flex-shrink: 0; }
.hs-progress-fill--warship { background: #f87171; }

.hs-btn-wrap    { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.hs-build-time  { font-size: 0.6rem; color: rgba(255,255,255,0.4); white-space: nowrap; }

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
  &--disabled { background: var(--hs-glass-xl); color: rgba(255,255,255,0.3); cursor: not-allowed; }
}

.hs-status-building { font-size: 0.7rem; font-weight: 600; color: var(--hs-warn); white-space: nowrap; }

// ── Warship fleet ─────────────────────────────────────────────────────────────
.hs-warship-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 0.5rem;

  &--orbit .hs-warship-card { border-color: rgba(52,211,153,0.3); background: rgba(52,211,153,0.04); }
}

.hs-warship-section-label {
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.3);
}

.hs-warship-fleet { display: flex; flex-direction: column; gap: 0.4rem; }

.hs-orbit-btn {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(52,211,153,0.35);
  background: rgba(52,211,153,0.08);
  color: rgba(52,211,153,0.9);
  font-size: 0.58rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
  &:hover:not(:disabled) { background: rgba(52,211,153,0.2); border-color: rgba(52,211,153,0.6); }
  &--disabled { opacity: 0.3; cursor: not-allowed; }
}

.hs-recall-btn {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.45);
  font-size: 0.58rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
  &:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }
}

.hs-warship-card {
  background: rgba(248,113,113,0.05);
  border: 1px solid rgba(248,113,113,0.2);
  border-radius: 6px;
  padding: 0.45rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hs-warship-card-header { display: flex; align-items: baseline; gap: 0.35rem; }
.hs-warship-card-icon   { font-size: 0.9rem; line-height: 1; }
.hs-warship-card-name   { font-size: 0.68rem; font-weight: 700; color: rgba(255,255,255,0.85); }
.hs-warship-card-class  { flex: 1; font-size: 0.5rem; color: rgba(255,255,255,0.3); font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hs-warship-card-stats  { display: flex; gap: 0.5rem; }

.hs-warship-stat {
  font-size: 0.58rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: rgba(255,255,255,0.55);
  &--boosted { color: #34d399; }
  &--atk     { color: #f87171; }
}

.hs-warship-weapons       { display: flex; flex-direction: column; gap: 0.2rem; }
.hs-warship-weapons-label { font-size: 0.52rem; color: rgba(255,255,255,0.25); text-transform: uppercase; letter-spacing: 0.04em; }
.hs-warship-weapon-slots  { display: flex; flex-direction: column; gap: 0.2rem; }

.hs-warship-weapon-slot {
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 0.55rem;
  font-weight: 600;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 2px;

  &--empty    { border: 1px dashed rgba(255,255,255,0.12); background: rgba(255,255,255,0.02); }
  &--equipped { border: 1px solid rgba(248,113,113,0.35); background: rgba(248,113,113,0.08); flex-direction: row; align-items: center; }

  &--drive {
    &.hs-warship-weapon-slot--equipped { border-color: rgba(251,191,36,0.4); background: rgba(251,191,36,0.08); }
    &.hs-warship-weapon-slot--empty    { border-color: rgba(251,191,36,0.2); }
  }
}

.hs-warship-weapon-slot-empty-label { color: rgba(255,255,255,0.18); font-style: italic; }

.hs-warship-slot-item {
  flex: 1;
  font-size: 0.62rem;
  font-weight: 600;
  color: rgba(248,113,113,0.9);
  .hs-warship-weapon-slot--drive & { color: rgba(251,191,36,0.9); }
}

.hs-warship-slot-stats {
  font-size: 0.5rem;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.35);
  margin-left: auto;
  white-space: nowrap;
}

.hs-warship-unequip-btn {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  color: rgba(255,255,255,0.3);
  font-size: 0.55rem;
  cursor: pointer;
  line-height: 1;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  &:hover { background: rgba(248,113,113,0.15); border-color: rgba(248,113,113,0.4); color: #f87171; }
}

.hs-warship-equip-row { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }

.hs-warship-equip-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid rgba(52,211,153,0.3);
  background: rgba(52,211,153,0.07);
  color: rgba(52,211,153,0.85);
  font-size: 0.58rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  &:hover { background: rgba(52,211,153,0.18); border-color: rgba(52,211,153,0.55); }

  &--drive {
    border-color: rgba(251,191,36,0.35);
    background: rgba(251,191,36,0.07);
    color: rgba(251,191,36,0.85);
    &:hover { background: rgba(251,191,36,0.17); border-color: rgba(251,191,36,0.6); }
  }
}

.hs-warship-equip-count { font-size: 0.52rem; opacity: 0.6; font-weight: 400; }
</style>
