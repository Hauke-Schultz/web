<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadHawk3Data, saveHawk3Data, LS_KEYS } from '~/utils/localStores.js'
import { MYSTERY_ITEMS } from '~/utils/mysteryBoxConfig.js'

const { t } = useI18n()

definePageMeta({ layout: 'default' })

useHead({
  title: 'Mein Profil',
  meta: [{ name: 'description', content: 'Dein Profil: Coins, Diamonds und gesammelte Mystery Items.' }],
})

const coins          = ref(0)
const diamonds       = ref(0)
const totalClaimed   = ref(0)
const dailyCounter   = ref(0)
const inventoryItems = ref([])

const rarityLabel = computed(() => ({
  legendary: t('games.profile.rarity_legendary'),
  epic:      t('games.profile.rarity_epic'),
  rare:      t('games.profile.rarity_rare'),
  common:    t('games.profile.rarity_common'),
}))

const rarityBg = (rarity) => ({
  legendary: 'bg-violet-500/15 border-violet-500/40',
  epic:      'bg-purple-500/15 border-purple-500/40',
  rare:      'bg-blue-500/15  border-blue-500/40',
})[rarity] ?? 'bg-white/10 border-white/10'

const rarityText = (rarity) => ({
  legendary: 'text-violet-400',
  epic:      'text-purple-400',
  rare:      'text-blue-400',
})[rarity] ?? 'text-white/50'

// sort: legendary > epic > rare, then by mysteryBoxNumber
const sortedItems = computed(() =>
  [...inventoryItems.value].sort((a, b) => {
    const tierOrder = { legendary: 0, epic: 1, rare: 2 }
    const ta = tierOrder[a.rarity] ?? 3
    const tb = tierOrder[b.rarity] ?? 3
    if (ta !== tb) return ta - tb
    return (a.mysteryBoxNumber ?? 0) - (b.mysteryBoxNumber ?? 0)
  })
)

// ── JSON Import ───────────────────────────────────────────
const importError  = ref('')
const importOk     = ref(false)
const fileInputRef = ref(null)

const triggerImport = () => {
  importError.value = ''
  importOk.value    = false
  fileInputRef.value?.click()
}

const onFileChange = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result)
      if (typeof parsed !== 'object' || !parsed.player) {
        importError.value = t('games.profile.import_error_format')
        return
      }
      localStorage.setItem(LS_KEYS.HAWK3_DATA, JSON.stringify(parsed))
      importOk.value = true
      // Reload data into reactive refs
      loadData()
    } catch {
      importError.value = t('games.profile.import_error_parse')
    }
    // Reset so same file can be re-imported
    e.target.value = ''
  }
  reader.readAsText(file)
}

const loadData = () => {
  const data = loadHawk3Data()
  coins.value        = data.player.coins ?? 0
  diamonds.value     = data.player.diamonds ?? 0
  totalClaimed.value = data.currency.mysteryBoxes.totalClaimed ?? 0
  dailyCounter.value = data.currency.dailyRewards.counter ?? 0

  const raw = data.player.inventory?.items ?? {}
  inventoryItems.value = Object.values(raw).map(saved => {
    const config = MYSTERY_ITEMS.find(m => m.id === saved.id)
    return {
      id:               saved.id,
      name:             saved.name             ?? config?.name,
      icon:             saved.icon             ?? config?.icon             ?? '🎁',
      description:      saved.description      ?? config?.description      ?? '',
      rarity:           saved.rarity           ?? config?.rarity           ?? 'rare',
      tier:             saved.tier             ?? config?.tier             ?? 1,
      mysteryBoxNumber: saved.mysteryBoxNumber ?? config?.mysteryBoxNumber ?? 0,
      purchasedAt:      saved.purchasedAt,
    }
  })
}

onMounted(loadData)
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-8 px-4">
    <div class="max-w-[480px] mx-auto flex flex-col gap-6">

      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white mb-1">{{ t('games.profile.title') }}</h1>
          <p class="text-white/40 text-sm">{{ t('games.profile.subtitle') }}</p>
        </div>
        <NuxtLink to="/games" class="text-white/30 hover:text-white/70 text-sm transition-colors mt-1">
          {{ t('games.profile.back') }}
        </NuxtLink>
      </div>

      <!-- JSON Import -->
      <div class="flex flex-col gap-2">
        <input ref="fileInputRef" type="file" accept=".json,application/json" class="hidden" @change="onFileChange" />
        <button
          class="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 text-white/60 hover:text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          @click="triggerImport"
        >{{ t('games.profile.import_btn') }}</button>
        <p v-if="importError" class="text-red-400 text-xs text-center">{{ importError }}</p>
        <p v-if="importOk"    class="text-green-400 text-xs text-center">{{ t('games.profile.import_ok') }}</p>
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

      <!-- Stats row -->
      <div class="flex gap-3">
        <div class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-white">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-1">{{ t('games.profile.stat_daily') }}</div>
          <div class="text-2xl font-bold tabular-nums">{{ dailyCounter }}</div>
        </div>
        <div class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-white">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-1">{{ t('games.profile.stat_boxes') }}</div>
          <div class="text-2xl font-bold tabular-nums">{{ totalClaimed }}</div>
        </div>
        <div class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-white">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-1">{{ t('games.profile.stat_items') }}</div>
          <div class="text-2xl font-bold tabular-nums">{{ inventoryItems.length }}</div>
        </div>
      </div>

      <!-- Mystery Items -->
      <div class="flex flex-col gap-3">
        <h2 class="text-white font-bold text-base">{{ t('games.profile.mystery_items_title') }}</h2>

        <!-- Empty state -->
        <div
          v-if="inventoryItems.length === 0"
          class="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white/30 text-sm"
        >
          <div class="text-4xl mb-3">🎁</div>
          <div class="font-semibold mb-1">{{ t('games.profile.empty_title') }}</div>
          <div>{{ t('games.profile.empty_text') }}</div>
          <NuxtLink to="/games/dailyReward" class="inline-block mt-4 text-amber-400 hover:text-amber-300 font-semibold transition-colors text-sm">
            {{ t('games.profile.empty_cta') }}
          </NuxtLink>
        </div>

        <!-- Item grid -->
        <div v-else class="flex flex-col gap-2">
          <div
            v-for="item in sortedItems"
            :key="item.id"
            class="flex items-center gap-4 border rounded-2xl p-4 transition-all"
            :class="rarityBg(item.rarity)"
          >
            <div
              class="w-16 h-16 rounded-xl border flex items-center justify-center text-4xl flex-shrink-0"
              :class="rarityBg(item.rarity)"
            >{{ item.icon }}</div>
            <div class="flex flex-col gap-1 min-w-0">
              <div class="text-white font-bold text-sm leading-tight">{{ item.name }}</div>
              <div class="text-white/50 text-xs leading-relaxed line-clamp-2">{{ item.description }}</div>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs font-bold capitalize" :class="rarityText(item.rarity)">
                  {{ rarityLabel[item.rarity] ?? item.rarity }}
                </span>
                <span class="text-white/20 text-xs">· {{ t('games.profile.box_label', { number: item.mysteryBoxNumber }) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
