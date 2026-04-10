<script setup>
import { ref, computed, onMounted } from 'vue'
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'
import { SHOP_ITEMS, SHOP_CATEGORIES, RARITY } from '~/utils/shopConfig.js'
import GamesHeader from '~/components/games/GamesHeader.vue'

const { t } = useI18n()
definePageMeta({ hideHeader: true })
useHead({ title: 'Shop' })

// ── State ─────────────────────────────────────────────────
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
}

function closeModal() {
  modal.value = null
}
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-4 px-4">
    <div class="max-w-[480px] mx-auto flex flex-col gap-5">

      <!-- Header -->
      <GamesHeader :title="`🛒 ${t('games.shop.title')}`" />

      <!-- Balance -->
      <div class="flex gap-3">
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.shop.coins') }}</div>
          <div class="text-xl font-bold tabular-nums">💰 {{ coins.toLocaleString() }}</div>
        </div>
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.shop.diamonds') }}</div>
          <div class="text-xl font-bold tabular-nums">💎 {{ diamonds.toLocaleString() }}</div>
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

      <!-- Item grid -->
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="item in visibleItems"
          :key="item.id"
          class="relative flex flex-col items-center gap-2 bg-surface border-2 rounded-2xl p-4 transition-all text-left"
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
          <!-- Owned / capped badge -->
          <span
            v-if="isCapped(item)"
            class="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-widest bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full"
          >✓</span>

          <!-- Quantity badge for stackable items -->
          <span
            v-else-if="getQuantity(item.id) > 0"
            class="absolute top-2 right-2 text-[10px] font-bold bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full"
          >×{{ getQuantity(item.id) }}</span>

          <!-- Icon -->
          <span class="text-4xl leading-none">{{ item.icon }}</span>

          <!-- Name + rarity -->
          <div class="text-center w-full">
            <div class="text-white font-semibold text-sm leading-tight">{{ item.name }}</div>
            <div class="text-[10px] font-bold uppercase tracking-widest mt-0.5" :class="rarityText(item.rarity)">
              {{ rarityLabel(item.rarity) }}
            </div>
          </div>

          <!-- Price -->
          <div v-if="!isCapped(item)" class="flex flex-col items-center gap-0.5 w-full mt-auto">
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
