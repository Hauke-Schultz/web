<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['game-complete'])
const { t } = useI18n()

// ── Wheel segments (8 × 45°, segment 0 = top) ────────────
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

// ── SVG helpers ───────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────────
const phase        = ref('idle')   // 'idle' | 'spinning' | 'result'
const currentAngle = ref(0)
const reward       = ref(null)

const wheelStyle = computed(() => ({
  transform:  `rotate(${currentAngle.value}deg)`,
  transition: phase.value === 'spinning'
    ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.08, 1)'
    : 'none',
}))

// ── Spin ──────────────────────────────────────────────────
const spin = () => {
  if (phase.value !== 'idle') return

  const winIndex   = Math.floor(Math.random() * SEGMENTS.length)
  const baseOffset = (360 - winIndex * 45) % 360
  const jitter     = (Math.random() - 0.5) * 28   // ±14° within segment

  phase.value   = 'spinning'
  reward.value  = null
  currentAngle.value += 5 * 360 + baseOffset + jitter

  setTimeout(() => {
    reward.value = SEGMENTS[winIndex]
    phase.value  = 'result'
  }, 3600)
}

// ── Collect ───────────────────────────────────────────────
const collect = () => {
  if (!reward.value) return
  emit('game-complete', {
    coins:    reward.value.coins,
    diamonds: reward.value.diamonds,
    label:    rewardLabel(reward.value),
  })
}

function rewardLabel(seg) {
  if (seg.coins > 0 && seg.diamonds > 0)
    return t('games.daily_reward.wheel_jackpot')
  if (seg.coins > 0)
    return t('games.daily_reward.wheel_coins', { n: seg.coins })
  if (seg.diamonds > 0)
    return t('games.daily_reward.wheel_diamonds', { n: seg.diamonds })
  return ''
}
</script>

<template>
  <div class="flex flex-col gap-5 items-center">

    <!-- Wheel -->
    <div class="relative w-[240px] h-[240px]">

      <!-- Pointer -->
      <div
        class="absolute top-0.5 left-1/2 -translate-x-1/2 z-20 text-yellow-400 text-2xl leading-none select-none"
        style="filter: drop-shadow(0 0 8px #fbbf24);"
      >▼</div>

      <!-- Spinning wheel -->
      <div class="w-full h-full" :style="wheelStyle">
        <svg viewBox="0 0 200 200" class="w-full h-full">

          <!-- Segments -->
          <path
            v-for="(seg, i) in SEGMENTS"
            :key="'s' + i"
            :d="segPath(i)"
            :fill="seg.color"
            stroke="#1a1a2e"
            stroke-width="2.5"
          />

          <!-- Emoji labels -->
          <text
            v-for="(seg, i) in SEGMENTS"
            :key="'e' + i"
            :x="emojiPos(i).x"
            :y="emojiPos(i).y"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="22"
          >{{ seg.emoji }}</text>

          <!-- Outer ring -->
          <circle :cx="CX" :cy="CY" :r="R" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3" />

          <!-- Center hub -->
          <circle :cx="CX" :cy="CY" r="16" fill="#1a1a2e" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
          <circle :cx="CX" :cy="CY" r="6"  fill="rgba(255,255,255,0.25)" />

        </svg>
      </div>
    </div>

    <!-- Result label -->
    <Transition name="fade">
      <div
        v-if="phase === 'result' && reward"
        class="text-center font-bold text-lg text-white"
      >{{ rewardLabel(reward) }}</div>
    </Transition>

    <!-- Reward amounts -->
    <Transition name="fade">
      <div v-if="phase === 'result' && reward" class="flex gap-3 justify-center">
        <div v-if="reward.coins > 0" class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[80px]">
          <div class="text-xs opacity-50 mb-0.5">{{ t('games.daily_reward.coins') }}</div>
          <div class="text-xl font-bold">+{{ reward.coins }}</div>
        </div>
        <div v-if="reward.diamonds > 0" class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[80px]">
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
    >{{ t('games.daily_reward.wheel_spin') }}</button>

    <button
      v-else-if="phase === 'spinning'"
      disabled
      class="w-full py-4 bg-white/10 text-white/40 font-bold rounded-xl text-lg cursor-not-allowed"
    >{{ t('games.daily_reward.wheel_spinning') }}</button>

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
</style>
