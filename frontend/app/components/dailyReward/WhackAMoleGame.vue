<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['game-complete', 'spin-start'])
const { t } = useI18n()

const TOTAL_ROUNDS  = 9
const MOLE_DURATION = 1000   // ms mole is visible
const ROUND_PAUSE   = 300    // ms between rounds (icons stay visible in this gap)

const REWARDS = computed(() => [
  { minHits: 8, coins: 150, diamonds: 6, label: t('games.daily_reward.mole_jackpot')     },
  { minHits: 6, coins: 100, diamonds: 3, label: t('games.daily_reward.mole_great')        },
  { minHits: 4, coins: 70,  diamonds: 2, label: t('games.daily_reward.mole_good')         },
  { minHits: 2, coins: 40,  diamonds: 1, label: t('games.daily_reward.mole_ok')           },
  { minHits: 0, coins: 20,  diamonds: 0, label: t('games.daily_reward.mole_consolation')  },
])

const phase  = ref('idle')   // 'idle' | 'playing' | 'done'
const holes  = ref(Array.from({ length: 9 }, () => ({ state: 'empty' })))
const hits   = ref(0)
const round  = ref(0)

const reward = computed(() =>
  REWARDS.value.find(r => hits.value >= r.minHits) ?? REWARDS.value.at(-1)
)

const holeStyle = (state) => {
  if (state === 'hit')  return 'background: #0d1f10; border-color: #16a34a40'
  if (state === 'miss') return 'background: #1f0d0d; border-color: #dc262640'
  return 'background: #0d0d1a; border-color: #1e2035'
}

let moleTimer = null
let holeOrder = []

const startGame = () => {
  emit('spin-start')
  holes.value = Array.from({ length: 9 }, () => ({ state: 'empty' }))
  hits.value  = 0
  round.value = 0
  // Fisher-Yates shuffle of all 9 indices — each hole used exactly once
  holeOrder = [0,1,2,3,4,5,6,7,8]
  for (let i = holeOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [holeOrder[i], holeOrder[j]] = [holeOrder[j], holeOrder[i]]
  }
  phase.value = 'playing'
  setTimeout(showNextMole, 500)
}

const showNextMole = () => {
  if (round.value >= TOTAL_ROUNDS) { phase.value = 'done'; return }

  const idx = holeOrder[round.value]
  holes.value[idx].state = 'mole'
  round.value++

  moleTimer = setTimeout(() => {
    holes.value[idx].state = 'miss'
    setTimeout(showNextMole, ROUND_PAUSE)
  }, MOLE_DURATION)
}

const whack = (idx) => {
  if (phase.value !== 'playing' || holes.value[idx].state !== 'mole') return
  clearTimeout(moleTimer)
  hits.value++
  holes.value[idx].state = 'hit'
  setTimeout(showNextMole, ROUND_PAUSE)
}

const collect = () => {
  if (phase.value !== 'done') return
  emit('game-complete', {
    coins:    reward.value.coins,
    diamonds: reward.value.diamonds,
    label:    reward.value.label,
  })
}
</script>

<template>
  <div class="flex flex-col gap-3 items-center">

    <!-- Score counter (during play) -->
    <div
      class="flex items-center gap-3 transition-opacity duration-200"
      :class="phase === 'playing' ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <span class="text-[11px] text-white/40 uppercase tracking-widest">Treffer</span>
      <div class="flex gap-1">
        <div
          v-for="i in TOTAL_ROUNDS"
          :key="i"
          class="w-2 h-2 rounded-full transition-all duration-200"
          :class="i <= hits
            ? 'bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.8)]'
            : i <= round
              ? 'bg-red-500/60'
              : 'bg-white/10'"
        ></div>
      </div>
      <span class="text-sm font-bold text-white/70 tabular-nums">{{ hits }}/{{ round }}</span>
    </div>

    <!-- Hole grid -->
    <div class="grid grid-cols-3 gap-2.5">
      <div
        v-for="(hole, idx) in holes"
        :key="idx"
        class="relative flex items-center justify-center rounded-full select-none transition-colors duration-200"
        style="width: 64px; height: 64px; border: 2px solid; box-shadow: inset 0 4px 10px rgba(0,0,0,0.7)"
        :style="holeStyle(hole.state)"
        :class="hole.state === 'mole' && phase === 'playing' ? 'cursor-pointer' : ''"
        @click="whack(idx)"
      >
        <!-- Ground ring -->
        <div
          class="absolute inset-1 rounded-full"
          style="background: radial-gradient(ellipse at 40% 35%, #1a1a2e, #06060f); border: 1px solid rgba(255,255,255,0.04)"
        ></div>

        <!-- Mole -->
        <Transition name="mole-pop">
          <span v-if="hole.state === 'mole'" class="relative z-10 text-3xl leading-none">🐭</span>
        </Transition>

        <!-- Hit -->
        <Transition name="feedback-pop">
          <span v-if="hole.state === 'hit'" class="relative z-10 text-3xl leading-none">🔨</span>
        </Transition>

        <!-- Miss -->
        <Transition name="feedback-fade">
          <span v-if="hole.state === 'miss'" class="relative z-10 text-2xl leading-none opacity-70">💨</span>
        </Transition>
      </div>
    </div>

    <!-- Result + inline Claim -->
    <div
      class="flex items-center gap-1.5 justify-center transition-opacity duration-300"
      :class="phase === 'done' ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <span class="text-xs font-bold text-white/70">{{ reward.label }}</span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💰 +{{ reward.coins }}</span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💎 +{{ reward.diamonds }}</span>
      <button
        class="ml-1 px-3 py-0.5 bg-green-500 hover:bg-green-400 text-white text-xs font-bold rounded-lg transition-colors"
        @click="collect"
      >{{ t('games.daily_reward.collect') }}</button>
    </div>

    <!-- Start button -->
    <button
      v-if="phase === 'idle'"
      class="mx-auto px-6 py-1.5 bg-primary hover:bg-primary-h text-white text-sm font-bold rounded-lg transition-colors"
      @click="startGame"
    >{{ t('games.daily_reward.mole_start') }}</button>

  </div>
</template>

<style scoped>
.mole-pop-enter-active {
  transition: opacity 0.15s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mole-pop-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.mole-pop-enter-from { opacity: 0; transform: scale(0.3) translateY(12px); }
.mole-pop-leave-to   { opacity: 0; transform: scale(0.5) translateY(8px); }

.feedback-pop-enter-active {
  transition: opacity 0.1s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.feedback-pop-leave-active { transition: opacity 0.2s ease; }
.feedback-pop-enter-from { opacity: 0; transform: scale(0.4); }
.feedback-pop-leave-to   { opacity: 0; }

.feedback-fade-enter-active { transition: opacity 0.15s ease; }
.feedback-fade-leave-active { transition: opacity 0.2s ease; }
.feedback-fade-enter-from { opacity: 0; }
.feedback-fade-leave-to   { opacity: 0; }
</style>
