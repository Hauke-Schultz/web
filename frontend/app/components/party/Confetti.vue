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
    el.style.animation = `confetti-fall ${dur}s ease-in forwards`
    container.appendChild(el)
    setTimeout(() => el.remove(), dur * 1000)
  }
}
</script>

<template>
  <button
    class="fixed bottom-[30px] right-[30px] z-[999] w-16 h-16 text-[2rem] border-[3px] border-white/80 rounded-full bg-gradient-to-br from-primary to-success cursor-pointer flex items-center justify-center shadow-md animate-pulse-btn transition-transform hover:scale-[1.15] hover:[animation:none]"
    aria-label="Konfetti!"
    @click="createConfetti"
  >🎉</button>
</template>
