<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'
import { calculateMysteryBoxReward, getMysteryBoxProgress, canClaimMysteryBox, MYSTERY_BOX_CONFIG } from '~/utils/mysteryBoxConfig.js'
import SlotMachineGame  from './SlotMachineGame.vue'
import FortuneWheelGame from './FortuneWheelGame.vue'
import ThreeShellsGame  from './ThreeShellsGame.vue'
import WhackAMoleGame   from './WhackAMoleGame.vue'
import ScratchCardGame  from './ScratchCardGame.vue'

const { t } = useI18n()

const emit = defineEmits(['currency-updated'])

const cardRef = ref(null)
const today = new Date().toISOString().split('T')[0]

const DAILY_GAMES = [
  { key: 'slot',   label: 'Slot Machine',  emoji: '🎰', component: SlotMachineGame  },
  { key: 'wheel',  label: 'Fortune Wheel', emoji: '🎡', component: FortuneWheelGame },
  { key: 'shells', label: 'Three Shells',  emoji: '🐚', component: ThreeShellsGame  },
  { key: 'mole',    label: 'Whack-a-Mole', emoji: '🐭', component: WhackAMoleGame   },
  { key: 'scratch', label: 'Scratch Card', emoji: '🎟️', component: ScratchCardGame  },
]
const dayIndex  = Math.floor(Date.now() / 86400000)
const todayGame = DAILY_GAMES[dayIndex % DAILY_GAMES.length]

const EXTRA_COST = 50

// ── State ─────────────────────────────────────────────────
const phase              = ref('loading') // 'idle' | 'claimed' | 'loading'
const counter            = ref(0)
const lastClaimedCounter = ref(0)
const pendingBox         = ref(null)
const claimedBox         = ref(null)
const lastReward         = ref(null)
const playerCoins        = ref(0)

// ── Extra play ────────────────────────────────────────────
const extraGame  = ref(null)   // null | game object
const extraPhase = ref('idle') // 'idle' | 'playing'

const canAffordExtra = computed(() => playerCoins.value >= EXTRA_COST)

// ── Mystery box progress ──────────────────────────────────
const progress = computed(() =>
  getMysteryBoxProgress(counter.value, lastClaimedCounter.value)
)

const rarityColor = (rarity) => ({
  legendary: 'text-violet-400',
  epic:      'text-purple-400',
  rare:      'text-blue-400',
})[rarity] ?? 'text-white/60'

// ── Load ──────────────────────────────────────────────────
onMounted(() => {
  const data         = loadHawk3Data()
  const claimedToday = data.currency.dailyRewards.lastClaimed === today

  counter.value            = data.currency.dailyRewards.counter
  lastClaimedCounter.value = data.currency.mysteryBoxes.lastClaimedCounter ?? 0
  pendingBox.value         = data.currency.mysteryBoxes.pendingMysteryBox  ?? null
  playerCoins.value        = data.player.coins
  phase.value              = claimedToday ? 'claimed' : 'idle'

  if (claimedToday) {
    lastReward.value = data.currency.dailyRewards.lastReward ?? null
    claimedBox.value = data.currency.mysteryBoxes.lastClaimed === today
      ? (data.currency.mysteryBoxes.lastClaimedBox ?? null)
      : null
  }
})

// ── Scroll to card top when game starts ──────────────────
const onSpinStart = () => {
  cardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── Handle game-complete from child (daily, counts toward box) ──
const onGameComplete = ({ coins: c, diamonds: d, label }) => {
  const data = loadHawk3Data()
  data.player.coins    += c
  data.player.diamonds += d
  data.currency.dailyRewards.lastClaimed = today
  data.currency.dailyRewards.counter    += 1

  const newCounter = data.currency.dailyRewards.counter
  const lastCC     = data.currency.mysteryBoxes.lastClaimedCounter ?? 0

  let autoClaimed = null
  if (canClaimMysteryBox(newCounter, lastCC)) {
    const boxNumber = Math.floor(newCounter / MYSTERY_BOX_CONFIG.requiredDailyRewards)
    const box = calculateMysteryBoxReward(boxNumber)
    const item = box.item
    data.player.inventory              = data.player.inventory       ?? {}
    data.player.inventory.items        = data.player.inventory.items ?? {}
    data.player.inventory.items[item.id] = {
      id: item.id, quantity: 1, purchasedAt: new Date().toISOString(),
      type: item.type, category: item.category, rarity: item.rarity,
      name: item.name, icon: item.icon, description: item.description,
      tier: item.tier, mysteryBoxNumber: item.mysteryBoxNumber,
    }
    data.currency.mysteryBoxes.pendingMysteryBox  = null
    data.currency.mysteryBoxes.lastClaimedCounter = newCounter
    data.currency.mysteryBoxes.totalClaimed       = (data.currency.mysteryBoxes.totalClaimed ?? 0) + 1
    data.currency.mysteryBoxes.lastClaimed        = today
    data.currency.mysteryBoxes.lastClaimedBox     = box
    autoClaimed = box
  }

  data.currency.dailyRewards.lastReward = { coins: c, diamonds: d, label }
  saveHawk3Data(data)

  counter.value            = newCounter
  lastClaimedCounter.value = autoClaimed ? newCounter : lastCC
  pendingBox.value         = null
  claimedBox.value         = autoClaimed
  lastReward.value         = { coins: c, diamonds: d, label }
  playerCoins.value        = data.player.coins
  phase.value              = 'claimed'

  emit('currency-updated', {
    coins:            data.player.coins,
    diamonds:         data.player.diamonds,
    mysteryItemCount: Object.keys(data.player?.inventory?.items ?? {}).length,
  })
}

// ── Extra play: pay 50 coins and launch chosen game ───────
const startExtra = () => {
  if (!extraGame.value || !canAffordExtra.value) return
  const data = loadHawk3Data()
  data.player.coins -= EXTRA_COST
  saveHawk3Data(data)
  playerCoins.value = data.player.coins
  emit('currency-updated', {
    coins:            data.player.coins,
    diamonds:         data.player.diamonds,
    mysteryItemCount: Object.keys(data.player?.inventory?.items ?? {}).length,
  })
  extraPhase.value = 'playing'
}

// ── Extra game complete: add reward only, no mystery box ──
const onExtraGameComplete = ({ coins: c, diamonds: d, label }) => {
  const data = loadHawk3Data()
  data.player.coins    += c
  data.player.diamonds += d
  data.currency.dailyRewards.lastReward = { coins: c, diamonds: d, label }
  saveHawk3Data(data)

  playerCoins.value = data.player.coins
  lastReward.value  = { coins: c, diamonds: d, label }
  extraPhase.value  = 'idle'
  extraGame.value   = null

  emit('currency-updated', {
    coins:            data.player.coins,
    diamonds:         data.player.diamonds,
    mysteryItemCount: Object.keys(data.player?.inventory?.items ?? {}).length,
  })
}

// ── Claim mystery box ─────────────────────────────────────
const claimMysteryBox = () => {
  if (!pendingBox.value) return
  const data = loadHawk3Data()
  const box  = data.currency.mysteryBoxes.pendingMysteryBox
  if (!box) return

  const item = box.item
  data.player.inventory              = data.player.inventory              ?? {}
  data.player.inventory.items        = data.player.inventory.items        ?? {}
  data.player.inventory.items[item.id] = {
    id: item.id, quantity: 1, purchasedAt: new Date().toISOString(),
    type: item.type, category: item.category, rarity: item.rarity,
    name: item.name, icon: item.icon, description: item.description,
    tier: item.tier, mysteryBoxNumber: item.mysteryBoxNumber,
  }
  data.currency.mysteryBoxes.pendingMysteryBox  = null
  data.currency.mysteryBoxes.lastClaimedCounter = data.currency.dailyRewards.counter
  data.currency.mysteryBoxes.totalClaimed       = (data.currency.mysteryBoxes.totalClaimed ?? 0) + 1
  data.currency.mysteryBoxes.lastClaimed        = today
  saveHawk3Data(data)

  lastClaimedCounter.value = data.currency.mysteryBoxes.lastClaimedCounter
  claimedBox.value  = box
  pendingBox.value  = null

  emit('currency-updated', {
    coins:            data.player.coins,
    diamonds:         data.player.diamonds,
    mysteryItemCount: Object.keys(data.player?.inventory?.items ?? {}).length,
  })
}
</script>

<template>
  <!-- ── COMPACT: already claimed today ─────────────────────── -->
  <div ref="cardRef" v-if="phase === 'claimed'" class="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">

    <template v-if="extraPhase === 'idle'">

      <!-- Auto-claimed mystery box -->
      <div
        v-if="claimedBox"
        class="bg-[#1a1a2e] border-2 border-yellow-400 rounded-xl p-4 flex flex-col gap-3"
        style="box-shadow: 0 0 20px rgba(255,215,0,0.25);"
      >
        <div class="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase tracking-widest">
          <span>⭐</span>
          <span>{{ t('games.daily_reward.mystery_item_discovered') }}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-xl border-2 border-yellow-400/60 bg-yellow-400/10 flex items-center justify-center text-3xl shrink-0">
            {{ claimedBox.item?.icon }}
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <div class="text-white font-bold text-sm">{{ claimedBox.item?.name }}</div>
            <div class="text-white/50 text-xs leading-relaxed">{{ claimedBox.item?.description }}</div>
            <div class="text-xs font-bold capitalize" :class="rarityColor(claimedBox.item?.rarity)">{{ claimedBox.item?.rarity }}</div>
          </div>
        </div>
        <div v-if="lastReward" class="flex gap-2">
          <div class="flex-1 bg-white/10 rounded-lg px-2 py-1.5 text-white text-center">
            <div class="text-[10px] opacity-50">{{ t('games.daily_reward.coins') }}</div>
            <div class="text-sm font-bold tabular-nums">+{{ lastReward.coins }}</div>
          </div>
          <div class="flex-1 bg-white/10 rounded-lg px-2 py-1.5 text-white text-center">
            <div class="text-[10px] opacity-50">{{ t('games.daily_reward.diamonds') }}</div>
            <div class="text-sm font-bold tabular-nums">+{{ lastReward.diamonds }}</div>
          </div>
        </div>
      </div>

      <!-- No mystery box: just reward row -->
      <div v-else-if="lastReward" class="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5">
        <span class="text-lg leading-none shrink-0">{{ todayGame.emoji }}</span>
        <span class="text-sm font-semibold text-white/60 flex-1 truncate">{{ lastReward.label ?? todayGame.label }}</span>
        <span class="text-sm font-bold text-yellow-400 tabular-nums shrink-0">💰 +{{ lastReward.coins }}</span>
        <span class="text-sm font-bold text-sky-400 tabular-nums shrink-0">💎 +{{ lastReward.diamonds }}</span>
      </div>

      <!-- Fallback: pending box -->
      <div
        v-else-if="pendingBox"
        class="flex items-center gap-3 bg-yellow-500/10 border border-yellow-400/40 rounded-xl px-3 py-2.5"
      >
        <span class="text-2xl leading-none shrink-0">{{ pendingBox.item?.icon }}</span>
        <div class="flex-1 min-w-0">
          <div class="text-white font-semibold text-sm leading-tight truncate">{{ pendingBox.item?.name }}</div>
          <div class="text-yellow-400/70 text-[11px]">⭐ {{ t('games.daily_reward.mystery_box_title') }}</div>
        </div>
        <button
          class="shrink-0 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors text-xs"
          @click="claimMysteryBox"
        >{{ t('games.daily_reward.collect') }}</button>
      </div>

      <!-- Compact Mystery Box Progress -->
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-white/40 uppercase tracking-wider shrink-0">{{ t('games.daily_reward.mystery_box_title') }}</span>
        <div class="flex gap-1.5 flex-1 justify-end">
          <div
            v-for="i in progress.required"
            :key="i"
            class="w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold transition-all"
            :class="i <= progress.current
              ? 'bg-primary border-primary text-white'
              : 'bg-white/5 border-white/10 text-white/20'"
          >{{ i }}</div>
        </div>
      </div>

      <!-- ── Extra play slot ─────────────────────────────── -->
      <div class="flex flex-col gap-2 border-t border-white/5 pt-2.5">

        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-white/40 uppercase tracking-wider">{{ t('games.daily_reward.extra_title') }}</span>
          <span class="ml-auto text-[10px] font-bold"
                :class="canAffordExtra ? 'text-yellow-400/70' : 'text-red-400/70'">
            {{ t('games.daily_reward.extra_available', { coins: playerCoins }) }}
          </span>
        </div>

        <!-- Game picker -->
        <div class="flex gap-1.5">
          <button
            v-for="g in DAILY_GAMES"
            :key="g.key"
            class="flex-1 py-2 rounded-lg text-xl text-center transition-all"
            :class="extraGame?.key === g.key
              ? 'bg-primary/30 ring-1 ring-primary'
              : 'bg-white/5 hover:bg-white/10'"
            :title="g.label"
            @click="extraGame = extraGame?.key === g.key ? null : g"
          >{{ g.emoji }}</button>
        </div>

        <!-- Play button -->
        <button
          class="w-full py-1.5 text-xs font-bold rounded-lg transition-colors"
          :class="extraGame && canAffordExtra
            ? 'bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer'
            : 'bg-white/5 text-white/25 cursor-not-allowed'"
          :disabled="!extraGame || !canAffordExtra"
          @click="startExtra"
        >
          <template v-if="!canAffordExtra">{{ t('games.daily_reward.extra_not_enough', { cost: EXTRA_COST }) }}</template>
          <template v-else-if="!extraGame">{{ t('games.daily_reward.extra_pick_game') }}</template>
          <template v-else>{{ t('games.daily_reward.extra_play_btn', { emoji: extraGame.emoji, label: extraGame.label, cost: EXTRA_COST }) }}</template>
        </button>

      </div>

    </template>

    <!-- ── Extra game running ──────────────────────────────── -->
    <template v-else>

      <div class="flex items-center justify-between text-[10px] uppercase tracking-wider">
        <span class="text-white/40">{{ t('games.daily_reward.extra_header', { emoji: extraGame.emoji, label: extraGame.label }) }}</span>
        <span class="text-yellow-400/60">{{ t('games.daily_reward.extra_deducted', { cost: EXTRA_COST }) }}</span>
      </div>

      <div class="bg-white/5 border border-white/10 rounded-xl p-4">
        <component :is="extraGame.component" @game-complete="onExtraGameComplete" @spin-start="onSpinStart" />
      </div>

    </template>

  </div>

  <!-- ── FULL: not yet played today ─────────────────────────── -->
  <div ref="cardRef" v-else class="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">

    <!-- Header -->
    <div class="flex items-center gap-3">
      <span class="text-3xl leading-none">🎁</span>
      <div>
        <h3 class="text-base font-bold text-fg m-0">{{ t('games.daily_reward.title') }}</h3>
        <p class="text-xs text-muted m-0 mt-0.5">{{ t('games.daily_reward.today_subtitle', { emoji: todayGame.emoji, label: todayGame.label }) }}</p>
      </div>
    </div>

    <!-- Game area -->
    <div class="bg-white/5 border border-white/10 rounded-xl p-5">
      <template v-if="phase === 'idle'">
        <component :is="todayGame.component" @game-complete="onGameComplete" @spin-start="onSpinStart" />
      </template>
      <template v-else>
        <div class="h-24 flex items-center justify-center text-white/20 text-sm">{{ t('games.daily_reward.loading') }}</div>
      </template>
    </div>

    <!-- Compact Mystery Box Progress -->
    <div class="flex items-center gap-2">
      <span class="text-[10px] text-white/40 uppercase tracking-wider shrink-0">{{ t('games.daily_reward.mystery_box_title') }}</span>
      <div class="flex gap-1.5 flex-1 justify-end">
        <div
          v-for="i in progress.required"
          :key="i"
          class="w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold transition-all"
          :class="i <= progress.current
            ? 'bg-primary border-primary text-white'
            : i === progress.current + 1 && !progress.isComplete
              ? 'bg-white/10 border-white text-white'
              : 'bg-white/5 border-white/10 text-white/20'"
        >{{ i }}</div>
      </div>
    </div>

  </div>
</template>
