<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// Hotel Bilder
const images = [
  new URL('./img/hotel-01.jpg', import.meta.url).href,
  new URL('./img/hotel-02.jpg', import.meta.url).href,
  new URL('./img/hotel-03.jpg', import.meta.url).href,
  new URL('./img/hotel-04.jpg', import.meta.url).href
]

const currentImageIndex = ref(0)
const isTransitioning = ref(false)

let intervalId = null

// Nächstes Bild mit Fade-Effekt
const transitionToNext = () => {
  isTransitioning.value = true

  setTimeout(() => {
    currentImageIndex.value = (currentImageIndex.value + 1) % images.length
    isTransitioning.value = false
  }, 1000)
}

onMounted(() => {
  intervalId = setInterval(transitionToNext, 6000)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

<template>
  <div class="hotel-fade-card">
    <div class="hotel-fade-container">
      <div
        class="hotel-image"
        :class="{ 'fade-out': isTransitioning }"
        :style="{ backgroundImage: `url(${images[currentImageIndex]})` }"
      ></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hotel-fade-card {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
  border-radius: var(--border-radius-xl);
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  background: var(--bg-secondary);
}

.hotel-fade-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.hotel-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 1;
  transition: opacity 1s ease-in-out;

  &.fade-out {
    opacity: 0;
  }
}
</style>