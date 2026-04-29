<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['game-complete', 'spin-start'])
const { t } = useI18n()

// ── Symbols + rewards ─────────────────────────────────────
const SYMBOLS = ['💰', '💎']

const REWARDS = computed(() => ({
  jackpot:         { coins: 200, diamonds: 8,  label: t('games.daily_reward.slot_jackpot'),         color: '#a78bfa' },
  triple_coins:    { coins: 150, diamonds: 3,  label: t('games.daily_reward.slot_triple_coins'),    color: '#fbbf24' },
  double_diamonds: { coins: 120, diamonds: 5,  label: t('games.daily_reward.slot_double_diamonds'), color: '#818cf8' },
  double_coins:    { coins: 80,  diamonds: 2,  label: t('games.daily_reward.slot_double_coins'),    color: '#f59e0b' },
  mixed:           { coins: 60,  diamonds: 2,  label: t('games.daily_reward.slot_mixed'),           color: '#6ee7b7' },
}))

// ── State ─────────────────────────────────────────────────
const phase  = ref('idle')   // 'idle' | 'spinning' | 'result'
const reels  = ref([
  { id: 0, display: '💰', spinning: false },
  { id: 1, display: '💎', spinning: false },
  { id: 2, display: '💰', spinning: false },
])
const reward = ref(null)

// ── Spin ──────────────────────────────────────────────────
const spin = () => {
  if (phase.value !== 'idle') return
  emit('spin-start')
  phase.value = 'spinning'
  reward.value = null

  const finals = reels.value.map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
  reels.value.forEach((r, i) => {
    r.spinning = true
    setTimeout(() => {
      r.spinning = false
      r.display  = finals[i]
      if (i === reels.value.length - 1) setTimeout(() => resolve(finals), 400)
    }, 900 + i * 350)
  })
}

const resolve = (finals) => {
  const coins3 = finals.filter(s => s === '💰').length
  const dia3   = finals.filter(s => s === '💎').length
  const r      = REWARDS.value
  if      (dia3 === 3)   reward.value = r.jackpot
  else if (coins3 === 3) reward.value = r.triple_coins
  else if (dia3 === 2)   reward.value = r.double_diamonds
  else if (coins3 === 2) reward.value = r.double_coins
  else                   reward.value = r.mixed
  phase.value = 'result'
}

const collect = () => {
  if (!reward.value) return
  emit('game-complete', {
    coins:    reward.value.coins,
    diamonds: reward.value.diamonds,
    label:    reward.value.label,
  })
}
</script>

<template>
  <div class="flex flex-col gap-3">

    <!-- Reels -->
    <div class="flex gap-3 justify-center">
      <div
        v-for="reel in reels"
        :key="reel.id"
        class="w-16 h-16 bg-[#0d0d1a] border-2 border-white/15 rounded-xl flex items-center justify-center text-3xl select-none"
      >
        <span :class="reel.spinning ? 'reel-spin' : ''">
          {{ reel.spinning ? '🎰' : reel.display }}
        </span>
      </div>
    </div>

    <!-- Result badges — always in DOM to prevent height jump -->
    <div
      class="flex items-center gap-1.5 justify-center transition-opacity duration-[250ms]"
      :class="phase === 'result' && reward ? 'opacity-100' : 'opacity-0'"
    >
      <span
        class="text-xs font-bold"
        :style="{ color: reward?.color ?? 'transparent' }"
      >{{ reward?.label ?? ' ' }}</span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💰 +{{ reward?.coins ?? 0 }}</span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💎 +{{ reward?.diamonds ?? 0 }}</span>
    </div>

    <!-- Button — all variants same size, swap via v-if -->
    <button
      v-if="phase === 'idle'"
      class="w-full py-2.5 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
      @click="spin"
    >{{ t('games.daily_reward.spin') }}</button>

    <button
      v-else-if="phase === 'spinning'"
      disabled
      class="w-full py-2.5 bg-white/10 text-white/40 font-bold rounded-xl cursor-not-allowed"
    >{{ t('games.daily_reward.spinning') }}</button>

    <button
      v-else-if="phase === 'result'"
      class="w-full py-2.5 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors"
      @click="collect"
    >{{ t('games.daily_reward.collect') }}</button>

  </div>
</template>

<style scoped>
@keyframes reelSpin {
  0%   { transform: translateY(0)    scale(1.1); opacity: 0.7; }
  50%  { transform: translateY(-8px) scale(0.9); opacity: 0.4; }
  100% { transform: translateY(0)    scale(1.1); opacity: 0.7; }
}
.reel-spin { animation: reelSpin 0.18s ease-in-out infinite; }
</style>
