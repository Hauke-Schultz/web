# Hawk Tower

Block-Stacking-Spiel im Endless Mode. Ein Block schwingt horizontal über den Bildschirm — Tippen oder Leertaste lässt ihn fallen. Der Überlapp mit dem darunterliegenden Block bestimmt die neue Blockbreite. Kein Überlapp = Game Over.

---

## Game Concept

- Ein farbiger Block schwingt links↔rechts über das Canvas
- Tap / Klick / Leertaste: Block fällt auf den Turm
- Überlapp mit dem Block darunter → Block wird auf die Überlapp-Breite getrimmt
- Kein Überlapp (vollständiges Daneben) → Game Over
- Block wird zu schmal (< 20px) → Game Over
- Nach jedem platzierten Block steigt die Geschwindigkeit
- Der erste Block landet immer zentriert (perfekt)
- Kamera scrollt nach oben, sobald der Turm wächst

---

## Scoring

| Aktion | Punkte |
|--------|--------|
| Normaler Stack | `10 × Überlapp-Ratio` |
| Perfect Stack (≥ 93% Überlapp) | 15 + Combo × 5 |
| Erster Block | 15 (immer perfect) |

**Combo:** Zählt aufeinanderfolgende Perfect Stacks. Wird bei einem normalen Stack auf 0 zurückgesetzt.

---

## Geschwindigkeit

```
speed = min(BASE_SPEED + height × SPEED_INC, 600)
BASE_SPEED = 120 px/sec
SPEED_INC  = 4   px/sec pro Block
Max        = 600 px/sec
```

---

## Kamera

Ab Block 8 scrollt die Kamera mit:
```
cameraOffset = max(0, (height - 7) × BLOCK_H)
```
Der letzte platzierte Block bleibt immer im sichtbaren Bereich.

---

## Canvas & Blöcke

| Parameter | Wert |
|-----------|------|
| Canvas    | 320 × 480 px (logisch, DPR-aware) |
| Block-Höhe | 36 px |
| Startbreite | 200 px |
| Mindestbreite (Game Over) | 20 px |
| Perfect-Threshold | ≥ 93% Überlapp |
| Kamera-Threshold | 7 Blöcke |

**Farb-Zyklus (16 Farben, wiederholt sich):**
Rot → Orange → Amber → Gelb → Lime → Grün → Emerald → Teal → Cyan → Sky → Blau → Indigo → Violett → Lila → Fuchsia → Pink

---

## Speicher-Format (`hawk3_game_data.games.hawkTower`)

```json
"hawkTower": {
  "highScore": 0,
  "gamesPlayed": 0,
  "maxHeight": 0
}
```

Kein `savedGame` — der Spielstand wird nicht zwischen Sessions gespeichert.

---

## Architecture

| Datei | Inhalt |
|-------|--------|
| `pages/games/hawkTower/index.vue` | Vollständige Game-Logic + Canvas-Rendering + Template (Single File) |
| `utils/localStores.js` | `loadHawk3Data()`, `saveHawk3Data()` |
| `i18n/de.json` + `en.json` | Keys unter `games.tower.*` |

**Rendering:** HTML5 Canvas (`requestAnimationFrame`-Loop), DPR-aware  
**Input:** Tap (Touch) + Klick (Mouse) + Leertaste (Keyboard)  
**State:** Alles lokal in `index.vue` (kein Composable, kein Store)  
**Falling Pieces:** Abgeschnittene Blöcke fallen mit Gravity (700 px/s²) und werden mit 2.5/s ausgeblendet

---

## Status

### Done ✅
- Canvas-Rendering mit `requestAnimationFrame`-Loop (DPR-aware)
- Block-Bewegung links↔rechts mit Wandabprall
- Overlap-Berechnung + Block-Trimming
- Falling Piece (abgeschnittener Teil fällt mit Gravity + Fade)
- Perfect-Erkennung (≥93%) mit Badge-Animation
- Combo-System mit Anzeige
- Kamera-Scrolling (ab Block 7)
- Progressive Geschwindigkeit (bis 600 px/sec)
- Farbzyklus (16 Farben)
- Block-Glow + Highlight-Effekte
- Start- und Game-Over-Overlay auf dem Canvas
- Highscore + maxHeight persistent in `hawk3_game_data`
- i18n (DE/EN)

### Geplant / Ideen 🔲
- Animierte Tile-Bewegung bei Kamera-Scroll (sanftes Lerp statt instant)
- Score-Milestone-Anzeige (z. B. bei 10, 25, 50 Blöcken)
- Online-Leaderboard / globale Highscores
- Breiter werdende Blöcke bei Perfect-Streak (Bonus)
- Hintergrund-Parallax-Effekt beim Scrollen
