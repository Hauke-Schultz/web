<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'
import GamesHeader from '~/components/games/GamesHeader.vue'

definePageMeta({ hideHeader: true })
useHead({
  title: 'Hawk Coin',
  meta: [{ name: 'description', content: 'Wirf Münzen in den Automaten und schiebe sie über die Kante!' }],
})

// ── Layout ──────────────────────────────────────────────────
const W        = 360
const PLAY_H   = 340   // play-field height
const WIN_H    = 72    // win-slot height below play field
const H        = PLAY_H + WIN_H  // 412 — total canvas

// ── Gameplay config ─────────────────────────────────────────
const COIN_R       = 22
const BUDGET_START = 60
const PLATE_MIN_Y  = 15    // back edge Y when plate fully up
const PLATE_MAX_Y  = 77    // back edge Y when plate fully down
const PLATE_H      = 150   // plate height in px
const PLATE_SPEED  = 48    // px / sec
const SPLIT_Y      = 185   // visual separator: moving zone / lower zone
const LOWER_MIN_Y  = SPLIT_Y + COIN_R   // = 207 — min center-Y for lower coins
const FRICTION     = 0.88  // velocity multiplier per frame (~60 fps)
const MAX_SLOT     = 16    // max win-slot coins shown

// ── Canvas ──────────────────────────────────────────────────
const canvasEl = ref(null)
let ctx        = null
let raf        = null
let dpr        = 1

// ── Game state (non-reactive for perf) ──────────────────────
let plateY        = (PLATE_MIN_Y + PLATE_MAX_Y) / 2
let plateDir      = 1
let coins         = []        // { x, y, vx, vy, layer: 0|1 }
let slotCoins     = []        // { x, y, vx, vy } — won coins visible in slot
let previewX      = W / 2
let showPreview   = false
let lastNow       = 0
let gameOverTimer = null

// ── Reactive state ───────────────────────────────────────────
const phase      = ref('idle')
const budget     = ref(0)
const won        = ref(0)
const highScore  = ref(0)
const headerRef  = ref(null)
const lastReward = ref(null)

// ── Helpers ──────────────────────────────────────────────────
const rnd      = (a, b) => a + Math.random() * (b - a)
const clampX   = x => Math.max(COIN_R + 4, Math.min(W - COIN_R - 4, x))

// ── Coin initialisation ──────────────────────────────────────
function spawnInitialCoins() {
  coins     = []
  slotCoins = []
  const py  = plateY

  // Layer 0 — moving plate (14 coins)
  for (let i = 0; i < 14; i++) {
    coins.push({
      x: rnd(COIN_R + 8, W - COIN_R - 8),
      y: rnd(py + COIN_R + 5, py + PLATE_H - COIN_R - 5),
      vx: 0, vy: 0, layer: 0,
    })
  }

  // Layer 1 — lower plate (20 coins, half near bottom for early wins)
  for (let i = 0; i < 20; i++) {
    const nearBottom = i < 10
    coins.push({
      x: rnd(COIN_R + 8, W - COIN_R - 8),
      y: nearBottom
        ? rnd(PLAY_H - 60, PLAY_H - COIN_R - 2)
        : rnd(LOWER_MIN_Y + 10, PLAY_H - 65),
      vx: 0, vy: 0, layer: 1, z: 0,
    })
  }

  for (let p = 0; p < 50; p++) resolveCollisions(false)
}

// ── Physics helpers ──────────────────────────────────────────
function resolveCollisions(withImpulse = true) {
  const minD = COIN_R * 2
  for (let i = 0; i < coins.length; i++) {
    for (let j = i + 1; j < coins.length; j++) {
      const a = coins[i], b = coins[j]
      if (a.layer !== b.layer) continue              // different plate levels
      if ((a.z ?? 0) !== (b.z ?? 0)) continue       // different stack levels
      if (a.falling || b.falling) continue           // falling coins phase through
      const dx = b.x - a.x, dy = b.y - a.y
      const d2 = dx * dx + dy * dy
      if (d2 >= minD * minD || d2 < 0.0001) continue
      const dist = Math.sqrt(d2)
      const nx = dx / dist, ny = dy / dist
      const push = (minD - dist) * 0.5
      a.x -= nx * push; a.y -= ny * push
      b.x += nx * push; b.y += ny * push
      if (withImpulse) {
        const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (relV < 0) {
          const imp = relV * 0.45
          a.vx += imp * nx; a.vy += imp * ny
          b.vx -= imp * nx; b.vy -= imp * ny
        }
      }
    }
  }
}

function resolveSlotCollisions() {
  const minD = COIN_R * 2
  for (let i = 0; i < slotCoins.length; i++) {
    for (let j = i + 1; j < slotCoins.length; j++) {
      const a = slotCoins[i], b = slotCoins[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const d2 = dx * dx + dy * dy
      if (d2 >= minD * minD || d2 < 0.0001) continue
      const dist = Math.sqrt(d2)
      const nx = dx / dist, ny = dy / dist
      const push = (minD - dist) * 0.5
      a.x -= nx * push; a.y -= ny * push
      b.x += nx * push; b.y += ny * push
      const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (relV < 0) {
        const imp = relV * 0.4
        a.vx += imp * nx; a.vy += imp * ny
        b.vx -= imp * nx; b.vy -= imp * ny
      }
    }
  }
}

// ── Main update ──────────────────────────────────────────────
function update(dt) {
  const prevY = plateY

  // 1. Move plate
  plateY += plateDir * PLATE_SPEED * dt
  if (plateY >= PLATE_MAX_Y) { plateY = PLATE_MAX_Y; plateDir = -1 }
  if (plateY <= PLATE_MIN_Y) { plateY = PLATE_MIN_Y; plateDir =  1 }

  const delta     = plateY - prevY
  const frontEdge = plateY + PLATE_H

  // 2. Carry layer-0 coins with the plate
  for (const c of coins) {
    if (c.layer !== 0) continue
    c.y += delta
    if (c.y - COIN_R < 0) { c.y = COIN_R; if (c.vy < 0) c.vy = 0 }
  }

  // 3. Push layer-1 coins with front edge (only when plate descends)
  if (delta > 0) {
    for (const c of coins) {
      if (c.layer !== 1) continue
      const pen = frontEdge - (c.y - COIN_R)
      if (pen > 0) {
        c.y  += pen
        c.vy  = Math.max(c.vy, pen * 10)
      }
    }
  }

  // 4. Apply velocities
  for (const c of coins) {
    c.x += c.vx * dt
    c.y += c.vy * dt
  }

  // 5. Collisions (2 passes)
  resolveCollisions()
  resolveCollisions()

  // 6. Wall clamps
  for (const c of coins) {
    if (c.x - COIN_R < 0)  { c.x = COIN_R;     c.vx =  Math.abs(c.vx) * 0.3 }
    if (c.x + COIN_R > W)  { c.x = W - COIN_R; c.vx = -Math.abs(c.vx) * 0.3 }
  }

  // 7. Layer transitions & win detection
  const FALL_GRAVITY = 900   // px/s² during drop animation
  const remove = []
  for (const c of coins) {
    if (c.layer === 0 && c.y > frontEdge) {
      // Transition: keep current position, start fall animation
      c.layer   = 1
      c.z       = 0      // will be re-evaluated on landing
      c.falling = true
      c.vy      = Math.max(c.vy, 40)
    }
    if (c.layer === 1) {
      if (c.falling) {
        // Accelerate downward until coin reaches lower plate level
        c.vy += FALL_GRAVITY * dt
        if (c.y >= LOWER_MIN_Y) {
          c.falling = false
          c.vy      = c.vy * 0.3   // dampen on landing
          c.z       = determineZOnLanding(c)
        }
      } else {
        if (c.y < LOWER_MIN_Y) { c.y = LOWER_MIN_Y; if (c.vy < 0) c.vy = 0 }
      }
      // Win: 50 % of coin past lower edge (center crosses PLAY_H)
      if (c.y > PLAY_H) {
        remove.push(c)
        won.value++
        spawnSlotCoin(c.x)
      }
    }
  }
  if (remove.length) coins = coins.filter(c => !remove.includes(c))

  // 8. Damping (skip falling coins so gravity isn't dampened away)
  const damp = Math.pow(FRICTION, dt * 60)
  for (const c of coins) {
    if (c.falling) { c.vx *= damp } else { c.vx *= damp; c.vy *= damp }
  }

  // 9. Win-slot physics
  updateSlot(dt)
}

// ── Z-level on landing ───────────────────────────────────────
function determineZOnLanding(coin) {
  const minD2 = (COIN_R * 2) ** 2
  let hasZ0 = false, hasZ1 = false
  for (const c of coins) {
    if (c === coin || c.layer !== 1 || c.falling) continue
    const dx = c.x - coin.x, dy = c.y - coin.y
    if (dx * dx + dy * dy < minD2) {
      if ((c.z ?? 0) === 0) hasZ0 = true
      if ((c.z ?? 0) === 1) hasZ1 = true
    }
  }
  if (hasZ0 && !hasZ1) return 1                              // stack on z=0 layer
  if (hasZ0 && hasZ1) {                                      // would be z=2 → slide off
    coin.vx += (Math.random() > 0.5 ? 1 : -1) * 100
    return 0
  }
  return 0                                                   // free ground
}

// ── Win slot ─────────────────────────────────────────────────
function spawnSlotCoin(x) {
  if (slotCoins.length >= MAX_SLOT) slotCoins.shift()
  slotCoins.push({
    x: Math.max(COIN_R + 4, Math.min(W - COIN_R - 4, x)),
    y: PLAY_H + COIN_R + 2,
    vx: (Math.random() - 0.5) * 30,
    vy: 20,
    age: 0,
  })
}

function updateSlot(dt) {
  const gravity = 500  // px/s²
  for (const sc of slotCoins) {
    sc.age += dt
    sc.vy += gravity * dt
    sc.x  += sc.vx * dt
    sc.y  += sc.vy * dt
    // Bottom clamp
    if (sc.y + COIN_R >= H) { sc.y = H - COIN_R; sc.vy = 0 }
    // Top clamp (stay in slot)
    if (sc.y - COIN_R < PLAY_H) { sc.y = PLAY_H + COIN_R; if (sc.vy < 0) sc.vy = 0 }
    // Wall clamps
    if (sc.x - COIN_R < 0)  { sc.x = COIN_R;     sc.vx =  Math.abs(sc.vx) * 0.4 }
    if (sc.x + COIN_R > W)  { sc.x = W - COIN_R; sc.vx = -Math.abs(sc.vx) * 0.4 }
  }
  resolveSlotCollisions()
  // Slot coin damping
  const damp = Math.pow(0.80, dt * 60)
  for (const sc of slotCoins) { sc.vx *= damp; sc.vy *= damp }
  // Remove expired coins (older than 3 s)
  slotCoins = slotCoins.filter(sc => sc.age < 3)
}

// ── Rendering ────────────────────────────────────────────────
// style: 0=moving plate  1=lower z=0 (dark)  2=lower z=1 (bright)  3=slot
function drawCoin(x, y, style) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.arc(x + 1.5, y + 2, COIN_R, 0, Math.PI * 2)
  ctx.fill()

  // Body gradient
  const cg = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, COIN_R)
  if (style === 0) {        // moving plate — mid gold
    cg.addColorStop(0, '#fde68a')
    cg.addColorStop(1, '#b45309')
  } else if (style === 1) { // lower z=0 — dark gold
    cg.addColorStop(0, '#d97706')
    cg.addColorStop(1, '#78350f')
  } else if (style === 2) { // lower z=1 — bright gold (stacked)
    cg.addColorStop(0, '#fef08a')
    cg.addColorStop(1, '#ca8a04')
  } else {                  // slot — brightest gold
    cg.addColorStop(0, '#fef9c3')
    cg.addColorStop(1, '#eab308')
  }
  ctx.fillStyle = cg
  ctx.beginPath()
  ctx.arc(x, y, COIN_R, 0, Math.PI * 2)
  ctx.fill()

  // Rim
  const rims = ['#fcd34d', '#b45309', '#fde047', '#facc15']
  ctx.strokeStyle = rims[style] ?? '#fcd34d'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Symbol
  ctx.fillStyle = 'rgba(120,53,15,0.85)'
  ctx.font = `bold ${Math.round(COIN_R * 0.75)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('$', x, y)
}

function draw() {
  ctx.clearRect(0, 0, W, H)
  const frontEdge = plateY + PLATE_H

  // ── Play field background
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, W, PLAY_H)

  // Lower plate area
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, SPLIT_Y, W, PLAY_H - SPLIT_Y)

  // Split line
  ctx.strokeStyle = 'rgba(71,85,105,0.45)'
  ctx.lineWidth = 1
  ctx.setLineDash([5, 5])
  ctx.beginPath(); ctx.moveTo(0, SPLIT_Y); ctx.lineTo(W, SPLIT_Y); ctx.stroke()
  ctx.setLineDash([])

  // Moving plate (drawn on top of lower-plate background)
  ctx.fillStyle = '#1e3a5f'
  ctx.fillRect(0, plateY, W, PLATE_H)

  // Plate back edge (blue)
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, plateY); ctx.lineTo(W, plateY); ctx.stroke()

  // Plate front edge (amber)
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.moveTo(0, frontEdge); ctx.lineTo(W, frontEdge); ctx.stroke()

  // ── Win slot ──────────────────────────────────────────────
  // Slot background
  ctx.fillStyle = '#1c1c0a'
  ctx.fillRect(0, PLAY_H, W, WIN_H)

  // Slot top separator (strong amber line)
  ctx.strokeStyle = '#ca8a04'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(0, PLAY_H); ctx.lineTo(W, PLAY_H); ctx.stroke()

  // Slot label left
  ctx.fillStyle = 'rgba(234,179,8,0.55)'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('GEWINN', 8, PLAY_H + WIN_H / 2)

  // Slot label right: coin count
  ctx.fillStyle = 'rgba(253,224,71,0.8)'
  ctx.font = 'bold 13px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`×${won.value}`, W - 8, PLAY_H + WIN_H / 2)

  // Down arrows just above slot line
  ctx.fillStyle = 'rgba(234,179,8,0.30)'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  for (let i = 0; i < 6; i++) ctx.fillText('▼', 30 + i * 60, PLAY_H - 3)

  // ── Layer-1 z=0 coins (dark, ground level)
  for (const c of coins) {
    if (c.layer === 1 && (c.z ?? 0) === 0) drawCoin(c.x, c.y, 1)
  }

  // ── Layer-1 z=1 coins (bright, stacked on top of z=0)
  for (const c of coins) {
    if (c.layer === 1 && c.z === 1) drawCoin(c.x, c.y, 2)
  }

  // ── Layer-0 coins (moving plate) — drawn on top of plate
  for (const c of coins) { if (c.layer === 0) drawCoin(c.x, c.y, 0) }

  // Slot coins
  for (const sc of slotCoins) {
    ctx.globalAlpha = sc.age < 2 ? 1 : Math.max(0, 1 - (sc.age - 2))
    drawCoin(sc.x, sc.y, 3)
  }
  ctx.globalAlpha = 1

  // ── Labels ────────────────────────────────────────────────
  ctx.font = '9px sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(148,163,184,0.4)'
  ctx.fillText('▲▼ PLATTE', 6, plateY + 4)
  ctx.fillStyle = 'rgba(148,163,184,0.25)'
  ctx.fillText('ABLAGE', 6, SPLIT_Y + 4)

  // ── Drop preview ──────────────────────────────────────────
  if (showPreview && phase.value === 'playing' && budget.value > 0) {
    const py = plateY + COIN_R + 5
    ctx.strokeStyle = 'rgba(253,230,138,0.18)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(previewX, 0); ctx.lineTo(previewX, py - COIN_R); ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(previewX, py, COIN_R, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(253,230,138,0.15)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(253,230,138,0.5)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// ── Input ────────────────────────────────────────────────────
function getCanvasX(e) {
  const rect = canvasEl.value.getBoundingClientRect()
  return ((e.clientX - rect.left) / rect.width) * W
}

function onPointerMove(e) {
  previewX    = clampX(getCanvasX(e))
  showPreview = phase.value === 'playing'
}

function onPointerLeave() { showPreview = false }

function onPointerDown(e) {
  e.preventDefault()
  if (phase.value !== 'playing' || budget.value <= 0) return
  previewX = clampX(getCanvasX(e))
  dropCoin(previewX)
}

function dropCoin(x) {
  if (budget.value <= 0 || phase.value !== 'playing') return
  budget.value--
  coins.push({ x, y: plateY + COIN_R + 5, vx: 0, vy: 0, layer: 0 })
  if (budget.value === 0 && !gameOverTimer) {
    gameOverTimer = setTimeout(endGame, 5000)
  }
}

// ── Game flow ─────────────────────────────────────────────────
function startGame() {
  if (gameOverTimer) { clearTimeout(gameOverTimer); gameOverTimer = null }
  phase.value      = 'playing'
  budget.value     = BUDGET_START
  won.value        = 0
  lastReward.value = null
  plateY           = (PLATE_MIN_Y + PLATE_MAX_Y) / 2
  plateDir         = 1
  lastNow          = performance.now()
  spawnInitialCoins()
}

function endGame() {
  if (phase.value !== 'playing') return
  gameOverTimer = null
  phase.value   = 'over'

  const data          = loadHawk3Data()
  const coinReward    = won.value * 2
  const diamondReward = Math.floor(won.value / 50)
  const netWin        = won.value - BUDGET_START

  data.games.hawkCoin.gamesPlayed++
  data.games.hawkCoin.totalCoinsWon    += won.value
  data.games.hawkCoin.totalCoinsSpent  += BUDGET_START
  if (won.value > (data.games.hawkCoin.highScore  ?? 0)) data.games.hawkCoin.highScore  = won.value
  if (netWin   > (data.games.hawkCoin.bestNetWin  ?? 0)) data.games.hawkCoin.bestNetWin  = netWin

  data.player          = data.player          ?? {}
  data.player.coins    = (data.player.coins    ?? 0) + coinReward
  data.player.diamonds = (data.player.diamonds ?? 0) + diamondReward

  highScore.value  = data.games.hawkCoin.highScore
  lastReward.value = { coins: coinReward, diamonds: diamondReward }
  saveHawk3Data(data)
  headerRef.value?.refresh()
}

// ── Game loop ─────────────────────────────────────────────────
function tick(now) {
  raf = requestAnimationFrame(tick)
  const dt = Math.min((now - lastNow) / 1000, 0.05)
  lastNow  = now

  if (phase.value === 'playing') {
    update(dt)
  } else {
    plateY += plateDir * PLATE_SPEED * dt
    if (plateY >= PLATE_MAX_Y) { plateY = PLATE_MAX_Y; plateDir = -1 }
    if (plateY <= PLATE_MIN_Y) { plateY = PLATE_MIN_Y; plateDir =  1 }
    updateSlot(dt)
  }
  draw()
}

// ── Setup ─────────────────────────────────────────────────────
function setupCanvas() {
  dpr = window.devicePixelRatio || 1
  const el = canvasEl.value
  el.width        = W * dpr
  el.height       = H * dpr
  el.style.width  = W + 'px'
  el.style.height = H + 'px'
  ctx = el.getContext('2d')
  ctx.scale(dpr, dpr)
}

onMounted(() => {
  const data      = loadHawk3Data()
  highScore.value = data.games.hawkCoin.highScore ?? 0
  setupCanvas()
  lastNow = performance.now()
  raf     = requestAnimationFrame(tick)
})

onUnmounted(() => {
  if (raf)           cancelAnimationFrame(raf)
  if (gameOverTimer) clearTimeout(gameOverTimer)
})
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-4 px-4 select-none">
    <div class="max-w-[420px] mx-auto flex flex-col gap-4">

      <GamesHeader ref="headerRef" title="🪙 Hawk Coin" />

      <!-- Stats row -->
      <div class="flex gap-3">
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-2 py-2 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">Budget</div>
          <div class="text-xl font-bold tabular-nums">{{ budget }}</div>
        </div>
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-2 py-2 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">Gewonnen</div>
          <div class="text-xl font-bold tabular-nums text-yellow-400">{{ won }}</div>
        </div>
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-2 py-2 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">Highscore</div>
          <div class="text-xl font-bold tabular-nums">{{ highScore }}</div>
        </div>
      </div>

      <!-- Canvas -->
      <div class="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <canvas
          ref="canvasEl"
          class="block touch-none mx-auto"
          @pointermove="onPointerMove"
          @pointerleave="onPointerLeave"
          @pointerdown="onPointerDown"
        />

        <!-- Idle overlay -->
        <Transition name="fade">
          <div v-if="phase === 'idle'"
            class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/65 backdrop-blur-sm">
            <div class="text-6xl">🪙</div>
            <h2 class="text-white text-2xl font-bold tracking-tight">Hawk Coin</h2>
            <p class="text-white/55 text-sm text-center max-w-[220px] leading-relaxed">
              Schiebe Münzen über die Kante —<br>was fällt, ist dein Gewinn!
            </p>
            <button
              class="mt-1 px-8 py-3 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-bold rounded-xl text-lg transition-all"
              @click="startGame"
            >Spielen</button>
          </div>
        </Transition>

        <!-- Game over overlay -->
        <Transition name="fade">
          <div v-if="phase === 'over'"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
            <div class="text-5xl">🏆</div>
            <h2 class="text-white text-xl font-bold">Runde beendet!</h2>
            <div class="text-center">
              <div class="text-yellow-400 text-4xl font-bold tabular-nums">{{ won }}</div>
              <div class="text-white/50 text-sm mt-0.5">Münzen gewonnen</div>
            </div>
            <div v-if="lastReward" class="flex gap-6 mt-1">
              <div class="text-center">
                <div class="text-yellow-300 font-bold text-lg">+{{ lastReward.coins }}</div>
                <div class="text-white/40 text-xs">🪙 Coins</div>
              </div>
              <div v-if="lastReward.diamonds > 0" class="text-center">
                <div class="text-cyan-300 font-bold text-lg">+{{ lastReward.diamonds }}</div>
                <div class="text-white/40 text-xs">💎 Diamanten</div>
              </div>
            </div>
            <button
              class="mt-2 px-8 py-3 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-bold rounded-xl text-lg transition-all"
              @click="startGame"
            >Nochmal</button>
          </div>
        </Transition>
      </div>

      <!-- Hint -->
      <div v-if="phase === 'playing'" class="text-center text-white/35 text-xs leading-relaxed">
        Klicke auf die bewegte Platte um eine Münze einzuwerfen
        <br>
        <button
          class="mt-1 text-white/25 hover:text-white/50 underline text-xs transition-colors"
          @click="endGame"
        >Runde beenden</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
