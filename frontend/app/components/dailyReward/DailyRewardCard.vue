<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'
import { calculateMysteryBoxReward, getMysteryBoxProgress, canClaimMysteryBox, MYSTERY_BOX_CONFIG } from '~/utils/mysteryBoxConfig.js'
import SlotMachineGame from './SlotMachineGame.vue'

const { t } = useI18n()

const emit = defineEmits(['currency-updated'])

const today = new Date().toISOString().split('T')[0]

// Daily game rotation — add new game components here when ready
const DAILY_GAMES = [
  { key: 'slot', label: 'Slot Machine', emoji: '🎰', component: SlotMachineGame },
]
const dayIndex  = Math.floor(Date.now() / 86400000)
const todayGame = DAILY_GAMES[dayIndex % DAILY_GAMES.length]

// ── State ─────────────────────────────────────────────────
const phase              = ref('loading') // 'idle' | 'claimed' | 'loading'
const counter            = ref(0)
const lastClaimedCounter = ref(0)
const pendingBox         = ref(null)
const claimedBox         = ref(null)
const lastReward         = ref(null)

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
  const data = loadHawk3Data()
  counter.value            = data.currency.dailyRewards.counter
  lastClaimedCounter.value = data.currency.mysteryBoxes.lastClaimedCounter ?? 0
  pendingBox.value         = data.currency.mysteryBoxes.pendingMysteryBox ?? null
  phase.value              = data.currency.dailyRewards.lastClaimed === today ? 'claimed' : 'idle'
})

// ── Handle game-complete from child ──────────────────────
const onGameComplete = ({ coins: c, diamonds: d, label }) => {
  const data = loadHawk3Data()
  data.player.coins    += c
  data.player.diamonds += d
  data.currency.dailyRewards.lastClaimed = today
  data.currency.dailyRewards.counter    += 1

  const newCounter = data.currency.dailyRewards.counter
  const lastCC     = data.currency.mysteryBoxes.lastClaimedCounter ?? 0

  if (canClaimMysteryBox(newCounter, lastCC)) {
    const boxNumber = Math.floor(newCounter / MYSTERY_BOX_CONFIG.requiredDailyRewards)
    data.currency.mysteryBoxes.pendingMysteryBox = calculateMysteryBoxReward(boxNumber)
  }

  saveHawk3Data(data)

  counter.value            = newCounter
  lastClaimedCounter.value = lastCC
  pendingBox.value         = data.currency.mysteryBoxes.pendingMysteryBox ?? null
  lastReward.value         = { coins: c, diamonds: d, label }
  phase.value              = 'claimed'

  emit('currency-updated', {
    coins:             data.player.coins,
    diamonds:          data.player.diamonds,
    mysteryItemCount:  Object.keys(data.player?.inventory?.items ?? {}).length,
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
  <div class="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-3xl leading-none">🎁</span>
        <div>
          <h3 class="text-base font-bold text-fg m-0">{{ t('games.daily_reward.title') }}</h3>
          <p class="text-xs text-muted m-0 mt-0.5">{{ t('games.daily_reward.today_subtitle', { emoji: todayGame.emoji, label: todayGame.label }) }}</p>
        </div>
      </div>
      <span
        v-if="phase === 'claimed'"
        class="text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-green-400/20 text-green-400"
      >{{ t('games.daily_reward.badge_claimed') }}</span>
    </div>

    <!-- Pending Mystery Box -->
    <Transition name="fade">
      <div
        v-if="pendingBox"
        class="bg-[#1a1a2e] border-2 border-yellow-400 rounded-xl p-4 flex flex-col gap-3"
        style="box-shadow: 0 0 20px rgba(255,215,0,0.25);"
      >
        <div class="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase tracking-widest">
          <span>⭐</span>
          <span>{{ t('games.daily_reward.mystery_item_discovered') }}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-xl border-2 border-yellow-400/60 bg-yellow-400/10 flex items-center justify-center text-3xl shrink-0">
            {{ pendingBox.item?.icon }}
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <div class="text-white font-bold text-sm">{{ pendingBox.item?.name }}</div>
            <div class="text-white/50 text-xs leading-relaxed">{{ pendingBox.item?.description }}</div>
            <div class="text-xs font-bold capitalize" :class="rarityColor(pendingBox.item?.rarity)">
              {{ pendingBox.item?.rarity }}
            </div>
          </div>
        </div>
        <button
          class="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-colors text-sm"
          @click="claimMysteryBox"
        >⭐ {{ t('games.daily_reward.collect') }}</button>
      </div>
    </Transition>

    <!-- Claimed box notification -->
    <Transition name="fade">
      <div
        v-if="claimedBox && !pendingBox"
        class="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3"
      >
        <div class="text-3xl">{{ claimedBox.item?.icon }}</div>
        <div>
          <div class="text-white font-semibold text-sm">{{ t('games.daily_reward.mystery_item_received', { name: claimedBox.item?.name }) }}</div>
          <div class="text-white/40 text-xs">{{ t('games.daily_reward.mystery_item_added') }}</div>
        </div>
      </div>
    </Transition>

    <!-- Game area -->
    <div class="bg-white/5 border border-white/10 rounded-xl p-5">
      <template v-if="phase === 'idle'">
        <component :is="todayGame.component" @game-complete="onGameComplete" />
      </template>
      <template v-else-if="phase === 'claimed'">
        <div class="flex flex-col gap-3">
          <div v-if="lastReward" class="flex gap-3 justify-center">
            <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-20">
              <div class="text-xs opacity-50 mb-0.5">{{ t('games.daily_reward.coins') }}</div>
              <div class="text-xl font-bold">+{{ lastReward.coins }}</div>
            </div>
            <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-20">
              <div class="text-xs opacity-50 mb-0.5">{{ t('games.daily_reward.diamonds') }}</div>
              <div class="text-xl font-bold">+{{ lastReward.diamonds }}</div>
            </div>
          </div>
          <div class="py-3 bg-white/5 border border-white/10 text-white/40 font-semibold rounded-xl text-center text-sm">
            {{ t('games.daily_reward.already_claimed') }}
          </div>
        </div>
      </template>
      <template v-else>
        <div class="h-24 flex items-center justify-center text-white/20 text-sm">{{ t('games.daily_reward.loading') }}</div>
      </template>
    </div>

    <!-- Mystery Box Progress -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-white/70 font-semibold text-xs uppercase tracking-widest">{{ t('games.daily_reward.mystery_box_title') }}</span>
        <span class="text-white/40 text-xs">{{ t('games.daily_reward.mystery_box_progress', { current: progress.current, required: progress.required }) }}</span>
      </div>
      <div class="flex gap-2 justify-center">
        <div
          v-for="i in progress.required"
          :key="i"
          class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all"
          :class="i <= progress.current
            ? 'bg-primary border-primary text-white'
            : 'bg-white/5 border-white/15 text-white/20'"
        >{{ i }}</div>
      </div>
      <div class="text-xs text-white/40 text-center">
        <template v-if="progress.isComplete && pendingBox">{{ t('games.daily_reward.mystery_box_waiting') }}</template>
        <template v-else-if="progress.isComplete">{{ t('games.daily_reward.mystery_box_ready') }}</template>
        <template v-else>{{
          t('games.daily_reward.mystery_box_remaining', {
            count: progress.remaining,
            days:  progress.remaining === 1 ? t('games.daily_reward.day') : t('games.daily_reward.days'),
            box:   progress.mysteryBoxNumber + 1,
          })
        }}</template>
      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }
</style>
