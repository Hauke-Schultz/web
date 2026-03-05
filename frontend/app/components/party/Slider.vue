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
  <div class="slider">
    <div class="slider__track">
      <img
        :src="images[currentIndex]"
        :class="{ 'slider__img--fade': fading }"
        class="slider__img"
        alt="Party Foto"
      />
      <button class="slider__btn slider__btn--prev" aria-label="Zurück" @click="prev">❮</button>
      <button class="slider__btn slider__btn--next" aria-label="Weiter" @click="next">❯</button>
    </div>
    <div class="slider__dots">
      <button
        v-for="(_, i) in images"
        :key="i"
        class="slider__dot"
        :class="{ 'slider__dot--active': i === currentIndex }"
        :aria-label="`Bild ${i + 1}`"
        @click="go(i)"
      />
    </div>
  </div>
</template>

<style scoped>
.slider__track {
  position: relative;
  height: 480px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface-alt);
  display: flex;
  align-items: center;
  justify-content: center;
}

.slider__img {
  width: auto;
  height: 100%;
  max-width: 100%;
  object-fit: contain;
  transition: opacity 0.3s ease;
  cursor: zoom-in;
}

.slider__img--fade { opacity: 0; }

.slider__btn {
  position: absolute;
  top: 50%;
  translate: 0 -50%;
  background: rgba(0 0 0 / 0.35);
  color: var(--color-white);
  border: none;
  padding: var(--space-3) var(--space-md);
  font-size: var(--font-size-xl);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.slider__btn:hover { background: rgba(0 0 0 / 0.55); }
.slider__btn--prev { left: 8px; }
.slider__btn--next { right: 8px; }

.slider__dots {
  display: flex;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-3);
}

.slider__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  background: var(--color-border);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.slider__dot--active {
  width: 32px;
  border-radius: 6px;
  background: var(--color-primary);
}
</style>
