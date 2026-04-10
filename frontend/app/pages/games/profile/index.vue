<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { loadHawk3Data, saveHawk3Data, LS_KEYS } from '~/utils/localStores.js'
import { MYSTERY_ITEMS } from '~/utils/mysteryBoxConfig.js'
import { SHOP_ITEMS } from '~/utils/shopConfig.js'
import GamesHeader from '~/components/games/GamesHeader.vue'

const { t, locale } = useI18n()
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

// ── Sorting ───────────────────────────────────────────────
const tierOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 }

const sortedMysteryItems = computed(() =>
  [...mysteryItems.value].sort((a, b) => {
    const ta = tierOrder[a.rarity] ?? 5
    const tb = tierOrder[b.rarity] ?? 5
    if (ta !== tb) return ta - tb
    return (a.mysteryBoxNumber ?? 0) - (b.mysteryBoxNumber ?? 0)
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
  return d.toLocaleDateString(locale.value === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
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
        <div class="flex justify-end gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
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

      <!-- ── Inventory ───────────────────────────────────── -->
      <div class="flex flex-col gap-4">
        <h2 class="text-white font-bold text-base">{{ t('games.profile.inventory_title') }}</h2>

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
            <div
              v-for="item in sortedMysteryItems"
              :key="item.id"
              class="flex items-center gap-4 border rounded-2xl p-4"
              :class="rarityBg(item.rarity)"
            >
              <!-- Icon -->
              <div
                class="w-14 h-14 rounded-xl border flex items-center justify-center text-4xl shrink-0"
                :class="rarityBg(item.rarity)"
              >{{ item.icon }}</div>

              <!-- Info -->
              <div class="flex flex-col gap-1 min-w-0 flex-1">
                <div class="text-white font-bold text-sm leading-tight">{{ item.name }}</div>
                <div class="text-white/50 text-xs leading-relaxed line-clamp-2">{{ item.description }}</div>
                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span class="text-xs font-bold capitalize" :class="rarityText(item.rarity)">
                    {{ rarityLabel[item.rarity] ?? item.rarity }}
                  </span>
                  <span class="text-white/20 text-xs">· {{ t('games.profile.box_label', { number: item.mysteryBoxNumber }) }}</span>
                </div>
              </div>

              <!-- Date badge -->
              <div v-if="item.purchasedAt" class="shrink-0 text-right">
                <div class="text-xs text-white/40 tabular-nums whitespace-nowrap">{{ t('games.profile.received_on', { date: formatDate(item.purchasedAt) }) }}</div>
              </div>
            </div>
          </div>

          <!-- Shop Items -->
          <div v-if="sortedShopItems.length > 0" class="flex flex-col gap-2">
            <div class="text-white/40 text-xs uppercase tracking-widest font-semibold">{{ t('games.profile.items_section') }}</div>
            <div
              v-for="item in sortedShopItems"
              :key="item.id"
              class="flex items-center gap-4 border rounded-2xl p-4"
              :class="rarityBg(item.rarity)"
            >
              <!-- Emoji icon -->
              <div
                class="w-14 h-14 rounded-xl border flex items-center justify-center text-4xl shrink-0"
                :class="rarityBg(item.rarity)"
              >{{ item.icon }}</div>

              <!-- Info -->
              <div class="flex flex-col gap-1 min-w-0 flex-1">
                <div class="text-white font-bold text-sm leading-tight">
                  {{ item.name }}
                  <span v-if="item.quantity > 1" class="text-white/40 font-normal text-xs ml-1">×{{ item.quantity }}</span>
                </div>
                <div class="text-white/50 text-xs leading-relaxed line-clamp-2">{{ item.description }}</div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs font-bold capitalize" :class="rarityText(item.rarity)">
                    {{ rarityLabel[item.rarity] ?? item.rarity }}
                  </span>
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
</style>
