<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { loadHawk3Data, saveHawk3Data } from '~/utils/localStores.js'
import GamesHeader from '~/components/games/GamesHeader.vue'

const { t } = useI18n()

definePageMeta({ hideHeader: true })

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

// ── Countdown defeat reward ───────────────────────────────
const COUNTDOWN_DEFEAT_REWARD = 25  // coins per defeated 7-tile

// ── Milestones ────────────────────────────────────────────
const MILESTONES = [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]
const MILESTONE_REWARDS = {
  8:    { coins: 10,   diamonds: 0  },
  16:   { coins: 15,   diamonds: 0  },
  32:   { coins: 25,   diamonds: 0  },
  64:   { coins: 50,   diamonds: 0  },
  128:  { coins: 100,  diamonds: 1  },
  256:  { coins: 200,  diamonds: 2  },
  512:  { coins: 500,  diamonds: 5  },
  1024: { coins: 800,  diamonds: 8  },
  2048: { coins: 1500, diamonds: 15 },
  4096: { coins: 3000, diamonds: 30 },
}

// ── Board measurement ─────────────────────────────────────
// Board: p-3 (12px padding), grid: gap-2.5 (10px gap)
const GRID_GAP      = 10
const BOARD_PADDING = 12
const boardRef      = ref(null)
const cellWidth     = ref(0)

function measureBoard() {
  if (!boardRef.value) return
  const inner = boardRef.value.clientWidth - 2 * BOARD_PADDING
  cellWidth.value = (inner - 3 * GRID_GAP) / 4
}

// Returns absolute-position style for a tile at (row, col).
// Outer wrapper handles position via transform — inner div handles scale animations separately.
function getTilePos(row, col) {
  const s = cellWidth.value
  return {
    top:       `${BOARD_PADDING}px`,
    left:      `${BOARD_PADDING}px`,
    width:     `${s}px`,
    height:    `${s}px`,
    transform: `translate(${col * (s + GRID_GAP)}px, ${row * (s + GRID_GAP)}px)`,
  }
}

// ── Tile state ────────────────────────────────────────────
// Each tile: { id, value, row, col, isNew, merging }
const displayTiles = ref([])
let nextId = 0

function findTile(id)  { return displayTiles.value.find(t => t.id === id) }

function gridValues() {
  const g = Array.from({ length: 4 }, () => Array(4).fill(null))
  for (const t of displayTiles.value) g[t.row][t.col] = t.value
  return g
}

function idGrid() {
  const g = Array.from({ length: 4 }, () => Array(4).fill(null))
  for (const t of displayTiles.value) g[t.row][t.col] = t.id
  return g
}

function getEmptyCells() {
  const occ = new Set(displayTiles.value.map(t => `${t.row}-${t.col}`))
  const cells = []
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (!occ.has(`${r}-${c}`)) cells.push([r, c])
  return cells
}

// ── Other state ───────────────────────────────────────────
const score        = ref(0)
const highScore    = ref(0)
const gamesPlayed  = ref(0)
const headerRef    = ref(null)
const phase        = ref('idle')   // 'idle' | 'playing' | 'over'
const lastReward   = ref(null)
const milestones   = ref({})
const newMilestone = ref(null)
// Last achieved milestone + next target
const milestoneProgress = computed(() => {
  const achieved  = MILESTONES.filter(m => milestones.value[m])
  const remaining = MILESTONES.filter(m => !milestones.value[m])
  return {
    last: achieved.at(-1) ?? null,
    next: remaining[0]    ?? null,
  }
})

const countdown        = ref(null)  // ID of the active countdown tile, or null
const isAnimating      = ref(false)
const countdownDefeats = ref(0)     // 7-tiles defeated this round

// ── Load ──────────────────────────────────────────────────
onMounted(() => {
  const data = loadHawk3Data()
  highScore.value   = data.games.hawkDoubleUp.highScore   ?? 0
  gamesPlayed.value = data.games.hawkDoubleUp.gamesPlayed ?? 0
  milestones.value  = data.games.hawkDoubleUp.milestones  ?? {}

  const saved = data.games.hawkDoubleUp.savedGame
  if (saved?.grid) {
    nextId = 0
    displayTiles.value = []
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const val = saved.grid[r]?.[c]
        if (val !== null && val !== undefined)
          displayTiles.value.push({ id: nextId++, value: val, row: r, col: c, isNew: false, merging: false })
      }
    score.value = saved.score ?? 0
    // Restore countdown: find tile at saved position with saved value
    if (saved.countdown) {
      const cd = displayTiles.value.find(t =>
        t.row === saved.countdown.row &&
        t.col === saved.countdown.col &&
        t.value === saved.countdown.value
      )
      countdown.value = cd?.id ?? null
    }
    phase.value = 'playing'
  }

  measureBoard()
  window.addEventListener('resize', measureBoard)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('resize', measureBoard)
  document.removeEventListener('keydown', handleKeyDown)
})

// ── Helpers ───────────────────────────────────────────────
function tileStyle(val) {
  const s = TILE[val]
  return s ? { background: s.bg, color: s.fg } : { background: '#3c3a32', color: '#f9f6f2' }
}

function tileSize(val) {
  if (val >= 1024) return 'text-lg'
  if (val >= 128)  return 'text-xl'
  return 'text-xl'
}

function addRandomTile() {
  const cells = getEmptyCells()
  if (!cells.length) return
  const [r, c] = cells[Math.floor(Math.random() * cells.length)]
  const val = Math.random() < 0.9 ? 2 : 4
  const id = nextId++
  displayTiles.value.push({ id, value: val, row: r, col: c, isNew: true, merging: false })
  setTimeout(() => {
    displayTiles.value = displayTiles.value.map(t => t.id === id ? { ...t, isNew: false } : t)
  }, 250)
}

// ── Move logic ────────────────────────────────────────────
// Processes one line of tile IDs (4 entries, left-to-right / top-to-bottom).
// Returns compacted result: [{ id, newValue, absorbedId? }]
function processLineIds(line) {
  const active = line.filter(x => x !== null)
  const result = []
  let i = 0
  while (i < active.length) {
    const id = active[i]
    const val = findTile(id).value
    if (i + 1 < active.length) {
      const nextTileId = active[i + 1]
      if (val === findTile(nextTileId).value) {
        result.push({ id, newValue: val * 2, absorbedId: nextTileId })
        i += 2
        continue
      }
    }
    result.push({ id, newValue: val })
    i++
  }
  return result
}

function move(dir) {
  if (phase.value !== 'playing' || isAnimating.value) return

  const ig = idGrid()
  let moved = false
  let totalGained = 0
  const updates = new Map()  // id → { newRow, newCol, newValue, absorbed }

  for (let i = 0; i < 4; i++) {
    let line
    if      (dir === 'left')  line = ig[i]
    else if (dir === 'right') line = [...ig[i]].reverse()
    else if (dir === 'up')    line = [ig[0][i], ig[1][i], ig[2][i], ig[3][i]]
    else                      line = [ig[3][i], ig[2][i], ig[1][i], ig[0][i]]

    const result = processLineIds(line)

    result.forEach(({ id, newValue, absorbedId }, pos) => {
      let newRow, newCol
      if      (dir === 'left')  { newRow = i;       newCol = pos }
      else if (dir === 'right') { newRow = i;       newCol = 3 - pos }
      else if (dir === 'up')    { newRow = pos;     newCol = i }
      else                      { newRow = 3 - pos; newCol = i }

      const tile = findTile(id)
      if (tile.row !== newRow || tile.col !== newCol) moved = true
      updates.set(id, { newRow, newCol, newValue })

      if (absorbedId) {
        const abs = findTile(absorbedId)
        if (abs.row !== newRow || abs.col !== newCol) moved = true
        updates.set(absorbedId, { newRow, newCol, newValue: abs.value, absorbed: true })
        totalGained += newValue
      }
    })
  }

  if (!moved) return

  score.value += totalGained
  isAnimating.value = true

  // Phase 1 — slide tiles to new positions (CSS transition fires here)
  displayTiles.value = displayTiles.value.map(t => {
    const u = updates.get(t.id)
    return u ? { ...t, row: u.newRow, col: u.newCol } : t
  })

  // Phase 2 — after slide finishes: remove absorbed, apply merged values, spawn
  setTimeout(() => {
    displayTiles.value = displayTiles.value
      .filter(t => !updates.get(t.id)?.absorbed)
      .map(t => {
        const u = updates.get(t.id)
        if (!u) return t
        const didMerge = u.newValue !== t.value
        return { ...t, value: u.newValue, merging: didMerge }
      })

    // Clear merge-pop after animation
    setTimeout(() => {
      displayTiles.value = displayTiles.value.map(t => ({ ...t, merging: false }))
    }, 150)

    tickCountdown()
    addRandomTile()
    checkMilestones()
    saveGame()
    isAnimating.value = false

    if (!canMove()) endGame()
  }, 130)
}

// ── Countdown tile ────────────────────────────────────────
function tickCountdown() {
  if (countdown.value === null) {
    if (getEmptyCells().length >= 7 && Math.random() < 0.05) {
      const cells = getEmptyCells()
      const [r, c] = cells[Math.floor(Math.random() * cells.length)]
      const id = nextId++
      displayTiles.value.push({ id, value: 7, row: r, col: c, isNew: true, merging: false })
      setTimeout(() => {
        displayTiles.value = displayTiles.value.map(t => t.id === id ? { ...t, isNew: false } : t)
      }, 250)
      countdown.value = id
    }
    return
  }

  const tile = findTile(countdown.value)
  if (!tile) { countdown.value = null; return }
  if (tile.value <= 4) { countdown.value = null; return }

  displayTiles.value = displayTiles.value.map(t =>
    t.id === countdown.value ? { ...t, value: t.value - 1 } : t
  )

  if ((findTile(countdown.value)?.value ?? 0) <= 4) {
    // 7-tile defeated — give reward
    countdownDefeats.value++
    const data = loadHawk3Data()
    data.player.coins = (data.player.coins ?? 0) + COUNTDOWN_DEFEAT_REWARD
    saveHawk3Data(data)
    headerRef.value?.refresh()
    countdown.value = null
  }
}

// ── Milestone check ───────────────────────────────────────
function checkMilestones() {
  const g = gridValues()
  let anyNew = false
  let highestNew = null
  const data = loadHawk3Data()
  for (const m of MILESTONES) {
    if (milestones.value[m]) continue
    if (g.some(row => row.some(cell => cell === m))) {
      milestones.value[m] = true
      const reward = MILESTONE_REWARDS[m]
      data.player.coins    = (data.player.coins    ?? 0) + reward.coins
      data.player.diamonds = (data.player.diamonds ?? 0) + reward.diamonds
      highestNew = { value: m, ...reward }
      anyNew = true
    }
  }
  if (anyNew) {
    data.games.hawkDoubleUp.milestones = { ...milestones.value }
    saveHawk3Data(data)
    headerRef.value?.refresh()
    newMilestone.value = highestNew
    setTimeout(() => { newMilestone.value = null }, 3000)
  }
}

// ── Can move check ────────────────────────────────────────
function canMove() {
  const g = gridValues()
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (g[r][c] === null) return true
      if (c < 3 && g[r][c] === g[r][c + 1]) return true
      if (r < 3 && g[r][c] === g[r + 1][c]) return true
    }
  return false
}

// ── Game flow ─────────────────────────────────────────────
function startGame() {
  displayTiles.value = []
  nextId             = 0
  score.value        = 0
  countdown.value        = null
  newMilestone.value     = null
  isAnimating.value      = false
  countdownDefeats.value = 0
  phase.value        = 'playing'
  addRandomTile()
  addRandomTile()
  saveGame()
}

function endGame() {
  phase.value = 'over'
  gamesPlayed.value++
  if (score.value > highScore.value) highScore.value = score.value

  const coins    = Math.floor(score.value / 15)
  const diamonds = Math.floor(score.value / 500)
  lastReward.value = { coins, diamonds }

  const data = loadHawk3Data()
  data.games.hawkDoubleUp.highScore   = highScore.value
  data.games.hawkDoubleUp.gamesPlayed = gamesPlayed.value
  data.games.hawkDoubleUp.savedGame   = null
  data.player.coins    = (data.player.coins    ?? 0) + coins
  data.player.diamonds = (data.player.diamonds ?? 0) + diamonds
  saveHawk3Data(data)
  headerRef.value?.refresh()
}

function saveGame() {
  if (phase.value !== 'playing') return
  const cdTile = countdown.value !== null ? findTile(countdown.value) : null
  const data = loadHawk3Data()
  data.games.hawkDoubleUp.savedGame = {
    grid:      gridValues().map(r => [...r]),
    score:     score.value,
    countdown: cdTile ? { row: cdTile.row, col: cdTile.col, value: cdTile.value } : null,
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
    class="min-h-dvh bg-gradient-to-b from-[#1a1a2e] to-[#16213e] py-4 px-4 select-none"
    @touchstart.passive="handleTouchStart"
    @touchend.passive="handleTouchEnd"
  >
    <div class="max-w-[420px] mx-auto flex flex-col gap-5">

      <!-- Header -->
      <GamesHeader ref="headerRef" title="🎰 Hawk Double-Up" />

      <!-- Stats -->
      <div class="flex gap-3">
        <!-- Score -->
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-2 py-2 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.doubleUp.score') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ score.toLocaleString() }}</div>
        </div>

        <!-- Best -->
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-2 py-2 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.doubleUp.best') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ highScore.toLocaleString() }}</div>
        </div>

        <!-- 7er defeated -->
        <div class="flex-1 bg-[#4c1ff4] border border-white/10 rounded-xl px-2 py-2 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-0.5">{{ t('games.doubleUp.countdown_defeated') }}</div>
          <div class="text-xl font-bold tabular-nums">{{ countdownDefeats }}</div>
        </div>

        <!-- Milestone progress: last achieved + next -->
        <div class="flex-1 bg-white/10 border border-white/10 rounded-xl px-2 py-2 text-white text-center">
          <div class="text-[10px] uppercase tracking-widest opacity-50 mb-1.5">{{ t('games.doubleUp.milestone_stat') }}</div>
          <div class="flex flex-col gap-1">
            <div v-if="milestoneProgress.last" class="flex justify-center items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all" :class="milestoneProgress.last ? ' bg-yellow-400/15 text-yellow-400 border-yellow-400/30' : 'bg-white/5 text-white/25 border-white/10'">
              {{ milestoneProgress.last ? `✓ ${milestoneProgress.last.toLocaleString()}` : '— —' }}
            </div>
            <div class="flex justify-center items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all bg-white/5 text-white/25 border-white/10">
              {{ milestoneProgress.next ? `${milestoneProgress.next.toLocaleString()}` : 'Max!' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Board -->
      <div ref="boardRef" class="relative bg-[#bbada0] rounded-2xl p-3">

        <!-- Background cells (define cell sizes, nothing else) -->
        <div class="grid grid-cols-4 gap-2.5">
          <div v-for="i in 16" :key="i" class="aspect-square rounded-xl bg-[#cdc1b4]" />
        </div>

        <!-- Animated tile layer -->
        <template v-if="cellWidth > 0">
          <!--
            Two-div approach: outer div moves (transform translate, transition),
            inner div scales (pop / merge animations) — no transform conflict.
          -->
          <div
            v-for="tile in displayTiles"
            :key="tile.id"
            class="absolute"
            :class="tile.isNew ? '' : 'tile-slide'"
            :style="getTilePos(tile.row, tile.col)"
          >
            <div
              class="w-full h-full rounded-xl flex items-center justify-center font-bold relative overflow-hidden"
              :class="[
                tileSize(tile.value),
                tile.isNew    ? 'animate-pop'   : '',
                tile.merging  ? 'animate-merge' : '',
              ]"
              :style="tileStyle(tile.value)"
            >
              <!-- Countdown glow ring -->
              <div
                v-if="countdown === tile.id"
                class="absolute inset-0 rounded-xl border-2 border-yellow-400 animate-pulse pointer-events-none"
              />
              {{ tile.value }}
            </div>
          </div>
        </template>

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
              <div class="text-sm opacity-50 pt-1">{{ t('games.doubleUp.best') }}: {{ Math.max(score, highScore).toLocaleString() }}</div>
            </div>
            <div v-if="lastReward" class="flex gap-3">
              <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[72px]">
                <div class="text-xs opacity-50 mb-0.5">{{ t('games.doubleUp.reward_coins') }}</div>
                <div class="text-lg font-bold">+{{ lastReward.coins }}</div>
              </div>
              <div class="bg-white/10 rounded-xl px-4 py-2 text-white text-center min-w-[72px]">
                <div class="text-xs opacity-50 mb-0.5">{{ t('games.doubleUp.reward_diamonds') }}</div>
                <div class="text-lg font-bold">+{{ lastReward.diamonds }}</div>
              </div>
            </div>
            <button
              class="px-10 py-3 bg-primary hover:bg-primary-h text-white font-bold rounded-xl transition-colors"
              @click="startGame"
            >{{ t('games.doubleUp.play_again') }}</button>
          </div>
        </Transition>
      </div>

      <!-- Milestones -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div class="text-[10px] uppercase tracking-widest text-white/40 mb-3">{{ t('games.doubleUp.milestones_title') }}</div>
        <div class="flex gap-2 flex-wrap">
          <div
            v-for="m in MILESTONES"
            :key="m"
            class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all"
            :class="milestones[m]
              ? 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30'
              : 'bg-white/5 text-white/25 border-white/10'"
          >
            <span v-if="milestones[m]">✓</span>
            {{ m.toLocaleString() }}
          </div>
        </div>
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

  <!-- Milestone toast -->
  <Transition name="milestone">
    <div
      v-if="newMilestone"
      class="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-black font-bold rounded-2xl px-5 py-3 shadow-2xl text-center whitespace-nowrap pointer-events-none"
    >
      <div class="text-base">🏆 {{ newMilestone.value.toLocaleString() }} {{ t('games.doubleUp.milestone_reached') }}</div>
      <div class="text-sm font-semibold mt-0.5 opacity-80">
        +{{ newMilestone.coins }} 💰<template v-if="newMilestone.diamonds > 0"> · +{{ newMilestone.diamonds }} 💎</template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Tile slide: only the outer positioning wrapper transitions transform */
.tile-slide {
  transition: transform 0.12s ease;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }

.milestone-enter-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.milestone-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.milestone-enter-from   { opacity: 0; transform: translate(-50%, 12px); }
.milestone-leave-to     { opacity: 0; transform: translate(-50%, -8px); }

/* Pop: new tile spawns (inner div — no conflict with outer translate) */
@keyframes pop {
  0%   { transform: scale(0.2); opacity: 0; }
  80%  { transform: scale(1.08); }
  100% { transform: scale(1); opacity: 1; }
}
/* Merge: tile that absorbed another bounces (inner div) */
@keyframes merge {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.animate-pop   { animation: pop   0.2s ease-out both; }
.animate-merge { animation: merge 0.15s ease-out; }
</style>
