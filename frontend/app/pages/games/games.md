# Gaming

Overview page and shared data layer for all games on the platform.

---

## Games Overview Page (`/games`)

A tile grid showing all available games.

| Game           | Tile status | Hinweis |
|----------------|-------------|---------|
| Daily Reward   | ✅ Active | Zeigt Heute-Spiel + "Abgeholt"-Badge |
| Hawk Fruit     | ✅ Active | |
| Hawk Memory    | 🔒 Coming Soon | |
| Hawk Double-Up | 🔒 Coming Soon | |
| Hawk Tower     | 🔒 Coming Soon | |

**Daily Reward Kachel** ist speziell:
- Badge: "Neu!" (nicht abgeholt) oder "✅ Abgeholt" (heute bereits gespielt)
- Untertitel: "Heute: 🎰 Slot Machine · …" (dynamisch aus `DAILY_GAMES` Rotation)
- Footer: "Spielen →" oder "Morgen wieder →"
- Liest `currency.dailyRewards.lastClaimed` beim Mount (kein SSR-Problem, nur `onMounted`)

---

## Shared LocalStore — `hawk3_game_data`

All games read and write from a single shared localStorage key: **`hawk3_game_data`**. This is the same key and format used on the old website — no migration needed.

### Top-level structure

```
hawk3_game_data (JSON, version "1.1")
├── player
│   ├── coins          ← Münzen (aus Daily Reward)
│   └── diamonds       ← Diamanten (aus Daily Reward)
├── currency
│   ├── dailyRewards
│   │   ├── lastClaimed   ← 'YYYY-MM-DD' — letzter Claim-Tag
│   │   └── counter       ← Gesamt-Anzahl abgeholter Belohnungen
│   └── mysteryBoxes
│       ├── lastClaimed
│       ├── totalClaimed
│       ├── lastClaimedCounter
│       └── pendingMysteryBox  ← null | { item, mysteryBoxNumber, ... }
├── settings      ← nicht aktiv
├── games
│   ├── hawkFruit     ← aktiv
│   ├── memory        ← Platzhalter
│   ├── hawkDoubleUp  ← Platzhalter
│   └── hawkTower     ← Platzhalter
├── cardStates    ← nicht aktiv
├── achievements  ← nicht aktiv
├── notifications ← nicht aktiv
└── version       "1.1"
```

Alter `counter`-Wert aus dem alten Format wird automatisch übernommen — kein Reset beim Wechsel zur neuen Seite.

---

## Daily Reward — Slot Machine (`/games/dailyReward`)

### Konzept

- Einmal pro Tag kann die Slot-Maschine gedreht werden
- Symbole: 💰 (Coins) und 💎 (Diamonds)
- Reward hängt von der Kombination ab (3x 💎 = Jackpot, etc.)
- Reward wird zu `player.coins` / `player.diamonds` addiert
- `currency.dailyRewards.counter` wird um 1 erhöht
- Nach jeweils **5 verschiedenen Tagen** (counter % 5 === 0) entsteht eine **Mystery Box**

### Mystery Box Progression

```
counter  1 → kein Box
counter  2 → kein Box
counter  3 → kein Box
counter  4 → kein Box
counter  5 → 🎁 Mystery Box #1 (Tier 1 — Rare)   pendingMysteryBox gesetzt
counter 10 → 🎁 Mystery Box #2 (Tier 1 — Rare)
counter 15 → 🎁 Mystery Box #3 (Tier 1 — Rare)
counter 20 → 🎁 Mystery Box #4 (Tier 2 — Epic)
...
counter 35 → 🎁 Mystery Box #7 (Tier 3 — Legendary)
```

Alter counter-Wert (z. B. 1 aus dem alten Spiel) zählt weiter — kein Reset.

### Mystery Box Items (aus `utils/mysteryBoxConfig.js`)

| Box # | Item | Rarity |
|-------|------|--------|
| 1 | Magic Hat 🎩 | Rare |
| 2 | Crystal Orb 🔮 | Rare |
| 3 | Golden Feather 🪶 | Rare |
| 4 | Unicorn Horn 🦄 | Epic |
| 5 | Dragon Scale 🐲 | Epic |
| 6 | Star Fragment ⭐ | Epic |
| 7+ | Cosmic Crown 👑, etc. | Legendary |

### Reward-Tabelle (Slot)

| Kombination | Coins | Diamonds |
|------------|-------|----------|
| 💎💎💎 Jackpot | 200 | 8 |
| 💰💰💰 Triple Coins | 150 | 3 |
| 💎💎 Double Diamonds | 120 | 5 |
| 💰💰 Double Coins | 80 | 2 |
| Gemischt | 60 | 2 |

### Datenfluss

1. Seite öffnen → `loadHawk3Data()`
2. `lastClaimed === today` → Zustand `claimed` (Slot gesperrt)
3. Spin → Reel-Animation → `finishSpin()` → `reward` gesetzt
4. „Einsammeln" → `player.coins += reward.coins`, `player.diamonds += reward.diamonds`
5. `dailyRewards.counter++`, `lastClaimed = today`
6. `counter % 5 === 0` → `pendingMysteryBox = calculateMysteryBoxReward(boxNumber)`
7. `saveHawk3Data()`

### Mystery Box Claim

- Solange `pendingMysteryBox !== null`: Box-Karte wird angezeigt (Goldrahmen-Glow)
- Klick „Einsammeln" → Item zu `player.inventory.items` hinzufügen
- `pendingMysteryBox = null`, `lastClaimedCounter = counter`, `totalClaimed++`

### Daily Game Rotation

`DAILY_GAMES` Array in `dailyReward/index.vue` und `games/index.vue` (synchron halten!):

```js
const DAILY_GAMES = [
  { key: 'slot',   label: 'Slot Machine', emoji: '🎰', component: SlotMachineGame },
  // { key: 'shells', label: 'Three Shells', emoji: '🐚', component: ThreeShellsGame },
  // { key: 'whack',  label: 'Whack-a-Mole', emoji: '🦔', component: WhackAMoleGame  },
]
const dayIndex  = Math.floor(Date.now() / 86400000)  // Tage seit Epoch
const todayGame = DAILY_GAMES[dayIndex % DAILY_GAMES.length]
```

Neue Spiele: Komponente in `dailyReward/` erstellen, emittet `game-complete` mit `{ coins, diamonds, label }`. Dann in das Array eintragen — der Hub kümmert sich um alles andere.

### Dateien

| Datei | Inhalt |
|-------|--------|
| `pages/games/dailyReward/index.vue` | Hub: Rotation, game-complete Handler, Mystery Box |
| `pages/games/dailyReward/SlotMachineGame.vue` | Slot-Machine-Komponente (emittet game-complete) |
| `utils/mysteryBoxConfig.js` | Item-Liste, Box-Logik (`calculateMysteryBoxReward`, etc.) |
| `utils/localStores.js` | `player.coins/diamonds`, `currency.dailyRewards`, `currency.mysteryBoxes` |

---

## Hawk-Fruit Save Format

The `games.hawkFruit` object inside `hawk3_game_data`:

```json
"hawkFruit": {
  "highScore": 0,
  "totalScore": 0,
  "gamesPlayed": 0,
  "totalMerges": 0,
  "maxCombo": 0,
  "savedGame": null,
  "levels": {
    "6": {
      "completed": false,
      "highScore": 0,
      "bestMoves": null,
      "stars": 0,
      "attempts": 0,
      "bestPerformance": null
    }
  }
}
```

Fields removed compared to the old format: `maxLevel`, `completedLevels`, `stars` (top-level) — these were level-count artefacts. The `levels` object always contains exactly **one entry: `"6"`** — Level 6 is always the **Endless Mode**.

### `savedGame` — Resume-State

`savedGame` is `null` when no game is in progress. When a fruit is dropped, the board state is written automatically. On unmount (navigating away), it is also saved.

```json
"savedGame": {
  "score": 1500,
  "nextFruit": "APPLE",
  "nextNextFruit": "LEMON",
  "fruits": [
    { "type": "APPLE",      "x": 120, "y": 300, "angle": 0.5 },
    { "type": "MOLD_FRUIT", "x": 80,  "y": 200, "angle": 0.1, "moldRadius": 20 }
  ],
  "savedAt": "2026-04-07T..."
}
```

- Bomb fruits are **not** saved (too complex to restore mid-fuse)
- On Game Over or Restart: `savedGame` is set to `null`

---

## Implementation Plan

### `utils/localStores.js`
- Add `HAWK3_DATA: 'hawk3_game_data'` to `LS_KEYS`
- Export `loadHawk3Data()` — returns the full parsed object, or a fresh default if missing
- Export `saveHawk3Data(data)` — writes the full object back

### `pages/games/index.vue`
- Grid of 4 game tiles
- Each tile reads its high score from `hawk3_game_data.games[key].highScore`
- Inactive tiles get a lock overlay, no click action
- Active tiles link to the game route

### `pages/games/hawkFruit/index.vue`
- On mount: load via `loadHawk3Data()`, check `savedGame` → restore board if present
- On drop: save board state to `savedGame` (after cooldown)
- On unmount: save board state to `savedGame`
- On game over: update `highScore`, `totalScore`, `gamesPlayed`, `totalMerges`, `maxCombo` and `levels["6"]`, clear `savedGame`
- On restart: clear `savedGame`

### `utils/localStores.js`
- Remove `HAWK_FRUIT_HS` (replaced by `HAWK3_DATA`)
- Keep the key registry clean — no dead keys

---

## Profil-Seite (`/games/profile`)

Zeigt alles, was der Spieler bisher gesammelt hat.

### Sections

| Abschnitt | Inhalt |
|-----------|--------|
| Balance | 💰 Coins · 💎 Diamonds |
| Stats | Daily Rewards gesamt · Mystery Boxes gesamt · Items gesamt |
| Mystery Items | Alle geclaim'ten Items aus `player.inventory.items`, sortiert nach Rarity (Legendary → Epic → Rare) |

### Rarity-Farben

| Rarity | Badge-Farbe | Karten-Hintergrund |
|--------|------------|-------------------|
| Legendary | `text-violet-400` | `bg-violet-500/15 border-violet-500/40` |
| Epic | `text-purple-400` | `bg-purple-500/15 border-purple-500/40` |
| Rare | `text-blue-400` | `bg-blue-500/15 border-blue-500/40` |

### Item-Daten

Items werden in `player.inventory.items` als Dictionary gespeichert (Key = `item.id`):

```json
"magic_hat": {
  "id": "magic_hat",
  "name": "Magic Hat",
  "icon": "🎩",
  "description": "A mysterious hat that sparkles with ancient magic",
  "rarity": "rare",
  "tier": 1,
  "mysteryBoxNumber": 1,
  "type": "cosmetic",
  "category": "profile",
  "quantity": 1,
  "purchasedAt": "2026-04-07T..."
}
```

Fehlende Felder (z.B. `icon` aus alten Saves) werden per Fallback aus `utils/mysteryBoxConfig.js → MYSTERY_ITEMS` nachgeladen.

### Profile Card auf Games-Übersicht

Oberhalb der Game-Tiles wird eine Profile Card eingeblendet:
- Zeigt Coins, Diamonds, Anzahl Mystery Items
- Link zu `/games/profile`

### Dateien

| Datei | Inhalt |
|-------|--------|
| `pages/games/profile/index.vue` | Profil-Seite |
| `pages/games/index.vue` | Profile Card Section |

---

## Implementation Status

| Task | Status |
|------|--------|
| `hawk3_game_data` helpers in `localStores.js` | ✅ Done |
| Games overview page (`/games`) with 4 tiles | ✅ Done |
| Hawk-Fruit reads/writes `hawk3_game_data` | ✅ Done |
| Hawk-Fruit reduced to 1 level | ✅ Done |
| Rainbow Fruit in new Hawk-Fruit page | ✅ Done |
| Level 6 = Endless Mode (einziges Level) | ✅ Done |
| Board-Zustand speichern + weitermachen | ✅ Done |
| `utils/mysteryBoxConfig.js` migrieren | ✅ Done |
| `localStores.js` um currency + player erweitern | ✅ Done |
| Daily Reward Hub (`/games/dailyReward`) mit Rotation | ✅ Done |
| `SlotMachineGame.vue` als eigenständige Komponente | ✅ Done |
| Daily Reward Kachel auf Games-Übersicht | ✅ Done |
| Mystery Box Claim speichert alle Item-Felder (inkl. icon) | ✅ Done |
| Profil-Seite (`/games/profile`) mit Mystery Items | ✅ Done |
| Profile Card auf Games-Übersicht | ✅ Done |
