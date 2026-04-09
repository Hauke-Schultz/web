<script setup>
import { ref, onMounted } from 'vue'
import { loadHawk3Data } from '~/utils/localStores.js'
import DailyRewardCard from '../../components/dailyReward/DailyRewardCard.vue'

const localePath = useLocalePath()

useHead({
  title: 'Games',
  meta: [{ name: 'description', content: 'Alle Spiele auf einem Blick.' }],
})
definePageMeta({ hideHeader: true })

// ── Profile state ─────────────────────────────────────────
const playerName       = ref('Spieler')
const playerAvatar     = ref('avatar/user')
const playerCoins      = ref(0)
const playerDiamonds   = ref(0)
const mysteryItemCount = ref(0)

onMounted(() => {
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
    active:      true,
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
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-8 px-4">
    <div class="max-w-[480px] mx-auto flex flex-col gap-6">

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
              💰 {{ playerCoins.toLocaleString() }} · 💎 {{ playerDiamonds.toLocaleString() }}
              <template v-if="mysteryItemCount > 0"> · 🎁 {{ mysteryItemCount }} {{ mysteryItemCount === 1 ? 'Item' : 'Items' }}</template>
            </div>
          </div>
        </div>
        <span class="text-primary text-sm font-semibold shrink-0">{{ $t('games.overview.profile_link') }}</span>
      </NuxtLink>

      <!-- Daily Reward (inline game + mystery box progress) -->
      <DailyRewardCard @currency-updated="onCurrencyUpdated" />

      <!-- Other game tiles -->
      <div class="flex flex-wrap gap-4">
        <NuxtLink
          v-for="g in games"
          :key="g.key"
          :to="localePath(g.route)"
          class="group relative flex flex-col gap-3 bg-surface border border-border rounded-2xl p-6 no-underline w-full"
          :class="g.active
            ? 'transition-all hover:border-primary hover:shadow-[0_4px_24px_var(--c-shadow)] hover:-translate-y-1 cursor-pointer'
            : 'opacity-60 cursor-default select-none'"
        >
          <!-- Lock overlay -->
          <div
            v-if="!g.active"
            class="absolute inset-0 rounded-2xl flex items-center justify-center bg-surface/40 backdrop-blur-[1px] z-10"
          >
            <span class="text-xs font-bold uppercase tracking-widest text-muted bg-surface border border-border px-3 py-1 rounded-full">Coming Soon</span>
          </div>

          <div class="flex items-start justify-between gap-2">
            <span class="text-4xl leading-none">{{ g.emoji }}</span>
          </div>

          <div>
            <h3 class="text-base font-bold text-fg mb-1 group-hover:text-primary transition-colors">{{ g.title }}</h3>
            <p class="text-sm text-muted leading-relaxed m-0">{{ g.description }}</p>
          </div>

          <div class="mt-auto">
            <span v-if="g.active" class="text-primary text-sm font-semibold">Spielen →</span>
          </div>
        </NuxtLink>
      </div>

    </div>
  </div>
</template>
