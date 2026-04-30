<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { loadHawk3Data, saveHawk3Data, LS_KEYS } from '~/utils/localStores.js'
import { MYSTERY_ITEMS } from '~/utils/mysteryBoxConfig.js'
import { SHOP_ITEMS } from '~/utils/shopConfig.js'
import GamesHeader from '~/components/games/GamesHeader.vue'

const { t } = useI18n()
const localePath = useLocalePath()

useHead({
  title: 'Mein Profil',
  meta: [{ name: 'description', content: 'Dein Profil: Coins, Diamonds und gesammelte Mystery Items.' }],
})
definePageMeta({ hideHeader: true })

// ── Avatar options ────────────────────────────────────────
const AVATAR_OPTIONS = [
  { value: 'avatar/user',    label: t('games.profile.avatars.default_user') },
  { value: 'avatar/beard',   label: t('games.profile.avatars.beard_user') },
  { value: 'avatar/glasses', label: t('games.profile.avatars.glasses_user') },
  { value: 'avatar/headset', label: t('games.profile.avatars.headset_user') },
  { value: 'avatar/cap',     label: t('games.profile.avatars.cap_user') },
]

// ── State ─────────────────────────────────────────────────
const playerName       = ref('Spieler')
const playerAvatar     = ref('avatar/user')
const editingName      = ref('')
const nameInputRef     = ref(null)
const showAvatarPicker = ref(false)
const avatarRef        = ref(null)

const coins          = ref(0)
const diamonds       = ref(0)
const totalClaimed   = ref(0)
const dailyCounter   = ref(0)
const mysteryItems   = ref([])
const shopItems      = ref([])

// ── Rarity helpers ────────────────────────────────────────
const rarityLabel = computed(() => ({
  legendary: t('games.profile.rarity_legendary'),
  epic:      t('games.profile.rarity_epic'),
  rare:      t('games.profile.rarity_rare'),
  uncommon:  t('games.profile.rarity_uncommon'),
  common:    t('games.profile.rarity_common'),
}))

const rarityBg = (rarity) => ({
  legendary: 'bg-violet-500/15 border-violet-500/40',
  epic:      'bg-purple-500/15 border-purple-500/40',
  rare:      'bg-blue-500/15 border-blue-500/40',
  uncommon:  'bg-green-500/15 border-green-500/40',
})[rarity] ?? 'bg-white/10 border-white/10'

const rarityText = (rarity) => ({
  legendary: 'text-violet-400',
  epic:      'text-purple-400',
  rare:      'text-blue-400',
  uncommon:  'text-green-400',
})[rarity] ?? 'text-white/50'

const rarityGlow = (rarity) => ({
  legendary: '139, 92, 246',
  epic:      '168, 85, 247',
  rare:      '59, 130, 246',
  uncommon:  '34, 197, 94',
})[rarity] ?? '255, 255, 255'

// ── View mode ─────────────────────────────────────────────
const listView = ref(false)

// ── Sorting ───────────────────────────────────────────────
const tierOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 }

const sortedMysteryItems = computed(() =>
  [...mysteryItems.value].sort((a, b) => {
    const da = a.purchasedAt ? new Date(a.purchasedAt).getTime() : 0
    const db = b.purchasedAt ? new Date(b.purchasedAt).getTime() : 0
    return db - da
  })
)

const sortedShopItems = computed(() =>
  [...shopItems.value].sort((a, b) => {
    const ta = tierOrder[a.rarity] ?? 5
    const tb = tierOrder[b.rarity] ?? 5
    return ta - tb
  })
)

const totalItemCount = computed(() => mysteryItems.value.length + shopItems.value.length)

// ── Date formatter ────────────────────────────────────────
const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

// ── Name editing ──────────────────────────────────────────
const sanitizeName = (name) => {
  if (!name || typeof name !== 'string') return ''
  return name.trim().replace(/[^a-zA-Z0-9\s\-äöüÄÖÜß]/g, '').replace(/\s+/g, ' ').substring(0, 20).trim()
}

const focusNameInput = async () => {
  await nextTick()
  nameInputRef.value?.focus()
  nameInputRef.value?.select()
}

const finishNameEdit = () => {
  const sanitized = sanitizeName(editingName.value)
  const final = sanitized.length > 0 ? sanitized : playerName.value
  editingName.value = final
  playerName.value  = final
  const data = loadHawk3Data()
  data.player.name  = final
  saveHawk3Data(data)
}

// ── Avatar ────────────────────────────────────────────────
const toggleAvatarPicker = () => { showAvatarPicker.value = !showAvatarPicker.value }

const selectAvatar = (value) => {
  playerAvatar.value     = value
  showAvatarPicker.value = false
  const data = loadHawk3Data()
  data.player.avatar     = value
  saveHawk3Data(data)
}

const handleOutsideClick = (e) => {
  if (avatarRef.value && !avatarRef.value.contains(e.target)) {
    showAvatarPicker.value = false
  }
}

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
      loadData()
    } catch {
      importError.value = t('games.profile.import_error_parse')
    }
    e.target.value = ''
  }
  reader.readAsText(file)
}

// ── Load data ─────────────────────────────────────────────
const MYSTERY_IDS = new Set(MYSTERY_ITEMS.map(m => m.id))

const loadData = () => {
  const data = loadHawk3Data()
  playerName.value   = data.player.name   ?? 'Spieler'
  playerAvatar.value = data.player.avatar ?? 'avatar/user'
  editingName.value  = playerName.value
  coins.value        = data.player.coins    ?? 0
  diamonds.value     = data.player.diamonds ?? 0
  totalClaimed.value = data.currency.mysteryBoxes.totalClaimed ?? 0
  dailyCounter.value = data.currency.dailyRewards.counter ?? 0

  const raw = data.player.inventory?.items ?? {}
  const mystery = []
  const shop    = []

  for (const saved of Object.values(raw)) {
    if (MYSTERY_IDS.has(saved.id)) {
      const cfg = MYSTERY_ITEMS.find(m => m.id === saved.id)
      mystery.push({
        id:               saved.id,
        name:             saved.name             ?? cfg?.name             ?? saved.id,
        icon:             saved.icon             ?? cfg?.icon             ?? '🎁',
        description:      saved.description      ?? cfg?.description      ?? '',
        rarity:           saved.rarity           ?? cfg?.rarity           ?? 'rare',
        mysteryBoxNumber: saved.mysteryBoxNumber ?? cfg?.mysteryBoxNumber ?? 0,
        purchasedAt:      saved.purchasedAt      ?? null,
        glowDelay:        Math.random() * 6,
        glowDuration:     4 + Math.random() * 1.5,
      })
    } else {
      const cfg = SHOP_ITEMS.find(s => s.id === saved.id)
      shop.push({
        id:          saved.id,
        name:        saved.name        ?? cfg?.name        ?? saved.id,
        icon:        saved.icon        ?? cfg?.icon        ?? '🎁',
        description: saved.description ?? cfg?.description ?? '',
        rarity:      saved.rarity      ?? cfg?.rarity      ?? 'common',
        type:        saved.type        ?? cfg?.type        ?? 'cosmetic',
        quantity:    saved.quantity    ?? 1,
        purchasedAt: saved.purchasedAt ?? null,
      })
    }
  }

  mysteryItems.value = mystery
  shopItems.value    = shop
}

onMounted(() => {
  loadData()
  document.addEventListener('click', handleOutsideClick)
})
onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-4 px-4">
    <div class="max-w-[480px] mx-auto flex flex-col gap-6">

      <!-- Top bar -->
      <div class="flex flex-col gap-2">
        <GamesHeader :title="`👤 ${t('games.profile.title')}`" />
      </div>

      <!-- Player card -->
      <div class="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">

        <!-- Avatar + Name -->
        <div class="flex items-center gap-4">

          <!-- Avatar button -->
          <div ref="avatarRef" class="relative shrink-0">
            <button
              class="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/30 hover:border-primary/60 flex items-center justify-center transition-all cursor-pointer overflow-hidden"
              :title="t('games.profile.avatar_title')"
              @click="toggleAvatarPicker"
            >
              <Icon :name="playerAvatar" :size="54" decorative />
            </button>

            <!-- Avatar picker dropdown -->
            <Transition name="picker">
              <div
                v-if="showAvatarPicker"
                class="absolute left-0 top-[72px] z-20 bg-surface border border-border rounded-2xl p-3 flex flex-wrap gap-2 shadow-lg"
                style="width: 220px;"
              >
                <button
                  v-for="opt in AVATAR_OPTIONS"
                  :key="opt.value"
                  class="w-14 h-14 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 overflow-hidden"
                  :class="playerAvatar === opt.value ? 'bg-primary/20 ring-2 ring-primary/60' : ''"
                  :title="opt.label"
                  @click.stop="selectAvatar(opt.value)"
                >
                  <Icon :name="opt.value" :size="44" decorative />
                </button>
              </div>
            </Transition>
          </div>

          <!-- Name input -->
          <div class="flex-1 min-w-0">
            <input
              ref="nameInputRef"
              v-model="editingName"
              type="text"
              maxlength="20"
              :placeholder="t('games.profile.player_name_placeholder')"
              class="w-full bg-transparent text-lg font-bold text-fg border-b border-white/20 focus:border-primary outline-none pb-1 transition-colors placeholder:text-white/20"
              @blur="finishNameEdit"
              @keydown.enter="nameInputRef?.blur()"
              @keydown.esc="editingName = playerName; nameInputRef?.blur()"
              @click="focusNameInput"
            />
            <div class="text-xs text-muted mt-1">
              💰 {{ coins.toLocaleString() }} · 💎 {{ diamonds.toLocaleString() }}
            </div>

          </div>
        </div>

        <!-- Stats row -->
        <div class="flex gap-3">
          <div class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center text-white">
            <div class="text-[10px] uppercase tracking-widest opacity-50 mb-1">{{ t('games.profile.stat_daily') }}</div>
            <div class="text-xl font-bold tabular-nums">{{ dailyCounter }}</div>
          </div>
          <div class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center text-white">
            <div class="text-[10px] uppercase tracking-widest opacity-50 mb-1">{{ t('games.profile.stat_boxes') }}</div>
            <div class="text-xl font-bold tabular-nums">{{ totalClaimed }}</div>
          </div>
          <div class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center text-white">
            <div class="text-[10px] uppercase tracking-widest opacity-50 mb-1">{{ t('games.profile.stat_items') }}</div>
            <div class="text-xl font-bold tabular-nums">{{ totalItemCount }}</div>
          </div>
        </div>
        <div class="flex gap-3">
          <div class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center text-white">
	          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-1">{{ t('games.profile.language') }}</div>
	          <div class="text-xl font-bold tabular-nums"><LanguageSwitcher /></div>
          </div>
          <div class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center text-white">

	          <input ref="fileInputRef" type="file" accept=".json,application/json" class="hidden" @change="onFileChange" />
	          <button
			          class="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 text-white/60 hover:text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
			          @click="triggerImport"
	          >{{ t('games.profile.import_btn') }}</button>
	          <p v-if="importError" class="text-red-400 text-xs text-center">{{ importError }}</p>
	          <p v-if="importOk"    class="text-green-400 text-xs text-center">{{ t('games.profile.import_ok') }}</p>
          </div>
        </div>
      </div>

      <!-- ── Inventory ───────────────────────────────────── -->
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <h2 class="text-white font-bold text-base">{{ t('games.profile.inventory_title') }}</h2>
          <div class="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
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

        <!-- Empty state -->
        <div
          v-if="totalItemCount === 0"
          class="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white/30 text-sm"
        >
          <div class="text-4xl mb-3">🎁</div>
          <div class="font-semibold mb-1">{{ t('games.profile.empty_title') }}</div>
          <div>{{ t('games.profile.empty_text') }}</div>
          <NuxtLink :to="localePath('/games')" class="inline-block mt-4 text-amber-400 hover:text-amber-300 font-semibold transition-colors text-sm">
            {{ t('games.profile.empty_cta') }}
          </NuxtLink>
        </div>

        <template v-else>

          <!-- Mystery Items -->
          <div v-if="sortedMysteryItems.length > 0" class="flex flex-col gap-2">
            <div class="text-white/40 text-xs uppercase tracking-widest font-semibold">{{ t('games.profile.mystery_section') }}</div>
            <!-- Kachelansicht -->
            <div v-if="!listView" class="grid grid-cols-3 gap-3">
              <div
                v-for="item in sortedMysteryItems"
                :key="item.id"
                class="relative flex flex-col items-center gap-2 border-2 rounded-2xl p-3 mystery-glow-inset"
                :class="rarityBg(item.rarity)"
                :style="{
                  '--glow': rarityGlow(item.rarity),
                  animationDelay:    item.glowDelay    + 's',
                  animationDuration: item.glowDuration + 's',
                }"
              >
                <div v-if="item.purchasedAt" class="absolute top-1.5 right-2 text-[10px] text-white/40 tabular-nums">{{ formatDate(item.purchasedAt) }}</div>
                <span class="text-4xl">{{ item.icon }}</span>
                <div class="text-center">
                  <div class="text-white font-semibold text-sm leading-tight">{{ item.name }}</div>
                </div>
              </div>
            </div>
            <!-- Listenansicht -->
            <div v-else class="flex flex-col gap-2">
              <div
                v-for="item in sortedMysteryItems"
                :key="item.id"
                class="relative flex flex-row items-center gap-3 border-2 rounded-2xl px-3 py-3 mystery-glow-inset"
                :class="rarityBg(item.rarity)"
                :style="{
                  '--glow': rarityGlow(item.rarity),
                  animationDelay:    item.glowDelay    + 's',
                  animationDuration: item.glowDuration + 's',
                }"
              >
                <div v-if="item.purchasedAt" class="absolute top-2 right-3 text-[10px] text-white/40 tabular-nums">{{ formatDate(item.purchasedAt) }}</div>
                <span class="text-4xl shrink-0">{{ item.icon }}</span>
                <div class="flex-1 min-w-0 pr-14">
                  <div class="text-white font-semibold text-sm leading-tight">{{ item.name }}</div>
                  <div v-if="item.description" class="text-white/60 text-xs mt-0.5 leading-relaxed">{{ item.description }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Shop Items -->
          <div v-if="sortedShopItems.length > 0" class="flex flex-col gap-2">
            <div class="text-white/40 text-xs uppercase tracking-widest font-semibold">{{ t('games.profile.items_section') }}</div>
            <!-- Kachelansicht -->
            <div v-if="!listView" class="grid grid-cols-3 gap-3">
              <div
                v-for="item in sortedShopItems"
                :key="item.id"
                class="relative flex flex-col items-center gap-2 border-2 rounded-2xl p-3"
                :class="rarityBg(item.rarity)"
              >
                <span
                  v-if="item.quantity > 1"
                  class="absolute top-2 right-2 text-[10px] font-bold bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full"
                >×{{ item.quantity }}</span>
                <span class="text-4xl">{{ item.icon }}</span>
                <div class="text-center">
                  <div class="text-white font-semibold text-sm leading-tight">{{ item.name }}</div>
                </div>
              </div>
            </div>
            <!-- Listenansicht -->
            <div v-else class="flex flex-col gap-2">
              <div
                v-for="item in sortedShopItems"
                :key="item.id"
                class="relative flex flex-row items-center gap-3 border-2 rounded-2xl px-3 py-3"
                :class="rarityBg(item.rarity)"
              >
                <span
                  v-if="item.quantity > 1"
                  class="absolute top-2 right-2 text-[10px] font-bold bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full"
                >×{{ item.quantity }}</span>
                <span class="text-4xl shrink-0">{{ item.icon }}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-white font-semibold text-sm leading-tight">{{ item.name }}</div>
                  <div v-if="item.description" class="text-white/60 text-xs mt-0.5 leading-relaxed">{{ item.description }}</div>
                </div>
              </div>
            </div>
          </div>

        </template>
      </div>

    </div>
  </div>
</template>

<style scoped>
.picker-enter-active, .picker-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.picker-enter-from, .picker-leave-to       { opacity: 0; transform: translateY(-4px) scale(0.97); }

@keyframes mysteryGlowInset {
  0%, 100% { box-shadow: inset 0 0 8px 2px rgba(var(--glow), 0.15); }
  50%       { box-shadow: inset 0 0 18px 5px rgba(var(--glow), 0.45); }
}
.mystery-glow-inset { animation: mysteryGlowInset ease-in-out infinite; }
</style>
