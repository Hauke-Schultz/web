<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['game-complete'])
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
  <div class="flex flex-col gap-5">

    <!-- Reels -->
    <div class="flex gap-3 justify-center">
      <div
        v-for="reel in reels"
        :key="reel.id"
        class="w-20 h-20 bg-[#0d0d1a] border-2 border-white/15 rounded-xl flex items-center justify-center text-4xl select-none"
      >
        <span :class="reel.spinning ? 'reel-spin' : ''">
          {{ reel.spinning ? '🎰' : reel.display }}
        </span>
      </div>
    </div>

    <!-- Result label -->
    <Transition name="fade">
      <div
        v-if="phase === 'result' && reward"
        class="text-center font-bold text-lg"
        :style="{ color: reward.color }"
      >{{ reward.label }}</div>
    </Transition>

    <!-- Reward detail -->
    <Transition name="fade">
      <div v-if="phase === 'result' && reward" class="flex gap-3 justify-center">
        <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[80px]">
          <div class="text-xs opacity-50 mb-0.5">{{ t('games.daily_reward.coins') }}</div>
          <div class="text-xl font-bold">+{{ reward.coins }}</div>
        </div>
        <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[80px]">
          <div class="text-xs opacity-50 mb-0.5">{{ t('games.daily_reward.diamonds') }}</div>
          <div class="text-xl font-bold">+{{ reward.diamonds }}</div>
        </div>
      </div>
    </Transition>

    <!-- Buttons -->
    <button
      v-if="phase === 'idle'"
      class="w-full py-4 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors text-lg"
      @click="spin"
    >{{ t('games.daily_reward.spin') }}</button>

    <button
      v-else-if="phase === 'spinning'"
      disabled
      class="w-full py-4 bg-white/10 text-white/40 font-bold rounded-xl text-lg cursor-not-allowed"
    >{{ t('games.daily_reward.spinning') }}</button>

    <button
      v-else-if="phase === 'result'"
      class="w-full py-4 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors text-lg"
      @click="collect"
    >{{ t('games.daily_reward.collect') }}</button>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }

@keyframes reelSpin {
  0%   { transform: translateY(0)    scale(1.1); opacity: 0.7; }
  50%  { transform: translateY(-8px) scale(0.9); opacity: 0.4; }
  100% { transform: translateY(0)    scale(1.1); opacity: 0.7; }
}
.reel-spin { animation: reelSpin 0.18s ease-in-out infinite; }
</style>
