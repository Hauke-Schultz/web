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

Jeden Tag wechselt das Minispiel automatisch. Drei Spiele rotieren per Day-Index:
- 🎰 Slot Machine (`SlotMachineGame.vue`)
- 🎡 Fortune Wheel (`FortuneWheelGame.vue`)
- 🐚 Three Shells (`ThreeShellsGame.vue`)

Die Logik liegt in `components/dailyReward/DailyRewardCard.vue` (eingebettet auf `/games`) und `pages/games/dailyReward/index.vue` (standalone Seite).

---

## Games Overview Page (`/games`)

Kachel-Grid mit allen Spielen.

| Seite / Spiel  | Route                 | Status        | Quelle (alt)          |
|----------------|-----------------------|---------------|-----------------------|
| Daily Reward   | Sektion auf /games    | ✅ Fertig      | —                     |
| Hawk Fruit     | `/games/hawkFruit`    | ✅ Fertig      | `games/hawkfruit/`    |
| Hawk Double-Up | `/games/hawkDoubleUp` | ✅ Fertig      | `games/hawkdoubleup/` |
| Hawk Tower     | `/games/hawkTower`    | ✅ Fertig      | `games/hawktower/`    |
| Shop           | `/games/shop`         | ✅ Fertig      | `views/Shop.vue`      |
| Profile        | `/games/profile`      | ✅ Fertig      | `views/Profile.vue`   |
| Hawk Star      | `/hawk-star`          | 🚧 In Arbeit  | Neu (kein Alt-System) |

**Daily Reward Kachel** ist eine eigenständige, expandierte Sektion (kein NuxtLink).

---

## Shared LocalStore — `hawk3_game_data`

Alle Spiele lesen und schreiben auf einen einzigen localStorage-Key: **`hawk3_game_data`**.
Derselbe Key wie auf der alten Website — kein Datenverlust beim Seitenwechsel.

### Top-level Struktur

```
hawk3_game_data (JSON, version "1.1")
├── player
│   ├── name
│   ├── avatar
│   ├── coins          ← Münzen (aus Daily Reward, Spiele, Shop)
│   ├── diamonds       ← Diamanten (aus Daily Reward, Spiele)
│   └── inventory
│       └── items      ← Object { [itemId]: { id, quantity, purchasedAt, type, category, rarity, name } }
│                         Enthält Shop-Käufe UND Mystery-Box-Items
├── currency
│   ├── dailyRewards
│   │   ├── lastClaimed   ← 'YYYY-MM-DD'
│   │   └── counter       ← Gesamt-Anzahl Belohnungen
│   └── mysteryBoxes
│       ├── lastClaimed
│       ├── totalClaimed
│       ├── lastClaimedCounter
│       └── pendingMysteryBox  ← null | { item, mysteryBoxNumber, ... }
├── games
│   ├── hawkFruit        ← aktiv (siehe unten)
│   ├── hawkDoubleUp     ← aktiv (siehe unten)
│   ├── hawkTower        ← aktiv (siehe unten)
│   ├── memory           ← Platzhalter
│   └── hawkDungeon      ← Platzhalter
├── settings             ← nicht aktiv
├── achievements         ← nicht aktiv
└── version              "1.1"
```

**Hinweis:** `shop.purchasedItems` existiert nicht mehr. Alle gekauften Items (Shop + Mystery Box) liegen in `player.inventory.items`.

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
    "6": { "completed": false, "highScore": 0, "bestMoves": null, "stars": 0, "attempts": 0, "bestPerformance": null }
  }
}
```

Rewards: `floor(score / 20)` Coins · `floor(score / 1000)` Diamonds — bei Game Over ausgezahlt.

### Hawk Double-Up (`games.hawkDoubleUp`)

```json
"hawkDoubleUp": {
  "highScore": 0,
  "gamesPlayed": 0,
  "savedGame": null
}
```

Rewards: `floor(score / 15)` Coins · `floor(score / 500)` Diamonds — bei Game Over ausgezahlt.

### Hawk Tower (`games.hawkTower`)

```json
"hawkTower": {
  "highScore": 0,
  "gamesPlayed": 0,
  "maxHeight": 0
}
```

Rewards: `height × 3` Coins · `floor(height / 10)` Diamonds — bei Game Over ausgezahlt.

---

## Shop

- `utils/shopConfig.js` — `SHOP_ITEMS`, `SHOP_CATEGORIES`, `RARITY`
- `pages/games/shop/index.vue` — Shop-UI mit Tab-Navigation (Profile / Items / Gifts)
- Kauf-Modal inline (confirm / broke / success)
- Gekaufte Items: `player.inventory.items[id]` — gleiche Struktur wie Mystery-Box-Items

### Kategorien
- **Profile** — Cosmetics (purchaseLimit: 1)
- **Items** — Consumables (Fruit Hammer, Undo Move; unbegrenzter Kauf)
- **Gifts** — Verschenkbare Cosmetics (purchaseLimit: 5–10)

---

## Hawk Star

Hawk-Star liegt in `/pages/hawk-star/` und ist ein eigenständiges Spiel (kein Teil des alten Systems).
Separate Dokumentation: `pages/hawk-star/hawk-star.md`
LocalStorage-Key: `hawkStarSave` (getrennt von `hawk3_game_data`)

---

## Neue Spiele implementieren — Checkliste

1. **Ordner anlegen**: `pages/games/<spielname>/index.vue`
2. **1 Level only**: Kein LevelSelection-Screen. Direkt ins Spiel.
3. **Save-Format** in `hawk3_game_data.games.<spielname>` hinzufügen
4. **`localStores.js`** um die neuen Felder erweitern
5. **Kachel** auf `pages/games/index.vue` auf `active: true` stellen
6. **i18n**: `de.json` + `en.json` um Spielname und UI-Texte erweitern
7. **Reward**: Coins/Diamonds bei Game Over gutschreiben und im Overlay anzeigen
8. **MD-Datei**: `pages/games/<spielname>/<spielname>.md` anlegen

---

## Implementation Status

| Task | Status |
|------|--------|
| `hawk3_game_data` helpers in `localStores.js` | ✅ Fertig |
| Games Overview Page (`/games`) | ✅ Fertig |
| Daily Reward (3 rotierende Spiele) | ✅ Fertig |
| Hawk Fruit (Endless Mode + Rewards) | ✅ Fertig |
| Hawk Double-Up (Endless Mode + Rewards) | ✅ Fertig |
| Hawk Tower (Endless Mode + Rewards) | ✅ Fertig |
| Shop (Profile / Items / Gifts) | ✅ Fertig |
| Profile-Seite | ✅ Fertig |
| Hawk Star (Kachel + Integration) | 🚧 In Arbeit |
| Games-Header (alle Seiten) | ✅ Fertig |
| i18n-Überarbeitung (alGames-Index Kachelnle Spiele + Shop + Profile) | ✅ Fertig |
| Games-Index Kacheln neu ordnen (Profile + Shop oben) | 🔲 Geplant |
| DailyRewardCard kompakter nach Claim | 🔲 Geplant |
| Light-Mode-Anpassung (Games-Bereich) | 🔲 Geplant |
