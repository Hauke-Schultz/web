<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  cells: { type: Array, default: null },
  now:   { type: Number, default: () => Date.now() },
})

const emit = defineEmits(['harvest'])
const { t } = useI18n()

const CELL_SIZE = 72
const BRUSH_R   = 24

// ── Per-cell state ────────────────────────────────────────────────────────────
// revealed:   scratch threshold reached, seed visible, waiting for tap
// collecting: tap sent, waiting for parent to replace cell
const localCells = ref([])
const canvases   = new Array(9).fill(null)
const activeIdx  = ref(-1)
const lockedIdx  = ref(-1)

watch(() => props.cells, (cells) => {
  localCells.value = cells
    ? cells.map(c => ({ ...c, revealed: false, collecting: false }))
    : []
  canvases.fill(null)
  activeIdx.value = -1
  lockedIdx.value = -1
}, { immediate: true })

// ── Helpers ───────────────────────────────────────────────────────────────────
const isReady = (cell) => cell.ready || cell.growsAt <= props.now

const growProgress = (cell) => {
  if (!cell.plantedAt || !cell.growsAt) return 0
  return Math.min(1, Math.max(0, (props.now - cell.plantedAt) / (cell.growsAt - cell.plantedAt)))
}

const growCountdown = (cell) => {
  const sec = Math.max(0, Math.ceil((cell.growsAt - props.now) / 1000))
  if (sec <= 0) return ''
  if (sec < 3600) { const m = Math.floor(sec / 60), s = sec % 60; return s ? `${m}m ${s}s` : `${m}m` }
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

const growIcon = (cell) => {
  const p = growProgress(cell)
  if (p < 0.33) return '🌱'
  if (p < 0.66) return '🌿'
  return '🪴'
}

// ── Canvas helpers ────────────────────────────────────────────────────────────
const initCanvas = (canvas) => {
  const ctx  = canvas.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, CELL_SIZE, CELL_SIZE)
  grad.addColorStop(0,   '#1a3020')
  grad.addColorStop(0.5, '#0f1e14')
  grad.addColorStop(1,   '#162419')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE)
  for (let x = 0; x < CELL_SIZE; x += 2) {
    for (let y = 0; y < CELL_SIZE; y += 2) {
      if (Math.random() > 0.6) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }
  ctx.strokeStyle = 'rgba(100,200,100,0.04)'
  ctx.lineWidth   = 1
  for (let i = -CELL_SIZE; i < CELL_SIZE * 2; i += 8) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CELL_SIZE, CELL_SIZE); ctx.stroke()
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
  ctx.beginPath(); ctx.arc(x, y, BRUSH_R, 0, Math.PI * 2); ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

const checkThreshold = (canvas, idx) => {
  const cell = localCells.value[idx]
  if (!cell || cell.revealed) return
  const data    = canvas.getContext('2d').getImageData(0, 0, CELL_SIZE, CELL_SIZE).data
  let cleared   = 0
  const samples = data.length / 16
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] < 128) cleared++
  }
  if (cleared / samples > 0.5) {
    cell.revealed   = true
    lockedIdx.value = -1
  }
}

// ── Pointer events (scratch) ──────────────────────────────────────────────────
const getPos = (e, canvas) => {
  const r = canvas.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

const onPointerDown = (e, idx) => {
  const cell = localCells.value[idx]
  if (!cell || !isReady(cell) || cell.revealed || cell.collecting) return
  if (lockedIdx.value !== -1 && lockedIdx.value !== idx) return
  activeIdx.value = idx
  lockedIdx.value = idx
  e.currentTarget.setPointerCapture(e.pointerId)
  const { x, y } = getPos(e, canvases[idx])
  doScratch(canvases[idx], x, y)
  checkThreshold(canvases[idx], idx)
}

const onPointerMove = (e, idx) => {
  const cell = localCells.value[idx]
  if (activeIdx.value !== idx || !cell || cell.revealed) return
  const { x, y } = getPos(e, canvases[idx])
  doScratch(canvases[idx], x, y)
  checkThreshold(canvases[idx], idx)
}

const onPointerUp = () => { activeIdx.value = -1 }

// ── Collect on tap (second interaction) ──────────────────────────────────────
const collect = (idx) => {
  const cell = localCells.value[idx]
  if (!cell || !cell.revealed || cell.collecting) return
  cell.collecting = true
  emit('harvest', idx)
}

// ── External update after harvest API response ────────────────────────────────
const updateCell = (idx, newData) => {
  if (idx < 0 || idx > 8) return
  canvases[idx] = null
  localCells.value[idx] = { ...newData, revealed: false, collecting: false }
}

defineExpose({ updateCell })
</script>

<template>
  <div v-if="localCells.length" class="hsc-root">
    <div class="hsc-grid">
      <div
        v-for="(cell, idx) in localCells"
        :key="idx"
        class="hsc-cell"
        :style="{ width: CELL_SIZE + 'px', height: CELL_SIZE + 'px' }"
        :class="{
          'hsc-cell--ready':      isReady(cell) && !cell.revealed && !cell.collecting,
          'hsc-cell--revealed':   cell.revealed && !cell.collecting,
          'hsc-cell--collecting': cell.collecting,
        }"
        @click="collect(idx)"
      >

        <!-- ── 1. Growing ──────────────────────────────────────── -->
        <template v-if="!isReady(cell) && !cell.revealed && !cell.collecting">
          <div class="hsc-growing">
            <div class="hsc-grow-icon">{{ growIcon(cell) }}</div>
            <div class="hsc-grow-bar-track">
              <div class="hsc-grow-bar-fill" :style="{ width: (growProgress(cell) * 100) + '%' }" />
            </div>
            <div class="hsc-grow-time">{{ growCountdown(cell) }}</div>
          </div>
        </template>

        <!-- ── 2 + 3. Ready or Revealed: symbol always underneath canvas ── -->
        <template v-else-if="!cell.collecting">
          <div class="hsc-cell-content">
            <div class="hsc-symbol">{{ cell.symbol }}</div>
          </div>

          <!-- Canvas overlay — only while not yet revealed -->
          <canvas
            v-if="!cell.revealed"
            :ref="el => { if (el) { canvases[idx] = el; initCanvas(el) } }"
            :width="CELL_SIZE"
            :height="CELL_SIZE"
            class="hsc-overlay touch-none"
            @pointerdown="onPointerDown($event, idx)"
            @pointermove="onPointerMove($event, idx)"
            @pointerup="onPointerUp"
          />
        </template>

        <!-- ── 4. Collecting spinner ──────────────────────────── -->
        <template v-else>
          <div class="hsc-growing">
            <div class="hsc-grow-icon">⏳</div>
          </div>
        </template>

      </div>
    </div>
  </div>

  <div v-else class="hsc-loading">
    <span>⏳</span>
    <span>{{ t('hawkStar.agriculture.loading') }}</span>
  </div>
</template>

<style lang="scss" scoped>
.hsc-root {
  margin-top: 0.875rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--hs-line-sm);
  display: flex;
  justify-content: center;
}

.hsc-loading {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.75rem; font-size: 0.75rem; opacity: 0.4;
}

// ── Grid ──────────────────────────────────────────────────────────────────────
.hsc-grid {
  display: grid;
  grid-template-columns: repeat(3, 72px);
  gap: 6px;
}

.hsc-cell {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  user-select: none;

  &--ready {
    animation: hsc-pulse 2s ease-in-out infinite;
  }

  &--revealed {
    cursor: pointer;
    box-shadow: 0 0 14px rgba(134,239,172,0.6);
  }

  &--collecting { opacity: 0.5; }
}

@keyframes hsc-pulse {
  0%, 100% { box-shadow: 0 0 6px rgba(134,239,172,0.25); }
  50%       { box-shadow: 0 0 16px rgba(134,239,172,0.65); }
}

// ── Growing ───────────────────────────────────────────────────────────────────
.hsc-growing {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #0a1a0e;
  border: 1px solid rgba(255,255,255,0.06);
}

.hsc-grow-icon  { font-size: 1.4rem; opacity: 0.7; }

.hsc-grow-bar-track {
  width: 52px; height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 9999px; overflow: hidden;
}

.hsc-grow-bar-fill {
  height: 100%;
  background: rgba(134,239,172,0.55);
  border-radius: 9999px;
  transition: width 1s linear;
}

.hsc-grow-time {
  font-size: 0.5rem;
  color: rgba(255,255,255,0.3);
  font-variant-numeric: tabular-nums;
}

// ── Seed cell (under canvas + after reveal) ───────────────────────────────────
.hsc-cell-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #0d2014;
  border: 1px solid rgba(134,239,172,0.1);
}

.hsc-symbol { font-size: 2rem; }

// ── Canvas overlay ────────────────────────────────────────────────────────────
.hsc-overlay {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  cursor: crosshair;
}
</style>
