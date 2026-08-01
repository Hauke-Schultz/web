<script setup>
const { t } = useI18n()

const BASE = '/party/fotobox'

const images = ref([]) // [{ src, thumb }]
const zips = ref([])   // [{ name, count, bytes }]
const loading = ref(true)

onMounted(async () => {
  try {
    const [list, parts] = await Promise.all([
      $fetch(`${BASE}/manifest.json`, { responseType: 'json' }).catch(() => []),
      $fetch(`${BASE}/zips.json`, { responseType: 'json' }).catch(() => []),
    ])
    images.value = Array.isArray(list) ? list : []
    zips.value = Array.isArray(parts) ? parts : []
  } finally {
    loading.value = false
  }
})

// Sortierung: 'desc' = neueste zuerst (Standard), 'asc' = älteste zuerst
const sortDir = ref('asc')
const displayImages = computed(() => {
  const arr = [...images.value].sort((a, b) =>
    a.src.localeCompare(b.src, 'de', { numeric: true, sensitivity: 'base' })
  )
  return sortDir.value === 'desc' ? arr.reverse() : arr
})
const toggleSort = () => {
  sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  if (isOpen.value) close()
}

const full = (i) => `${BASE}/${displayImages.value[i].src}`
const thumb = (item) => `${BASE}/${item.thumb}`

const fmtMB = (bytes) => `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`

// Lightbox
const openIndex = ref(-1)
const isOpen = computed(() => openIndex.value >= 0)
const open = (i) => { openIndex.value = i }
const close = () => { openIndex.value = -1 }
const prev = () => { openIndex.value = (openIndex.value - 1 + displayImages.value.length) % displayImages.value.length }
const next = () => { openIndex.value = (openIndex.value + 1) % displayImages.value.length }

const onKey = (e) => {
  if (!isOpen.value) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

// Wischen (Touch)
let touchX = null
const onTouchStart = (e) => { touchX = e.changedTouches[0].clientX }
const onTouchEnd = (e) => {
  if (touchX === null) return
  const dx = e.changedTouches[0].clientX - touchX
  if (Math.abs(dx) > 50) (dx > 0 ? prev : next)()
  touchX = null
}

watch(isOpen, (v) => {
  if (import.meta.client) document.body.style.overflow = v ? 'hidden' : ''
})

// Download eines einzelnen Originals (Blob erzwingt Download auch auf Mobile)
const downloading = ref(false)
const downloadOne = async (i) => {
  const name = displayImages.value[i].src
  try {
    downloading.value = true
    const blob = await $fetch(full(i), { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    window.open(full(i), '_blank')
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="text-white">
    <h2 class="card__title text-white">{{ t('party.gallery.title') }}</h2>

    <!-- Zustände -->
    <p v-if="loading" class="opacity-80">{{ t('party.gallery.loading') }}</p>
    <p v-else-if="!images.length" class="opacity-80">{{ t('party.gallery.empty') }}</p>

    <template v-else>
      <!-- Download-Teile -->
      <div v-if="zips.length" class="mb-5">
        <p class="text-sm opacity-80 mb-2">{{ t('party.gallery.downloadHint', { count: images.length }) }}</p>
        <div class="flex flex-wrap gap-2">
          <a
            v-for="(zip, i) in zips"
            :key="zip.name"
            :href="`/party/${zip.name}`"
            download
            class="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors text-white text-sm font-bold rounded-lg px-4 py-2 no-underline"
          >
            ⬇️ {{ zips.length > 1 ? t('party.gallery.part', { n: i + 1 }) : t('party.gallery.downloadAll') }}
            <span class="font-normal opacity-80">· {{ zip.count }} {{ t('party.gallery.photos') }} · {{ fmtMB(zip.bytes) }}</span>
          </a>
        </div>
      </div>

      <!-- Sortierung -->
      <div class="flex items-center justify-between gap-3 mb-3">
        <span class="text-sm opacity-70">{{ displayImages.length }} {{ t('party.gallery.photos') }}</span>
        <button
          class="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors text-white text-sm font-bold rounded-lg px-3 py-2 border-0 cursor-pointer"
          @click="toggleSort"
        >
          <span class="text-base leading-none">{{ sortDir === 'desc' ? '↓' : '↑' }}</span>
          {{ sortDir === 'desc' ? t('party.gallery.sortNewest') : t('party.gallery.sortOldest') }}
        </button>
      </div>

      <!-- Grid (Thumbnails) -->
      <div
        class="grid gap-2 sm:gap-3"
        style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));"
      >
        <button
          v-for="(item, i) in displayImages"
          :key="item.src"
          class="relative block aspect-square overflow-hidden rounded-lg bg-white/10 cursor-zoom-in group border-0 p-0"
          style="content-visibility: auto; contain-intrinsic-size: 160px;"
          @click="open(i)"
        >
          <img
            :src="thumb(item)"
            loading="lazy"
            decoding="async"
            alt="Party Foto"
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </button>
      </div>
    </template>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[1000] bg-black/90 flex flex-col"
        @click.self="close"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <div class="flex items-center justify-between gap-3 p-4 text-white shrink-0">
          <div class="flex flex-col min-w-0">
            <span class="text-sm opacity-80">{{ openIndex + 1 }} / {{ displayImages.length }}</span>
            <span class="text-xs opacity-60 truncate">{{ displayImages[openIndex].src }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 transition-colors rounded-lg px-3 py-2 text-sm font-bold border-0 text-white cursor-pointer disabled:opacity-50"
              :disabled="downloading"
              @click="downloadOne(openIndex)"
            >⬇️ {{ t('party.gallery.download') }}</button>
            <button
              class="bg-white/15 hover:bg-white/25 transition-colors rounded-lg w-10 h-10 text-xl border-0 text-white cursor-pointer"
              :aria-label="t('party.gallery.close')"
              @click="close"
            >✕</button>
          </div>
        </div>

        <div class="relative flex-1 flex items-center justify-center min-h-0 px-2">
          <button
            class="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white border-0 py-3 px-4 text-xl rounded-lg cursor-pointer"
            :aria-label="t('party.gallery.prev')"
            @click.stop="prev"
          >❮</button>
          <img
            :src="full(openIndex)"
            alt="Party Foto"
            class="max-w-full max-h-full object-contain select-none"
            @click.stop
          />
          <button
            class="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white border-0 py-3 px-4 text-xl rounded-lg cursor-pointer"
            :aria-label="t('party.gallery.next')"
            @click.stop="next"
          >❯</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
