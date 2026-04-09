<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'
import { calculateMysteryBoxReward, getMysteryBoxProgress, canClaimMysteryBox, MYSTERY_BOX_CONFIG } from '~/utils/mysteryBoxConfig.js'
import SlotMachineGame from '../../../components/dailyReward/SlotMachineGame.vue'
import FortuneWheelGame from '../../../components/dailyReward/FortuneWheelGame.vue'

const { t } = useI18n()

definePageMeta({ layout: 'default' })

useHead({
  title: 'Daily Reward',
  meta: [{ name: 'description', content: 'Täglich ein anderes Minispiel — sammle Coins, Diamonds und Mystery Boxes!' }],
})

// ── Daily game rotation ───────────────────────────────────
// dayIndex changes every calendar day. Add new games here when ready.
const DAILY_GAMES = [
  { key: 'slot',  label: 'Slot Machine',  emoji: '🎰', component: SlotMachineGame  },
  { key: 'wheel', label: 'Fortune Wheel', emoji: '🎡', component: FortuneWheelGame },
]

const dayIndex  = Math.floor(Date.now() / 86400000)  // days since epoch
const todayGame = DAILY_GAMES[dayIndex % DAILY_GAMES.length]
const today     = new Date().toISOString().split('T')[0]

// ── State ─────────────────────────────────────────────────
const phase      = ref('loading')  // 'idle' | 'claimed' | 'loading'
const coins      = ref(0)
const diamonds   = ref(0)
const counter    = ref(0)
const lastClaimedCounter = ref(0)
const pendingBox = ref(null)
const claimedBox = ref(null)
const lastReward = ref(null)

// ── Mystery box progress ──────────────────────────────────
const progress = computed(() =>
  getMysteryBoxProgress(counter.value, lastClaimedCounter.value)
)

const rarityColor = (rarity) => ({
  legendary: 'text-violet-400',
  epic:      'text-purple-400',
  rare:      'text-blue-400',
})[rarity] ?? 'text-white/60'

// ── Load on mount ─────────────────────────────────────────
onMounted(() => {
  const data = loadHawk3Data()
  coins.value              = data.player.coins
  diamonds.value           = data.player.diamonds
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

  const newCounter         = data.currency.dailyRewards.counter
  const lastCC             = data.currency.mysteryBoxes.lastClaimedCounter ?? 0

  if (canClaimMysteryBox(newCounter, lastCC)) {
    const boxNumber = Math.floor(newCounter / MYSTERY_BOX_CONFIG.requiredDailyRewards)
    data.currency.mysteryBoxes.pendingMysteryBox = calculateMysteryBoxReward(boxNumber)
  }

  saveHawk3Data(data)

  coins.value              = data.player.coins
  diamonds.value           = data.player.diamonds
  counter.value            = newCounter
  lastClaimedCounter.value = lastCC
  pendingBox.value         = data.currency.mysteryBoxes.pendingMysteryBox ?? null
  lastReward.value         = { coins: c, diamonds: d, label }
  phase.value              = 'claimed'
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
}
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-8 px-4">
    <div class="max-w-[400px] mx-auto flex flex-col gap-6">

      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white mb-1">{{ t('games.daily_reward.title') }}</h1>
          <p class="text-white/40 text-sm">
            {{ t('games.daily_reward.today_subtitle', { emoji: todayGame.emoji, label: todayGame.label }) }}
          </p>
        </div>
        <NuxtLink to="/games" class="text-white/30 hover:text-white/70 text-sm transition-colors mt-1">
          {{ t('games.daily_reward.back') }}
        </NuxtLink>
      </div>

      <!-- Balance -->
      <div class="flex gap-3">
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.daily_reward.coins') }}</div>
          <div class="text-xl font-bold tabular-nums">💰 {{ coins.toLocaleString() }}</div>
        </div>
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.daily_reward.diamonds') }}</div>
          <div class="text-xl font-bold tabular-nums">💎 {{ diamonds.toLocaleString() }}</div>
        </div>
      </div>

      <!-- ── Pending Mystery Box ── -->
      <Transition name="fade">
        <div
          v-if="pendingBox"
          class="bg-[#1a1a2e] border-2 border-yellow-400 rounded-2xl p-5 flex flex-col gap-4"
          style="box-shadow: 0 0 24px rgba(255,215,0,0.3);"
        >
          <div class="flex items-center gap-2 text-yellow-400 text-sm font-bold">
            <span>⭐</span>
            <span>{{ t('games.daily_reward.mystery_item_discovered') }}</span>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-20 h-20 rounded-xl border-2 border-yellow-400/60 bg-yellow-400/10 flex items-center justify-center text-5xl flex-shrink-0">
              {{ pendingBox.item?.icon }}
            </div>
            <div class="flex flex-col gap-1 min-w-0">
              <div class="text-white font-bold">{{ pendingBox.item?.name }}</div>
              <div class="text-white/50 text-xs leading-relaxed">{{ pendingBox.item?.description }}</div>
              <div class="text-xs font-bold mt-1 capitalize" :class="rarityColor(pendingBox.item?.rarity)">
                {{ pendingBox.item?.rarity }}
              </div>
            </div>
          </div>
          <button
            class="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-colors"
            @click="claimMysteryBox"
          >⭐ {{ t('games.daily_reward.collect') }}</button>
        </div>
      </Transition>

      <!-- ── Claimed box notification ── -->
      <Transition name="fade">
        <div
          v-if="claimedBox && !pendingBox"
          class="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4"
        >
          <div class="text-4xl">{{ claimedBox.item?.icon }}</div>
          <div>
            <div class="text-white font-semibold">{{ t('games.daily_reward.mystery_item_received', { name: claimedBox.item?.name }) }}</div>
            <div class="text-white/40 text-xs">{{ t('games.daily_reward.mystery_item_added') }}</div>
          </div>
        </div>
      </Transition>

      <!-- ── Game area ── -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-6">

        <!-- Today's game (only if not yet claimed) -->
        <template v-if="phase === 'idle'">
          <component
            :is="todayGame.component"
            @game-complete="onGameComplete"
          />
        </template>

        <!-- Already claimed: show reward summary + come-back info -->
        <template v-else-if="phase === 'claimed'">
          <div class="flex flex-col gap-4">
            <div v-if="lastReward" class="flex gap-3 justify-center">
              <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[80px]">
                <div class="text-xs opacity-50 mb-0.5">{{ t('games.daily_reward.coins') }}</div>
                <div class="text-xl font-bold">+{{ lastReward.coins }}</div>
              </div>
              <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[80px]">
                <div class="text-xs opacity-50 mb-0.5">{{ t('games.daily_reward.diamonds') }}</div>
                <div class="text-xl font-bold">+{{ lastReward.diamonds }}</div>
              </div>
            </div>
            <div class="py-4 bg-white/5 border border-white/10 text-white/40 font-semibold rounded-xl text-center text-sm">
              {{ t('games.daily_reward.already_claimed') }}
            </div>
          </div>
        </template>

        <!-- Loading skeleton -->
        <template v-else>
          <div class="h-32 flex items-center justify-center text-white/20 text-sm">{{ t('games.daily_reward.loading') }}</div>
        </template>

      </div>

      <!-- ── Mystery Box Progress ── -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-white font-semibold">{{ t('games.daily_reward.mystery_box_title') }}</span>
          <span class="text-white/50">{{ t('games.daily_reward.mystery_box_progress', { current: progress.current, required: progress.required }) }}</span>
        </div>

        <!-- Progress dots -->
        <div class="flex gap-2 justify-center">
          <div
            v-for="i in progress.required"
            :key="i"
            class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all"
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
              box:   progress.mysteryBoxNumber + 1
            })
          }}</template>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }
</style>
