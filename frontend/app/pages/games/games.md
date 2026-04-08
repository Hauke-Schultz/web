# Gaming

Overview page and shared data layer for all games on the platform.

---

## Games Overview Page (`/games`)

A tile grid showing all available games.

| Game           | Tile status | Hinweis |
|----------------|-------------|--------|
| Daily Reward   | ✅ Active | |
| Hawk Fruit     | ✅ Active | |
| Hawk Memory    | 🔒 Coming Soon | |
| Hawk Double-Up | 🔒 Coming Soon | |
| Hawk Tower     | 🔒 Coming Soon | |
| Hawk Star      | 🔒 Coming Soon | |

**Daily Reward Kachel** ist eine eigenständige, expandierte Sektion (kein NuxtLink)

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

## Implementation Status

| Task | Status |
|------|--------|
| `hawk3_game_data` helpers in `localStores.js` | ✅ Done |
| Games overview page (`/games`) with 4 tiles | ✅ Done |
