// ── LocalStore Key Registry ────────────────────────────────────────────────────
// Single source of truth for all localStorage keys used across the platform.
// Import from here — never hardcode key strings in components or composables.

export const LS_KEYS = {
  // Shared game data (same format as old website)
  HAWK3_DATA: 'hawk3_game_data',

  // Hawk-Star (own versioned save)
  HAWK_STAR_SAVE: 'hawk-star-save',
  HAWK_STAR_DEV:  'hawk-star-dev',

  // App
  THEME: 'theme',

  // Party
  PARTY_RSVP:        'party_rsvp',
  PARTY_LEVEL:       'party_level',
  PARTY_PLAYER_NAME: 'party_player_name',
  PARTY_PLAYER_ID:   'party_player_id',
}

// ── hawk3_game_data helpers ───────────────────────────────────────────────────

const freshHawkFruitLevel = () => ({
  completed:       false,
  highScore:       0,
  bestMoves:       null,
  stars:           0,
  attempts:        0,
  bestPerformance: null,
})

const freshHawkFruit = () => ({
  highScore:      0,
  totalScore:     0,
  gamesPlayed:    0,
  totalMerges:    0,
  maxCombo:       0,
  savedGame:      null,   // { score, nextFruit, nextNextFruit, fruits[], savedAt }
  levels: {
    '6': freshHawkFruitLevel(),   // 6 = Endless Mode
  },
})

const freshDailyRewards = () => ({
  lastClaimed:  '2023-01-01',
  counter:      0,
  lastReward:   null,   // { coins, diamonds } — reset each day
})

const freshMysteryBoxes = () => ({
  lastClaimed:        '2023-01-01',
  totalClaimed:       0,
  lastClaimedCounter: 0,
  pendingMysteryBox:  null,
  lastClaimedBox:     null,   // box claimed today — reset each day
})

const freshHawk3Data = () => ({
  version: '1.1',
  player: {
    name:     'Spieler',
    avatar:   'avatar/user',
    coins:    0,
    diamonds: 0,
  },
  currency: {
    dailyRewards: freshDailyRewards(),
    mysteryBoxes: freshMysteryBoxes(),
  },
  games: {
    hawkFruit:    freshHawkFruit(),
    memory:       { highScore: 0, gamesPlayed: 0 },
    hawkDoubleUp: { highScore: 0, gamesPlayed: 0, savedGame: null, milestones: {} },
    hawkTower:    { highScore: 0, gamesPlayed: 0, maxHeight: 0 },
  },
})

// Returns the full hawk3_game_data object. Falls back to fresh defaults if missing or corrupt.
export const loadHawk3Data = () => {
  try {
    const raw = localStorage.getItem(LS_KEYS.HAWK3_DATA)
    if (!raw) return freshHawk3Data()
    const data = JSON.parse(raw)
    // Ensure all game keys exist (forward-compat)
    data.games            = data.games            ?? {}
    data.games.hawkFruit  = data.games.hawkFruit  ?? freshHawkFruit()
    // Ensure required hawkFruit fields exist (forward-compat)
    data.games.hawkFruit.levels        = data.games.hawkFruit.levels        ?? {}
    data.games.hawkFruit.levels['6']   = data.games.hawkFruit.levels['6']   ?? freshHawkFruitLevel()
    if (!('savedGame' in data.games.hawkFruit)) data.games.hawkFruit.savedGame = null
    data.games.memory        = data.games.memory        ?? { highScore: 0, gamesPlayed: 0 }
    data.games.hawkDoubleUp  = data.games.hawkDoubleUp  ?? { highScore: 0, gamesPlayed: 0, savedGame: null, milestones: {} }
    if (!('savedGame'  in data.games.hawkDoubleUp)) data.games.hawkDoubleUp.savedGame  = null
    if (!('milestones' in data.games.hawkDoubleUp)) data.games.hawkDoubleUp.milestones = {}
    data.games.hawkTower     = data.games.hawkTower     ?? { highScore: 0, gamesPlayed: 0, maxHeight: 0 }
    if (!('maxHeight' in data.games.hawkTower)) data.games.hawkTower.maxHeight = 0
    // Player currency
    data.player              = data.player              ?? {}
    data.player.name         = data.player.name         ?? 'Spieler'
    data.player.avatar       = data.player.avatar       ?? 'avatar/user'
    data.player.coins              = data.player.coins              ?? 0
    data.player.diamonds           = data.player.diamonds           ?? 0
    data.player.inventory          = data.player.inventory          ?? {}
    data.player.inventory.items    = data.player.inventory.items    ?? {}
    // Daily rewards + mystery boxes
    data.currency                             = data.currency                             ?? {}
    data.currency.dailyRewards               = data.currency.dailyRewards               ?? freshDailyRewards()
    data.currency.dailyRewards.lastClaimed   = data.currency.dailyRewards.lastClaimed   ?? '2023-01-01'
    data.currency.dailyRewards.counter       = data.currency.dailyRewards.counter       ?? 0
    data.currency.mysteryBoxes               = data.currency.mysteryBoxes               ?? freshMysteryBoxes()
    if (!('pendingMysteryBox' in data.currency.mysteryBoxes)) data.currency.mysteryBoxes.pendingMysteryBox = null
    if (!('lastClaimedBox'    in data.currency.mysteryBoxes)) data.currency.mysteryBoxes.lastClaimedBox    = null
    if (!('lastReward'        in data.currency.dailyRewards)) data.currency.dailyRewards.lastReward        = null
    return data
  } catch {
    return freshHawk3Data()
  }
}

// Writes the full object back to localStorage.
export const saveHawk3Data = (data) => {
  localStorage.setItem(LS_KEYS.HAWK3_DATA, JSON.stringify(data))
}
