<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['game-complete', 'spin-start'])
const { t } = useI18n()

const SYMBOLS    = ['💰', '💎', '⭐', '🍀']
const MAX_REVEAL = 6
const CELL_SIZE  = 72
const BRUSH_R    = 22

const LINES = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6],
]

const REWARDS = computed(() => ({
  line:   { coins: 180, diamonds: 7, label: t('games.daily_reward.scratch_line')   },
  triple: { coins: 110, diamonds: 4, label: t('games.daily_reward.scratch_triple') },
  pair:   { coins: 55,  diamonds: 1, label: t('games.daily_reward.scratch_pair')   },
  none:   { coins: 20,  diamonds: 0, label: t('games.daily_reward.scratch_none')   },
}))

// ── State ─────────────────────────────────────────────────
const genCells = () =>
  Array(9).fill(null).map(() => ({
    symbol:   SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    revealed: false,
    winning:  false,
  }))

const phase      = ref('scratching')
const cells      = ref(genCells())
const result     = ref(null)
const hasStarted = ref(false)
const activeIdx  = ref(-1)
const lockedIdx  = ref(-1)   // cell that has been started but not yet revealed

// Plain array — canvas refs don't need reactivity
const canvases = new Array(9).fill(null)

const revealed     = computed(() => cells.value.filter(c => c.revealed).length)
const limitReached = computed(() => revealed.value >= MAX_REVEAL)

// ── Canvas helpers ────────────────────────────────────────
const initCanvas = (canvas) => {
  const ctx = canvas.getContext('2d')
  // Base gradient
  const grad = ctx.createLinearGradient(0, 0, CELL_SIZE, CELL_SIZE)
  grad.addColorStop(0,   '#2e2e52')
  grad.addColorStop(0.5, '#1a1a32')
  grad.addColorStop(1,   '#242448')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
  // Noise texture for scratch-card feel
  for (let x = 0; x < CELL_SIZE; x += 2) {
    for (let y = 0; y < CELL_SIZE; y += 2) {
      if (Math.random() > 0.6) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }
  // Diagonal line texture
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth   = 1
  for (let i = -CELL_SIZE; i < CELL_SIZE * 2; i += 8) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + CELL_SIZE, CELL_SIZE)
    ctx.stroke()
  }
}

const doScratch = (canvas, x, y) => {
  const ctx = canvas.getContext('2d')
  ctx.globalCompositeOperation = 'destination-out'
  const grad = ctx.createRadialGradient(x, y, 0, x, y, BRUSH_R)
  grad.addColorStop(0,   'rgba(0,0,0,1)')
  grad.addColorStop(0.6, 'rgba(0,0,0,0.9)')
  grad.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x, y, BRUSH_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

const checkThreshold = (canvas, idx) => {
  if (cells.value[idx].revealed) return
  const data    = canvas.getContext('2d').getImageData(0, 0, CELL_SIZE, CELL_SIZE).data
  let cleared   = 0
  const samples = data.length / 16   // every 4th pixel
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] < 128) cleared++
  }
  if (cleared / samples > 0.5) {
    cells.value[idx].revealed = true
    if (lockedIdx.value === idx) lockedIdx.value = -1
    if (limitReached.value) finalize()
  }
}

// ── Pointer events ────────────────────────────────────────
const getPos = (e, canvas) => {
  const r = canvas.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

const onPointerDown = (e, idx) => {
  if (limitReached.value || cells.value[idx].revealed || phase.value === 'done') return
  if (lockedIdx.value !== -1 && lockedIdx.value !== idx) return  // must finish current cell first
  if (!hasStarted.value) { emit('spin-start'); hasStarted.value = true }
  activeIdx.value = idx
  lockedIdx.value = idx
  e.currentTarget.setPointerCapture(e.pointerId)
  const { x, y } = getPos(e, canvases[idx])
  doScratch(canvases[idx], x, y)
  checkThreshold(canvases[idx], idx)
}

const onPointerMove = (e, idx) => {
  if (activeIdx.value !== idx || cells.value[idx].revealed || limitReached.value) return
  const { x, y } = getPos(e, canvases[idx])
  doScratch(canvases[idx], x, y)
  checkThreshold(canvases[idx], idx)
}

const onPointerUp = () => { activeIdx.value = -1 }

// ── Win detection ─────────────────────────────────────────
const finalize = () => {
  if (phase.value === 'done') return
  const syms        = cells.value.map(c => c.revealed ? c.symbol : null)
  const revealedIdx = cells.value.map((c, i) => c.revealed ? i : null).filter(i => i !== null)

  for (const [a, b, c] of LINES) {
    if (syms[a] && syms[a] === syms[b] && syms[b] === syms[c]) {
      ;[a, b, c].forEach(i => { cells.value[i].winning = true })
      result.value = { ...REWARDS.value.line };  phase.value = 'done'; return
    }
  }

  const counts = {}
  revealedIdx.forEach(i => {
    const s = cells.value[i].symbol
    ;(counts[s] ??= []).push(i)
  })

  const triple = Object.values(counts).find(v => v.length >= 3)
  if (triple) {
    triple.slice(0, 3).forEach(i => { cells.value[i].winning = true })
    result.value = { ...REWARDS.value.triple }; phase.value = 'done'; return
  }

  const pair = Object.values(counts).find(v => v.length >= 2)
  if (pair) {
    pair.slice(0, 2).forEach(i => { cells.value[i].winning = true })
    result.value = { ...REWARDS.value.pair }; phase.value = 'done'; return
  }

  result.value = { ...REWARDS.value.none }; phase.value = 'done'
}

const collect = () => {
  if (!result.value) return
  emit('game-complete', {
    coins:    result.value.coins,
    diamonds: result.value.diamonds,
    label:    result.value.label,
  })
}
</script>

<template>
  <div class="flex flex-col gap-3 items-center">

    <!-- Progress dots -->
    <div class="flex items-center gap-2">
      <div class="flex gap-1">
        <div
          v-for="i in MAX_REVEAL"
          :key="i"
          class="w-2 h-2 rounded-full transition-all duration-200"
          :class="i <= revealed
            ? 'bg-yellow-400 shadow-[0_0_5px_rgba(250,204,21,0.7)]'
            : 'bg-white/10'"
        ></div>
      </div>
      <span class="text-[11px] tabular-nums" :class="limitReached ? 'text-white/20' : 'text-white/40'">
        {{ revealed }}/{{ MAX_REVEAL }}
      </span>
    </div>

    <!-- 3×3 grid -->
    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="(cell, idx) in cells"
        :key="idx"
        class="relative select-none overflow-hidden rounded-xl"
        :style="{ width: CELL_SIZE + 'px', height: CELL_SIZE + 'px', transition: 'box-shadow 0.4s ease' }"
        :class="cell.winning && phase === 'done'
          ? 'ring-2 ring-green-400 shadow-[0_0_14px_rgba(74,222,128,0.55)]'
          : ''"
      >
        <!-- Symbol underneath -->
        <div
          class="absolute inset-0 flex items-center justify-center text-3xl"
          style="background: #0d0d1a; border: 1px solid rgba(255,255,255,0.06)"
        >{{ cell.symbol }}</div>

        <!-- Canvas scratch overlay (stays for unrevealed; dims when limit reached) -->
        <canvas
          v-if="!cell.revealed"
          :ref="el => { if (el) { canvases[idx] = el; initCanvas(el) } }"
          :width="CELL_SIZE"
          :height="CELL_SIZE"
          class="absolute inset-0 touch-none transition-opacity duration-300"
          :class="[
            limitReached || phase === 'done' ? 'pointer-events-none' : 'cursor-crosshair',
          ]"
          @pointerdown="onPointerDown($event, idx)"
          @pointermove="onPointerMove($event, idx)"
          @pointerup="onPointerUp"
        />
      </div>
    </div>

    <!-- Result + inline Claim -->
    <div
      class="flex items-center gap-1.5 justify-center transition-opacity duration-300"
      :class="phase === 'done' ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <span
        class="text-xs font-bold"
        :style="{ color: result?.type === 'none' ? 'rgba(255,255,255,0.35)' : '#fbbf24' }"
      >{{ result?.label ?? ' ' }}</span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💰 +{{ result?.coins ?? 0 }}</span>
      <span class="bg-white/10 rounded-md px-2 py-0.5 text-white text-xs font-bold">💎 +{{ result?.diamonds ?? 0 }}</span>
      <button
        class="ml-1 px-3 py-0.5 bg-green-500 hover:bg-green-400 text-white text-xs font-bold rounded-lg transition-colors"
        @click="collect"
      >{{ t('games.daily_reward.collect') }}</button>
    </div>

  </div>
</template>
