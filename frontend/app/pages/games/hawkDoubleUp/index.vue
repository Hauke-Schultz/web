<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'

const { t } = useI18n()

definePageMeta({ layout: 'default' })

useHead({
  title: 'Hawk Double-Up',
  meta: [{ name: 'description', content: 'Verdopple Zahlen und erreiche einen Highscore!' }],
})

// ── Tile colors ───────────────────────────────────────────
const TILE = {
  2:    { bg: '#eee4da', fg: '#776e65' },
  4:    { bg: '#ede0c8', fg: '#776e65' },
  5:    { bg: '#6d6881', fg: '#f9f6f2' },
  6:    { bg: '#6049b6', fg: '#f9f6f2' },
  7:    { bg: '#4c1ff4', fg: '#f9f6f2' },
  8:    { bg: '#f2b179', fg: '#f9f6f2' },
  16:   { bg: '#f59563', fg: '#f9f6f2' },
  32:   { bg: '#f67c5f', fg: '#f9f6f2' },
  64:   { bg: '#f65e3b', fg: '#f9f6f2' },
  128:  { bg: '#edcf72', fg: '#f9f6f2' },
  256:  { bg: '#edcc61', fg: '#f9f6f2' },
  512:  { bg: '#edc850', fg: '#f9f6f2' },
  1024: { bg: '#edc53f', fg: '#f9f6f2' },
  2048: { bg: '#edc22e', fg: '#f9f6f2' },
  4096: { bg: '#3c3a32', fg: '#f9f6f2' },
  8192: { bg: '#000000', fg: '#f9f6f2' },
}

// ── State ─────────────────────────────────────────────────
const grid        = ref(emptyGrid())
const score       = ref(0)
const highScore   = ref(0)
const gamesPlayed = ref(0)
const phase       = ref('idle')    // 'idle' | 'playing' | 'over'
const newCells    = ref([])
const mergeCells  = ref([])
const countdown   = ref(null)      // { row, col, value } — special tile that counts down

function emptyGrid() {
  return Array.from({ length: 4 }, () => Array(4).fill(null))
}

// ── Load ──────────────────────────────────────────────────
onMounted(() => {
  const data = loadHawk3Data()
  highScore.value   = data.games.hawkDoubleUp.highScore   ?? 0
  gamesPlayed.value = data.games.hawkDoubleUp.gamesPlayed ?? 0

  const saved = data.games.hawkDoubleUp.savedGame
  if (saved) {
    grid.value      = saved.grid
    score.value     = saved.score
    countdown.value = saved.countdown ?? null
    phase.value     = 'playing'
  }

  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

// ── Helpers ───────────────────────────────────────────────
function getEmptyCells() {
  const cells = []
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (grid.value[r][c] === null) cells.push([r, c])
  return cells
}

function addRandomTile() {
  const cells = getEmptyCells()
  if (!cells.length) return
  const [r, c] = cells[Math.floor(Math.random() * cells.length)]
  const val = Math.random() < 0.9 ? 2 : 4
  grid.value[r][c] = val
  newCells.value = [`${r}-${c}`]
  setTimeout(() => { newCells.value = [] }, 250)
}

function tileStyle(val) {
  const s = TILE[val]
  return s ? { background: s.bg, color: s.fg } : { background: '#3c3a32', color: '#f9f6f2' }
}

function tileSize(val) {
  if (val >= 1024) return 'text-sm'
  if (val >= 128)  return 'text-base'
  return 'text-lg'
}

function isNew(r, c)        { return newCells.value.includes(`${r}-${c}`) }
function isMerge(r, c)      { return mergeCells.value.includes(`${r}-${c}`) }
function isCountdown(r, c)  { return countdown.value?.row === r && countdown.value?.col === c }

// ── Move logic ────────────────────────────────────────────
function processLine(line) {
  const tiles = line.filter(x => x !== null)
  let gained = 0
  const merged = []

  for (let i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] === tiles[i + 1] && !merged.includes(i)) {
      tiles[i] *= 2
      gained += tiles[i]
      tiles.splice(i + 1, 1)
      merged.push(i)
    }
  }

  while (tiles.length < 4) tiles.push(null)
  return { tiles, gained, mergedAt: merged }
}

function move(dir) {
  if (phase.value !== 'playing') return

  let moved = false
  let totalGained = 0
  const newMerge = []

  if (dir === 'left' || dir === 'right') {
    for (let r = 0; r < 4; r++) {
      const rev = dir === 'right'
      const line = rev ? [...grid.value[r]].reverse() : [...grid.value[r]]
      const { tiles, gained, mergedAt } = processLine(line)
      const result = rev ? [...tiles].reverse() : tiles

      if (result.some((v, c) => v !== grid.value[r][c])) moved = true
      grid.value[r] = result
      totalGained += gained
      mergedAt.forEach(i => newMerge.push(`${r}-${rev ? 3 - i : i}`))
    }
  } else {
    for (let c = 0; c < 4; c++) {
      const rev = dir === 'down'
      const col = Array.from({ length: 4 }, (_, r) => grid.value[r][c])
      const line = rev ? [...col].reverse() : col
      const { tiles, gained, mergedAt } = processLine(line)
      const result = rev ? [...tiles].reverse() : tiles

      for (let r = 0; r < 4; r++) {
        if (grid.value[r][c] !== result[r]) moved = true
        grid.value[r][c] = result[r]
      }
      totalGained += gained
      mergedAt.forEach(i => newMerge.push(`${rev ? 3 - i : i}-${c}`))
    }
  }

  if (!moved) return

  score.value += totalGained
  mergeCells.value = newMerge
  setTimeout(() => { mergeCells.value = [] }, 200)

  tickCountdown()
  addRandomTile()
  saveGame()

  if (!canMove()) endGame()
}

// ── Countdown tile ────────────────────────────────────────
function tickCountdown() {
  if (!countdown.value) {
    // 5% chance to spawn a countdown tile if there's enough space
    if (getEmptyCells().length > 4 && Math.random() < 0.05) {
      const cells = getEmptyCells()
      const [r, c] = cells[Math.floor(Math.random() * cells.length)]
      grid.value[r][c] = 7
      countdown.value = { row: r, col: c, value: 7 }
    }
    return
  }

  const { value } = countdown.value
  if (value <= 4) { countdown.value = null; return }

  // Find the countdown tile (it may have moved after a merge)
  let found = null
  outer: for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (grid.value[r][c] === value && [5, 6, 7].includes(value)) {
        found = [r, c]; break outer
      }

  if (!found) { countdown.value = null; return }

  const [r, c] = found
  const next = value - 1
  grid.value[r][c] = next
  countdown.value = next <= 4 ? null : { row: r, col: c, value: next }
}

// ── Can move check ────────────────────────────────────────
function canMove() {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (grid.value[r][c] === null) return true
      if (c < 3 && grid.value[r][c] === grid.value[r][c + 1]) return true
      if (r < 3 && grid.value[r][c] === grid.value[r + 1][c]) return true
    }
  return false
}

// ── Game flow ─────────────────────────────────────────────
function startGame() {
  grid.value       = emptyGrid()
  score.value      = 0
  countdown.value  = null
  newCells.value   = []
  mergeCells.value = []
  phase.value      = 'playing'
  addRandomTile()
  addRandomTile()
  saveGame()
}

function endGame() {
  phase.value = 'over'
  gamesPlayed.value++
  if (score.value > highScore.value) highScore.value = score.value

  const data = loadHawk3Data()
  data.games.hawkDoubleUp.highScore   = highScore.value
  data.games.hawkDoubleUp.gamesPlayed = gamesPlayed.value
  data.games.hawkDoubleUp.savedGame   = null
  saveHawk3Data(data)
}

function saveGame() {
  if (phase.value !== 'playing') return
  const data = loadHawk3Data()
  data.games.hawkDoubleUp.savedGame = {
    grid:      grid.value.map(r => [...r]),
    score:     score.value,
    countdown: countdown.value,
  }
  saveHawk3Data(data)
}

// ── Input ─────────────────────────────────────────────────
const touch = { x: 0, y: 0 }

function handleTouchStart(e) {
  touch.x = e.touches[0].clientX
  touch.y = e.touches[0].clientY
}

function handleTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touch.x
  const dy = e.changedTouches[0].clientY - touch.y
  if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
}

function handleKeyDown(e) {
  const map = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
  }
  const dir = map[e.key]
  if (dir) { e.preventDefault(); move(dir) }
}
</script>

<template>
  <div
    class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-8 px-4 select-none"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
  >
    <div class="max-w-[420px] mx-auto flex flex-col gap-5">

      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white mb-1">🎰 Hawk Double-Up</h1>
          <p class="text-white/40 text-sm">{{ t('games.doubleUp.subtitle') }}</p>
        </div>
        <NuxtLink to="/games" class="text-white/30 hover:text-white/70 text-sm transition-colors mt-1">
          {{ t('games.doubleUp.back') }}
        </NuxtLink>
      </div>

      <!-- Stats -->
      <div class="flex gap-3">
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.doubleUp.score') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ score.toLocaleString() }}</div>
        </div>
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.doubleUp.best') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ highScore.toLocaleString() }}</div>
        </div>
      </div>

      <!-- Board -->
      <div class="relative bg-[#bbada0] rounded-2xl p-3">
        <div class="grid grid-cols-4 gap-2.5">
          <template v-for="(row, r) in grid" :key="r">
            <div
              v-for="(cell, c) in row"
              :key="c"
              class="aspect-square rounded-xl flex items-center justify-center font-bold relative overflow-hidden transition-colors duration-100"
              :class="[
                cell ? '' : 'bg-[#cdc1b4]',
                isNew(r, c)   ? 'animate-pop'   : '',
                isMerge(r, c) ? 'animate-merge' : '',
                tileSize(cell),
              ]"
              :style="cell ? tileStyle(cell) : {}"
            >
              <div
                v-if="isCountdown(r, c)"
                class="absolute inset-0 rounded-xl border-2 border-yellow-400 animate-pulse pointer-events-none"
              />
              {{ cell ?? '' }}
            </div>
          </template>
        </div>

        <!-- Start overlay -->
        <Transition name="fade">
          <div
            v-if="phase === 'idle'"
            class="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-5 z-20"
          >
            <h2 class="text-2xl font-bold text-white tracking-wide">🎰 Hawk Double-Up</h2>
            <p class="text-white/60 text-sm text-center leading-relaxed px-6">{{ t('games.doubleUp.instructions') }}</p>
            <button
              class="px-10 py-3 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
              @click="startGame"
            >{{ t('games.doubleUp.start') }}</button>
          </div>
        </Transition>

        <!-- Game over overlay -->
        <Transition name="fade">
          <div
            v-if="phase === 'over'"
            class="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-5 z-20"
          >
            <h2 class="text-2xl font-bold text-white tracking-wide">{{ t('games.doubleUp.game_over') }}</h2>
            <div class="text-center text-white space-y-1">
              <div class="text-xs uppercase tracking-widest opacity-60">{{ t('games.doubleUp.score') }}</div>
              <div class="text-5xl font-bold tabular-nums">{{ score.toLocaleString() }}</div>
              <div class="text-sm opacity-50 pt-1">Best: {{ Math.max(score, highScore).toLocaleString() }}</div>
            </div>
            <button
              class="px-10 py-3 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
              @click="startGame"
            >{{ t('games.doubleUp.play_again') }}</button>
          </div>
        </Transition>
      </div>

      <!-- Restart button while playing -->
      <div v-if="phase === 'playing'" class="flex justify-center">
        <button
          class="py-2 px-6 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-sm font-medium rounded-xl transition-colors"
          @click="startGame"
        >↺ {{ t('games.doubleUp.restart') }}</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }

@keyframes pop {
  0%   { transform: scale(0.2); opacity: 0; }
  80%  { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes merge {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.animate-pop   { animation: pop   0.2s ease-out both; }
.animate-merge { animation: merge 0.15s ease-out; }
</style>
