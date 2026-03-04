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
  <div class="hotel-fade">
    <div
      class="hotel-fade__image"
      :class="{ 'hotel-fade__image--out': isTransitioning }"
      :style="{ backgroundImage: `url(${images[currentImageIndex]})` }"
    />
  </div>
</template>

<style scoped>
.hotel-fade {
  position: relative;
  width: 100%;
  min-height: 360px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface-alt);
}

.hotel-fade__image {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 1;
  transition: opacity 1s ease-in-out;
}

.hotel-fade__image--out {
  opacity: 0;
}
</style>
