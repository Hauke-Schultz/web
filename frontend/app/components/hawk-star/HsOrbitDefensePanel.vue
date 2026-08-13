<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { SPY, RESOURCES } from '~/utils/hawkStarConfig.js'

const { t } = useI18n()
const {
  foreignSatellites,
  canIntercept,
  interceptSatellite,
  interceptError,
  lastIntercepted,
  playerResources,
  now,
} = useHawkStar()

// One shot, one power cell. Shown on the button like the shield's crystal cost,
// because the same rule applies: a click that spends something says what.
const cost = computed(() =>
  Object.entries(SPY.interceptCost).map(([res, amount]) => ({
    res,
    amount,
    icon: RESOURCES[res]?.icon ?? '•',
    ok: (playerResources.value[res] ?? 0) >= amount,
  }))
)

const affordable = computed(() => cost.value.every(c => c.ok))

// How long it has been watching — the number that replaced the old countdown.
const watchingFor = (placedAt) => {
  if (!placedAt) return ''
  const h = Math.max(0, (now.value - placedAt) / 3600000)
  if (h < 1)  return t('hawkStar.galaxy.intelAgeMin',   { n: Math.max(1, Math.round(h * 60)) })
  if (h < 48) return t('hawkStar.galaxy.intelAgeHours', { n: Math.round(h) })
  return t('hawkStar.galaxy.intelAgeDays', { n: Math.floor(h / 24) })
}
</script>

<template>
  <div class="hs-orbit">
    <div class="hs-orbit-head">
      <span class="hs-orbit-title">🎯 {{ t('hawkStar.orbitDefense.title') }}</span>
      <span class="hs-orbit-count" :class="{ 'hs-orbit-count--alert': foreignSatellites.length > 0 }">
        {{ foreignSatellites.length }}
      </span>
    </div>

    <!-- Detected bogeys. The wreck names its owner, so the row does too — that
         is what makes being spied on something a player can answer. -->
    <ul v-if="foreignSatellites.length" class="hs-orbit-list">
      <li v-for="sat in foreignSatellites" :key="sat.playerId" class="hs-orbit-row">
        <span class="hs-orbit-portrait">{{ sat.portrait ?? '👤' }}</span>
        <span class="hs-orbit-info">
          <span class="hs-orbit-name">{{ sat.username }}</span>
          <span class="hs-orbit-since">📡 {{ t('hawkStar.orbitDefense.watching', { age: watchingFor(sat.placedAt) }) }}</span>
        </span>
        <button
          class="hs-orbit-fire"
          :disabled="!canIntercept"
          :title="affordable ? t('hawkStar.orbitDefense.fireHint') : t('hawkStar.orbitDefense.noAmmo')"
          @click="interceptSatellite(sat.playerId)"
        >
          🎯 {{ t('hawkStar.orbitDefense.fire') }}
          <span
            v-for="c in cost"
            :key="c.res"
            class="hs-orbit-cost"
            :class="c.ok ? 'hs-orbit-cost--ok' : 'hs-orbit-cost--no'"
          >{{ c.icon }} {{ c.amount }}</span>
        </button>
      </li>
    </ul>

    <!-- An empty orbit is a real finding here: the building IS the sensor -->
    <div v-else class="hs-orbit-clear">{{ t('hawkStar.orbitDefense.clear') }}</div>

    <div v-if="lastIntercepted" class="hs-orbit-kill">
      💥 {{ t('hawkStar.orbitDefense.destroyed', { name: lastIntercepted.username }) }}
    </div>
    <div v-if="interceptError" class="hs-orbit-error">{{ interceptError }}</div>

    <div class="hs-orbit-hint">{{ t('hawkStar.orbitDefense.hint') }}</div>
  </div>
</template>

<style lang="scss" scoped>
.hs-orbit {
  margin-bottom: 0.5rem;
  padding: 0.4rem 0.6rem;
  border-radius: var(--hs-r-sm);
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.08);
}

.hs-orbit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.hs-orbit-title {
  font-size: 0.74rem;
  font-weight: 700;
  color: #fecaca;
}
.hs-orbit-count {
  font-size: 0.66rem;
  font-weight: 700;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;

  &--alert { opacity: 1; color: #fca5a5; }
}

.hs-orbit-list {
  list-style: none;
  margin: 0.35rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hs-orbit-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.35rem;
  border-radius: var(--hs-r-sm);
  background: rgba(0, 0, 0, 0.18);
}
.hs-orbit-portrait { font-size: 0.9rem; line-height: 1; flex: none; }
.hs-orbit-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.hs-orbit-name {
  font-size: 0.66rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hs-orbit-since {
  font-size: 0.55rem;
  color: rgba(45, 212, 191, 0.8);
  white-space: nowrap;
}

.hs-orbit-fire {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.58rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  color: #fecaca;
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(239, 68, 68, 0.5);
  transition: background 0.15s, transform 0.05s;

  &:hover:not(:disabled)  { background: rgba(239, 68, 68, 0.34); }
  &:active:not(:disabled) { transform: scale(0.98); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
}
.hs-orbit-cost {
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  &--ok { color: var(--hs-ok); }
  &--no { color: var(--hs-danger); }
}

.hs-orbit-clear {
  margin-top: 0.3rem;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.45);
}

.hs-orbit-kill {
  margin-top: 0.35rem;
  font-size: 0.62rem;
  font-weight: 600;
  color: #fca5a5;
}

.hs-orbit-error {
  margin-top: 0.35rem;
  font-size: 0.62rem;
  color: var(--hs-danger);
}

.hs-orbit-hint {
  margin-top: 0.35rem;
  font-size: 0.58rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.35);
}
</style>
