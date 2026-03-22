<script setup>
const STORAGE_LEVEL  = 'party_level'
const STORAGE_NAME   = 'party_player_name'
const STORAGE_ID     = 'party_player_id'
const STORAGE_SCORES = 'party_local_highscores'

// --- State ---
const currentLevel    = ref(0)
const clickAnimation  = ref(false)
const isFlipped       = ref(false)
const playerName      = ref('')
const playerId        = ref('')
const localHighscores = ref([])
const showAll         = ref(false)
const comboCount      = ref(0)
const floatingStatus  = ref(null)
let comboTimer = null

// --- localStorage helpers ---
const ls = {
  get:     (k)  => { try { return localStorage.getItem(k) } catch { return null } },
  set:     (k, v) => { try { localStorage.setItem(k, v) } catch {} },
  getJSON: (k)  => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  setJSON: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

const genId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })

onMounted(() => {
  const stored = ls.get(STORAGE_LEVEL)
  currentLevel.value = stored ? (parseInt(stored, 10) || 0) : 0
  playerName.value   = ls.get(STORAGE_NAME) || ''

  let id = ls.get(STORAGE_ID)
  if (!id) { id = genId(); ls.set(STORAGE_ID, id) }
  playerId.value = id

  localHighscores.value = ls.getJSON(STORAGE_SCORES) || []
})

onUnmounted(() => { if (comboTimer) clearTimeout(comboTimer) })

// --- Level Titles ---
const getLevelTitle = (lvl) => {
  if (lvl === 0)     return 'Bereit für dein Abenteuer?'
  if (lvl < 5)       return 'Neuling'
  if (lvl < 10)      return 'Novize'
  if (lvl < 25)      return 'Wegfinder'
  if (lvl < 50)      return 'Abenteurer'
  if (lvl < 75)      return 'Kämpfer'
  if (lvl < 100)     return 'Held'
  if (lvl < 200)     return 'Erweckter 🔥'
  if (lvl < 400)     return 'Unaufhaltsamer 💪'
  if (lvl < 800)     return 'Legende 👑'
  if (lvl < 1200)    return 'Unsterblicher ⚡'
  if (lvl < 1600)    return 'Mythischer 🦄'
  if (lvl < 2000)    return 'Göttlicher 🌟'
  if (lvl < 2400)    return 'Himmelswächter 🌌'
  if (lvl < 2800)    return 'Erleuchteter ✨'
  if (lvl < 3200)    return 'Ewiger 🔮'
  if (lvl < 4000)    return 'Kosmischer Wanderer 🌠'
  if (lvl < 5000)    return 'Transzendenter 🎆'
  if (lvl < 6000)    return 'Allmächtiger 💫'
  if (lvl < 7000)    return 'Ultimativer 🎮'
  if (lvl < 8000)    return 'Titan der Sagen 🗿'
  if (lvl < 9000)    return 'Gott der Welten 🌍'
  if (lvl < 10000)   return 'Meister der Existenz 🌊'
  return 'der Eine ☯️'
}

// --- Computed ---
const visibleScores = computed(() =>
  showAll.value ? localHighscores.value : localHighscores.value.slice(0, 10)
)

const myEntry = computed(() =>
  localHighscores.value.find(s => s.id === playerId.value) ?? null
)

const isImprovement = computed(() =>
  !myEntry.value ? currentLevel.value > 0 : currentLevel.value > myEntry.value.level
)

const myRank = computed(() => {
  const list = [...localHighscores.value]
  if (currentLevel.value > 0 && !myEntry.value) {
    list.push({ id: playerId.value, level: currentLevel.value })
  } else if (myEntry.value && currentLevel.value > myEntry.value.level) {
    const idx = list.findIndex(s => s.id === playerId.value)
    if (idx !== -1) list[idx] = { ...list[idx], level: currentLevel.value }
  }
  list.sort((a, b) => b.level - a.level)
  const pos = list.findIndex(s => s.id === playerId.value)
  return pos === -1 ? null : pos + 1
})

// --- Inline style helpers (dynamic gradients can't use Tailwind classes) ---
const rankBadgeStyle = (rank) => {
  if (rank === 1) return { background: 'linear-gradient(135deg, #ffd700, #ffb900)', borderColor: '#ffd700' }
  if (rank === 2) return { background: 'linear-gradient(135deg, #c0c0c0, #a9a9a9)', borderColor: '#c0c0c0' }
  if (rank === 3) return { background: 'linear-gradient(135deg, #cd7f32, #b8733b)', borderColor: '#cd7f32' }
  return {}
}

const entryStyle = (i) => {
  if (i === 0) return { background: 'linear-gradient(135deg, rgba(255,215,0,0.6), rgba(255,185,0,0.6))',   border: '1.5px solid rgba(255,215,0,0.8)' }
  if (i === 1) return { background: 'linear-gradient(135deg, rgba(192,192,192,0.5), rgba(169,169,169,0.5))', border: '1.5px solid rgba(192,192,192,0.7)' }
  if (i === 2) return { background: 'linear-gradient(135deg, rgba(205,127,50,0.5), rgba(184,115,51,0.5))',  border: '1.5px solid rgba(205,127,50,0.7)' }
  return {}
}

// --- Click Game ---
const levelUp = (e) => {
  clickAnimation.value = true
  setTimeout(() => { clickAnimation.value = false }, 200)

  currentLevel.value++
  ls.set(STORAGE_LEVEL, currentLevel.value)

  comboCount.value++
  if (comboTimer) clearTimeout(comboTimer)
  comboTimer = setTimeout(() => { comboCount.value = 0 }, 400)

  showFloating(e)
}

// --- Floating Combo Texts ---
const COMBO_TEXTS = {
  1:  ['👆', '👌', 'Click! ✌️', 'Nice! 🤘', 'Cool! 😎', 'Yay! 🎉', '🚀', '💥', 'Yeah! ✨'],
  3:  ['Läuft! 🔥', 'Weiter so! 🫵', 'Go! 💪', 'Stark! 💪', 'Push! ⚡', 'Mehr! 🎊'],
  5:  ['COMBO! 🎯', 'On Fire! 🔥', 'Stark! 💥', 'Super! 🌟', 'Hot! 🌶️'],
  8:  ['SUPER! 🚀', 'Krass! ⚡', 'Wow! 🌟', 'Power! ⚡', 'Beast! 🦁'],
  12: ['MEGA! 🎆', 'Wahnsinn! 🎊', 'Crazy! 🤪', 'Hammer! 🔨', 'Killer! ⚔️'],
  15: ['ULTRA! 🌈', 'Monster! 👾', 'Brutal! 💀', 'Gigant! 🦍', 'Titan! 🗿'],
  20: ['GIGANTISCH! 🦖', 'Legendär! 👑', 'Episch! ⚔️', 'Wahnsinn! 🌋', 'Grandios! 🎪'],
  25: ['UNGLAUBLICH! 🌠', 'Göttlich! ⚡', 'Magisch! ✨', 'Brilliant! 💫', 'Himmlisch! ☁️'],
  30: ['UNSTOPPABLE! 🔥', 'Meisterlich! 🏆', 'Unbezwingbar! 🛡️', 'Supreme! 👑'],
  40: ['GODLIKE! 👼', 'Kosmisch! 🌌', 'Allmächtig! ⚡', 'Galaktisch! 🌟'],
  50: ['LEGENDARY! 🐉', 'Mythisch! 🦄', 'UNFASSBAR! 🌌', 'GODMODE! 🎆', 'GÖTTLICH! ⚡'],
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const showFloating = (event) => {
  const container = document.querySelector('.level-up-card')
  if (!container) return

  const c = comboCount.value
  let status, text, size

  if      (c >= 50) { status = 'l50'; text = pick(COMBO_TEXTS[50]); size = 'huge' }
  else if (c >= 40) { status = 'l40'; text = pick(COMBO_TEXTS[40]); size = 'huge' }
  else if (c >= 30) { status = 'l30'; text = pick(COMBO_TEXTS[30]); size = 'huge' }
  else if (c >= 25) { status = 'l25'; text = pick(COMBO_TEXTS[25]); size = 'large' }
  else if (c >= 20) { status = 'l20'; text = pick(COMBO_TEXTS[20]); size = 'large' }
  else if (c >= 15) { status = 'l15'; text = pick(COMBO_TEXTS[15]); size = 'large' }
  else if (c >= 12) { status = 'l12'; text = pick(COMBO_TEXTS[12]); size = 'medium' }
  else if (c >=  8) { status = 'l8';  text = pick(COMBO_TEXTS[8]);  size = 'medium' }
  else if (c >=  5) { status = 'l5';  text = pick(COMBO_TEXTS[5]);  size = 'medium' }
  else if (c >=  3) { status = 'l3';  text = pick(COMBO_TEXTS[3]);  size = 'small' }
  else              { status = 'l1';  text = pick(COMBO_TEXTS[1]);  size = 'normal' }

  if (floatingStatus.value === status) return
  floatingStatus.value = status

  let el = container.querySelector('.floating-number')
  if (el) el.remove()

  const colors = ['#feca57', '#f3b67e', '#ff9ff3', '#f093fb', '#1dd1a1', '#00cf68', '#48dbfb']
  el = document.createElement('div')
  el.className = `floating-number size-${size}`
  const color = colors[Math.floor(Math.random() * colors.length)]
  el.style.color = color
  el.style.textShadow = `0 0 20px ${color}80`
  el.textContent = text

  const btn = container.querySelector('.level-up-btn')
  if (btn) {
    const br = btn.getBoundingClientRect()
    const cr = container.getBoundingClientRect()
    el.style.left = (br.left - cr.left + br.width / 2) + 'px'
    el.style.top  = (br.top  - cr.top  - 40) + 'px'
  }

  container.appendChild(el)
  setTimeout(() => {
    if (el.parentNode === container) {
      el.remove()
      floatingStatus.value = null
    }
  }, 1000)
}

// --- Highscore ---
const sanitize = (s) =>
  (s ?? '').trim()
    .replace(/[^\p{L}\p{N}\s\-?!_&*+]/gu, '')
    .replace(/\s+/g, ' ')
    .substring(0, 20)
    .trim()

const submitScore = () => {
  const name = sanitize(playerName.value)
  if (!name) return
  playerName.value = name
  ls.set(STORAGE_NAME, name)

  const list = localHighscores.value.filter(s => s.id !== playerId.value)
  list.push({
    id:    playerId.value,
    name,
    level: currentLevel.value,
    date:  new Date().toISOString().split('T')[0],
  })
  list.sort((a, b) => b.level - a.level)
  localHighscores.value = list
  ls.setJSON(STORAGE_SCORES, list)
}

const saveNameOnBlur = () => {
  const name = sanitize(playerName.value)
  if (name) { playerName.value = name; ls.set(STORAGE_NAME, name) }
}
</script>

<template>
  <div
    class="level-up-card bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-xl relative h-full min-h-[360px] flex flex-col"
  >

    <!-- Vorderseite: Spiel -->
    <div v-show="!isFlipped" class="flex flex-col gap-4 p-6 text-white w-full h-full">
      <div class="text-center">
        <div class="text-[3rem] font-bold leading-none mt-2 [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
          Level {{ currentLevel }}
        </div>
        <div class="text-[1.5rem] font-medium opacity-90 min-h-[1.5em] mt-6 mb-8 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
          {{ getLevelTitle(currentLevel) }}
        </div>
      </div>

      <button
        class="level-up-btn w-full py-5 text-2xl font-bold uppercase tracking-[2px] text-white bg-gradient-to-br from-[#f093fb] to-[#f5576c] border-0 rounded-lg cursor-pointer select-none shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.96]"
        :style="clickAnimation ? { transform: 'scale(0.96)' } : {}"
        @click="levelUp"
      >
        LEVEL UP!
      </button>

      <div class="flex items-center justify-end gap-2 mt-auto">
        <div
          v-if="myRank && isImprovement && currentLevel > 0"
          class="inline-flex items-center justify-center px-[10px] py-1 rounded-lg text-sm font-bold cursor-pointer border-2 border-white/80 shadow-[0_0_14px_rgba(240,147,251,0.6)] animate-pulse-badge bg-gradient-to-br from-[#f093fb] to-[#f5576c]"
          :style="rankBadgeStyle(myRank)"
          @click="isFlipped = true"
        >
          #{{ myRank }}
        </div>
        <button
          class="px-3 py-1 text-sm bg-white/20 text-white border-[1.5px] border-white/35 rounded-lg cursor-pointer transition-all hover:bg-white/30 hover:-translate-y-px"
          @click="isFlipped = true"
        >
          🏆 Highscore
        </button>
      </div>
    </div>

    <!-- Rückseite: Highscore -->
    <div v-show="isFlipped" class="flex flex-col gap-4 p-6 text-white w-full h-full overflow-y-auto">
      <div class="flex items-center justify-between shrink-0">
        <span class="text-lg font-bold">🏆 Highscore</span>
        <button
          class="px-3 py-1 text-sm bg-white/20 text-white border-[1.5px] border-white/35 rounded-lg cursor-pointer transition-all hover:bg-white/30 hover:-translate-y-px"
          @click="isFlipped = false"
        >🎮 Zurück</button>
      </div>

      <!-- Aktueller Spieler -->
      <div
        v-if="currentLevel > 0"
        class="flex items-center gap-2 px-4 py-2 rounded bg-gradient-to-br from-[rgba(0,200,150,0.55)] to-[rgba(0,150,255,0.55)] border-[1.5px] border-[rgba(0,200,150,0.7)] flex-wrap text-sm animate-pulse-player"
      >
        <template v-if="isImprovement">
          <p class="text-sm m-0 leading-[1.3] w-full">Neuer Highscore! Trag deinen Namen ein:</p>
          <div class="flex items-center gap-2 flex-wrap w-full">
            <span
              class="inline-flex items-center justify-center px-[10px] py-1 rounded-lg text-sm font-bold border-2 border-white/80 shadow-[0_0_14px_rgba(240,147,251,0.6)] animate-pulse-badge bg-gradient-to-br from-[#f093fb] to-[#f5576c]"
              :style="rankBadgeStyle(myRank)"
            >#{{ myRank }}</span>
            <input
              v-model="playerName"
              type="text"
              placeholder="Dein Name..."
              class="flex-1 min-w-[100px] py-[6px] px-[10px] bg-white/15 border-[1.5px] border-white/30 rounded-lg text-white text-sm placeholder:text-white/55 focus:outline-none focus:border-white/75 font-sans"
              maxlength="20"
              @blur="saveNameOnBlur"
            />
            <span class="text-sm font-bold whitespace-nowrap">Lvl {{ currentLevel }}</span>
            <button
              class="py-[6px] px-[14px] text-sm font-bold uppercase tracking-[1px] text-white bg-gradient-to-br from-[#f093fb] to-[#f5576c] border-0 rounded-lg cursor-pointer whitespace-nowrap transition-all hover:-translate-y-px hover:shadow-[0_3px_10px_rgba(0,0,0,0.25)] disabled:opacity-45 disabled:cursor-not-allowed"
              :disabled="!playerName.trim()"
              @click="submitScore"
            >
              Speichern
            </button>
          </div>
        </template>
        <template v-else>
          <p class="text-sm m-0 text-center w-full">
            Platz <strong>#{{ myRank }}</strong> · Level <strong>{{ myEntry?.level }}</strong>
            — Weiter klicken!
          </p>
        </template>
      </div>

      <!-- Noch kein Score -->
      <div v-else class="flex items-center justify-center gap-2 px-[10px] py-[6px] rounded bg-white/10 text-sm">
        <p class="text-sm m-0 text-center w-full">Klicke auf "LEVEL UP!" um zu starten!</p>
      </div>

      <!-- Top-Liste -->
      <ul class="list-none m-0 p-0 flex flex-col gap-1">
        <li
          v-for="(entry, i) in visibleScores"
          :key="entry.id"
          class="flex items-center gap-2 px-[10px] py-[6px] rounded text-sm transition-colors hover:bg-white/16"
          :class="entry.id === playerId ? 'outline outline-[1.5px] outline-white/50' : (i > 2 ? 'bg-white/10' : '')"
          :style="entryStyle(i)"
        >
          <span class="font-bold min-w-[24px]">{{ i + 1 }}.</span>
          <span class="flex-1 font-medium">{{ entry.name }}</span>
          <span class="font-bold">{{ entry.level }}</span>
        </li>
      </ul>

      <button
        v-if="localHighscores.length > 10"
        class="mt-2 w-full py-2 text-sm font-semibold uppercase tracking-[1px] text-white bg-white/12 border-[1.5px] border-white/25 rounded-lg cursor-pointer transition-colors hover:bg-white/22"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Nur Top 10' : 'Alle anzeigen' }}
      </button>
    </div>

  </div>
</template>
