# Hawk Double-Up

Ein 2048-Klon im Endless Mode. Zahlen auf einem 4×4-Grid durch Wischen oder Pfeiltasten verschieben — gleiche Zahlen verschmelzen und verdoppeln sich. Ziel: möglichst hoher Score.

---

## Game Concept

- 4×4 Grid, Start mit zwei zufälligen Tiles (2 oder 4)
- Swipe oder Pfeiltasten: alle Tiles rutschen in die Richtung, gleiche Zahlen mergen
- Merged Wert = alter Wert × 2 → Score steigt um den Merged-Wert
- Nach jedem Zug spawnt ein neues Tile (90% Chance: 2, 10% Chance: 4)
- Game Over: keine Züge mehr möglich (kein leeres Feld, keine benachbarten gleichen Zahlen)
- Highscore + Spielstand werden in `hawk3_game_data` gespeichert

---

## Tile-Farben

| Wert  | Hintergrund | Textfarbe |
|-------|-------------|-----------|
| 2     | `#eee4da`   | `#776e65` |
| 4     | `#ede0c8`   | `#776e65` |
| 8     | `#f2b179`   | `#f9f6f2` |
| 16    | `#f59563`   | `#f9f6f2` |
| 32    | `#f67c5f`   | `#f9f6f2` |
| 64    | `#f65e3b`   | `#f9f6f2` |
| 128   | `#edcf72`   | `#f9f6f2` |
| 256   | `#edcc61`   | `#f9f6f2` |
| 512   | `#edc850`   | `#f9f6f2` |
| 1024  | `#edc53f`   | `#f9f6f2` |
| 2048  | `#edc22e`   | `#f9f6f2` |
| 4096  | `#3c3a32`   | `#f9f6f2` |
| 8192+ | `#000000`   | `#f9f6f2` |

---

## Countdown-Tile (Spezial)

- 5% Chance pro Zug zu spawnen, wenn mehr als 4 Felder frei sind
- Startet mit Wert **7** (leuchtet mit gelbem Glow-Rand)
- Zählt nach jedem Zug um 1 runter: 7 → 6 → 5 → 4
- Bei Wert 4 wird das Tile zu einem normalen 4er (kann danach normal gemergt werden)
- Tile-Farben: 7 = violett (`#4c1ff4`), 6 = lila (`#6049b6`), 5 = grau-lila (`#6d6881`)

---

## Rewards

Am Spielende werden Coins und Diamonds basierend auf dem erzielten Score gutgeschrieben:

| Währung | Formel |
|---------|--------|
| Coins | `floor(score / 15)` |
| Diamonds | `floor(score / 500)` |

Beispiele: Score 750 → 50 Coins, 1 Diamond. Score 300 → 20 Coins, 0 Diamonds.
Anzeige im Game-Over-Overlay. Werden direkt in `hawk3_game_data.player` gespeichert.

---

## Speicher-Format (`hawk3_game_data.games.hawkDoubleUp`)

```json
"hawkDoubleUp": {
  "highScore": 0,
  "gamesPlayed": 0,
  "savedGame": null
}
```

`savedGame` enthält beim laufenden Spiel:
```json
{
  "grid": [[...], [...], [...], [...]],
  "score": 1234,
  "countdown": { "row": 2, "col": 1, "value": 6 }
}
```

`savedGame = null` wenn kein laufendes Spiel.

---

## Architecture

| Datei | Inhalt |
|-------|--------|
| `pages/games/hawkDoubleUp/index.vue` | Vollständige Game-Logic + Template (Single File) |
| `utils/localStores.js` | `loadHawk3Data()`, `saveHawk3Data()` |
| `i18n/de.json` + `en.json` | Keys unter `games.doubleUp.*` |

**Input:** Swipe (Touch) + Pfeiltasten / WASD (Keyboard)
**Animationen:** CSS `@keyframes pop` (neues Tile) + `merge` (Verschmelzung)
**State:** Alles lokal in `index.vue` (kein Composable, kein Store)

---

## Status

### Done ✅
- 4×4 Grid mit Merge-Logik (alle vier Richtungen)
- Tile-Farben aus dem originalen 2048-Farbschema
- Swipe-Input (Touch) + Keyboard (Arrow / WASD)
- Spawn neuer Tiles nach jedem gültigen Zug
- Game-Over-Erkennung
- Pop- und Merge-Animationen (CSS)
- Countdown-Tile (7 → 4, mit Glow)
- Auto-Save nach jedem Zug, Wiederherstellung beim nächsten Besuch
- Highscore persistent in `hawk3_game_data`
- i18n (DE/EN)

### Geplant / Ideen 🔲
- Score-Milestone-Anzeige (z. B. "2048 erreicht!")
- Bestenliste / globale Highscores
- Undo-Button (1 Zug zurück)
- Animierte Tile-Bewegung (CSS translate statt instant snap)
