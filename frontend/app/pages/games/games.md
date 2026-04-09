# Gaming Platform

Entwicklungsreferenz für alle Spiele, den Shop und die gemeinsame Datenschicht.

---

## Altes System → Neues System

Das alte System liegt in `frontend/app/oldPageSrc/gamingHub/`. Dort liegen:
- **Spiele** in `games/`: `dailyReward/`, `hawkdoubleup/`, `hawkdungeon/`, `hawkfruit/`, `hawktower/`, `memory/`
- **Views**: `Gaming.vue`, `Profile.vue`, `Shop.vue`, `Trophy.vue`
- **Composables**: `useLocalStorage.js`, `useShop.js`, `useInventory.js`, `useComboSystem.js`
- **Config**: `shopConfig.js` (Shop-Items und Kategorien)

Alle alten Spiele hatten **6 Level** mit LevelSelection-Screen. Im neuen System gibt es **nur noch 1 Level** (Endless Mode) — kein LevelSelection-Screen, direkt ins Spiel. Der localStorage-Key `hawk3_game_data` bleibt identisch — **keine Datenmigration nötig**.

---

## Daily Reward — Spiel-Rotation

Jeden Tag wechselt das Minispiel automatisch. Die Logik steht in `pages/games/dailyReward`:

---

## Games Overview Page (`/games`)

Kachel-Grid mit allen Spielen.

| Spiel          | Route                 | Status       | Quelle (alt)          |
|----------------|-----------------------|--------------|-----------------------|
| Daily Reward   | Sektion auf /games    | ✅ Fertig     | —                     |
| Hawk Fruit     | `/games/hawkFruit`    | ✅ Fertig     | `games/hawkfruit/`    |
| Hawk Double-Up | `/games/hawkDoubleUp` | ✅ Fertig     | `games/hawkdoubleup/` |
| Hawk Tower     | `/games/hawkTower`    | ✅ Fertig    | `games/hawktower/`    |
| Shop           | `/games/shop`         | ✅ Fertig    | `views/Shop.vue`      |
| Hawk Star      | `/hawk-star`          | 🚧 In Arbeit | Neu (kein Alt-System) |

**Daily Reward Kachel** ist eine eigenständige, expandierte Sektion (kein NuxtLink).

---

## Shared LocalStore — `hawk3_game_data`

Alle Spiele lesen und schreiben auf einen einzigen localStorage-Key: **`hawk3_game_data`**.
Derselbe Key wie auf der alten Website — kein Datenverlust beim Seitenwechsel.

### Top-level Struktur

```
hawk3_game_data (JSON, version "1.1")
├── player
│   ├── coins          ← Münzen (aus Daily Reward, Shop)
│   └── diamonds       ← Diamanten (aus Daily Reward, Shop)
├── currency
│   ├── dailyRewards
│   │   ├── lastClaimed   ← 'YYYY-MM-DD'
│   │   └── counter       ← Gesamt-Anzahl Belohnungen
│   └── mysteryBoxes
│       ├── lastClaimed
│       ├── totalClaimed
│       ├── lastClaimedCounter
│       └── pendingMysteryBox  ← null | { item, mysteryBoxNumber, ... }
├── shop
│   └── purchasedItems    ← Array von Item-IDs
├── games
│   ├── hawkFruit        ← aktiv (siehe unten)
│   ├── memory           ← Platzhalter
│   ├── hawkDoubleUp     ← Platzhalter
│   ├── hawkTower        ← Platzhalter
│   └── hawkDungeon      ← Platzhalter
├── settings             ← nicht aktiv
├── achievements         ← nicht aktiv
└── version              "1.1"
```

Alter `counter`-Wert aus dem alten Format wird automatisch übernommen.

---

## Spiele — Save-Format

### Hawk Fruit (`games.hawkFruit`)

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

`levels["6"]` = Endless Mode. Im alten System war Level 6 das letzte von 6 Levels.
`savedGame` = null wenn kein laufendes Spiel. Wird bei jedem Drop und beim Verlassen gespeichert.
Bomb-Früchte werden **nicht** gespeichert (zu komplex zum Wiederherstellen).

### Hawk Double-Up (`games.hawkDoubleUp`) — Geplant

```json
"hawkDoubleUp": {
  "highScore": 0,
  "gamesPlayed": 0,
  "totalWins": 0,
  "savedGame": null
}
```

### Hawk Tower (`games.hawkTower`) — Geplant

```json
"hawkTower": {
  "highScore": 0,
  "gamesPlayed": 0,
  "maxHeight": 0,
  "savedGame": null
}
```

## Shop

### Altes System
- `oldPageSrc/gamingHub/views/Shop.vue` — Shop-UI mit Kategorien und Kauf-Modal
- `oldPageSrc/gamingHub/config/shopConfig.js` — SHOP_ITEMS, SHOP_CATEGORIES
- `oldPageSrc/gamingHub/composables/useShop.js` — Kauf-Logik, Leistbarkeit, Limits
- `oldPageSrc/gamingHub/composables/useInventory.js` — Inventar-Verwaltung

### Neues System
- `utils/shopConfig.js` — bereits erstellt (noch leer / in Arbeit)
- Shop-Seite: `/games/shop` — noch zu erstellen
- Kauf-Composable: `composables/useShop.js` — noch zu erstellen
- Gekaufte Items liegen in `hawk3_game_data.shop.purchasedItems`

### Shop-Kategorien (aus altem System übernehmen)
- **Profile** — Avatar-Items, Profilbild-Elemente
- **Power-Ups** — Einmalige Spielvorteile
- **Cosmetics** — Skins, Themes

---

## Hawk Star

Hawk-Star liegt in `/pages/hawk-star/` und ist ein eigenständiges Spiel (kein Teil des alten Systems).
Separate Dokumentation: `pages/hawk-star/hawk-star.md`
LocalStorage-Key: `hawkStarSave` (getrennt von `hawk3_game_data`)

Hawk-Star soll als Kachel auf der Games-Übersichtsseite erscheinen (Route `/hawk-star`).

---

## Neue Spiele implementieren — Checkliste

Für jedes neue Spiel aus dem alten System:

1. **Ordner anlegen**: `pages/games/<spielname>/index.vue`
2. **1 Level only**: Kein LevelSelection-Screen. Direkt ins Spiel.
3. **Save-Format** in `hawk3_game_data.games.<spielname>` hinzufügen (siehe oben)
4. **`localStores.js`** um die neuen Felder erweitern
5. **Kachel** auf `pages/games/index.vue` von "Coming Soon" auf aktiv stellen
6. **i18n**: `de.json` + `en.json` um Spielname und UI-Texte erweitern

---

## Implementation Status

| Task | Status |
|------|--------|
| `hawk3_game_data` helpers in `localStores.js` | ✅ Fertig |
| Games Overview Page (`/games`) | ✅ Fertig |
| Daily Reward | ✅ Fertig |
| Hawk Fruit (Endless Mode) | ✅ Fertig |
| Profile-Seite | ✅ Fertig |
| `utils/shopConfig.js` erstellt | ✅ Fertig (leer) |
| Hawk Double-Up | ✅ Fertig |
| Hawk Tower | ✅ Fertig |
| Shop-Seite + Logik | ✅ Fertig |
| Hawk Star (Kachel + Integration) | 🚧 In Arbeit |
