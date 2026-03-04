<script setup>
const createConfetti = () => {
  const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#00d2d3']
  const emojis = ['🍬', '🍭', '🍫', '🍦', '🍰', '🍺', '🍻', '🍷', '🥂', '🎂', '🎁', '✨', '🎈', '🎊']
  const container = document.querySelector('.party-page')
  const scrollTop = window.scrollY

  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div')
    el.className = 'confetti-piece'
    el.style.left = (Math.random() * 70 + 10) + '%'
    el.style.top = `${scrollTop - 50}px`

    if (Math.random() > 0.5) {
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)]
      el.style.fontSize = (Math.random() * 20 + 20) + 'px'
    } else {
      el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
      const size = (Math.random() * 12 + 6) + 'px'
      el.style.width = size
      el.style.height = size
      el.style.borderRadius = '50%'
    }

    const dur = Math.random() * 2 + 3
    const y = container.clientHeight - scrollTop - 100
    el.style.setProperty('--x', (Math.random() * 20 - 10) + 'px')
    el.style.setProperty('--y', y + 'px')
    el.style.setProperty('--r', (Math.random() * 720) + 'deg')
    el.style.animation = `confettiFall ${dur}s ease-in forwards`
    container.appendChild(el)
    setTimeout(() => el.remove(), dur * 1000)
  }
}
</script>

<template>
  <button class="confetti-btn" aria-label="Konfetti!" @click="createConfetti">🎉</button>
</template>

<style>
@keyframes confettiFall {
  from { opacity: 1; transform: translate(0, 0) rotate(0deg); }
  to   { opacity: 1; transform: translate(var(--x), var(--y)) rotate(var(--r)); }
}

.confetti-piece {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}
</style>

<style scoped>
.confetti-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 999;
  width: 64px;
  height: 64px;
  font-size: 2rem;
  border: 3px solid rgba(255 255 255 / 0.8);
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-success));
  cursor: pointer;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 2s ease-in-out infinite;
  transition: transform var(--transition-fast);
}

.confetti-btn:hover {
  animation: none;
  transform: scale(1.15);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.08); }
}
</style>
