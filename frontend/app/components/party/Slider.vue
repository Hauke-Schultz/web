<script setup>
const images = [
  '/party/img/party-01.png',
  '/party/img/party-02.png',
  '/party/img/party-03.png',
  '/party/img/party-04.png',
  '/party/img/party-05.png',
  '/party/img/party-06.png',
  '/party/img/party-07.png',
]

const currentIndex = ref(0)
const fading = ref(false)

const go = (index) => {
  fading.value = true
  setTimeout(() => {
    currentIndex.value = (index + images.length) % images.length
    fading.value = false
  }, 300)
}

const prev = () => go(currentIndex.value - 1)
const next = () => go(currentIndex.value + 1)
</script>

<template>
  <div>
    <div class="relative h-[480px] rounded-xl overflow-hidden bg-surface-alt flex items-center justify-center">
      <img
        :src="images[currentIndex]"
        :class="{ 'opacity-0': fading }"
        class="w-auto h-full max-w-full object-contain transition-opacity duration-300 cursor-zoom-in"
        alt="Party Foto"
      />
      <button
        class="absolute top-1/2 left-2 -translate-y-1/2 bg-black/35 text-white border-0 py-3 px-4 text-xl rounded-lg cursor-pointer transition-colors hover:bg-black/55"
        aria-label="Zurück"
        @click="prev"
      >❮</button>
      <button
        class="absolute top-1/2 right-2 -translate-y-1/2 bg-black/35 text-white border-0 py-3 px-4 text-xl rounded-lg cursor-pointer transition-colors hover:bg-black/55"
        aria-label="Weiter"
        @click="next"
      >❯</button>
    </div>
    <div class="flex justify-center gap-2 mt-3">
      <button
        v-for="(_, i) in images"
        :key="i"
        class="h-3 rounded-full border-0 bg-border cursor-pointer transition-all"
        :class="i === currentIndex ? 'w-8 rounded-[6px] bg-primary' : 'w-3'"
        :aria-label="`Bild ${i + 1}`"
        @click="go(i)"
      />
    </div>
  </div>
</template>
