<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'
import GamesHeader from '~/components/games/GamesHeader.vue'

const { t } = useI18n()
definePageMeta({ hideHeader: true })
useHead({ title: 'Hawk Tower' })

// ── Config ────────────────────────────────────────────────
const W          = 320   // canvas logical width
const H          = 480   // canvas logical height
const BLOCK_H    = 36    // block height px
const BASE_W     = 200   // first block width
const MIN_W      = 20    // game over if block trimmed below this
const BASE_Y     = H - BLOCK_H - 16  // world-y of block 1
const THRESHOLD  = 7     // blocks before camera starts scrolling
const PERFECT_T  = 0.93  // ≥93% overlap = perfect
const BASE_SPEED = 120   // px/sec for block 1
const SPEED_INC  = 4     // px/sec added per placed block

const COLORS = [
  '#EF4444','#F97316','#F59E0B','#EAB308','#84CC16',
  '#22C55E','#10B981','#14B8A6','#06B6D4','#0EA5E9',
  '#3B82F6','#6366F1','#8B5CF6','#A855F7','#D946EF','#EC4899',
]

// ── Canvas ────────────────────────────────────────────────
const canvasEl = ref(null)
let ctx        = null
let raf        = null

// ── Reactive state ────────────────────────────────────────
const phase       = ref('idle')   // 'idle' | 'playing' | 'over'
const score       = ref(0)
const towerHeight = ref(0)
const highScore   = ref(0)
const headerRef   = ref(null)
const maxHeight   = ref(0)
const combo       = ref(0)
const showPerfect = ref(false)
const lastReward  = ref(null)   // { coins, diamonds }

// ── Internal (non-reactive for perf) ─────────────────────
let blocks  = []  // { x, y, w, color }
let moving  = null  // { x, y, w, vx }
let falling = []  // { x, y, w, vy, opacity, color }
let camera  = 0   // positive = scrolled up (world → screen: screenY = worldY + camera)
let lastNow = 0

// ── Lifecycle ─────────────────────────────────────────────
onMounted(() => {
  const data    = loadHawk3Data()
  highScore.value  = data.games.hawkTower.highScore ?? 0
  maxHeight.value  = data.games.hawkTower.maxHeight ?? 0
  setupCanvas()
  renderIdle()
  document.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  document.removeEventListener('keydown', onKey)
})

// ── Canvas setup ──────────────────────────────────────────
function setupCanvas() {
  if (!canvasEl.value) return
  const dpr = window.devicePixelRatio || 1
  canvasEl.value.width  = W * dpr
  canvasEl.value.height = H * dpr
  ctx = canvasEl.value.getContext('2d')
  ctx.scale(dpr, dpr)
}

// ── Game flow ─────────────────────────────────────────────
function startGame() {
  cancelAnimationFrame(raf)
  blocks   = []
  falling  = []
  moving   = null
  camera   = 0
  score.value       = 0
  towerHeight.value = 0
  combo.value       = 0
  showPerfect.value = false
  phase.value       = 'playing'
  spawnBlock()
  lastNow = performance.now()
  raf = requestAnimationFrame(loop)
}

function spawnBlock() {
  const w    = blocks.length === 0 ? BASE_W : blocks[blocks.length - 1].w
  const worldY  = BASE_Y - towerHeight.value * BLOCK_H
  const speed   = Math.min(BASE_SPEED + towerHeight.value * SPEED_INC, 600)
  const fromLeft = Math.random() > 0.5

  moving = {
    x:  fromLeft ? -w : W,
    y:  worldY,
    w,
    vx: fromLeft ? speed : -speed,
  }
}

function drop() {
  if (phase.value !== 'playing' || !moving) return

  // First block — snap to center, always perfect
  if (blocks.length === 0) {
    const x = (W - moving.w) / 2
    blocks.push({ x, y: moving.y, w: moving.w, color: color(1) })
    towerHeight.value = 1
    combo.value = 1
    score.value += 15
    flashPerfect()
    moving = null
    setTimeout(spawnBlock, 160)
    return
  }

  const last = blocks[blocks.length - 1]
  const lo   = Math.max(moving.x, last.x)
  const ro   = Math.min(moving.x + moving.w, last.x + last.w)
  const overlap = ro - lo

  if (overlap <= 0) { endGame(); return }

  const ratio   = overlap / moving.w
  const perfect = ratio >= PERFECT_T

  if (!perfect) {
    // Create trimmed falling piece
    const trimX = moving.x < last.x ? moving.x : last.x + last.w
    const trimW = moving.w - overlap
    falling.push({ x: trimX, y: moving.y, w: trimW, vy: 0, opacity: 1, color: color(towerHeight.value + 1) })
    combo.value = 0
  } else {
    combo.value++
    flashPerfect()
  }

  const newW = perfect ? moving.w : overlap
  if (newW < MIN_W) { endGame(); return }

  const gained = perfect ? 15 + combo.value * 5 : Math.round(10 * ratio)
  score.value       += gained
  towerHeight.value += 1

  blocks.push({ x: lo, y: moving.y, w: newW, color: color(towerHeight.value) })

  // Update camera offset
  if (towerHeight.value > THRESHOLD) {
    camera = (towerHeight.value - THRESHOLD) * BLOCK_H
  }

  moving = null
  setTimeout(spawnBlock, 160)
}

function endGame() {
  phase.value = 'over'
  moving      = null
  cancelAnimationFrame(raf)

  if (score.value        > highScore.value) highScore.value = score.value
  if (towerHeight.value  > maxHeight.value) maxHeight.value = towerHeight.value

  const coins    = towerHeight.value * 3
  const diamonds = Math.floor(towerHeight.value / 10)
  lastReward.value = { coins, diamonds }

  const data = loadHawk3Data()
  data.games.hawkTower.highScore   = highScore.value
  data.games.hawkTower.maxHeight   = maxHeight.value
  data.games.hawkTower.gamesPlayed = (data.games.hawkTower.gamesPlayed ?? 0) + 1
  data.player.coins    = (data.player.coins    ?? 0) + coins
  data.player.diamonds = (data.player.diamonds ?? 0) + diamonds
  saveHawk3Data(data)
  headerRef.value?.refresh()

  render()  // final frame
}

function flashPerfect() {
  showPerfect.value = true
  setTimeout(() => { showPerfect.value = false }, 900)
}

// ── Game loop ─────────────────────────────────────────────
function loop(now) {
  const dt = Math.min((now - lastNow) / 1000, 0.05)
  lastNow  = now
  update(dt)
  render()
  if (phase.value === 'playing') raf = requestAnimationFrame(loop)
}

function update(dt) {
  if (!moving) return

  moving.x += moving.vx * dt

  // Bounce at walls (allow slight overhang so block fully exits)
  if (moving.vx < 0 && moving.x < -moving.w * 0.45) {
    moving.x  = -moving.w * 0.45
    moving.vx = Math.abs(moving.vx)
  } else if (moving.vx > 0 && moving.x + moving.w > W + moving.w * 0.45) {
    moving.x  = W - moving.w * 0.55
    moving.vx = -Math.abs(moving.vx)
  }

  // Falling pieces — gravity + fade
  falling = falling.filter(p => p.opacity > 0)
  for (const p of falling) {
    p.vy      += 700 * dt
    p.y       += p.vy * dt
    p.opacity -= dt * 2.5
  }
}

// ── Render ────────────────────────────────────────────────
function render() {
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)
  drawBackground()

  ctx.save()
  ctx.translate(0, camera)

  for (const b of blocks)  drawBlock(b.x, b.y, b.w, BLOCK_H, b.color, false)

  for (const p of falling) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, p.opacity)
    drawBlock(p.x, p.y, p.w, BLOCK_H, p.color, false)
    ctx.restore()
  }

  if (moving) drawBlock(moving.x, moving.y, moving.w, BLOCK_H, color(towerHeight.value + 1), true)

  ctx.restore()
}

function renderIdle() {
  if (!ctx) return
  drawBackground()
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#0a0a14')
  grad.addColorStop(1, '#1a1a2e')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(255,255,255,0.035)'
  ctx.lineWidth   = 1
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
}

function drawBlock(x, y, w, h, col, isMoving) {
  // Drop shadow
  if (!isMoving) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.fillRect(x + 3, y + 4, w, h)
  }

  // Main fill
  ctx.fillStyle = col
  ctx.fillRect(x, y, w, h)

  // Top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fillRect(x, y, w, 5)

  // Glow outline for moving block
  if (isMoving) {
    ctx.shadowColor = col
    ctx.shadowBlur  = 12
  }
  ctx.strokeStyle = isMoving ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.25)'
  ctx.lineWidth   = 1.5
  ctx.strokeRect(x, y, w, h)
  ctx.shadowBlur  = 0
}

function color(n) {
  return COLORS[(n - 1) % COLORS.length]
}

// ── Input ─────────────────────────────────────────────────
function onKey(e) {
  if ((e.code === 'Space' || e.key === ' ') && phase.value === 'playing') {
    e.preventDefault()
    drop()
  }
}

function onCanvasTap(e) {
  e.preventDefault()
  if (phase.value === 'playing') drop()
}
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-4 px-4 select-none">
    <div class="max-w-[420px] mx-auto flex flex-col gap-5">

      <!-- Header -->
      <GamesHeader ref="headerRef" title="🏗️ Hawk Tower" />

      <!-- Stats -->
      <div class="flex gap-3">
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.tower.height') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ towerHeight }}</div>
        </div>
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.tower.score') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ score }}</div>
        </div>
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.tower.best') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ maxHeight }}</div>
        </div>
      </div>

      <!-- Canvas container -->
      <div class="relative rounded-2xl overflow-hidden mx-auto" style="width: 320px; height: 480px;">
        <canvas
          ref="canvasEl"
          style="width: 320px; height: 480px; display: block; touch-action: none; cursor: pointer;"
          @click="onCanvasTap"
          @touchstart="onCanvasTap"
        />

        <!-- Start overlay -->
        <Transition name="fade">
          <div
            v-if="phase === 'idle'"
            class="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-5"
          >
            <h2 class="text-2xl font-bold text-white">🏗️ Hawk Tower</h2>
            <p class="text-white/60 text-sm text-center leading-relaxed px-8">
              {{ t('games.tower.instructions') }}
            </p>
            <button
              class="px-10 py-3 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
              @click.stop="startGame"
            >{{ t('games.tower.start') }}</button>
          </div>
        </Transition>

        <!-- Game over overlay -->
        <Transition name="fade">
          <div
            v-if="phase === 'over'"
            class="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-5"
          >
            <h2 class="text-2xl font-bold text-white">{{ t('games.tower.game_over') }}</h2>
            <div class="text-center text-white space-y-1">
              <div class="text-xs uppercase tracking-widest opacity-60">{{ t('games.tower.height') }}</div>
              <div class="text-5xl font-bold tabular-nums">{{ towerHeight }}</div>
              <div class="text-sm opacity-50 pt-1">{{ t('games.tower.best') }}: {{ maxHeight }}</div>
            </div>
            <div v-if="lastReward" class="flex gap-3">
              <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[72px]">
                <div class="text-xs opacity-50 mb-0.5">{{ t('games.tower.reward_coins') }}</div>
                <div class="text-lg font-bold">+{{ lastReward.coins }}</div>
              </div>
              <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[72px]">
                <div class="text-xs opacity-50 mb-0.5">{{ t('games.tower.reward_diamonds') }}</div>
                <div class="text-lg font-bold">+{{ lastReward.diamonds }}</div>
              </div>
            </div>
            <button
              class="px-10 py-3 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
              @click.stop="startGame"
            >{{ t('games.tower.play_again') }}</button>
          </div>
        </Transition>

        <!-- Perfect badge -->
        <Transition name="pop">
          <div
            v-if="showPerfect"
            class="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full pointer-events-none whitespace-nowrap"
          >✨ PERFECT</div>
        </Transition>
      </div>

      <!-- Combo + restart row -->
      <div v-if="phase === 'playing'" class="flex items-center justify-between">
        <Transition name="fade">
          <div v-if="combo > 1" class="text-yellow-400 font-bold text-sm">
            🔥 {{ combo }}× Combo
          </div>
        </Transition>
        <button
          class="ml-auto py-2 px-5 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-sm font-medium rounded-xl transition-colors"
          @click="startGame"
        >↺ {{ t('games.tower.restart') }}</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }

.pop-enter-active  { transition: opacity 0.15s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.pop-leave-active  { transition: opacity 0.4s ease; }
.pop-enter-from    { opacity: 0; transform: translateX(-50%) scale(0.5); }
.pop-leave-to      { opacity: 0; }
</style>
