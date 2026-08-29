<script setup>
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHawkStar } from '~/composables/useHawkStar.js'
import { SPY, RESOURCES } from '~/utils/hawkStarConfig.js'
import HsInterceptGame from '~/components/hawk-star/HsInterceptGame.vue'

const { t } = useI18n()
const {
  foreignSatellites,
  canIntercept,
  interceptError,
  lastIntercepted,
  playerResources,
  now,
} = useHawkStar()

// The 🎯 button no longer fires — it opens the fire-control overlay, and the
// shooting happens in there.
//
// A SNAPSHOT of the bogey, deliberately, not a live lookup into
// `foreignSatellites`: the winning shot removes the satellite from that list,
// so anything derived from it tears the overlay down at the exact moment the
// player has earned the 💥. Nothing is lost by copying — the game seeds its
// counter from this and then follows the server's answer to every shot.
const engaging = ref(null)
const closeGame = () => { engaging.value = null }

// 🎯 is a toggle, not a one-way door: the game has no title bar of its own to
// hang a ✕ on any more, and the button that opened it is still right there, so
// it is the obvious thing to press to put it away. Pressing it on a DIFFERENT
// bogey switches targets rather than closing — a second satellite in the list
// is a new engagement, not a toggle of the first.
//
// The field opens INSIDE the tile, below the row that was tapped, and on a
// phone that is reliably below the fold: the panel sits under the resource bar
// and the bogey list, so a player who pressed 🎯 saw the row highlight and
// nothing else happen. Bring the field into view so the next tap can be the
// first shot. `nearest` on purpose — it scrolls the minimum needed, which
// keeps the bogey's row and its damage bar on screen directly above the field,
// the one place the game deliberately does not repeat them.
const panelEl = ref(null)

const toggleGame = async (sat) => {
  const opening = engaging.value?.playerId !== sat.playerId
  engaging.value = opening ? { ...sat } : null
  if (!opening) return
  await nextTick()
  panelEl.value
    ?.querySelector('.hs-icept')
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

// One shot, one power cell — printed on the button as `1/7`: what a round costs
// over what is in the magazine. The price alone was the shield's pattern, and it
// is the wrong one here, because the price never changes while the stock is what
// decides the engagement. The sortie has no cap of its own, so that second
// number IS how many rounds are left, and it is the only figure there is to plan
// an attack around.
const cost = computed(() =>
  Object.entries(SPY.interceptCost).map(([res, amount]) => ({
    res,
    amount,
    // Floored, so it never advertises a round the stock cannot actually pay for.
    have: Math.floor(playerResources.value[res] ?? 0),
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
  <div ref="panelEl" class="hs-orbit">
    <div class="hs-orbit-head">
      <span class="hs-orbit-title">🎯 {{ t('hawkStar.orbitDefense.title') }}</span>
      <span class="hs-orbit-count" :class="{ 'hs-orbit-count--alert': foreignSatellites.length > 0 }">
        {{ foreignSatellites.length }}
      </span>
    </div>

    <!-- One slot, one height. Shooting the last bogey used to shrink the tile:
         a row is three stacked lines and the text that takes its place is one,
         so the panel — and everything below it in the column — jumped at the
         exact moment the player was watching the wreck. The list, the "orbit
         clear" line and the kill notice now share a box that is never shorter
         than one row, and the row is never taller than the box. -->
    <div class="hs-orbit-body">
      <!-- Detected bogeys. The wreck names its owner, so the row does too — that
           is what makes being spied on something a player can answer. -->
      <ul v-if="foreignSatellites.length" class="hs-orbit-list">
        <li v-for="sat in foreignSatellites" :key="sat.playerId" class="hs-orbit-row">
          <span class="hs-orbit-portrait">{{ sat.portrait ?? '👤' }}</span>
          <span class="hs-orbit-info">
            <span class="hs-orbit-name">{{ sat.username }}</span>
            <span class="hs-orbit-since">📡 {{ t('hawkStar.orbitDefense.watching', { age: watchingFor(sat.placedAt) }) }}</span>
            <!-- Damage already done to this one. It survives the salvo that dealt
                 it, so an engagement broken off is a head start, not a loss.

                 Shown at 0/3 as well: an empty bar is the answer to "how much of
                 this is left", and hiding it until the first hit meant the one
                 moment the question is most likely to be asked — before firing a
                 single round — was the one moment it went unanswered. It also
                 stopped the row changing height as soon as a shot landed. -->
            <span class="hs-orbit-armor">
              <span class="hs-orbit-armor__bar">
                <span class="hs-orbit-armor__fill" :style="{ width: (sat.hits / (sat.armor || 3)) * 100 + '%' }" />
              </span>
              {{ sat.hits }} / {{ sat.armor || 3 }}
            </span>
          </span>
          <button
            class="hs-orbit-fire"
            :disabled="!canIntercept"
            :title="affordable ? t('hawkStar.orbitDefense.fireHint') : t('hawkStar.orbitDefense.noAmmo')"
            @click="toggleGame(sat)"
          >
            🎯 {{ t('hawkStar.orbitDefense.fire') }}
            <span
              v-for="c in cost"
              :key="c.res"
              class="hs-orbit-cost"
              :class="c.ok ? 'hs-orbit-cost--ok' : 'hs-orbit-cost--no'"
            >{{ c.icon }} {{ c.amount }}/{{ c.have }}</span>
          </button>
        </li>
      </ul>

      <!-- An empty orbit is a real finding here: the building IS the sensor -->
      <div v-else class="hs-orbit-clear">{{ t('hawkStar.orbitDefense.clear') }}</div>

      <div v-if="lastIntercepted" class="hs-orbit-kill">
        💥 {{ t('hawkStar.orbitDefense.destroyed', { name: lastIntercepted.username }) }}
      </div>
    </div>

    <div v-if="interceptError" class="hs-orbit-error">{{ interceptError }}</div>


    <!-- In the tile, not over the screen. Firing at something in your own orbit
         is part of running the planet, not a mode you enter — and the panel it
         replaces is right here, so the field opens where the target list was
         rather than somewhere the eye has to be led back from. -->
    <HsInterceptGame v-if="engaging" :target="engaging" @close="closeGame" />
  </div>
</template>

<style lang="scss" scoped>
// The height of one bogey row, and therefore the height of the slot that holds
// the list. It is the row's own natural height with a hair of headroom — three
// pinned line-heights in the info column plus the row's padding — so neither
// side of `min-height` ever has to grow to meet the other.
$slot: 2.75rem;

// The row's damage bar. Deliberately the same two colours as the one inside the
// game, because it is the same number — a player who softened a satellite last
// night should recognise the bar they left behind.
.hs-orbit-armor {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.5rem;
  line-height: 1.3;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(252,165,165,0.85);
}

.hs-orbit-armor__bar {
  width: 2.4rem;
  height: 3px;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  overflow: hidden;
}

.hs-orbit-armor__fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}

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

// Never shorter than one row, whatever is in it. Centred, so the one or two
// lines of text that stand in for a row sit where the row was rather than
// clinging to the top of an obviously empty box.
.hs-orbit-body {
  margin-top: 0.35rem;
  min-height: $slot;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
}

.hs-orbit-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hs-orbit-row {
  display: flex;
  align-items: center;
  min-height: $slot;
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
// The three lines are pinned to one line-height, which is what makes the row's
// height a number `$slot` can be written down against instead of whatever the
// browser's default line box happens to work out to.
.hs-orbit-name {
  font-size: 0.66rem;
  line-height: 1.3;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hs-orbit-since {
  font-size: 0.55rem;
  line-height: 1.3;
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
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.45);
}

.hs-orbit-kill {
  font-size: 0.62rem;
  font-weight: 600;
  color: #fca5a5;
}

.hs-orbit-error {
  margin-top: 0.35rem;
  font-size: 0.62rem;
  color: var(--hs-danger);
}

</style>
