<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['game-complete', 'spin-start'])
const { t } = useI18n()

const SYMBOLS      = ['💰', '💎', '⭐', '🍀', '🔔', '💫']
const MAX_ATTEMPTS = 5

const REWARDS = computed(() => ({
  jackpot:         { coins: 200, diamonds: 8,  label: t('games.daily_reward.slot_jackpot'),         color: '#a78bfa' },
  triple_coins:    { coins: 150, diamonds: 3,  label: t('games.daily_reward.slot_triple_coins'),    color: '#fbbf24' },
  double_diamonds: { coins: 120, diamonds: 5,  label: t('games.daily_reward.slot_double_diamonds'), color: '#818cf8' },
  double_coins:    { coins: 80,  diamonds: 2,  label: t('games.daily_reward.slot_double_coins'),    color: '#f59e0b' },
  mixed:           { coins: 60,  diamonds: 2,  label: t('games.daily_reward.slot_mixed'),           color: '#6ee7b7' },
}))

const phase         = ref('idle')   // 'idle' | 'spinning' | 'result' | 'done'
const attemptsLeft  = ref(MAX_ATTEMPTS)
const leverPulled   = ref(false)
const currentReward = ref(null)

const rand = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]

const reels = ref([
  { id: 0, top: rand(), middle: '💰', bottom: rand(), spinning: false, stopCount: 0 },
  { id: 1, top: rand(), middle: '💎', bottom: rand(), spinning: false, stopCount: 0 },
  { id: 2, top: rand(), middle: '💰', bottom: rand(), spinning: false, stopCount: 0 },
])

const spinIntervals = [null, null, null]

const canSpin = computed(() =>
  (phase.value === 'idle' || phase.value === 'result') && attemptsLeft.value > 0
)

const pullLever = () => {
  if (!canSpin.value) return
  leverPulled.value = true
  setTimeout(() => { leverPulled.value = false }, 500)
  doSpin()
}

const doSpin = () => {
  emit('spin-start')
  phase.value = 'spinning'
  currentReward.value = null
  attemptsLeft.value--

  const finals = reels.value.map(rand)

  reels.value.forEach((reel, i) => {
    reel.spinning = true
    spinIntervals[i] = setInterval(() => {
      reel.top    = rand()
      reel.middle = rand()
      reel.bottom = rand()
    }, 70)

    setTimeout(() => {
      clearInterval(spinIntervals[i])
      reel.top    = rand()
      reel.middle = finals[i]
      reel.bottom = rand()
      reel.spinning  = false
      reel.stopCount++
      if (i === 2) setTimeout(() => resolveResult(finals), 350)
    }, 900 + i * 400)
  })
}

const resolveResult = (finals) => {
  const r = REWARDS.value
  const counts = {}
  finals.forEach(s => { counts[s] = (counts[s] || 0) + 1 })
  const topCount  = Math.max(...Object.values(counts))
  const topSymbol = Object.keys(counts).find(k => counts[k] === topCount)

  let result
  if      (topCount === 3 && topSymbol === '💎') result = r.jackpot
  else if (topCount === 3 && topSymbol === '💰') result = r.triple_coins
  else if (topCount === 3)                        result = r.triple_coins
  else if (topCount === 2 && topSymbol === '💎') result = r.double_diamonds
  else if (topCount === 2)                        result = r.double_coins
  else                                            result = r.mixed

  currentReward.value = result
  phase.value = attemptsLeft.value <= 0 ? 'done' : 'result'
}

const collect = () => {
  if (!currentReward.value) return
  emit('game-complete', {
    coins:    currentReward.value.coins,
    diamonds: currentReward.value.diamonds,
    label:    currentReward.value.label,
  })
}
</script>

<template>
  <div class="flex flex-col gap-3">

    <!-- Machine + Lever -->
    <div class="flex items-stretch gap-3">

      <!-- Machine body -->
      <div
        class="flex-1 relative bg-[#080814] rounded-2xl overflow-hidden"
        style="border: 2px solid #1e1e3c; box-shadow: inset 0 2px 12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)"
      >
        <!-- Win-line glow strip (center row) -->
        <div
          class="absolute inset-x-0 pointer-events-none z-10"
          style="
            top: calc(50% - 32px); height: 64px;
            background: linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.04) 30%, rgba(255,215,0,0.04) 70%, transparent 100%);
            border-top: 1px solid rgba(255,215,0,0.22);
            border-bottom: 1px solid rgba(255,215,0,0.22);
          "
        ></div>

        <!-- Reels -->
        <div class="flex gap-2 justify-center p-3">
          <div
            v-for="reel in reels"
            :key="reel.id"
            class="flex flex-col rounded-lg overflow-hidden"
            style="width: 68px; height: 192px; background: #04040e; border: 1px solid rgba(255,255,255,0.07)"
          >
            <!-- Top cell (dim) -->
            <div
              class="flex items-center justify-center shrink-0 select-none"
              style="height: 64px; font-size: 1.5rem; opacity: 0.2"
              :style="reel.spinning ? 'filter: blur(1px)' : ''"
            >{{ reel.top }}</div>

            <!-- Middle cell (active / win line) -->
            <div
              :key="`m-${reel.id}-${reel.stopCount}`"
              class="flex items-center justify-center shrink-0 select-none"
              style="height: 64px; font-size: 2rem"
              :class="reel.spinning ? 'reel-spin' : reel.stopCount > 0 ? 'reel-land' : ''"
            >{{ reel.middle }}</div>

            <!-- Bottom cell (dim) -->
            <div
              class="flex items-center justify-center shrink-0 select-none"
              style="height: 64px; font-size: 1.5rem; opacity: 0.2"
              :style="reel.spinning ? 'filter: blur(1px)' : ''"
            >{{ reel.bottom }}</div>
          </div>
        </div>
      </div>

      <!-- Lever — entire area is clickable -->
      <div
        class="relative flex flex-col items-center py-2 select-none"
        style="width: 36px; flex-shrink: 0"
        :class="canSpin ? 'cursor-pointer' : 'cursor-not-allowed'"
        :style="{ opacity: canSpin ? 1 : 0.4 }"
        @click="pullLever"
      >
        <!-- Handle ball -->
        <div
          class="w-9 h-9 rounded-full z-10 pointer-events-none"
          style="
            background: radial-gradient(circle at 38% 35%, #f87171, #991b1b);
            border: 2px solid rgba(255,180,180,0.35);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s;
          "
          :style="{
            transform: leverPulled ? 'translateY(100px)' : 'translateY(0)',
            boxShadow: canSpin && !leverPulled
              ? '0 4px 14px rgba(153,27,27,0.55), 0 0 10px rgba(248,113,113,0.3), inset 0 1px 2px rgba(255,255,255,0.15)'
              : '0 2px 6px rgba(153,27,27,0.3), inset 0 1px 2px rgba(255,255,255,0.1)',
          }"
        ></div>

        <!-- Rod -->
        <div
          class="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style="
            top: 22px; bottom: 18px;
            width: 8px;
            background: linear-gradient(to right, #374151 0%, #9ca3af 35%, #d1d5db 50%, #9ca3af 65%, #4b5563 100%);
            border-radius: 4px;
          "
        ></div>

        <!-- Base block -->
        <div
          class="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none"
          style="
            width: 24px; height: 14px;
            background: linear-gradient(to bottom, #4b5563, #1f2937);
            border-radius: 4px;
            border: 1px solid rgba(255,255,255,0.07);
          "
        ></div>
      </div>
    </div>

    <!-- Attempts indicator -->
    <div class="flex items-center justify-center gap-2">
      <span class="text-[10px] text-white/30 uppercase tracking-widest font-medium">{{ t('games.daily_reward.attempts') }}</span>
      <div class="flex gap-1.5">
        <div
          v-for="i in MAX_ATTEMPTS"
          :key="i"
          class="w-2.5 h-2.5 rounded-full transition-all duration-500"
          :class="i <= attemptsLeft
            ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.8)]'
            : 'bg-white/10'"
        ></div>
      </div>
    </div>

    <!-- Current result + inline Claim -->
    <div
      class="flex items-center gap-1.5 justify-center transition-opacity duration-300"
      :class="currentReward ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <span class="text-xs font-bold" :style="{ color: currentReward?.color ?? 'transparent' }">
        {{ currentReward?.label ?? ' ' }}
      </span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">
        💰 +{{ currentReward?.coins ?? 0 }}
      </span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">
        💎 +{{ currentReward?.diamonds ?? 0 }}
      </span>
      <button
        v-if="currentReward && (phase === 'result' || phase === 'done')"
        class="ml-1 px-3 py-0.5 bg-green-500 hover:bg-green-400 text-white text-xs font-bold rounded-lg transition-colors"
        @click="collect"
      >{{ t('games.daily_reward.collect') }}</button>
    </div>

  </div>
</template>

<style scoped>
@keyframes symbolFlick {
  0%   { transform: scale(1) translateY(0);    opacity: 1; }
  50%  { transform: scale(0.8) translateY(-6px); opacity: 0.45; }
  100% { transform: scale(1) translateY(0);    opacity: 1; }
}
.reel-spin {
  animation: symbolFlick 0.1s ease-in-out infinite;
}

@keyframes symbolLand {
  0%   { transform: scale(1.35) translateY(-14px); filter: blur(2px); opacity: 0.5; }
  55%  { transform: scale(1.06) translateY(4px);   filter: blur(0);   opacity: 1;   }
  100% { transform: scale(1)    translateY(0); }
}
.reel-land {
  animation: symbolLand 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
</style>
