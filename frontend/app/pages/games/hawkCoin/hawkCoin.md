# Hawk Coin — Coin Pusher

Ein browserbasiertes Coin-Pusher-Spiel inspiriert von klassischen Arcade-Automaten. Blick von **oben** auf das Spielfeld: zwei übereinanderliegende Platten, die bewegte obere Platte schiebt Münzen auf die untere, von der sie herausfallen können.

---

## Perspektive & Darstellung

Der Automat wird **von oben** betrachtet — Vogelperspektive direkt auf das Spielfeld.

```
┌─────────────────────────────────┐
│     [ Einwurf-Zone oben ]       │  ← Spieler wirft Münzen von oben
│                                 │
│  ○   ○     ○   ○   ○    ○      │  ← Münzen auf der bewegten Platte
│  ○     ○  ○   ○   ○    ○   ○   │
│══════════════════════════════════│  ← Vorderkante der bewegten Platte
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ↑ bewegte Platte (1/3 Höhe, fährt ↑↓)
│══════════════════════════════════│  ← Hinterkante der bewegten Platte
│                                 │
│  ○  ○   ○    ○  ○   ○  ○  ○   │  ← Münzen auf der unteren (festen) Platte
│  ○    ○  ○   ○   ○   ○   ○     │
│  ○  ○   ○  ○   ○  ○    ○  ○   │
└─────────────────────────────────┘
          ↓   ↓   ↓
    (Münzen fallen unten heraus = Gewinn)
```

- Die **bewegte Platte** (obere) nimmt ~1/3 der Spielfeldhöhe ein und fährt kontinuierlich vor (↓) und zurück (↑)
- Die **untere Platte** ist größer (~2/3 der Spielfeldhöhe) und liegt fest darunter
- Münzen werden von oben auf die bewegte Platte geworfen
- Die Vorderkante der bewegten Platte schiebt Münzen, die sich auf der **unteren Platte** befinden, wenn sie sich nach unten bewegt
- Münzen, die über die untere Kante der **bewegten Platte** kippen, landen auf der **unteren Platte**
- Münzen, die über die untere Kante der **unteren Platte** fallen → **Gewinn**

---

## Game Concept

- Vogelperspektive (Top-Down) auf das Spielfeld
- Spieler wählt die X-Position der Münze frei (hover/drag in der Einwurf-Zone oben)
- Bei Klick/Tap fällt die Münze auf die bewegte Platte
- Die bewegte Platte fährt kontinuierlich vor (↓) und zurück (↑) — schiebt Münzen in beide Richtungen
- Wenn Münzen von der bewegten Platte über deren Vorderkante fallen → landen auf der unteren Platte
- Wenn Münzen auf der unteren Platte über die untere Kante fallen → Gewinn
- Die bewegte Platte schiebt auch Münzen auf der **unteren Platte**, wenn ihre Vorderkante nach unten fährt
- Game Over: wenn das Einwurf-Budget aufgebraucht ist
- Ziel: maximalen Netto-Gewinn erzielen

---

## Spielmechanik

### Einwurf
- Spieler bewegt die Maus/den Finger horizontal in der Einwurf-Zone (ganz oben im Canvas)
- Eine Geister-Münze zeigt die gewählte X-Position an (Drop-Preview)
- Klick/Tap: Münze spawnt an der gewählten X-Position und fällt auf die bewegte Platte
- Budget wird um 1 verringert

### Spielfeld-Aufbau (Canvas von oben nach unten)

```
┌─────────────────────────┐  y=0
│   Einwurf-Zone          │  Münzwurf-Leiste (interaktiv, ~60px)
├─────────────────────────┤  y=60
│   Freier Fall           │  Münze fällt hier herunter (~40px)
├─────────────────────────┤  y=100
│                         │
│   Bewegte Platte        │  ~1/3 der Spielfeldhöhe
│   (fährt ↑↓)           │
│                         │
├─────────────────────────┤  y=Mitte
│                         │
│   Untere Platte         │  ~2/3 der Spielfeldhöhe (größer, fest)
│   (statisch)            │
│                         │
└─────────────────────────┘  y=max
         ↓ ↓ ↓
    Gewinn-Kante (Sensor)
```

| Bereich | Beschreibung |
|---------|-------------|
| Einwurf-Zone (oben) | Münz-Drop-Leiste, interaktiv |
| Freier Fall | Münze fällt hier auf die bewegte Platte |
| Bewegte Platte | ~1/3 Höhe, fährt kontinuierlich vor/zurück (↑↓), schiebt Münzen |
| Untere Platte | Größer (~2/3), statisch — sammelt Münzen von oben |
| Austritts-Kante (unten) | Sensor: Münzen die hier ankommen = Gewinn |

### Bewegte Platte (obere Platte)

- Rechteckiger kinematischer Body in Matter.js (volle Canvas-Breite)
- Höhe: ~1/3 des nutzbaren Spielfelds
- Bewegt sich mit konstanter Geschwindigkeit auf der **Y-Achse**: Amplitude + Tempo konfigurierbar
- Position wird per `Body.setPosition()` gesetzt (kein Physics-Einfluss auf die Platte selbst)
- **Schiebt Münzen auf der bewegten Platte** durch physikalische Kollision
- **Schiebt Münzen auf der unteren Platte** wenn die Vorderkante nach unten fährt und in deren Bereich eindringt

### Untere Platte (feste Platte)

- Statischer rechteckiger Body (volle Canvas-Breite)
- Höhe: ~2/3 des nutzbaren Spielfelds
- Liegt direkt unterhalb der bewegten Platte
- Münzen landen hier, wenn sie von der bewegten Platte nach unten kippen
- Wenn Münzen über die untere Kante fallen → Gewinn-Sensor

### Münzen

- Kreisförmige Rigid Bodies in Matter.js (restitution niedrig, friction mittel)
- Kollision untereinander und mit Platten / Wänden
- Münze verlässt untere Kante der unteren Platte → Gewinn +1, Münze wird entfernt
- Linke + rechte Wände halten Münzen im Spielfeld

### Übergangs-Mechanik (bewegte → untere Platte)

- Münzen auf der bewegten Platte, die über deren **Vorderkante** (untere Kante der Platte) hinausgeschoben werden, fallen auf die untere Platte
- Die untere Platte hat keine physische Rückkante für die bewegte Platte — der Übergang passiert durch normale Physik (Münze kippt über Kante, fällt hinunter)
- Da der Canvas Top-Down ist: "fallen" bedeutet Y-Koordinate überschreitet die Plattengrenze → Münze wird der unteren Platte zugeordnet

---

## Matter.js Setup

```
Engine + World
├── Bodies.rectangle — linke Wand (statisch)
├── Bodies.rectangle — rechte Wand (statisch)
├── Bodies.rectangle — bewegte Platte (kinematisch, Y per tick)
├── Bodies.rectangle — untere Platte / Ablagefläche (statisch)
├── Bodies.rectangle — Gewinn-Sensor an unterer Kante (isSensor: true)
├── Bodies.circle    — Münzen (dynamisch, on-demand spawned)
└── Events.on(engine, 'collisionStart') — Gewinn-Sensor Auswertung
```

- Plattform wird **nicht** per Force bewegt, sondern per `Body.setPosition()` jeden Tick
- Gravitation: `gravity.y = 1` (Münzen fallen auf Platten)
- Rendering: **kein** Matter.js Renderer — Vue + Canvas API liest `body.position` und zeichnet selbst
- Kamera-Perspektive: Top-Down → X/Y-Koordinaten entsprechen direkt der Bildschirmposition

---

## Visuelles Design (Top-Down)

- **Bewegte Platte**: leicht hellere Farbe als untere Platte, z.B. Holz-Textur oder Grau-Gradient
- **Untere Platte**: dunklere Basis-Farbe
- **Münzen**: Kreise mit Goldton, leichter Glanz-Effekt
- **Einwurf-Zone**: halbtransparenter Bereich oben mit Pfeil-Indikator
- **Geister-Münze**: transparente Vorschau-Münze folgt Maus-X
- **Plattenkante** der bewegten Platte: deutlich markiert (dickere Linie), da sie der aktive Schieber ist

---

## Rewards

| Währung | Formel |
|---------|--------|
| Coins | `gewonnene_münzen × 2` |
| Diamonds | `floor(gewonnene_münzen / 50)` |

Ausgezahlt am Ende der Runde (Budget leer oder manuell beendet). Anzeige im Game-Over-Overlay.

---

## Save-Format (`hawk3_game_data.games.hawkCoin`)

```json
"hawkCoin": {
  "highScore": 0,
  "gamesPlayed": 0,
  "totalCoinsWon": 0,
  "totalCoinsSpent": 0,
  "bestNetWin": 0
}
```

---

## Architecture

| File | Content |
|------|---------|
| `pages/games/hawkCoin/index.vue` | Spiellogik + Template + Canvas-Rendering |
| `utils/localStores.js` | `hawk3_game_data` — `games.hawkCoin` hinzufügen |

**Physics:** Matter.js (lazy-loaded via dynamic import on mount)
**Rendering:** Vue 3 + Canvas API (liest `body.position` der Matter.js Bodies, kein eingebauter Renderer)
**State:** Lokal in `index.vue`

---

## Implementation Checklist

- [ ] `index.vue` anlegen
- [ ] Matter.js Engine + World setup (Wände, beide Platten, Sensor)
- [ ] Kinematische bewegte Platte (Y-Bewegung per `Body.setPosition`)
- [ ] Untere statische Platte
- [ ] Drop-Preview (Geister-Münze folgt Maus-X)
- [ ] Münzwurf bei Klick/Tap (Münze spawnen auf bewegter Platte, Budget verringern)
- [ ] Übergangs-Logik: Münzen die Vorderkante der bewegten Platte verlassen → untere Platte
- [ ] Schiebe-Logik: bewegte Platte schiebt Münzen auf unterer Platte mit
- [ ] Gewinn-Sensor an unterer Kante (untere Platte Vorderkante)
- [ ] Canvas-Rendering Top-Down (Münzen + beide Platten + Wände)
- [ ] Score + Budget HUD
- [ ] Game Over (Budget = 0) + Overlay
- [ ] Rewards (Coins/Diamonds) ausschütten
- [ ] Highscore + Stats in `hawk3_game_data`
- [ ] Save-Format in `localStores.js` registrieren
- [ ] Kachel auf `/games` freischalten (`active: true`)
- [ ] i18n: `de.json` + `en.json`
- [ ] Mobile Touch Support

---

## Status

🔲 Geplant — noch nicht implementiert
