<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { loadHawk3Data } from '~/utils/localStores.js'

const localePath = useLocalePath()

useHead({
  title: 'Games',
  meta: [{ name: 'description', content: 'Alle Spiele auf einem Blick.' }],
})

const today = new Date().toISOString().split('T')[0]

// Daily game rotation (same order as dailyReward/index.vue)
const DAILY_GAMES = [
  { key: 'slot', label: 'Slot Machine', emoji: '🎰' },
]
const dayIndex    = Math.floor(Date.now() / 86400000)
const todayGame   = DAILY_GAMES[dayIndex % DAILY_GAMES.length]

const highScores = ref({
  hawkFruit:    0,
  memory:       0,
  hawkDoubleUp: 0,
  hawkTower:    0,
})
const dailyClaimedToday = ref(false)
const playerCoins       = ref(0)
const playerDiamonds    = ref(0)
const mysteryItemCount  = ref(0)
const totalBoxes        = ref(0)

onMounted(() => {
  const data = loadHawk3Data()
  highScores.value.hawkFruit    = data.games.hawkFruit?.highScore    ?? 0
  highScores.value.memory       = data.games.memory?.highScore       ?? 0
  highScores.value.hawkDoubleUp = data.games.hawkDoubleUp?.highScore ?? 0
  highScores.value.hawkTower    = data.games.hawkTower?.highScore    ?? 0
  dailyClaimedToday.value       = data.currency?.dailyRewards?.lastClaimed === today
  playerCoins.value             = data.player?.coins    ?? 0
  playerDiamonds.value          = data.player?.diamonds ?? 0
  mysteryItemCount.value        = Object.keys(data.player?.inventory?.items ?? {}).length
  totalBoxes.value              = data.currency?.mysteryBoxes?.totalClaimed ?? 0
})

const games = [
  {
    key:         'dailyReward',
    title:       'Daily Reward',
    description: `Täglich ein anderes Minispiel — sammle Coins, Diamonds und Mystery Boxes!`,
    emoji:       '🎁',
    route:       '/games/dailyReward',
    active:      true,
    isDaily:     true,
  },
  {
    key:         'hawkFruit',
    title:       'Hawk Fruit',
    description: 'Merge-Spiel im Suika-Stil – kombiniere Früchte zu immer größeren!',
    emoji:       '🍉',
    route:       '/games/hawkFruit',
    active:      true,
  },
  {
    key:         'hawkMemory',
    title:       'Hawk Memory',
    description: 'Finde alle Paare so schnell und mit so wenigen Zügen wie möglich.',
    emoji:       '🧠',
    route:       '/games/hawkMemory',
    active:      false,
  },
  {
    key:         'hawkDoubleUp',
    title:       'Hawk Double-Up',
    description: 'Verdopple deinen Einsatz – aber wann ist genug genug?',
    emoji:       '🎰',
    route:       '/games/hawkDoubleUp',
    active:      false,
  },
  {
    key:         'hawkTower',
    title:       'Hawk Tower',
    description: 'Stapele Blöcke so hoch wie möglich ohne umzufallen.',
    emoji:       '🏗️',
    route:       '/games/hawkTower',
    active:      false,
  },
]
</script>

<template>
  <div>
    <div class="container py-12">
      <!-- Profile card -->
      <NuxtLink
        :to="localePath('/games/profile')"
        class="flex items-center justify-between gap-4 bg-surface border border-border rounded-2xl p-5 mb-8 no-underline group transition-all hover:border-primary hover:shadow-[0_4px_24px_var(--c-shadow)] hover:-translate-y-0.5"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-2xl flex-shrink-0">👤</div>
          <div>
            <div class="text-fg font-bold group-hover:text-primary transition-colors">{{ $t('games.overview.profile_title') }}</div>
            <div class="text-muted text-sm mt-0.5">
              💰 {{ playerCoins.toLocaleString() }} · 💎 {{ playerDiamonds.toLocaleString() }}
              <template v-if="mysteryItemCount > 0"> · 🎁 {{ mysteryItemCount }} {{ mysteryItemCount === 1 ? 'Item' : 'Items' }}</template>
            </div>
          </div>
        </div>
        <span class="text-primary text-sm font-semibold flex-shrink-0">{{ $t('games.overview.profile_link') }}</span>
      </NuxtLink>

      <div class="flex flex-wrap gap-4">
        <NuxtLink
          v-for="g in games"
          :key="g.key"
          :to="localePath(g.route)"
          class="group relative flex flex-col gap-3 bg-surface border border-border rounded-2xl p-6 no-underline w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]"
          :class="g.active
            ? 'transition-all hover:border-primary hover:shadow-[0_4px_24px_var(--c-shadow)] hover:-translate-y-1 cursor-pointer'
            : 'opacity-60 cursor-default select-none'"
        >
          <!-- Lock overlay (inactive games) -->
          <div
            v-if="!g.active"
            class="absolute inset-0 rounded-2xl flex items-center justify-center bg-surface/40 backdrop-blur-[1px] z-10"
          >
            <span class="text-xs font-bold uppercase tracking-widest text-muted bg-surface border border-border px-3 py-1 rounded-full">Coming Soon</span>
          </div>

          <div class="flex items-start justify-between gap-2">
            <span class="text-4xl leading-none">{{ g.emoji }}</span>
            <!-- Daily reward: claimed badge or "Heute: …" -->
            <template v-if="g.isDaily">
              <span
                v-if="dailyClaimedToday"
                class="text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-green-400/20 text-green-400"
              >✅ Abgeholt</span>
              <span
                v-else
                class="text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-500"
              >Neu!</span>
            </template>
            <span
              v-else-if="g.active"
              class="text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-500"
            >Beta</span>
          </div>

          <div>
            <h3 class="text-base font-bold text-fg mb-1 group-hover:text-primary transition-colors">{{ g.title }}</h3>
            <!-- Daily reward: show today's game name -->
            <p v-if="g.isDaily" class="text-sm text-muted leading-relaxed m-0">
              Heute: {{ todayGame.emoji }} {{ todayGame.label }} · {{ g.description }}
            </p>
            <p v-else class="text-sm text-muted leading-relaxed m-0">{{ g.description }}</p>
          </div>

          <div class="mt-auto flex items-center justify-between">
            <span v-if="g.isDaily && dailyClaimedToday" class="text-muted text-sm font-semibold">Morgen wieder →</span>
            <span v-else-if="g.active" class="text-primary text-sm font-semibold">Spielen →</span>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
