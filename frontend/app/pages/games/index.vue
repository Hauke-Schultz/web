<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

import { loadHawk3Data } from '~/utils/localStores.js'
import DailyRewardCard from '../../components/dailyReward/DailyRewardCard.vue'
import GamesHeader from '~/components/games/GamesHeader.vue'

const localePath = useLocalePath()
const { t } = useI18n()
const { applyTheme } = useTheme()

useHead({
  title: 'Games',
  meta: [{ name: 'description', content: 'Alle Spiele auf einem Blick.' }],
})
definePageMeta({ hideHeader: true, forceTheme: 'dark' })

// ── Profile state ─────────────────────────────────────────
const headerRef        = ref(null)
const playerName       = ref('Spieler')
const playerAvatar     = ref('avatar/user')
const playerCoins      = ref(0)
const playerDiamonds   = ref(0)
const mysteryItemCount = ref(0)

onUnmounted(() => {
  const stored = localStorage.getItem('theme')
  if (stored === 'light') applyTheme(stored)
})

onMounted(() => {
  applyTheme('dark')
  const data = loadHawk3Data()
  playerName.value       = data.player?.name    ?? 'Spieler'
  playerAvatar.value     = data.player?.avatar  ?? 'avatar/user'
  playerCoins.value      = data.player?.coins    ?? 0
  playerDiamonds.value   = data.player?.diamonds ?? 0
  mysteryItemCount.value = Object.keys(data.player?.inventory?.items ?? {}).length
})

const onCurrencyUpdated = ({ coins, diamonds, mysteryItemCount: mic }) => {
  playerCoins.value      = coins
  playerDiamonds.value   = diamonds
  mysteryItemCount.value = mic
  headerRef.value?.refresh()
}

const games = [
  {
    key:         'hawkFruit',
    title:       'Hawk Fruit',
    description: 'Merge-Spiel im Suika-Stil – kombiniere Früchte zu immer größeren!',
    emoji:       '🍉',
    route:       '/games/hawkFruit',
    active:      true,
  },
  {
    key:         'hawkDoubleUp',
    title:       'Hawk Double-Up',
    description: 'Verdopple deinen Einsatz – aber wann ist genug genug?',
    emoji:       '🎰',
    route:       '/games/hawkDoubleUp',
    active:      true,
  },
  {
    key:         'hawkTower',
    title:       'Hawk Tower',
    description: 'Stapele Blöcke so hoch wie möglich ohne umzufallen.',
    emoji:       '🏗️',
    route:       '/games/hawkTower',
    active:      true,
  },
  {
    key:         'hawkStar',
    title:       'Hawk Star',
    description: 'Aufbau-Strategie im Weltall – errichte deine Kolonie Planet für Planet.',
    emoji:       '🌌',
    route:       '/games/hawkStar',
    active:      true,
  },
  {
    key:         'hawkCoin',
    title:       'Hawk Coin',
    description: 'Wirf Münzen in den Automaten und schiebe sie über die Kante!',
    emoji:       '🪙',
    route:       '/games/hawkCoin',
    active:      true,
  },
]
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-4 px-4">
    <div class="max-w-[480px] mx-auto flex flex-col gap-6">

      <!-- Header -->
      <GamesHeader ref="headerRef" :title="t('games.overview.title')" back-to="/" home-mode />

      <!-- Profile + Shop row -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Profile card -->
        <NuxtLink
          :to="localePath('/games/profile')"
          class="flex items-center justify-between gap-4 bg-surface border border-border rounded-2xl p-5 no-underline group transition-all hover:border-primary hover:shadow-[0_4px_24px_var(--c-shadow)] hover:-translate-y-0.5"
        >
	        <div class="flex items-center gap-4">
		        <div class="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 overflow-hidden">
			        <Icon :name="playerAvatar" :size="44" decorative />
		        </div>
		        <div>
			        <div class="text-fg font-bold group-hover:text-primary transition-colors">{{ playerName }}</div>
			        <div class="text-muted text-sm mt-0.5">
				        <template v-if="mysteryItemCount > 0">🎁 {{ mysteryItemCount }} {{ mysteryItemCount === 1 ? 'Item' : 'Items' }}</template>
			        </div>
		        </div>
	        </div>
	      </NuxtLink>

        <!-- Shop card -->
        <NuxtLink
          :to="localePath('/games/shop')"
          class="flex flex-col items-center justify-between gap-4 bg-surface border border-border rounded-2xl p-5 no-underline group transition-all hover:border-primary hover:shadow-[0_4px_24px_var(--c-shadow)] hover:-translate-y-0.5"
        >
          <span class="text-3xl leading-none">🛒</span>
          <div>
            <h3 class="text-sm font-bold text-fg mb-0.5 group-hover:text-primary transition-colors leading-tight">Shop</h3>
          </div>
        </NuxtLink>
      </div>

      <!-- Daily Reward (inline game + mystery box progress) -->
      <DailyRewardCard @currency-updated="onCurrencyUpdated" />

      <!-- Game tiles -->
      <div class="grid grid-cols-2 gap-3">
        <NuxtLink
          v-for="g in games"
          :key="g.key"
          :to="localePath(g.route)"
          class="group relative flex flex-col gap-2 bg-surface border border-border rounded-2xl p-4 no-underline"
          :class="g.active
            ? 'transition-all hover:border-primary hover:shadow-[0_4px_24px_var(--c-shadow)] hover:-translate-y-1 cursor-pointer'
            : 'opacity-60 cursor-default select-none'"
        >
          <!-- Lock overlay -->
          <div
            v-if="!g.active"
            class="absolute inset-0 rounded-2xl flex items-center justify-center bg-surface/40 backdrop-blur-[1px] z-10"
          >
            <span class="text-[10px] font-bold uppercase tracking-widest text-muted bg-surface border border-border px-2 py-0.5 rounded-full">Coming Soon</span>
          </div>

          <span class="text-3xl leading-none">{{ g.emoji }}</span>

          <div>
            <h3 class="text-sm font-bold text-fg mb-0.5 group-hover:text-primary transition-colors leading-tight">{{ g.title }}</h3>
            <p class="text-xs text-muted leading-relaxed m-0 line-clamp-2">{{ g.description }}</p>
          </div>

          <div class="mt-auto pt-1">
            <span v-if="g.active" class="text-primary text-xs font-semibold">Spielen →</span>
          </div>
        </NuxtLink>
      </div>

    </div>
  </div>
</template>
