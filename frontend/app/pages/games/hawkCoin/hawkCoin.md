# Hawk Coin — Coin Pusher

Ein browserbasiertes Coin-Pusher-Spiel inspiriert von klassischen Arcade-Automaten. Die Sicht ist **von oben** (Top-Down) auf das Spielfeld: Eine bewegliche obere Platte schiebt Münzen Richtung untere Platte; von der unteren Platte fallen Münzen als Gewinn heraus.

---

## Perspektive & Darstellung

Vogelperspektive — direkt von oben auf das Spielfeld. Es gibt **keine echte Schwerkraft**. Münzen liegen flach auf den Platten und werden nur durch die Plattenbewegung und gegenseitige Kollision verschoben. „Fallen" bedeutet: eine Münze überschreitet die Kante einer Platte und wechselt auf die nächste Ebene oder verlässt das Spielfeld.

```
┌─────────────────────────────────┐
│                                 │  ←  Feste Wand, die bewegte Platte schiebt sich hier darunter wenn sie nach oben fährt
│- - - - - - - - - - - - - - - - -│  ←  Hinterkante der bewegten Platte, sie bleibt immer unter der Mauer
│                                 │  
│═════════════════════════════════│  ←  Feste Wand, hier können keine Münzen drunter
│  ○   ○     ○   ○   ○    ○       │  ←  Münzen auf der bewegten Platte, Spieler plaziert Münzen
│  ○     ○  ○   ○   ○    ○   ○    │  ↑↓ bewegte Platte (fährt ↑↓ immer hoch und runter)
│═════════════════════════════════│  ←  Vorderkante der bewegten Platte, von hier können Münzen auf die untere Platte runter Fallen
│  ○  ○   ○    ○  ○   ○  ○    ○   │  ←  Münzen auf der unteren (festen) Platte
│  ○    ○  ○   ○   ○   ○    ○     │
│  ○  ○   ○  ○   ○  ○    ○    ○   │  
└─────────────────────────────────┘  ←  Münzen auf der unteren Kante der festen Platte, von hier fallen die Münzen als Gewinn

```

---

## Spielprinzip

- Die **bewegte Platte** (obere) nimmt ~1/3 der Spielfeldhöhe ein und fährt kontinuierlich vor (↓) und zurück (↑)
- Die **untere Platte** ist fest und nimmt den unteren Teil des Spielfelds ein
- Spieler wirft Münzen auf die bewegte Platte (Klick auf die gewünschte X-Position)
- Münzen werden durch die Plattenbewegung und andere Münzen verschoben (Kreis-Kreis-Kollision)
- Münzen, die über die **Vorderkante der bewegten Platte** hinausgeschoben werden → landen auf der **unteren Platte**
- Münzen, die über die **untere Kante der unteren Platte** hinausgeschoben werden → **Gewinn**
- Linke und rechte Wände halten alle Münzen im Spielfeld

### Bewegungslogik im Detail

**Platte fährt nach oben (↑):**  
Die Hinterkante der bewegten Platte nähert sich der festen Wand. Münzen auf der bewegten Platte, die gegen die obere Wand gedrückt werden, stauen sich. Bei sehr vielen Münzen kann der Platz knapp werden → Münzen werden seitlich oder über die Vorderkante geschoben.

**Platte fährt nach unten (↓):**  
Die Vorderkante der bewegten Platte schiebt Münzen auf die untere Platte. Gleichzeitig werden Münzen auf der unteren Platte Richtung untere Kante gedrückt → Gewinnchance steigt.

---

## Startzustand

Beim Spielstart liegen **bereits Münzen auf beiden Platten**, damit sofort Gewinnmünzen herausfallen können:
- Obere (bewegte) Platte: zufällig verteilte Münzen (ca. 8–12 Stück)
- Untere (feste) Platte: zufällig verteilte Münzen (ca. 10–15 Stück), davon einige nahe der Abwurfkante

---

## Spielmechanik

### Einwurf
- Spieler bewegt die Maus/den Finger über der Einwurfzone (oberhalb der bewegten Platte)
- Eine Geister-Münze zeigt die X-Position als Vorschau (Drop-Preview)
- Klick/Tap: Münze spawnt an der gewählten X-Position am oberen Rand der bewegten Platte
- Budget wird um 1 verringert

### Bewegte Platte
- Bewegt sich mit konstanter Geschwindigkeit auf der **Y-Achse** (Amplitude und Tempo konfigurierbar)
- Position wird direkt per Y-Koordinate gesetzt — keine Physik-Engine nötig
- Schiebt Münzen auf der Platte durch einfache AABB-/Kreis-Kollision

### Untere Platte
- Statische Fläche (feste Y-Position)
- Münzen landen hier, wenn sie von der bewegten Platte abgeschoben werden
- Münzen können sich auf der unteren Platte **stapeln** (zwei Z-Ebenen: z=0 und z=1)
- Über die untere Kante hinaus → Gewinn-Auslöser, gilt für beide Z-Ebenen

### Münz-Stapelsystem (Z-Ebenen auf der unteren Platte)
Münzen auf der unteren Platte haben eine zusätzliche Z-Eigenschaft:

| Z-Ebene | Bedeutung | Farbe |
|---------|-----------|-------|
| z=0 | Bodenebene, liegt direkt auf der Platte | Dunkles Gold |
| z=1 | Gestapelt, liegt auf einer z=0-Münze | Helles Gold |

**Stapelung bei Landung (`determineZOnLanding`):**
- Nur z=0-Münzen in der Nähe → neue Münze landet als **z=1** (stapelt auf)
- Sowohl z=0 als auch z=1 in der Nähe → würde z=2 werden → Münze bekommt **seitlichen Schubs** und landet als z=0 woanders
- Keine anderen Münzen in der Nähe → landet normal als **z=0**

**Physikregeln:**
- Kollisionen nur innerhalb derselben Z-Ebene (z=0 ↔ z=0, z=1 ↔ z=1)
- Fallende Münzen (während der Fallanimation) phasen durch — keine Kollision bis zur Landung
- Die bewegte Platte schiebt **beide Z-Ebenen** direkt
- Gewinnauslöser (Mittelpunkt überschreitet untere Kante) gilt für z=0 und z=1 gleichermaßen

### Münzen
- Kreisförmig, alle gleich groß
- Kollision: Kreis–Kreis (Münze–Münze) und Kreis–Wand (links, rechts, oben)
- **Kollision nur zwischen Münzen derselben Platte UND derselben Z-Ebene**
- Übergänge: Münze wechselt die Ebene wenn ihr **Mittelpunkt** die Kante überschreitet (50 % Überstand)
- Fallanimation beim Übergang von bewegter auf untere Platte: kurze Gravitationsbeschleunigung, kein harter Positionssnap
- Münzen haben eine einfache Reibung/Dämpfung, damit sie nicht endlos gleiten
- **Keine Gravitation im Normalbetrieb** — nur während der Fallanimation

### Physik-Umsetzung (ohne Matter.js)
Da es keine echte Schwerkraft gibt, reicht eine einfache eigene Physikschleife:
- Pro Frame: Plattenposition aktualisieren, alle Münzen gegen Plattenränder und andere Münzen prüfen
- Kollisionsantwort: Münzen werden aus Überlappungen herausgeschoben (positional correction), nur innerhalb derselben Platte + Z-Ebene
- Münze verlässt Plattenbereich → Ebene wechseln oder Gewinn auslösen (Trigger: Mittelpunkt überschreitet Kante)
- Dämpfung: Geschwindigkeit jeder Münze wird pro Frame mit einem Faktor kleiner als 1 multipliziert (Y-Dämpfung während Fallanimation ausgesetzt)

### Rendering-Reihenfolge (Z-Order)
1. Spielfeld-Hintergrund
2. Untere Platte (Hintergrund)
3. **Layer-1 z=0 Münzen** (untere Platte, Bodenebene, dunkel)
4. **Layer-1 z=1 Münzen** (untere Platte, gestapelt, hell)
5. **Bewegte Platte** (überdeckt Münzen, die noch halb darunter liegen)
6. **Layer-0 Münzen** (auf der bewegten Platte, ganz oben)
7. Win-Slot + Slot-Münzen

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

**Physics:** Eigene einfache 2D-Kollisionslogik (kein Matter.js nötig)
**Rendering:** Vue 3 + Canvas API (requestAnimationFrame)
**State:** Lokal in `index.vue`

---

## Implementation Checklist

- [x] Canvas-Setup + Game-Loop (requestAnimationFrame)
- [x] Bewegte Platte: Y-Animation (Hin- und Herbewegung)
- [x] Münz-Klasse: Position, Velocity, Radius, Ebene (oben/unten), Z-Stapelebene
- [x] Einwurf: Drop-Preview + Spawn bei Klick
- [x] Kollision Münze–Münze (Kreis–Kreis)
- [x] Kollision Münze–Wände (links, rechts, oben)
- [x] Plattenrand-Detektion: Münze fällt von bewegter Platte auf untere
- [x] Abwurfkante: Münze verlässt untere Platte → Gewinn
- [x] Startzustand: Münzen auf beiden Platten vorbelegen
- [x] Budget-System + Game-Over
- [x] Reward-Berechnung + Overlay
- [x] Save in localStores
- [x] Win-Slot: Gewinnmünzen fallen animiert in den Slot (Gravitation, Kollision)
- [x] Win-Slot: Münzen faden nach 3 Sek. aus und verschwinden
- [x] Münz-Stapelsystem: z=0 (dunkel) und z=1 (hell) auf der unteren Platte
- [x] Fallanimation: sanfter Übergang von bewegter auf untere Platte (kein Positionssnap)
- [x] 50%-Fallregel: Mittelpunkt-Trigger für beide Plattenkanten und beide Z-Ebenen

---

## Status

Vollständig umgesetzt und spielbar.
