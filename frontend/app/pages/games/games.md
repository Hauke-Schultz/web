# Gaming

Overview page and shared data layer for all games on the platform.

---

## Games Overview Page (`/games`)

A tile grid showing all available games. Only **Hawk Fruit** is active — all other tiles are visible but locked ("Coming Soon").

| Game           | Key in `hawk3_game_data` | Tile status |
|----------------|--------------------------|-------------|
| Hawk Fruit     | `games.hawkFruit` | ✅ Active |
| Hawk Memory    | `games.memory` | 🔒 Coming Soon |
| Hawk Double-Up | `games.hawkDoubleUp` | 🔒 Coming Soon |
| Hawk Tower     | `games.hawkTower` | 🔒 Coming Soon |

Each tile shows: game icon, name, high score (if any), and a lock overlay for inactive games.

---

## Shared LocalStore — `hawk3_game_data`

All games read and write from a single shared localStorage key: **`hawk3_game_data`**. This is the same key and format used on the old website — no migration needed.

### Top-level structure

```
hawk3_game_data (JSON, version "1.1")
├── player        ← not used yet on new site
├── currency      ← not used yet on new site
├── settings      ← not used yet on new site
├── games
│   ├── hawkFruit     ← active
│   ├── memory        ← placeholder only
│   ├── hawkDoubleUp  ← placeholder only
│   └── hawkTower     ← placeholder only
├── cardStates    ← not used yet
├── achievements  ← not used yet
├── notifications ← not used yet
└── version       "1.1"
```

On first load, if `hawk3_game_data` does not exist, it is initialised with sensible defaults for all known game keys so that future sections can be written without checking for existence.

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
