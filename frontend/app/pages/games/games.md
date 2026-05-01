# Gaming Platform

Entwicklungsreferenz für alle Spiele, den Shop und die gemeinsame Datenschicht.

---

## Altes System → Neues System

Das alte System liegt in `frontend/app/oldPageSrc/gamingHub/`. Dort liegen:
- **Spiele** in `games/`: `dailyReward/`, `hawkdoubleup/`, `hawkfruit/`, `hawktower/`
- **Views**: `Gaming.vue`, `Profile.vue`, `Shop.vue`, `Trophy.vue`
- **Composables**: `useLocalStorage.js`, `useShop.js`, `useInventory.js`, `useComboSystem.js`
- **Config**: `shopConfig.js` (Shop-Items und Kategorien)

Alle alten Spiele hatten **6 Level** mit LevelSelection-Screen. Im neuen System gibt es **nur noch 1 Level** (Endless Mode) — kein LevelSelection-Screen, direkt ins Spiel. Der localStorage-Key `hawk3_game_data` bleibt identisch — **keine Datenmigration nötig**.

---

## Daily Reward — Spiel-Rotation

Jeden Tag wechselt das Minispiel automatisch. Fünf Spiele rotieren per Day-Index:
- 🎰 Slot Machine (`SlotMachineGame.vue`) — 5 Versuche, Lever-Steuerung
- 🎡 Fortune Wheel (`FortuneWheelGame.vue`) — 5 Versuche, Lever-Steuerung
- 🐚 Three Shells (`ThreeShellsGame.vue`) — 1 Runde, Shell-Tipp-Mechanik
- 🐭 Whack-a-Mole (`WhackAMoleGame.vue`) — 9 Moles, Reaktionsspiel
- 🎟️ Scratch Card (`ScratchCardGame.vue`) — 3×3 Kratzkarte, Symbole aufdecken

### Scratch Card — Design

3×3 Grid (9 Felder), alle verdeckt. Spieler tippt jedes Feld einzeln an um es aufzudecken, oder nutzt "Alle aufdecken" für eine sequenzielle Auto-Animation. Nach Aufdecken aller 9 Felder wird das Ergebnis anhand der Symbole bewertet.

**Gewinn-Logik (Priorität absteigend):**
1. 3 gleiche Symbole in einer Reihe/Spalte/Diagonale → **Line** (wie Tic-Tac-Toe)
2. 3 gleiche Symbole irgendwo → **Triple**
3. 2 gleiche Symbole → **Pair**
4. Keine Übereinstimmung → **Trostpreis**

**Reward-Staffelung:**
| Ergebnis | Coins | Diamonds | Label |
|----------|-------|----------|-------|
| Line     | 180   | 7        | 🎉 3 in einer Reihe! |
| Triple   | 110   | 4        | ✨ Drei Gleiche! |
| Pair     | 55    | 1        | 💫 Pärchen! |
| None     | 20    | 0        | 🥲 Kein Treffer |

Gewinnende Felder werden grün hervorgehoben. Symbole: 💰 💎 ⭐ 🔔 🍀

### Extra Play — Einwurf-Slot

Wer heute schon gespielt hat, kann für **50 Coins** eine Extra-Runde kaufen. Der Spieler wählt aus allen 4 täglichen Spielen frei aus. Der Gewinn (Coins + Diamonds) wird gutgeschrieben, aber der `dailyRewards.counter` wird **nicht** erhöht — kein Mystery-Box-Fortschritt. Coins-Check und Abzug erfolgen vor dem Start. Nach dem Spiel kehrt die Karte zum compakten Claimed-View zurück.

UI: Separator-Linie → Coins-Anzeige (grün/rot je nach Guthaben) → 4 Emoji-Buttons (Spiel wählen) → gelber "Einwerfen"-Button.

### Whack-a-Mole — Design

9 Löcher (3×3 Grid). Nacheinander taucht je eine Maus zufällig auf (max. 1000 ms sichtbar). Klickt der Spieler rechtzeitig → 🔨 Hit (+1 Punkt). Reagiert er zu langsam → 💨 Miss. Nach 9 Runden erscheint das Ergebnis mit inline Claim-Button.

**Reward-Staffelung:**
| Treffer | Coins | Diamonds | Label |
|---------|-------|----------|-------|
| 8–9     | 150   | 6        | 🏆 Perfekt! |
| 6–7     | 100   | 3        | 🎉 Super! |
| 4–5     | 70    | 2        | 👍 Gut! |
| 2–3     | 40    | 1        | Nicht schlecht! |
| 0–1     | 20    | 0        | 🥲 Üb weiter! |

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
| Hawk Star      | `/games/hawkStar`     | 🚧 In Arbeit  | Neu (kein Alt-System) |
| Hawk Coin      | `/games/hawkCoin`     | 🔲 Geplant    | Neu (kein Alt-System) |

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
│   └── hawkTower        ← aktiv (siehe unten)
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

Hawk-Star liegt in `/pages/games/hawkStar/` und ist ein eigenständiges Spiel (kein Teil des alten Systems).
Separate Dokumentation: `pages/games/hawkStar/hawk-star.md`
LocalStorage-Key: `hawkStarSave` (getrennt von `hawk3_game_data`)

---

## Hawk Coin

Hawk-Coin liegt in `/pages/games/hawkCoin/` und ist ein eigenständiges Spiel (kein Teil des alten Systems).
Separate Dokumentation: `pages/games/hawkCoin/hawkCoin.md`
Save-Format: `hawk3_game_data.games.hawkCoin`

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
| Daily Reward (4 rotierende Spiele) | ✅ Fertig |
| Hawk Fruit (Endless Mode + Rewards) | ✅ Fertig |
| Hawk Double-Up (Endless Mode + Rewards) | ✅ Fertig |
| Hawk Tower (Endless Mode + Rewards) | ✅ Fertig |
| Shop (Profile / Items / Gifts) | ✅ Fertig |
| Profile-Seite | ✅ Fertig |
| Games-Header (alle Seiten) | ✅ Fertig |
| i18n-Überarbeitung (alGames-Index Kachelnle Spiele + Shop + Profile) | ✅ Fertig |
| Games-Index Kacheln neu ordnen (Profile + Shop oben) | ✅ Fertig |
| Light-Mode-Anpassung (Games-Bereich) | 🔲 Geplant |
| Hawk Star (Kachel + Integration) | ✅ Fertig |
| Hawk Coin (Coin Pusher) | 🔲 Geplant |
