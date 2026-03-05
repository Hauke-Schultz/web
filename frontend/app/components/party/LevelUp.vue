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

const rankClass = (rank) => {
  if (rank === 1) return 'rank--gold'
  if (rank === 2) return 'rank--silver'
  if (rank === 3) return 'rank--bronze'
  return ''
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
  <div class="level-up-card" :class="{ 'is-flipped': isFlipped }">

    <!-- Vorderseite: Spiel -->
    <div class="flip-front">
      <div class="level-display">
        <div class="level-number">Level {{ currentLevel }}</div>
        <div class="level-title">{{ getLevelTitle(currentLevel) }}</div>
      </div>

      <button
        class="level-up-btn"
        :class="{ 'level-up-btn--pop': clickAnimation }"
        @click="levelUp"
      >
        LEVEL UP!
      </button>

      <div class="flip-footer">
        <div
          v-if="myRank && isImprovement && currentLevel > 0"
          class="rank-badge"
          :class="rankClass(myRank)"
          @click="isFlipped = true"
        >
          #{{ myRank }}
        </div>
        <button class="flip-btn" @click="isFlipped = true">
          🏆 Highscore
        </button>
      </div>
    </div>

    <!-- Rückseite: Highscore -->
    <div class="flip-back">
      <div class="hs-header">
        <span class="hs-title">🏆 Highscore</span>
        <button class="flip-btn" @click="isFlipped = false">🎮 Zurück</button>
      </div>

      <!-- Aktueller Spieler -->
      <div v-if="currentLevel > 0" class="hs-entry current-player">
        <!-- Neuer / besserer Score -->
        <template v-if="isImprovement">
          <p class="hs-congrats">Neuer Highscore! Trag deinen Namen ein:</p>
          <div class="hs-submit-row">
            <span class="rank-badge" :class="rankClass(myRank)">#{{ myRank }}</span>
            <input
              v-model="playerName"
              type="text"
              placeholder="Dein Name..."
              class="name-input"
              maxlength="20"
              @blur="saveNameOnBlur"
            />
            <span class="hs-level">Lvl {{ currentLevel }}</span>
            <button
              class="submit-btn"
              :disabled="!playerName.trim()"
              @click="submitScore"
            >
              Speichern
            </button>
          </div>
        </template>
        <!-- Gleichbleibend / schlechter -->
        <template v-else>
          <p class="hs-info">
            Platz <strong>#{{ myRank }}</strong> · Level <strong>{{ myEntry?.level }}</strong>
            — Weiter klicken!
          </p>
        </template>
      </div>

      <!-- Noch kein Score -->
      <div v-else class="hs-entry hs-empty">
        <p class="hs-info">Klicke auf "LEVEL UP!" um zu starten!</p>
      </div>

      <!-- Top-Liste -->
      <ul class="hs-list">
        <li
          v-for="(entry, i) in visibleScores"
          :key="entry.id"
          class="hs-entry"
          :class="[
            i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '',
            entry.id === playerId ? 'is-me' : ''
          ]"
        >
          <span class="hs-rank">{{ i + 1 }}.</span>
          <span class="hs-name">{{ entry.name }}</span>
          <span class="hs-lvl">{{ entry.level }}</span>
        </li>
      </ul>

      <button
        v-if="localHighscores.length > 10"
        class="show-all-btn"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Nur Top 10' : 'Alle anzeigen' }}
      </button>
    </div>

  </div>
</template>

<style scoped>
/* ---- Card container (Flip-Mechanismus) ---- */
.level-up-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--radius-lg);
  position: relative;
	height: 100%;
  min-height: 360px;
  display: flex;
  flex-direction: column;
}

/* Flip-Vorderseite */
.flip-front,
.flip-back {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  color: #fff;
  width: 100%;
  height: 100%;
}

.flip-back {
  display: none;
  overflow-y: auto;
}

.level-up-card.is-flipped .flip-front { display: none; }
.level-up-card.is-flipped .flip-back  { display: flex; }

/* ---- Level Display ---- */
.level-display { text-align: center; }

.level-number {
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0 0 0 / 0.4);
}

.level-title {
  font-size: 1rem;
  font-weight: 500;
  opacity: 0.9;
  min-height: 1.5em;
  margin-top: 6px;
  text-shadow: 0 1px 4px rgba(0 0 0 / 0.3);
}

/* ---- Level-Up Button ---- */
.level-up-btn {
  width: 100%;
  padding: 20px;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #fff;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  user-select: none;
  box-shadow: 0 4px 16px rgba(0 0 0 / 0.25);
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.level-up-btn:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 6px 20px rgba(0 0 0 / 0.35);
}

.level-up-btn:active,
.level-up-btn--pop {
  transform: scale(0.96);
}

/* ---- Footer (Highscore-Toggle) ---- */
.flip-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: auto;
}

.flip-btn {
  padding: 6px 12px;
  font-size: 0.8rem;
  background: rgba(255 255 255 / 0.2);
  color: #fff;
  border: 1.5px solid rgba(255 255 255 / 0.35);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 150ms ease, transform 150ms ease;
}

.flip-btn:hover {
  background: rgba(255 255 255 / 0.3);
  transform: translateY(-1px);
}

/* ---- Rank Badge ---- */
.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  border: 2px solid rgba(255 255 255 / 0.8);
  box-shadow: 0 0 14px rgba(240 147 251 / 0.6);
  animation: pulse-badge 2s ease-in-out infinite;
}

.rank-badge.rank--gold   { background: linear-gradient(135deg, #ffd700, #ffb900); border-color: #ffd700; }
.rank-badge.rank--silver { background: linear-gradient(135deg, #c0c0c0, #a9a9a9); border-color: #c0c0c0; }
.rank-badge.rank--bronze { background: linear-gradient(135deg, #cd7f32, #b8733b); border-color: #cd7f32; }

@keyframes pulse-badge {
  0%, 100% { box-shadow: 0 0 10px rgba(240 147 251 / 0.5); }
  50%       { box-shadow: 0 0 20px rgba(240 147 251 / 0.9); }
}

/* ---- Highscore Back ---- */
.hs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.hs-title {
  font-size: 1.1rem;
  font-weight: 700;
}

.hs-congrats {
  font-size: 0.9rem;
  margin: 0;
  line-height: 1.3;
}

.hs-info {
  font-size: 0.9rem;
  margin: 0;
  text-align: center;
  width: 100%;
}

.hs-submit-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.hs-level {
  font-weight: 700;
  font-size: 0.9rem;
  white-space: nowrap;
}

/* ---- Name Input ---- */
.name-input {
  flex: 1;
  min-width: 100px;
  padding: 6px 10px;
  background: rgba(255 255 255 / 0.15);
  border: 1.5px solid rgba(255 255 255 / 0.3);
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 0.9rem;
}

.name-input::placeholder { color: rgba(255 255 255 / 0.55); }
.name-input:focus { outline: none; border-color: rgba(255 255 255 / 0.75); }

/* ---- Submit Button ---- */
.submit-btn {
  padding: 6px 14px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #fff;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;
  white-space: nowrap;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0 0 0 / 0.25);
}

.submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ---- Highscore List ---- */
.hs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hs-entry {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: rgba(255 255 255 / 0.1);
  font-size: 0.9rem;
  transition: background 150ms ease;
}

.hs-entry:hover { background: rgba(255 255 255 / 0.16); }

.hs-entry.current-player {
  background: linear-gradient(135deg, rgba(0 200 150 / 0.55), rgba(0 150 255 / 0.55));
  border: 1.5px solid rgba(0 200 150 / 0.7);
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  animation: pulse-player 2s ease-in-out infinite;
}

.hs-empty { justify-content: center; }

@keyframes pulse-player {
  0%, 100% { box-shadow: 0 0 8px rgba(0 200 150 / 0.4); }
  50%       { box-shadow: 0 0 18px rgba(0 200 150 / 0.75); }
}

.hs-entry.top-1 { background: linear-gradient(135deg, rgba(255 215 0 / 0.6), rgba(255 185 0 / 0.6)); border: 1.5px solid rgba(255 215 0 / 0.8); }
.hs-entry.top-2 { background: linear-gradient(135deg, rgba(192 192 192 / 0.5), rgba(169 169 169 / 0.5)); border: 1.5px solid rgba(192 192 192 / 0.7); }
.hs-entry.top-3 { background: linear-gradient(135deg, rgba(205 127 50 / 0.5), rgba(184 115 51 / 0.5)); border: 1.5px solid rgba(205 127 50 / 0.7); }
.hs-entry.is-me { outline: 1.5px solid rgba(255 255 255 / 0.5); }

.hs-rank { font-weight: 700; min-width: 24px; }
.hs-name { flex: 1; font-weight: 500; }
.hs-lvl  { font-weight: 700; }

/* ---- Show All Button ---- */
.show-all-btn {
  margin-top: var(--space-sm);
  width: 100%;
  padding: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #fff;
  background: rgba(255 255 255 / 0.12);
  border: 1.5px solid rgba(255 255 255 / 0.25);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 150ms ease;
}

.show-all-btn:hover { background: rgba(255 255 255 / 0.22); }

/* ---- Floating Combo Number (DOM-injiziert) ---- */
:global(.floating-number) {
  position: absolute;
  font-weight: 700;
  pointer-events: none;
  user-select: none;
  z-index: 10;
  transform: translateX(-50%);
  white-space: nowrap;
  animation: floatUp 1s ease-out forwards;
}

:global(.floating-number.size-normal) { font-size: 1.2rem; }
:global(.floating-number.size-small)  { font-size: 1.5rem; }
:global(.floating-number.size-medium) { font-size: 1.8rem; }
:global(.floating-number.size-large)  { font-size: 2.2rem; }
:global(.floating-number.size-huge)   { font-size: 2.7rem; }

@keyframes floatUp {
  0%   { opacity: 1; transform: translate(-50%,   0) scale(0.8); }
  50%  { opacity: 1; transform: translate(-50%, -30px) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -80px) scale(1); }
}
</style>
