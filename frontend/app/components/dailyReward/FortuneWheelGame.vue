<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['game-complete', 'spin-start'])
const { t } = useI18n()

const SEGMENTS = [
  { coins: 50,  diamonds: 0, emoji: '💰', color: '#f59e0b' },
  { coins: 0,   diamonds: 3, emoji: '💎', color: '#6366f1' },
  { coins: 80,  diamonds: 0, emoji: '💰', color: '#fbbf24' },
  { coins: 0,   diamonds: 5, emoji: '💎', color: '#4f46e5' },
  { coins: 120, diamonds: 0, emoji: '💰', color: '#f59e0b' },
  { coins: 0,   diamonds: 2, emoji: '💎', color: '#818cf8' },
  { coins: 100, diamonds: 8, emoji: '🌟', color: '#a78bfa' },
  { coins: 60,  diamonds: 0, emoji: '💰', color: '#fcd34d' },
]

const MAX_ATTEMPTS = 5
const CX = 100, CY = 100, R = 88, TEXT_R = 62

function segPath(i) {
  const toRad = (d) => d * Math.PI / 180
  const s = toRad(i * 45 - 22.5 - 90)
  const e = toRad(i * 45 + 22.5 - 90)
  const x1 = (CX + R * Math.cos(s)).toFixed(3)
  const y1 = (CY + R * Math.sin(s)).toFixed(3)
  const x2 = (CX + R * Math.cos(e)).toFixed(3)
  const y2 = (CY + R * Math.sin(e)).toFixed(3)
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`
}

function emojiPos(i) {
  const rad = (i * 45 - 90) * Math.PI / 180
  return {
    x: (CX + TEXT_R * Math.cos(rad)).toFixed(3),
    y: (CY + TEXT_R * Math.sin(rad)).toFixed(3),
  }
}

const phase        = ref('idle')   // 'idle' | 'spinning' | 'result' | 'done'
const attemptsLeft = ref(MAX_ATTEMPTS)
const leverPulled  = ref(false)
const currentAngle = ref(0)
const reward       = ref(null)

const wheelStyle = computed(() => ({
  transform:  `rotate(${currentAngle.value}deg)`,
  transition: phase.value === 'spinning'
    ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.08, 1)'
    : 'none',
}))

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
  phase.value  = 'spinning'
  reward.value = null
  attemptsLeft.value--

  const winIndex   = Math.floor(Math.random() * SEGMENTS.length)
  const baseOffset = (360 - winIndex * 45) % 360
  const jitter     = (Math.random() - 0.5) * 28

  currentAngle.value += 5 * 360 + baseOffset + jitter

  setTimeout(() => {
    reward.value = SEGMENTS[winIndex]
    phase.value  = attemptsLeft.value <= 0 ? 'done' : 'result'
  }, 3600)
}

const collect = () => {
  if (!reward.value) return
  emit('game-complete', {
    coins:    reward.value.coins,
    diamonds: reward.value.diamonds,
    label:    rewardLabel(reward.value),
  })
}

function rewardLabel(seg) {
  if (seg.coins > 0 && seg.diamonds > 0) return t('games.daily_reward.wheel_jackpot')
  if (seg.coins > 0)                      return t('games.daily_reward.wheel_coins',    { n: seg.coins    })
  if (seg.diamonds > 0)                   return t('games.daily_reward.wheel_diamonds', { n: seg.diamonds })
  return ''
}
</script>

<template>
  <div class="flex flex-col gap-3">

    <!-- Wheel + Lever -->
    <div class="flex items-center gap-3">

      <!-- Wheel -->
      <div class="flex-1 flex justify-center">
        <div class="relative w-[180px] h-[180px]">

          <!-- Pointer -->
          <div
            class="absolute top-0 left-1/2 -translate-x-1/2 z-20 text-yellow-400 text-xl leading-none select-none"
            style="filter: drop-shadow(0 0 6px #fbbf24);"
          >▼</div>

          <!-- Spinning wheel -->
          <div class="w-full h-full" :style="wheelStyle">
            <svg viewBox="0 0 200 200" class="w-full h-full">
              <path
                v-for="(seg, i) in SEGMENTS"
                :key="'s' + i"
                :d="segPath(i)"
                :fill="seg.color"
                stroke="#1a1a2e"
                stroke-width="2.5"
              />
              <text
                v-for="(seg, i) in SEGMENTS"
                :key="'e' + i"
                :x="emojiPos(i).x"
                :y="emojiPos(i).y"
                text-anchor="middle"
                dominant-baseline="central"
                font-size="22"
              >{{ seg.emoji }}</text>
              <circle :cx="CX" :cy="CY" :r="R" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3" />
              <circle :cx="CX" :cy="CY" r="16" fill="#1a1a2e" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
              <circle :cx="CX" :cy="CY" r="6"  fill="rgba(255,255,255,0.25)" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Lever — entire area is clickable -->
      <div
        class="relative flex flex-col items-center py-2 select-none"
        style="width: 36px; flex-shrink: 0; height: 180px"
        :class="canSpin ? 'cursor-pointer' : 'cursor-not-allowed'"
        :style="{ opacity: canSpin ? 1 : 0.4 }"
        @touchstart.prevent="pullLever"
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

    <!-- Result + inline Claim -->
    <div
      class="flex items-center gap-1.5 justify-center transition-opacity duration-[250ms]"
      :class="reward && (phase === 'result' || phase === 'done') ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <span class="text-xs font-bold" :style="{ color: reward?.color ?? 'transparent' }">
        {{ reward ? rewardLabel(reward) : ' ' }}
      </span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💰 +{{ reward?.coins ?? 0 }}</span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💎 +{{ reward?.diamonds ?? 0 }}</span>
      <button
        v-if="reward && (phase === 'result' || phase === 'done')"
        class="ml-1 px-3 py-0.5 bg-green-500 hover:bg-green-400 text-white text-xs font-bold rounded-lg transition-colors"
        @click="collect"
      >{{ t('games.daily_reward.collect') }}</button>
    </div>

  </div>
</template>
