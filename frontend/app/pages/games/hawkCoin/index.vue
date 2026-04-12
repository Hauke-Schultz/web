<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'
import GamesHeader from '~/components/games/GamesHeader.vue'

const { t } = useI18n()
definePageMeta({ hideHeader: true })
useHead({ title: 'Hawk Coin' })

// ── Config ────────────────────────────────────────────────
const W              = 360
const H              = 520
const COIN_R         = 13
const PLATFORM_W     = W - 24       // 336px — slightly narrower than canvas
const PLATFORM_H     = 22
const PLATFORM_Y_MIN = 140          // top (backward)
const PLATFORM_Y_MAX = H - 70       // 450 — forward (near exit)
const PLATFORM_SPEED = 62           // px/sec
const START_BUDGET   = 30
const DROP_ZONE_H    = 60           // interactive drop area at top
const PRE_SPAWN      = 12           // coins pre-loaded at game start
const EXIT_Y         = H + COIN_R + 4  // coins below this = win

// ── Canvas ────────────────────────────────────────────────
const canvasEl = ref(null)
let ctx        = null
let raf        = null
let lastNow    = 0

// ── Matter.js refs ────────────────────────────────────────
let MEngine, MBodies, MBody, MComposite
let engine, world, platformBody
let coins = []   // { body, color }

// ── Platform motion ───────────────────────────────────────
let platformY   = (PLATFORM_Y_MIN + PLATFORM_Y_MAX) / 2
let platformDir = 1   // 1 = down (forward), -1 = up (backward)

// ── Reactive state ────────────────────────────────────────
const phase      = ref('idle')
const budget     = ref(START_BUDGET)
const wonCoins   = ref(0)
const highScore  = ref(0)
const headerRef  = ref(null)
const dropX      = ref(W / 2)
const lastReward = ref(null)
let   endTimer   = null

// ── Lifecycle ─────────────────────────────────────────────
onMounted(() => {
  const data = loadHawk3Data()
  highScore.value = data.games.hawkCoin?.highScore ?? 0
  setupCanvas()
  drawIdleFrame()
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  clearTimeout(endTimer)
  if (engine) MEngine.clear(engine)
})

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1
  canvasEl.value.width  = W * dpr
  canvasEl.value.height = H * dpr
  ctx = canvasEl.value.getContext('2d')
  ctx.scale(dpr, dpr)
}

// ── Start ─────────────────────────────────────────────────
async function startGame() {
  clearTimeout(endTimer)
  cancelAnimationFrame(raf)

  const Matter = await import('matter-js')
  MEngine    = Matter.Engine
  MBodies    = Matter.Bodies
  MBody      = Matter.Body
  MComposite = Matter.Composite

  if (engine) MEngine.clear(engine)
  engine = MEngine.create({ gravity: { y: 2.2 } })
  world  = engine.world
  coins  = []
  platformY   = (PLATFORM_Y_MIN + PLATFORM_Y_MAX) / 2
  platformDir = 1
  budget.value     = START_BUDGET
  wonCoins.value   = 0
  lastReward.value = null
  phase.value      = 'playing'

  // Static walls (left + right — no bottom wall so coins can exit)
  const wallOpts = { isStatic: true, friction: 0.4, restitution: 0.15, label: 'wall' }
  const wallL = MBodies.rectangle(-20, H / 2, 40, H * 3, wallOpts)
  const wallR = MBodies.rectangle(W + 20, H / 2, 40, H * 3, wallOpts)

  // Kinematic platform
  platformBody = MBodies.rectangle(W / 2, platformY, PLATFORM_W, PLATFORM_H, {
    isStatic:    true,
    friction:    0.55,
    restitution: 0.1,
    label:       'platform',
  })

  MComposite.add(world, [wallL, wallR, platformBody])

  // Pre-spawn some coins above & on the platform
  for (let i = 0; i < PRE_SPAWN; i++) {
    const x = 20 + Math.random() * (W - 40)
    const y = PLATFORM_Y_MIN - 20 - Math.random() * 120
    spawnCoin(x, y)
  }

  lastNow = performance.now()
  raf = requestAnimationFrame(loop)
}

function spawnCoin(x, y) {
  const body = MBodies.circle(x, y, COIN_R, {
    restitution: 0.22,
    friction:    0.55,
    frictionAir: 0.007,
    label:       'coin',
    density:     0.003,
  })
  coins.push({ body, color: pickColor() })
  MComposite.add(world, body)
}

// ── Drop ──────────────────────────────────────────────────
function dropCoin() {
  if (phase.value !== 'playing' || budget.value <= 0) return
  budget.value--
  spawnCoin(dropX.value, DROP_ZONE_H - COIN_R * 2)
  if (budget.value === 0) {
    endTimer = setTimeout(endGame, 2800)
  }
}

// ── Exit detection ────────────────────────────────────────
function collectExits() {
  for (const c of [...coins]) {
    if (c.body.position.y > EXIT_Y) {
      MComposite.remove(world, c.body)
      coins = coins.filter(x => x !== c)
      wonCoins.value++
    }
  }
}

// ── End game ──────────────────────────────────────────────
function endGame() {
  if (phase.value !== 'playing') return
  phase.value = 'over'
  cancelAnimationFrame(raf)

  const rewardCoins    = wonCoins.value * 2
  const rewardDiamonds = Math.floor(wonCoins.value / 50)
  lastReward.value     = { coins: rewardCoins, diamonds: rewardDiamonds }

  const data = loadHawk3Data()
  if (!data.games.hawkCoin) {
    data.games.hawkCoin = { highScore: 0, gamesPlayed: 0, totalCoinsWon: 0, totalCoinsSpent: 0, bestNetWin: 0 }
  }
  const hc = data.games.hawkCoin
  hc.gamesPlayed     = (hc.gamesPlayed     ?? 0) + 1
  hc.totalCoinsWon   = (hc.totalCoinsWon   ?? 0) + wonCoins.value
  hc.totalCoinsSpent = (hc.totalCoinsSpent ?? 0) + START_BUDGET
  if (wonCoins.value > (hc.highScore ?? 0)) hc.highScore = wonCoins.value
  const netWin = wonCoins.value - START_BUDGET
  if (netWin > (hc.bestNetWin ?? -9999)) hc.bestNetWin = netWin
  data.player.coins    = (data.player.coins    ?? 0) + rewardCoins
  data.player.diamonds = (data.player.diamonds ?? 0) + rewardDiamonds
  saveHawk3Data(data)
  headerRef.value?.refresh()
  highScore.value = hc.highScore

  render()
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
  // Advance platform position
  platformY += platformDir * PLATFORM_SPEED * dt
  if (platformY >= PLATFORM_Y_MAX) { platformY = PLATFORM_Y_MAX; platformDir = -1 }
  if (platformY <= PLATFORM_Y_MIN) { platformY = PLATFORM_Y_MIN; platformDir  =  1 }

  // Apply kinematic position — Matter.js resolves overlaps by pushing coins
  MBody.setPosition(platformBody, { x: W / 2, y: platformY })
  // Hint velocity so collision response pushes in the right direction
  MBody.setVelocity(platformBody, { x: 0, y: platformDir * PLATFORM_SPEED * dt * 60 })

  MEngine.update(engine, dt * 1000)
  collectExits()
}

// ── Render ────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H)
  drawBg()
  drawDropZone()
  drawExitGlow()
  drawCoins()
  drawPlatform()
  if (phase.value === 'playing' && budget.value > 0) drawGhost()
}

function drawIdleFrame() {
  if (!ctx) return
  drawBg()
  drawDropZone()
  drawExitGlow()
  drawPlatformAt((PLATFORM_Y_MIN + PLATFORM_Y_MAX) / 2)
}

function drawBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0d0d1a')
  g.addColorStop(1, '#1a1a2e')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(255,255,255,0.025)'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 36) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y < H; y += 36) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
}

function drawDropZone() {
  ctx.fillStyle = 'rgba(255,255,255,0.025)'
  ctx.fillRect(0, 0, W, DROP_ZONE_H)
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, DROP_ZONE_H); ctx.lineTo(W, DROP_ZONE_H); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.font = 'bold 10px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('▼  EINWURF', W / 2, 20)
}

function drawExitGlow() {
  const g = ctx.createLinearGradient(0, H - 50, 0, H)
  g.addColorStop(0, 'rgba(234,179,8,0)')
  g.addColorStop(1, 'rgba(234,179,8,0.28)')
  ctx.fillStyle = g
  ctx.fillRect(0, H - 50, W, 50)

  ctx.strokeStyle = 'rgba(234,179,8,0.45)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath(); ctx.moveTo(0, H - 2); ctx.lineTo(W, H - 2); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(234,179,8,0.55)'
  ctx.font = 'bold 9px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('↓  GEWINN-KANTE', W / 2, H - 5)
}

function drawPlatform() { drawPlatformAt(platformY) }

function drawPlatformAt(y) {
  const x  = (W - PLATFORM_W) / 2
  const hy = y - PLATFORM_H / 2

  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillRect(x + 3, hy + 6, PLATFORM_W, PLATFORM_H)

  const g = ctx.createLinearGradient(0, hy, 0, hy + PLATFORM_H)
  g.addColorStop(0, '#c4b5fd')
  g.addColorStop(0.5, '#8b5cf6')
  g.addColorStop(1, '#6d28d9')
  ctx.fillStyle = g
  ctx.fillRect(x, hy, PLATFORM_W, PLATFORM_H)

  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.fillRect(x, hy, PLATFORM_W, 4)

  ctx.strokeStyle = 'rgba(167,139,250,0.55)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(x, hy, PLATFORM_W, PLATFORM_H)
}

function drawCoins() {
  for (const c of coins) {
    const { x, y } = c.body.position
    if (y < -30 || y > H + 30) continue

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(c.body.angle)

    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur  = 5

    ctx.beginPath()
    ctx.arc(0, 0, COIN_R, 0, Math.PI * 2)
    const g = ctx.createRadialGradient(-COIN_R * 0.35, -COIN_R * 0.35, 1, 0, 0, COIN_R)
    g.addColorStop(0, lighten(c.color, 65))
    g.addColorStop(1, c.color)
    ctx.fillStyle = g
    ctx.fill()

    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.font = `bold ${COIN_R + 1}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('¢', 0, 1)

    ctx.restore()
  }
}

function drawGhost() {
  const x = dropX.value
  const y = DROP_ZONE_H - COIN_R - 5

  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.arc(x, y, COIN_R, 0, Math.PI * 2)
  ctx.fillStyle = '#EAB308'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.1
  ctx.strokeStyle = '#EAB308'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 5])
  ctx.beginPath()
  ctx.moveTo(x, DROP_ZONE_H)
  ctx.lineTo(x, H - 10)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

// ── Input ─────────────────────────────────────────────────
function updateDropX(clientX) {
  const rect = canvasEl.value.getBoundingClientRect()
  const x    = (clientX - rect.left) * (W / rect.width)
  dropX.value = Math.max(COIN_R + 4, Math.min(W - COIN_R - 4, x))
}

function onMouseMove(e) {
  if (phase.value !== 'playing') return
  updateDropX(e.clientX)
}

function onClick(e) {
  if (phase.value !== 'playing') return
  updateDropX(e.clientX)
  dropCoin()
}

function onTouchMove(e) {
  e.preventDefault()
  if (phase.value !== 'playing') return
  updateDropX(e.touches[0].clientX)
}

function onTouchEnd(e) {
  e.preventDefault()
  if (phase.value !== 'playing') return
  updateDropX(e.changedTouches[0].clientX)
  dropCoin()
}

// ── Utils ─────────────────────────────────────────────────
const COIN_COLORS = ['#D97706', '#B45309', '#92400E', '#CA8A04', '#A16207']
function pickColor() { return COIN_COLORS[Math.floor(Math.random() * COIN_COLORS.length)] }

function lighten(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (n >> 16)        + amount)
  const g = Math.min(255, ((n >> 8) & 0xFF) + amount)
  const b = Math.min(255, (n & 0xFF)        + amount)
  return `rgb(${r},${g},${b})`
}
</script>

<template>
  <div class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-4 px-4 select-none">
    <div class="max-w-[420px] mx-auto flex flex-col gap-5">

      <!-- Header -->
      <GamesHeader ref="headerRef" title="🪙 Hawk Coin" />

      <!-- Stats -->
      <div class="flex gap-3">
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.coin.budget') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ budget }}</div>
        </div>
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.coin.won') }}</div>
          <div class="text-xl font-bold tabular-nums text-yellow-400">{{ wonCoins }}</div>
        </div>
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.coin.best') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ highScore }}</div>
        </div>
      </div>

      <!-- Canvas -->
      <div
        class="relative rounded-2xl overflow-hidden mx-auto border border-white/10"
        style="width: 360px; height: 520px;"
      >
        <canvas
          ref="canvasEl"
          style="width: 360px; height: 520px; display: block; touch-action: none; cursor: crosshair;"
          @mousemove="onMouseMove"
          @click="onClick"
          @touchmove.prevent="onTouchMove"
          @touchend.prevent="onTouchEnd"
        />

        <!-- Start overlay -->
        <Transition name="fade">
          <div
            v-if="phase === 'idle'"
            class="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-5"
          >
            <h2 class="text-2xl font-bold text-white">🪙 Hawk Coin</h2>
            <p class="text-white/60 text-sm text-center leading-relaxed px-8">
              {{ t('games.coin.instructions') }}
            </p>
            <button
              class="px-10 py-3 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
              @click.stop="startGame"
            >{{ t('games.coin.start') }}</button>
          </div>
        </Transition>

        <!-- Game Over overlay -->
        <Transition name="fade">
          <div
            v-if="phase === 'over'"
            class="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-5"
          >
            <h2 class="text-2xl font-bold text-white">{{ t('games.coin.game_over') }}</h2>
            <div class="text-center text-white space-y-1">
              <div class="text-xs uppercase tracking-widest opacity-60">{{ t('games.coin.won') }}</div>
              <div class="text-5xl font-bold tabular-nums text-yellow-400">{{ wonCoins }}</div>
              <div class="text-sm opacity-50 pt-1">{{ t('games.coin.best') }}: {{ highScore }}</div>
            </div>
            <div v-if="lastReward" class="flex gap-3">
              <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[72px]">
                <div class="text-xs opacity-50 mb-0.5">{{ t('games.coin.reward_coins') }}</div>
                <div class="text-lg font-bold">+{{ lastReward.coins }}</div>
              </div>
              <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[72px]">
                <div class="text-xs opacity-50 mb-0.5">{{ t('games.coin.reward_diamonds') }}</div>
                <div class="text-lg font-bold">+{{ lastReward.diamonds }}</div>
              </div>
            </div>
            <button
              class="px-10 py-3 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
              @click.stop="startGame"
            >{{ t('games.coin.play_again') }}</button>
          </div>
        </Transition>
      </div>

      <!-- Playing footer -->
      <div v-if="phase === 'playing'" class="flex items-center justify-between">
        <div class="text-white/40 text-sm">
          {{ budget > 0
            ? t('games.coin.coins_left', { n: budget })
            : t('games.coin.settling') }}
        </div>
        <button
          class="py-2 px-5 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-sm font-medium rounded-xl transition-colors"
          @click="startGame"
        >↺ {{ t('games.coin.restart') }}</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
