<script setup>
import { ref, computed, onMounted } from 'vue'
const route = useRoute()
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'
import { SHOP_ITEMS, SHOP_CATEGORIES, RARITY } from '~/utils/shopConfig.js'
import GamesHeader from '~/components/games/GamesHeader.vue'

const { t } = useI18n()
definePageMeta({ hideHeader: true })
useHead({ title: 'Shop' })

// ── State ─────────────────────────────────────────────────
const headerRef = ref(null)
const listView  = ref(false)
const coins     = ref(0)
const diamonds  = ref(0)
const inventory = ref({})   // player.inventory.items — object keyed by item id
const activeTab = ref('profile')
const modal     = ref(null) // null | { item, phase: 'confirm'|'broke'|'success' }

// ── Load ──────────────────────────────────────────────────
onMounted(() => {
  const data      = loadHawk3Data()
  coins.value     = data.player.coins               ?? 0
  diamonds.value  = data.player.diamonds            ?? 0
  inventory.value = data.player.inventory?.items    ?? {}
  if (route.query.tab) activeTab.value = route.query.tab
})

// ── Filtered items ────────────────────────────────────────
const visibleItems = computed(() =>
  SHOP_ITEMS.filter(i => i.category === activeTab.value)
)

// ── Helpers ───────────────────────────────────────────────
function getQuantity(id) {
  return inventory.value[id]?.quantity ?? 0
}

function isCapped(item) {
  if (item.purchaseLimit === null) return false
  return getQuantity(item.id) >= item.purchaseLimit
}

function canAfford(item) {
  return coins.value >= item.price.coins && diamonds.value >= item.price.diamonds
}

const rarityText   = r => RARITY[r]?.text   ?? 'text-white/50'
const rarityBorder = r => RARITY[r]?.border ?? 'border-white/20'
const rarityLabel  = r => RARITY[r]?.label  ?? r

// ── Modal ─────────────────────────────────────────────────
function openItem(item) {
  if (isCapped(item)) return
  modal.value = { item, phase: canAfford(item) ? 'confirm' : 'broke' }
}

function confirmBuy() {
  const item = modal.value?.item
  if (!item || !canAfford(item)) return

  const data = loadHawk3Data()
  data.player.coins    -= item.price.coins
  data.player.diamonds -= item.price.diamonds

  data.player.inventory       = data.player.inventory       ?? {}
  data.player.inventory.items = data.player.inventory.items ?? {}

  const existing = data.player.inventory.items[item.id]
  if (existing) {
    existing.quantity    += 1
    existing.purchasedAt  = new Date().toISOString()
  } else {
    data.player.inventory.items[item.id] = {
      id:          item.id,
      quantity:    1,
      purchasedAt: new Date().toISOString(),
      type:        item.type ?? 'cosmetic',
      category:    item.category,
      rarity:      item.rarity,
      name:        item.name,
    }
  }
  saveHawk3Data(data)

  coins.value     = data.player.coins
  diamonds.value  = data.player.diamonds
  inventory.value = { ...data.player.inventory.items }
  modal.value     = { item, phase: 'success' }
  headerRef.value?.refresh()
}

function closeModal() {
  modal.value = null
}
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-4 px-4">
    <div class="max-w-[480px] mx-auto flex flex-col gap-5">

      <!-- Header -->
      <GamesHeader ref="headerRef" :title="`🛒 ${t('games.shop.title')}`" />

      <!-- Balance + View toggle -->
      <div class="flex justify-between items-center">
        <div class="flex gap-2">
          <div class="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white flex items-center">
            <span class="text-sm font-bold tabular-nums">💰 {{ coins.toLocaleString() }}</span>
          </div>
          <div class="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white flex items-center">
            <span class="text-sm font-bold tabular-nums">💎 {{ diamonds.toLocaleString() }}</span>
          </div>
        </div>
        <div class="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 shrink-0">
          <button
            class="p-1.5 rounded-md transition-colors"
            :class="!listView ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/60'"
            @click="listView = false"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="0" width="6" height="6" rx="1"/><rect x="8" y="0" width="6" height="6" rx="1"/><rect x="0" y="8" width="6" height="6" rx="1"/><rect x="8" y="8" width="6" height="6" rx="1"/></svg>
          </button>
          <button
            class="p-1.5 rounded-md transition-colors"
            :class="listView ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/60'"
            @click="listView = true"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="1" width="14" height="2.5" rx="1"/><rect x="0" y="5.75" width="14" height="2.5" rx="1"/><rect x="0" y="10.5" width="14" height="2.5" rx="1"/></svg>
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 bg-white/5 p-1 rounded-xl">
        <button
          v-for="cat in SHOP_CATEGORIES"
          :key="cat.id"
          class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all"
          :class="activeTab === cat.id
            ? 'bg-primary text-white shadow'
            : 'text-white/50 hover:text-white/80'"
          @click="activeTab = cat.id"
        >
          <span>{{ cat.emoji }}</span>
          <span>{{ cat.label }}</span>
        </button>
      </div>

      <!-- Kachelansicht -->
      <div v-if="!listView" class="grid grid-cols-3 gap-3">
        <button
          v-for="item in visibleItems"
          :key="item.id"
          class="relative flex flex-col items-center gap-2 bg-surface border-2 rounded-2xl p-3 transition-all text-left"
          :class="[
            rarityBorder(item.rarity),
            isCapped(item)
              ? 'opacity-60 cursor-default'
              : canAfford(item)
                ? 'hover:bg-white/5 cursor-pointer'
                : 'cursor-pointer opacity-80',
          ]"
          @click="openItem(item)"
        >
          <span
            v-if="isCapped(item)"
            class="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-widest bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full"
          >✓</span>
          <span
            v-else-if="getQuantity(item.id) > 0"
            class="absolute top-2 right-2 text-[10px] font-bold bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full"
          >×{{ getQuantity(item.id) }}</span>
          <span class="text-3xl leading-none">{{ item.icon }}</span>
          <div class="text-center w-full">
            <div class="text-white font-semibold text-sm leading-tight">{{ item.name }}</div>
          </div>
          <div v-if="!isCapped(item)" class="flex flex-row items-center justify-center gap-2 w-full mt-auto">
            <span
              v-if="item.price.coins > 0"
              class="text-xs font-semibold"
              :class="coins >= item.price.coins ? 'text-yellow-400' : 'text-red-400'"
            >💰 {{ item.price.coins.toLocaleString() }}</span>
            <span
              v-if="item.price.diamonds > 0"
              class="text-xs font-semibold"
              :class="diamonds >= item.price.diamonds ? 'text-cyan-400' : 'text-red-400'"
            >💎 {{ item.price.diamonds }}</span>
          </div>
          <div v-else class="text-xs text-green-400 font-semibold mt-auto">
            {{ t('games.shop.owned') }}
          </div>
        </button>
      </div>

      <!-- Listenansicht -->
      <div v-else class="flex flex-col gap-2">
        <button
          v-for="item in visibleItems"
          :key="item.id"
          class="relative flex flex-row items-center gap-3 bg-surface border-2 rounded-2xl px-3 py-3 transition-all text-left"
          :class="[
            rarityBorder(item.rarity),
            isCapped(item)
              ? 'opacity-60 cursor-default'
              : canAfford(item)
                ? 'hover:bg-white/5 cursor-pointer'
                : 'cursor-pointer opacity-80',
          ]"
          @click="openItem(item)"
        >
          <span
            v-if="isCapped(item)"
            class="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-widest bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full"
          >✓</span>
          <span
            v-else-if="getQuantity(item.id) > 0"
            class="absolute top-2 right-2 text-[10px] font-bold bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full"
          >×{{ getQuantity(item.id) }}</span>
          <span class="text-2xl leading-none shrink-0">{{ item.icon }}</span>
          <div class="flex-1 min-w-0 pr-8">
            <div class="text-white font-semibold text-sm leading-tight">{{ item.name }}</div>
            <div v-if="item.description" class="text-white/50 text-xs mt-0.5 leading-relaxed">{{ item.description }}</div>
            <div v-if="!isCapped(item)" class="flex gap-2 mt-1">
              <span
                v-if="item.price.coins > 0"
                class="text-xs font-semibold"
                :class="coins >= item.price.coins ? 'text-yellow-400' : 'text-red-400'"
              >💰 {{ item.price.coins.toLocaleString() }}</span>
              <span
                v-if="item.price.diamonds > 0"
                class="text-xs font-semibold"
                :class="diamonds >= item.price.diamonds ? 'text-cyan-400' : 'text-red-400'"
              >💎 {{ item.price.diamonds }}</span>
            </div>
            <div v-else class="text-xs text-green-400 font-semibold mt-1">{{ t('games.shop.owned') }}</div>
          </div>
        </button>
      </div>

    </div>
  </div>

  <!-- Modal -->
  <Transition name="fade">
    <div
      v-if="modal"
      class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      @click.self="closeModal"
    >
      <div class="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5">

        <!-- Confirm -->
        <template v-if="modal.phase === 'confirm'">
          <div class="flex flex-col items-center gap-3 text-center">
            <span class="text-5xl">{{ modal.item.icon }}</span>
            <div>
              <div class="text-white font-bold text-lg">{{ modal.item.name }}</div>
              <div class="text-[11px] font-bold uppercase tracking-widest mt-0.5" :class="rarityText(modal.item.rarity)">
                {{ rarityLabel(modal.item.rarity) }}
              </div>
            </div>
            <p class="text-white/50 text-sm leading-relaxed">{{ modal.item.description }}</p>
            <div class="flex gap-2">
              <span v-if="modal.item.price.coins > 0" class="bg-white/10 rounded-lg px-3 py-1.5 text-yellow-400 font-bold text-sm">
                💰 {{ modal.item.price.coins.toLocaleString() }}
              </span>
              <span v-if="modal.item.price.diamonds > 0" class="bg-white/10 rounded-lg px-3 py-1.5 text-cyan-400 font-bold text-sm">
                💎 {{ modal.item.price.diamonds }}
              </span>
            </div>
            <p v-if="modal.item.purchaseLimit && modal.item.purchaseLimit > 1" class="text-white/30 text-xs">
              {{ t('games.shop.limit', { n: modal.item.purchaseLimit }) }}
            </p>
          </div>
          <div class="flex gap-3">
            <button
              class="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white/60 font-bold rounded-xl transition-colors"
              @click="closeModal"
            >{{ t('games.shop.cancel') }}</button>
            <button
              class="flex-1 py-3 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
              @click="confirmBuy"
            >{{ t('games.shop.buy') }}</button>
          </div>
        </template>

        <!-- Not enough funds -->
        <template v-else-if="modal.phase === 'broke'">
          <div class="flex flex-col items-center gap-3 text-center">
            <span class="text-5xl">{{ modal.item.icon }}</span>
            <div class="text-white font-bold text-lg">{{ modal.item.name }}</div>
            <p class="text-white/50 text-sm">{{ t('games.shop.not_enough') }}</p>
            <div class="flex gap-2 flex-wrap justify-center">
              <span v-if="modal.item.price.coins > 0" class="bg-white/10 rounded-lg px-3 py-1.5 text-sm flex gap-1.5 items-center">
                <span class="text-red-400 font-bold">💰 {{ coins.toLocaleString() }}</span>
                <span class="text-white/30">/</span>
                <span class="text-white/50">{{ modal.item.price.coins.toLocaleString() }}</span>
              </span>
              <span v-if="modal.item.price.diamonds > 0" class="bg-white/10 rounded-lg px-3 py-1.5 text-sm flex gap-1.5 items-center">
                <span class="text-red-400 font-bold">💎 {{ diamonds }}</span>
                <span class="text-white/30">/</span>
                <span class="text-white/50">{{ modal.item.price.diamonds }}</span>
              </span>
            </div>
          </div>
          <button
            class="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors"
            @click="closeModal"
          >{{ t('games.shop.close') }}</button>
        </template>

        <!-- Success -->
        <template v-else-if="modal.phase === 'success'">
          <div class="flex flex-col items-center gap-3 text-center">
            <span class="text-5xl">{{ modal.item.icon }}</span>
            <div class="text-white font-bold text-lg">{{ t('games.shop.success_title') }}</div>
            <p class="text-white/50 text-sm">{{ t('games.shop.success_text', { name: modal.item.name }) }}</p>
          </div>
          <button
            class="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors"
            @click="closeModal"
          >{{ t('games.shop.close') }}</button>
        </template>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }
</style>
