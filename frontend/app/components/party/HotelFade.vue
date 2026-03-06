<script setup>
const images = [
  '/party/img/hotel-01.jpg',
  '/party/img/hotel-02.jpg',
  '/party/img/hotel-03.jpg',
  '/party/img/hotel-04.jpg',
]

const currentImageIndex = ref(0)
const isTransitioning = ref(false)
let intervalId = null

const transitionToNext = () => {
  isTransitioning.value = true
  setTimeout(() => {
    currentImageIndex.value = (currentImageIndex.value + 1) % images.length
    isTransitioning.value = false
  }, 1000)
}

onMounted(() => { intervalId = setInterval(transitionToNext, 6000) })
onUnmounted(() => { if (intervalId) clearInterval(intervalId) })
</script>

<template>
  <div class="relative w-full min-h-[360px] rounded-xl overflow-hidden bg-surface-alt">
    <div
      class="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
      :class="{ 'opacity-0': isTransitioning }"
      :style="{ backgroundImage: `url(${images[currentImageIndex]})` }"
    />
  </div>
</template>
