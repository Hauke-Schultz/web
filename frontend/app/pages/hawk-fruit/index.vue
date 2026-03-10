<script setup>
import { ref, computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { FRUIT_TYPES, PHYSICS_CONFIG } from './hawkFruitConfig.js'

definePageMeta({ hideNav: false })

// ── Board constants ───────────────────────────────────────
const BOARD_W  = 320
const BOARD_H  = 480
const WALL_T   = 10
const DANGER_Y = 60   // y-threshold: fruits above here = game over risk
const DROP_Y   = 28   // y where fruit spawns

// ── Fruit helpers ─────────────────────────────────────────
const FRUIT_LIST    = Object.values(FRUIT_TYPES).sort((a, b) => a.index - b.index)
const DROPPABLE     = FRUIT_LIST.filter(f => f.index <= 5)
const randomDrop    = () => DROPPABLE[Math.floor(Math.random() * DROPPABLE.length)]
const toDataUrl     = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`
const clamp         = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// ── Game state ────────────────────────────────────────────
const fruits          = shallowRef([])
const nextFruitType   = ref(randomDrop())
const nextNextFruit   = ref(randomDrop())
const score           = ref(0)
const highScore       = ref(0)
const gameState       = ref('playing')   // 'playing' | 'gameover'
const dropX           = ref(BOARD_W / 2)
const canDrop         = ref(true)
const isHovering      = ref(false)

// ── Matter.js refs ────────────────────────────────────────
let M           = null
let engine      = null
let runner      = null
let fruitCtr    = 0
const bodyMap   = new Map()  // Matter body.id → our fruit.id
const merging   = new Set()  // fruit ids pending merge

// ── DOM ───────────────────────────────────────────────────
const boardEl = ref(null)

// ── Walls ─────────────────────────────────────────────────
const buildWalls = () => {
  const o = {
    isStatic: true,
    restitution: PHYSICS_CONFIG.walls.restitution,
    friction: PHYSICS_CONFIG.walls.friction,
    frictionStatic: PHYSICS_CONFIG.walls.frictionStatic,
    label: 'wall',
  }
  M.Composite.add(engine.world, [
    // floor
    M.Bodies.rectangle(BOARD_W / 2, BOARD_H + WALL_T / 2, BOARD_W + WALL_T * 4, WALL_T, o),
    // left
    M.Bodies.rectangle(-WALL_T / 2, BOARD_H / 2, WALL_T, BOARD_H * 2, o),
    // right
    M.Bodies.rectangle(BOARD_W + WALL_T / 2, BOARD_H / 2, WALL_T, BOARD_H * 2, o),
  ])
}

// ── Spawn fruit ───────────────────────────────────────────
const spawnFruit = (typeName, x, y) => {
  const cfg  = FRUIT_TYPES[typeName]
  if (!cfg) return
  const id   = fruitCtr++
  const body = M.Bodies.circle(x, y, cfg.radius, {
    restitution:    PHYSICS_CONFIG.fruit.restitution,
    friction:       PHYSICS_CONFIG.fruit.friction,
    frictionAir:    PHYSICS_CONFIG.fruit.frictionAir,
    density:        PHYSICS_CONFIG.fruit.density,
    sleepThreshold: PHYSICS_CONFIG.fruit.sleepThreshold,
    label:          `fruit-${id}`,
    collisionFilter: PHYSICS_CONFIG.fruit.collisionFilter,
  })
  M.Composite.add(engine.world, body)
  bodyMap.set(body.id, id)
  fruits.value = [...fruits.value, {
    id, type: typeName, body,
    x: body.position.x,
    y: body.position.y,
    radius: cfg.radius,
    angle: 0,
  }]
}

// ── Remove fruit ──────────────────────────────────────────
const removeFruit = (id) => {
  const f = fruits.value.find(f => f.id === id)
  if (!f) return
  bodyMap.delete(f.body.id)
  M.Composite.remove(engine.world, f.body)
  fruits.value = fruits.value.filter(f2 => f2.id !== id)
}

// ── Drop ──────────────────────────────────────────────────
const drop = () => {
  if (!canDrop.value || gameState.value !== 'playing') return
  canDrop.value = false
  const cfg = nextFruitType.value
  const x   = clamp(dropX.value, cfg.radius + WALL_T, BOARD_W - cfg.radius - WALL_T)
  spawnFruit(cfg.type, x, DROP_Y)
  nextFruitType.value = nextNextFruit.value
  nextNextFruit.value = randomDrop()
  setTimeout(() => { canDrop.value = true }, PHYSICS_CONFIG.dropCooldown)
}

// ── Merge ─────────────────────────────────────────────────
const onCollision = (event) => {
  for (const pair of event.pairs) {
    const { bodyA, bodyB } = pair
    const idA = bodyMap.get(bodyA.id)
    const idB = bodyMap.get(bodyB.id)
    if (idA == null || idB == null) continue
    if (merging.has(idA) || merging.has(idB)) continue

    const fA = fruits.value.find(f => f.id === idA)
    const fB = fruits.value.find(f => f.id === idB)
    if (!fA || !fB || fA.type !== fB.type) continue

    const cfg = FRUIT_TYPES[fA.type]
    if (!cfg?.nextType || !FRUIT_TYPES[cfg.nextType]) continue

    merging.add(idA)
    merging.add(idB)

    const mx = (bodyA.position.x + bodyB.position.x) / 2
    const my = (bodyA.position.y + bodyB.position.y) / 2

    setTimeout(() => {
      removeFruit(idA)
      removeFruit(idB)
      merging.delete(idA)
      merging.delete(idB)
      const nextR = FRUIT_TYPES[cfg.nextType].radius
      spawnFruit(cfg.nextType, mx, clamp(my, nextR, BOARD_H - nextR))
      score.value += cfg.scoreValue
    }, PHYSICS_CONFIG.popEffect.delay)
  }
}

// ── Game loop (sync physics → Vue) ───────────────────────
let animFrame    = null
let gameOverTimer = null

const gameLoop = () => {
  // Sync positions
  fruits.value = fruits.value.map(f => ({
    ...f,
    x:     f.body.position.x,
    y:     f.body.position.y,
    angle: f.body.angle,
  }))

  // Game-over check: fruits settled above danger line
  if (gameState.value === 'playing') {
    const overLine = fruits.value.filter(
      f => !merging.has(f.id) && f.y - f.radius < DANGER_Y && f.body.speed < 0.5
    )
    if (overLine.length >= PHYSICS_CONFIG.fruitsInDanger) {
      if (!gameOverTimer) {
        gameOverTimer = setTimeout(triggerGameOver, 1500)
      }
    } else if (gameOverTimer) {
      clearTimeout(gameOverTimer)
      gameOverTimer = null
    }
  }

  animFrame = requestAnimationFrame(gameLoop)
}

const triggerGameOver = () => {
  gameState.value = 'gameover'
  M.Runner.stop(runner)
  const saved = parseInt(localStorage.getItem('hawk-fruit-hs') || '0')
  if (score.value > saved) localStorage.setItem('hawk-fruit-hs', String(score.value))
  highScore.value = Math.max(score.value, saved)
}

const restart = () => {
  M.Composite.clear(engine.world)
  bodyMap.clear()
  merging.clear()
  fruits.value = []
  score.value  = 0
  if (gameOverTimer) { clearTimeout(gameOverTimer); gameOverTimer = null }
  buildWalls()
  nextFruitType.value = randomDrop()
  nextNextFruit.value = randomDrop()
  canDrop.value       = true
  gameState.value     = 'playing'
  M.Runner.run(runner, engine)
}

// ── Input ─────────────────────────────────────────────────
const toBoard = (clientX) => {
  if (!boardEl.value) return BOARD_W / 2
  const rect  = boardEl.value.getBoundingClientRect()
  const scale = BOARD_W / rect.width
  return (clientX - rect.left) * scale
}

const onMouseMove  = (e) => { isHovering.value = true;  dropX.value = toBoard(e.clientX) }
const onMouseLeave = ()  => { isHovering.value = false }
const onClick      = (e) => { dropX.value = toBoard(e.clientX); drop() }
const onTouchMove  = (e) => { e.preventDefault(); dropX.value = toBoard(e.touches[0].clientX) }
const onTouchEnd   = (e) => { e.preventDefault(); dropX.value = toBoard(e.changedTouches[0].clientX); drop() }

// ── Computed ──────────────────────────────────────────────
const previewX = computed(() => {
  const r = nextFruitType.value?.radius ?? 20
  return clamp(dropX.value, r + WALL_T, BOARD_W - r - WALL_T)
})

// ── Lifecycle ─────────────────────────────────────────────
onMounted(async () => {
  highScore.value = parseInt(localStorage.getItem('hawk-fruit-hs') || '0')

  M = await import('matter-js')

  engine = M.Engine.create({
    gravity:           PHYSICS_CONFIG.engine.gravity,
    velocityIterations: PHYSICS_CONFIG.engine.velocityIterations,
    positionIterations: PHYSICS_CONFIG.engine.positionIterations,
    enableSleeping:    PHYSICS_CONFIG.engine.enableSleeping,
  })
  runner = M.Runner.create()

  buildWalls()
  M.Events.on(engine, 'collisionStart', onCollision)
  M.Runner.run(runner, engine)
  gameLoop()
})

onUnmounted(() => {
  if (animFrame)  cancelAnimationFrame(animFrame)
  if (runner && M) M.Runner.stop(runner)
  if (engine && M) M.Engine.clear(engine)
  if (gameOverTimer) clearTimeout(gameOverTimer)
})
</script>

<template>
  <div class="flex flex-col items-center min-h-[calc(100dvh-60px)] bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-6 px-4 select-none">

    <!-- HUD: score + next fruits -->
    <div class="flex items-stretch gap-3 mb-4 w-full max-w-[320px]">
      <!-- Score -->
      <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white">
        <div class="text-[10px] uppercase tracking-widest opacity-60">Score</div>
        <div class="text-2xl font-bold tabular-nums">{{ score.toLocaleString() }}</div>
      </div>
      <!-- Best -->
      <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white">
        <div class="text-[10px] uppercase tracking-widest opacity-60">Best</div>
        <div class="text-2xl font-bold tabular-nums">{{ Math.max(score, highScore).toLocaleString() }}</div>
      </div>
      <!-- Next -->
      <div class="bg-white/10 border border-white/10 rounded-xl px-4 py-2 text-white text-center">
        <div class="text-[10px] uppercase tracking-widest opacity-60 mb-1">Next</div>
        <div class="flex items-center gap-2">
          <img v-if="nextFruitType" :src="toDataUrl(nextFruitType.svg)" class="w-9 h-9" alt="" />
          <img v-if="nextNextFruit" :src="toDataUrl(nextNextFruit.svg)" class="w-5 h-5 opacity-50" alt="" />
        </div>
      </div>
    </div>

    <!-- Game board -->
    <div
      ref="boardEl"
      class="relative bg-[#0d0d1a] border-2 border-white/10 rounded-2xl overflow-hidden touch-none"
      :class="gameState === 'playing' ? 'cursor-crosshair' : 'cursor-default'"
      style="width: 320px; height: 480px;"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
      @click="onClick"
      @touchmove.prevent="onTouchMove"
      @touchend.prevent="onTouchEnd"
    >
      <!-- Danger line -->
      <div
        class="absolute inset-x-0 border-t border-dashed border-red-400/30 pointer-events-none z-10"
        :style="{ top: `${DANGER_Y}px` }"
      />

      <!-- Drop preview -->
      <template v-if="isHovering && canDrop && gameState === 'playing' && nextFruitType">
        <!-- Vertical guide line -->
        <div
          class="absolute w-px bg-white/15 pointer-events-none z-10"
          :style="{ left: `${previewX}px`, top: 0, height: `${DANGER_Y - nextFruitType.radius}px` }"
        />
        <!-- Ghost fruit -->
        <img
          :src="toDataUrl(nextFruitType.svg)"
          class="absolute pointer-events-none z-10 opacity-50"
          :style="{
            left:      `${previewX}px`,
            top:       `${DANGER_Y - nextFruitType.radius * 2}px`,
            width:     `${nextFruitType.radius * 2}px`,
            height:    `${nextFruitType.radius * 2}px`,
            transform: 'translateX(-50%)',
          }"
          alt=""
        />
      </template>

      <!-- Fruits -->
      <img
        v-for="fruit in fruits"
        :key="fruit.id"
        :src="toDataUrl(FRUIT_TYPES[fruit.type].svg)"
        class="absolute pointer-events-none"
        :style="{
          left:      `${fruit.x}px`,
          top:       `${fruit.y}px`,
          width:     `${fruit.radius * 2}px`,
          height:    `${fruit.radius * 2}px`,
          transform: `translate(-50%, -50%) rotate(${fruit.angle}rad)`,
        }"
        alt=""
      />

      <!-- Game over overlay -->
      <Transition name="fade">
        <div
          v-if="gameState === 'gameover'"
          class="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6 z-20"
        >
          <h2 class="text-3xl font-bold text-white tracking-wide">Game Over</h2>
          <div class="text-center text-white space-y-1">
            <div class="text-xs uppercase tracking-widest opacity-60">Score</div>
            <div class="text-5xl font-bold tabular-nums">{{ score.toLocaleString() }}</div>
            <div class="text-sm opacity-50 pt-1">Best: {{ Math.max(score, highScore).toLocaleString() }}</div>
          </div>
          <button
            @click.stop="restart"
            class="px-10 py-3 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors text-base"
          >
            Nochmal
          </button>
        </div>
      </Transition>
    </div>

    <!-- Merge chain guide -->
    <div class="mt-5 flex items-center gap-1 flex-wrap justify-center max-w-[320px]">
      <template v-for="(fruit, i) in FRUIT_LIST" :key="fruit.type">
        <img
          :src="toDataUrl(fruit.svg)"
          :title="fruit.type"
          :style="{ width: `${clamp(fruit.radius * 0.55, 16, 38)}px`, height: `${clamp(fruit.radius * 0.55, 16, 38)}px` }"
          alt=""
        />
        <span v-if="i < FRUIT_LIST.length - 1" class="text-white/20 text-xs">→</span>
      </template>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
