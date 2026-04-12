# Hawk Coin — Coin Pusher

Ein browserbasiertes Coin-Pusher-Spiel inspiriert von klassischen Arcade-Automaten. Blick von vorne auf den Automaten: Münzen fallen von oben auf eine Plattform, die sich vor und zurück bewegt und dabei Münzen über die vordere Kante schiebt.

---

## Perspektive & Darstellung

Der Automat wird **von vorne** betrachtet — wie beim echten Arcade-Gerät.

```
┌─────────────────────────┐
│   [  Einwurf-Zone  ]    │  ← Spieler positioniert Münze hier (X-Achse frei wählbar)
│                         │
│  ○  ○    ○   ○   ○      │  ← Münzen liegen auf der Spielfläche
│ ○  ○  ○   ○    ○  ○     │
│══════════════════════════│  ← Plattform (bewegt sich vor = nach unten, zurück = nach oben)
│                         │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← feste Ablagefläche (hinter der Plattform)
└─────────────────────────┘
         ↓ ↓ ↓
    (Münzen fallen hier raus = Gewinn)
```

- Die **Plattform** bewegt sich auf der Y-Achse: vorwärts (nach unten im Canvas) und rückwärts (nach oben)
- Die **Einwurf-Zone** ist die obere Kante — Spieler wählt die X-Position frei (Klick/Tap auf die obere Leiste)
- Bei Bestätigung fällt die Münze senkrecht nach unten auf die Plattform oder die darauf liegenden Münzen
- Wenn die Plattform vorwärts fährt, schiebt sie Münzen Richtung untere Kante
- Münzen die über die **untere Kante** fallen → Gewinn

---

## Game Concept

- Blick von vorne auf den Coin-Pusher-Automaten
- Spieler wählt die X-Position der Münze frei (hover/drag in der Einwurf-Zone oben)
- Bei Klick/Tap fällt die Münze nach unten (Gravitation via Matter.js)
- Die Plattform bewegt sich kontinuierlich vor (↓) und zurück (↑)
- Münzen auf der Plattform werden beim Vorwärtsfahren mitgeschoben
- Münzen die über die untere Kante fallen = Gewinn
- Münzen die seitlich herausfallen = kein Gewinn (verloren)
- Game Over: wenn das Einwurf-Budget (Münzzahl) aufgebraucht ist
- Ziel: maximalen Netto-Gewinn erzielen

---

## Spielmechanik

### Einwurf
- Spieler bewegt die Maus/den Finger horizontal in der Einwurf-Zone oben
- Eine Geister-Münze zeigt die gewählte X-Position an (Drop-Preview)
- Klick/Tap: Münze spawnt an der gewählten X-Position und fällt durch Gravitation nach unten
- Budget wird um 1 verringert

### Plattform
- Rechteckiger Körper (kinematischer Body in Matter.js — kein Einfluss der Physik auf ihn)
- Bewegt sich mit konstanter Geschwindigkeit auf der Y-Achse: Amplitude + Tempo konfigurierbar
- Schiebt alle aufliegenden Münzen mit (Kollision über Matter.js)
- Breite: 100% der Canvas-Breite (linke + rechte Wände halten Münzen)

### Spielfeld-Aufbau (Canvas von oben nach unten)
| Bereich | Beschreibung |
|---------|-------------|
| Einwurf-Zone (oben) | Münz-Drop-Leiste, interaktiv |
| Freier Fall-Bereich | Münze fällt hier herunter |
| Plattform | Beweglicher Körper (vor/zurück) |
| Ablagefläche | Feste Fläche hinter der Plattform — Münzen sammeln sich hier |
| Austritts-Kante (unten) | Sensor: Münzen die hier ankommen = Gewinn |

### Münzen
- Kreisförmige Rigid Bodies in Matter.js (restitution niedrig, friction mittel)
- Kollision untereinander und mit Plattform / Wänden / Ablagefläche
- Münze verlässt untere Kante → Sensor-Event → Gewinn +1, Münze wird entfernt
- Münze verlässt seitliche Kante → keine Aktion (nicht möglich, da Wände)

### Gewinn & Verlust
- Gewonnene Münzen = Münzen die unten herausfallen
- Eingeworfene Münzen = Budget-Kosten
- Netto-Gewinn: `gewonnene_münzen - eingeworfene_münzen`

---

## Matter.js Setup

```
Engine + World
├── Bodies.rectangle — linke Wand (statisch)
├── Bodies.rectangle — rechte Wand (statisch)
├── Bodies.rectangle — Ablagefläche hinten (statisch)
├── Bodies.rectangle — Plattform (kinematisch, Y-Position per tick gesetzt)
├── Bodies.circle    — Münzen (dynamisch, on-demand spawned)
└── Events.on(engine, 'collisionStart') — Sensor an unterer Kante
```

- Plattform wird **nicht** per Force bewegt, sondern per `Body.setPosition()` jeden Tick → stabiles kinematisches Verhalten
- Gravitation: Standard Matter.js `gravity.y = 1`
- Rendering: **kein** Matter.js Renderer — Vue + Canvas API oder SVG liest `body.position` und zeichnet selbst

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
- [ ] Matter.js Engine + World setup (Wände, Ablagefläche)
- [ ] Kinematische Plattform (Y-Bewegung per `Body.setPosition`)
- [ ] Drop-Preview (Geister-Münze folgt Maus-X)
- [ ] Münzwurf bei Klick/Tap (Münze spawnen, Budget verringern)
- [ ] Gewinn-Sensor an unterer Kante (`collisionStart` oder `bounds` check)
- [ ] Canvas-Rendering (Münzen + Plattform + Wände zeichnen)
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
