<script setup>
import { ref, computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { FRUIT_TYPES, PHYSICS_CONFIG, BOMB_FRUIT_CONFIG, MOLD_FRUIT_CONFIG } from './hawkFruitConfig.js'
const { locale } = useI18n()

definePageMeta({ hideHeader: true })

// ── Board constants ───────────────────────────────────────
const BOARD_W  = 320
const BOARD_H  = 480
const WALL_T   = 10
const DANGER_Y = 60   // y-threshold: fruits above here = game over risk
const DROP_Y   = 28   // y where fruit spawns

// ── Fruit helpers ─────────────────────────────────────────
const FRUIT_LIST    = Object.values(FRUIT_TYPES).sort((a, b) => a.index - b.index)
const DROPPABLE     = FRUIT_LIST.filter(f => f.index <= 5)
const toDataUrl     = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`
const clamp         = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// ── Special fruit shorthands (from config) ────────────────
const BOMB = FRUIT_TYPES.BOMB_FRUIT
const MOLD = FRUIT_TYPES.MOLD_FRUIT

// Shrink rate derived from lifespan: fruit goes from full radius to minRadius over lifespan ms
const MOLD_SHRINK_PER_FRAME =
  (MOLD.radius - MOLD_FRUIT_CONFIG.minRadius) / (MOLD_FRUIT_CONFIG.lifespan / 1000 * 60)

const moldHitCooldown = new Map() // fruitId → timestamp, throttles shrink-on-hit

let lastBombTime = -Infinity

// ── Bomb state (declared before randomDrop so it can reference bombActive) ──
const bombActive      = ref(false)
const bombId          = ref(null)
const bombFuseEnd     = ref(0)
const bombFuseLeft    = ref(0)   // seconds remaining, for display
const screenShaking   = ref(false)

const randomDrop = () => {
  const now = Date.now()
  if (
    !bombActive.value &&
    now - lastBombTime > BOMB_FRUIT_CONFIG.minSpawnDelay &&
    Math.random() < BOMB_FRUIT_CONFIG.spawnChance
  ) return BOMB
  if (Math.random() < MOLD_FRUIT_CONFIG.spawnChance) return MOLD
  return DROPPABLE[Math.floor(Math.random() * DROPPABLE.length)]
}

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
const particles       = ref([])
const comboCount      = ref(0)
const comboFlashes    = ref([])

// ── Matter.js refs ────────────────────────────────────────
let M           = null
let engine      = null
let runner      = null
let fruitCtr    = 0
let particleCtr = 0
let comboCtr    = 0
let comboTimer  = null
const bodyMap   = new Map()  // Matter body.id → our fruit.id
const merging   = new Set()  // fruit ids pending merge

// ── Combo system ──────────────────────────────────────────
const COMBO_COLORS = ['#feca57', '#ff9f43', '#ff6b6b', '#ff9ff3', '#48dbfb', '#1dd1a1', '#f093fb', '#a29bfe']

const COMBO_TEXTS = {
  de: {
    1:  ['Lecker! 🍓', 'Frisch! 🍋', 'Saftig! 🍊', 'Süß! 🍇', 'Knackig! 🍎', 'Yummy! 🫐', 'Frucht! 🍑', 'Reif! 🍌'],
    3:  ['Combo! 🎯', 'Doppelt hält! ✌️', 'Mehr davon! 🔥', 'Weiter so! 💪', 'Heiß! 🌶️', 'Treffer! 💥'],
    5:  ['5x Combo! 🔥', 'On Fire! 🌶️', 'Saftig heiß! 🍓🔥', 'Wahnsinn! ⚡', 'Fruchtig! 🍊💥', 'Bombe! 💣'],
    8:  ['8x COMBO! 🚀', 'Mega Ernte! 🌽', 'Frucht-Gott! 🍉', 'Unaufhaltsam! ⚡', 'Fantastisch! 🌟', 'Stark! 💪'],
    12: ['12x MEGA! 🎆', 'Obstsalat! 🥗', 'Frucht-Titan! 🏆', 'EPISCH! 💥', 'Frucht-Legende! 🌟', 'BOOM! 💥'],
    15: ['15x ULTRA! 🌈', 'Frucht-König! 👑', 'Obst-Wahnsinn! 🦁', 'INSANE! 🎊', 'Unglaublich! 🌠', 'Krass! 🤯'],
    20: ['20x GIGANTISCH! 🦖', 'FRUCHT-GOTT! 🌋', 'EPISCH! ⚔️', 'Obstwunder! 🌟', 'VERRÜCKT! 🤯', 'Titanisch! 🗿'],
    30: ['30x GÖTTLICH! 🌌', 'UNFASSBAR! 🐉', 'Frucht-Meister! 🦄', 'LEGENDÄR! 👼', 'KOSMISCH! 🌠', 'DER BESTE! 👑'],
  },
  en: {
    1:  ['Tasty! 🍓', 'Fresh! 🍋', 'Juicy! 🍊', 'Sweet! 🍇', 'Crispy! 🍎', 'Yummy! 🫐', 'Fruity! 🍑', 'Ripe! 🍌'],
    3:  ['Combo! 🎯', 'Double up! ✌️', 'More! 🔥', 'Keep going! 💪', 'Hot! 🌶️', 'Hit! 💥'],
    5:  ['5x Combo! 🔥', 'On Fire! 🌶️', 'Juicy hot! 🍓🔥', 'Insane! ⚡', 'Fruity! 🍊💥', 'Bomb! 💣'],
    8:  ['8x COMBO! 🚀', 'Mega Harvest! 🌽', 'Fruit God! 🍉', 'Unstoppable! ⚡', 'Fantastic! 🌟', 'Strong! 💪'],
    12: ['12x MEGA! 🎆', 'Fruit Salad! 🥗', 'Fruit Titan! 🏆', 'EPIC! 💥', 'Fruit Legend! 🌟', 'BOOM! 💥'],
    15: ['15x ULTRA! 🌈', 'Fruit King! 👑', 'Fruit Madness! 🦁', 'INSANE! 🎊', 'Unbelievable! 🌠', 'Crazy! 🤯'],
    20: ['20x GIGANTIC! 🦖', 'FRUIT GOD! 🌋', 'EPIC! ⚔️', 'Fruit Wonder! 🌟', 'CRAZY! 🤯', 'Titanic! 🗿'],
    30: ['30x DIVINE! 🌌', 'UNREAL! 🐉', 'Fruit Master! 🦄', 'LEGENDARY! 👼', 'COSMIC! 🌠', 'THE BEST! 👑'],
  },
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const getComboTier = (c) => {
  if (c >= 30) return { key: 30, size: 'huge' }
  if (c >= 20) return { key: 20, size: 'huge' }
  if (c >= 15) return { key: 15, size: 'large' }
  if (c >= 12) return { key: 12, size: 'large' }
  if (c >=  8) return { key: 8,  size: 'medium' }
  if (c >=  5) return { key: 5,  size: 'medium' }
  if (c >=  3) return { key: 3,  size: 'small' }
  return           { key: 1,  size: 'normal' }
}

const triggerCombo = () => {
  comboCount.value++
  if (comboTimer) clearTimeout(comboTimer)
  comboTimer = setTimeout(() => { comboCount.value = 0 }, 2500)

  const { key, size } = getComboTier(comboCount.value)
  const lang  = locale.value === 'de' ? 'de' : 'en'
  const text  = pick(COMBO_TEXTS[lang][key])
  const color = pick(COMBO_COLORS)
  const id    = comboCtr++

  // Always center horizontally, float up from middle of board
  comboFlashes.value = [...comboFlashes.value, {
    id,
    x: BOARD_W / 2,
    y: BOARD_H * 0.45,
    text, color, size,
  }]
  setTimeout(() => {
    comboFlashes.value = comboFlashes.value.filter(f => f.id !== id)
  }, 1000)
}

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
  const cfg  = FRUIT_TYPES[typeName] ?? null
  if (!cfg) return null
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
    isBomb: !!cfg.isBomb,
    isMold: !!cfg.isMold,
    moldRadius: cfg.isMold ? cfg.radius : undefined,
  }]
  return id
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
  const typeName = cfg.type
  const id  = spawnFruit(typeName, x, DROP_Y)

  if (cfg.isBomb) {
    bombId.value      = id
    bombActive.value  = true
    bombFuseEnd.value = Date.now() + BOMB_FRUIT_CONFIG.fuseTime
    lastBombTime      = Date.now()
  }

  nextFruitType.value = nextNextFruit.value
  nextNextFruit.value = randomDrop()
  setTimeout(() => { canDrop.value = true }, PHYSICS_CONFIG.dropCooldown)
}

// ── Merge particles ───────────────────────────────────────
const spawnMergeEffect = (x, y, color, radius) => {
  const COUNT    = 12
  const newBatch = []

  // Burst particles
  for (let i = 0; i < COUNT; i++) {
    const angle    = (Math.PI * 2 * i) / COUNT + (Math.random() - 0.5) * 0.4
    const dist     = radius * 1.0 + Math.random() * radius * 1.2
    const size     = 4 + Math.random() * 5
    const duration = 380 + Math.random() * 220
    const id       = particleCtr++

    newBatch.push({ id, x, y, tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, color, size, duration, isRing: false })
    setTimeout(() => { particles.value = particles.value.filter(p => p.id !== id) }, duration)
  }

  // Expanding ring
  const ringId       = particleCtr++
  const ringDuration = 420
  newBatch.push({ id: ringId, x, y, tx: 0, ty: 0, color, size: radius * 2, duration: ringDuration, isRing: true })
  setTimeout(() => { particles.value = particles.value.filter(p => p.id !== ringId) }, ringDuration)

  particles.value = [...particles.value, ...newBatch]
}

// ── Bomb explosion ────────────────────────────────────────
const triggerScreenShake = () => {
  screenShaking.value = true
  setTimeout(() => { screenShaking.value = false }, BOMB_FRUIT_CONFIG.screenShakeDuration)
}

const explodeBomb = () => {
  const bomb = fruits.value.find(f => f.id === bombId.value)
  bombActive.value = false
  bombId.value     = null

  const bx = bomb ? bomb.x : BOARD_W / 2
  const by = bomb ? bomb.y : BOARD_H / 2
  const r  = BOMB_FRUIT_CONFIG.explosionRadius

  // Explosion particles (bigger burst)
  spawnMergeEffect(bx, by, '#FF4444', r * 0.8)
  spawnMergeEffect(bx, by, '#FFD700', r * 0.5)

  if (bomb) removeFruit(bomb.id)

  // Destroy all fruits in radius
  const victims = fruits.value.filter(f => {
    if (merging.has(f.id)) return false
    const dx = f.x - bx, dy = f.y - by
    return dx * dx + dy * dy <= r * r
  })
  for (const f of victims) removeFruit(f.id)
  score.value += victims.length * BOMB_FRUIT_CONFIG.bonusPerFruit

  triggerScreenShake()
}

// ── Mold shrink ───────────────────────────────────────────
const shrinkMold = (id, amount) => {
  const idx = fruits.value.findIndex(f => f.id === id)
  if (idx === -1) return
  const f    = fruits.value[idx]
  const newR = f.moldRadius - amount
  if (newR <= MOLD_FRUIT_CONFIG.minRadius) {
    spawnMergeEffect(f.x, f.y, MOLD.sparkleColor, f.moldRadius)
    removeFruit(id)
    moldHitCooldown.delete(id)
    return
  }
  const scale = newR / f.moldRadius
  M.Body.scale(f.body, scale, scale)
  const updated = [...fruits.value]
  updated[idx] = { ...f, moldRadius: newR, radius: newR }
  fruits.value = updated
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
    if (!fA || !fB) continue
    if (fA.isBomb || fB.isBomb) continue  // bombs don't merge

    // Mold shrinks on hit, never merges
    if (fA.isMold || fB.isMold) {
      const now = Date.now()
      for (const mf of [fA, fB]) {
        if (!mf.isMold) continue
        if (moldHitCooldown.has(mf.id) && now - moldHitCooldown.get(mf.id) < MOLD_FRUIT_CONFIG.hitCooldown) continue
        moldHitCooldown.set(mf.id, now)
        shrinkMold(mf.id, MOLD_FRUIT_CONFIG.shrinkOnHit)
      }
      continue
    }

    if (fA.type !== fB.type) continue

    const cfg = FRUIT_TYPES[fA.type]
    if (!cfg?.nextType || !FRUIT_TYPES[cfg.nextType]) continue

    merging.add(idA)
    merging.add(idB)

    const mx = (bodyA.position.x + bodyB.position.x) / 2
    const my = (bodyA.position.y + bodyB.position.y) / 2

    // Particles + combo at merge point
    spawnMergeEffect(mx, my, cfg.sparkleColor, cfg.radius)
    triggerCombo()

    setTimeout(() => {
      removeFruit(idA)
      removeFruit(idB)
      merging.delete(idA)
      merging.delete(idB)
      const nextR = FRUIT_TYPES[cfg.nextType].radius
      spawnFruit(cfg.nextType, mx, clamp(my, nextR, BOARD_H - nextR))
      score.value += cfg.scoreValue

      // Wake up all sleeping fruits near the merge point so they
      // fall/roll into the gap left by the removed bodies
      const wakeR = cfg.radius * 6
      const wakeR2 = wakeR * wakeR
      for (const f of fruits.value) {
        if (merging.has(f.id)) continue
        const dx = f.body.position.x - mx
        const dy = f.body.position.y - my
        if (dx * dx + dy * dy < wakeR2) {
          M.Sleeping.set(f.body, false)
        }
      }
    }, PHYSICS_CONFIG.popEffect.delay)
  }
}

// ── Game loop (sync physics → Vue) ───────────────────────
let animFrame    = null
let gameOverTimer = null

const gameLoop = () => {
  // Sync positions + shrink molt fruits
  const moldExpired = []
  fruits.value = fruits.value.map(f => {
    const base = { ...f, x: f.body.position.x, y: f.body.position.y, angle: f.body.angle }
    if (!f.isMold) return base
    const newR = f.moldRadius - MOLD_SHRINK_PER_FRAME
    if (newR <= MOLD_FRUIT_CONFIG.minRadius) { moldExpired.push(f); return base }
    const scale = newR / f.moldRadius
    M.Body.scale(f.body, scale, scale)
    return { ...base, moldRadius: newR, radius: newR }
  })
  for (const f of moldExpired) {
    spawnMergeEffect(f.x, f.y, MOLD.sparkleColor, f.radius)
    removeFruit(f.id)
    moldHitCooldown.delete(f.id)
  }

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

  // Bomb fuse countdown
  if (bombActive.value && bombId.value !== null) {
    const remaining = bombFuseEnd.value - Date.now()
    bombFuseLeft.value = Math.max(0, Math.ceil(remaining / 1000))
    if (remaining <= 0) explodeBomb()
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
  fruits.value       = []
  particles.value    = []
  comboFlashes.value = []
  comboCount.value   = 0
  if (comboTimer) { clearTimeout(comboTimer); comboTimer = null }
  bombActive.value   = false
  bombId.value       = null
  bombFuseLeft.value = 0
  lastBombTime       = -Infinity
  moldHitCooldown.clear()
  score.value        = 0
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
  <div class="flex flex-col items-center min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-6 px-4 select-none">

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
      <!-- Combo badge (only when active) -->
      <Transition name="combo-pop">
        <div
          v-if="comboCount >= 2"
          class="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white text-center min-w-[60px]"
        >
          <div class="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Combo</div>
          <div class="text-2xl font-bold tabular-nums" style="color: #feca57; text-shadow: 0 0 12px #feca5780;">
            {{ comboCount }}x
          </div>
        </div>
      </Transition>
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
      :class="[
        gameState === 'playing' ? 'cursor-crosshair' : 'cursor-default',
        screenShaking ? 'screen-shake' : '',
      ]"
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

      <!-- Bomb: explosion radius preview + fuse countdown -->
      <template v-if="bombActive && bombId !== null">
        <template v-for="f in fruits" :key="`bomb-overlay-${f.id}`">
          <template v-if="f.isBomb">
            <!-- Explosion radius ring -->
            <div
              class="absolute rounded-full pointer-events-none border-2 border-dashed border-red-400/40"
              :class="bombFuseLeft <= 3 ? 'border-red-400/70' : 'border-orange-400/40'"
              :style="{
                left:   `${f.x}px`,
                top:    `${f.y}px`,
                width:  `${BOMB_FRUIT_CONFIG.explosionRadius * 2}px`,
                height: `${BOMB_FRUIT_CONFIG.explosionRadius * 2}px`,
                transform: 'translate(-50%, -50%)',
              }"
            />
            <!-- Fuse countdown above bomb -->
            <div
              class="absolute pointer-events-none font-black text-white text-center leading-none"
              :class="bombFuseLeft <= 3 ? 'text-red-400' : 'text-orange-300'"
              :style="{
                left:      `${f.x}px`,
                top:       `${f.y - f.radius - 18}px`,
                transform: 'translateX(-50%)',
                fontSize:  '18px',
                textShadow: bombFuseLeft <= 3 ? '0 0 12px #ff444488' : '0 0 8px #ff990088',
                zIndex: 12,
              }"
            >{{ bombFuseLeft }}</div>
          </template>
        </template>
      </template>

      <!-- Combo floating texts -->
      <div
        v-for="f in comboFlashes"
        :key="f.id"
        class="floating-number"
        :class="`size-${f.size}`"
        :style="{
          left:       `${f.x}px`,
          top:        `${f.y}px`,
          color:      f.color,
          textShadow: `0 0 18px ${f.color}99`,
          zIndex:     15,
          pointerEvents: 'none',
        }"
      >{{ f.text }}</div>

      <!-- Merge particles -->
      <div
        v-for="p in particles"
        :key="p.id"
        class="absolute pointer-events-none rounded-full"
        :style="p.isRing ? {
          left:      `${p.x}px`,
          top:       `${p.y}px`,
          width:     `${p.size}px`,
          height:    `${p.size}px`,
          border:    `2px solid ${p.color}`,
          boxShadow: `0 0 6px ${p.color}`,
          transform: 'translate(-50%, -50%)',
          animation: `merge-ring ${p.duration}ms ease-out forwards`,
        } : {
          left:      `${p.x}px`,
          top:       `${p.y}px`,
          width:     `${p.size}px`,
          height:    `${p.size}px`,
          background: p.color,
          boxShadow: `0 0 4px ${p.color}`,
          transform: 'translate(-50%, -50%)',
          '--tx':    `${p.tx}px`,
          '--ty':    `${p.ty}px`,
          animation: `merge-burst ${p.duration}ms ease-out forwards`,
        }"
      />

      <!-- Fruits -->
      <img
        v-for="fruit in fruits"
        :key="fruit.id"
        :src="toDataUrl(FRUIT_TYPES[fruit.type]?.svg ?? '')"
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

<style>
/* Game over overlay transition (must be global for <Transition>) */
.fade-enter-active,
.fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }

/* Combo badge pop-in */
.combo-pop-enter-active { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.combo-pop-leave-active { transition: all 0.2s ease-in; }
.combo-pop-enter-from,
.combo-pop-leave-to     { opacity: 0; transform: scale(0.6); }

/* Merge burst: particle flies outward and shrinks */
@keyframes merge-burst {
  0%   { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0); opacity: 0; }
}

/* Merge ring: expands and fades */
@keyframes merge-ring {
  0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; }
  60%  { opacity: 0.6; }
  100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
}

/* Screen shake */
@keyframes screen-shake {
  0%   { transform: translate(0, 0) rotate(0deg); }
  15%  { transform: translate(-5px, -4px) rotate(-1deg); }
  30%  { transform: translate(5px, 3px) rotate(1deg); }
  45%  { transform: translate(-4px, 5px) rotate(-0.5deg); }
  60%  { transform: translate(4px, -3px) rotate(0.5deg); }
  75%  { transform: translate(-3px, 2px) rotate(-0.3deg); }
  90%  { transform: translate(2px, -2px) rotate(0.2deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}

.screen-shake {
  animation: screen-shake 0.45s ease-out;
}
</style>
