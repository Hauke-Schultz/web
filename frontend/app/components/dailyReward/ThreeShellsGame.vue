<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['game-complete', 'spin-start'])
const { t } = useI18n()

// ── Rewards ───────────────────────────────────────────────
const REWARD_WIN  = { coins: 100, diamonds: 3 }
const REWARD_LOSE = { coins: 25,  diamonds: 1 }

// ── State ─────────────────────────────────────────────────
const phase      = ref('start')   // start | showing | shuffling | playing | revealed
const prizeShell = ref(0)         // which shell index (0-2) holds the prize
const shellSlots = ref([0, 1, 2]) // slot position of each shell (0=left,1=mid,2=right)
const selected   = ref(null)
const won        = ref(false)

// ── Slot x-positions (in 192px container, shells 48px wide) ──
const SLOT_X = [0, 72, 144]

// ── Computed helpers ──────────────────────────────────────
const reward = computed(() => won.value ? REWARD_WIN : REWARD_LOSE)

const phaseText = computed(() => {
  if (phase.value === 'showing')   return t('games.daily_reward.shells_watch')
  if (phase.value === 'shuffling') return t('games.daily_reward.shells_shuffling')
  if (phase.value === 'playing')   return t('games.daily_reward.shells_pick')
  return ' '
})

// ── Style + class helpers ─────────────────────────────────
function shellStyle(i) {
  return {
    left: SLOT_X[shellSlots.value[i]] + 'px',
    transition: phase.value === 'shuffling' ? 'left 0.75s cubic-bezier(0.4,0,0.2,1)' : 'none',
  }
}

function showPrize(i) {
  return (phase.value === 'showing'  && i === prizeShell.value) ||
         (phase.value === 'revealed' && i === prizeShell.value)
}

function cupClass(i) {
  const base = 'w-full h-10 rounded-t-2xl rounded-b-sm border-2 transition-all duration-300'
  if (phase.value === 'revealed' && i === prizeShell.value)
    return base + ' bg-yellow-600 border-yellow-400'
  if (phase.value === 'showing' && i === prizeShell.value)
    return base + ' bg-amber-700 border-yellow-400'
  if (phase.value === 'revealed' && i === selected.value && i !== prizeShell.value)
    return base + ' bg-slate-700 border-slate-500'
  if (phase.value === 'playing')
    return base + ' bg-amber-800 border-amber-600 group-hover:border-amber-400 group-hover:bg-amber-700'
  return base + ' bg-amber-800 border-amber-600'
}

function shellGlow(i) {
  if (phase.value === 'revealed' && i === prizeShell.value)
    return 'drop-shadow(0 0 12px rgba(250,204,21,0.7))'
  if (phase.value === 'showing' && i === prizeShell.value)
    return 'drop-shadow(0 0 8px rgba(250,204,21,0.5))'
  return 'none'
}

// ── Game flow ─────────────────────────────────────────────
const start = () => {
  emit('spin-start')
  prizeShell.value = Math.floor(Math.random() * 3)
  shellSlots.value = [0, 1, 2]
  selected.value   = null
  won.value        = false
  phase.value      = 'showing'
  setTimeout(startShuffling, 2500)
}

const startShuffling = () => {
  phase.value = 'shuffling'
  const total = Math.floor(Math.random() * 3) + 5   // 5-7 swaps
  let done = 0

  const doSwap = () => {
    if (done >= total) { phase.value = 'playing'; return }
    let a, b
    do {
      a = Math.floor(Math.random() * 3)
      b = Math.floor(Math.random() * 3)
    } while (a === b)
    const tmp        = shellSlots.value[a]
    shellSlots.value[a] = shellSlots.value[b]
    shellSlots.value[b] = tmp
    done++
    setTimeout(doSwap, 900)
  }
  setTimeout(doSwap, 300)
}

const pick = (i) => {
  if (phase.value !== 'playing') return
  selected.value = i
  won.value      = i === prizeShell.value
  phase.value    = 'revealed'
}

const collect = () => {
  emit('game-complete', {
    coins:    reward.value.coins,
    diamonds: reward.value.diamonds,
    label:    won.value ? t('games.daily_reward.shells_win') : t('games.daily_reward.shells_lose'),
  })
}
</script>

<template>
  <div class="flex flex-col gap-3">

    <!-- Shell area -->
    <div class="relative h-[90px] w-[192px] mx-auto select-none">
      <div
        v-for="i in [0, 1, 2]"
        :key="i"
        class="absolute bottom-0 w-12 flex flex-col items-center gap-0.5 group"
        :style="[shellStyle(i), { filter: shellGlow(i) }]"
        :class="phase === 'playing' ? 'cursor-pointer' : ''"
        @click="pick(i)"
      >
        <!-- Prize / reveal area (fixed height) -->
        <div class="h-9 flex items-center justify-center text-2xl leading-none">
          <Transition name="pop">
            <span v-if="showPrize(i)">💎</span>
            <span v-else-if="phase === 'revealed' && i !== prizeShell.value">🪙</span>
          </Transition>
        </div>

        <!-- Cup body -->
        <div :class="cupClass(i)" />

        <!-- Base strip -->
        <div class="w-full h-1.5 rounded-sm bg-amber-900" />
      </div>
    </div>

    <!-- Phase label — always in DOM to prevent height jump -->
    <p class="text-center text-white/60 text-xs font-medium m-0 transition-opacity duration-[250ms]"
       :class="phaseText !== ' ' ? 'opacity-100' : 'opacity-0'"
    >{{ phaseText }}</p>

    <!-- Result badges — always in DOM to prevent height jump -->
    <div
      class="flex items-center gap-1.5 justify-center transition-opacity duration-[250ms]"
      :class="phase === 'revealed' ? 'opacity-100' : 'opacity-0'"
    >
      <span class="text-xs font-bold" :class="won ? 'text-green-400' : 'text-white/50'">
        {{ phase === 'revealed' ? (won ? t('games.daily_reward.shells_win') : t('games.daily_reward.shells_lose')) : ' ' }}
      </span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💰 +{{ reward.coins }}</span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💎 +{{ reward.diamonds }}</span>
    </div>

    <!-- Button — always same height; playing phase uses invisible placeholder -->
    <button
      v-if="phase === 'start'"
      class="w-full py-2.5 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
      @click="start"
    >{{ t('games.daily_reward.shells_start') }}</button>

    <button
      v-else-if="phase === 'shuffling' || phase === 'showing'"
      disabled
      class="w-full py-2.5 bg-white/10 text-white/40 font-bold rounded-xl cursor-not-allowed"
    >{{ t('games.daily_reward.shells_wait') }}</button>

    <button
      v-else-if="phase === 'playing'"
      disabled
      class="w-full py-2.5 bg-transparent text-transparent font-bold rounded-xl cursor-default"
      aria-hidden="true"
    >-</button>

    <button
      v-else-if="phase === 'revealed'"
      class="w-full py-2.5 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors"
      @click="collect"
    >{{ t('games.daily_reward.collect') }}</button>

  </div>
</template>

<style scoped>
.pop-enter-active { transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.pop-enter-from   { opacity: 0; transform: scale(0.4) translateY(8px); }
</style>
