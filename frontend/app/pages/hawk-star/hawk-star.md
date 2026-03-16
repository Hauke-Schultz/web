# Hawk-Star

Ein browserbasiertes Multiplayer-Online-Strategiespiel im Weltraum.

## Spielkonzept

Jeder Spieler startet auf einem eigenen Planeten und muss von Grund auf eine Zivilisation aufbauen. Ziel ist es, durch Ressourcenmanagement, Forschung und Expansion eine mächtige Raumzivilisation zu werden.

---

## Phasen des Spiels

### Phase 1 – Aufbau der Heimatbasis

#### Ressourcenleiste (oben)
Immer sichtbar: **Population | Metall | Kristall | Energie**

#### Planetenraster (3×3)
Der Planet wird als 3×3-Kachel-Raster dargestellt. Jede Kachel steht für einen Bereich des Planeten.

```
[ 1 ][ 2 ][ 3 ]
[ 4 ][ B ][ 6 ]   ← B = Basis (Kachel 5, Mittelpunkt)
[ 7 ][ 8 ][ 9 ]
```

- **Kachel 5 (Basis)** ist von Beginn an aktiv – hier startet der Spieler
- Alle anderen Kacheln sind zunächst **gesperrt** und werden durch Fortschritt in der Basis freigeschaltet
- Kacheln haben je einen eigenen Typ (Bergbau, Energie, Forschung, etc.)

#### Kachel 5 – Basis
Die Basiskachel zeigt eine Liste von bebaubaren Gebäuden:
- Klick auf "Bauen" startet einen **Timer** (Bauzeit je nach Gebäude)
- Während des Baus ist das Gebäude als "im Bau" markiert
- Nach Ablauf ist das Gebäude aktiv und schaltet ggf. neue Kacheln oder Optionen frei

**Startgebäude der Basis:**

| Gebäude          | Effekt                          | Schaltet frei      |
| ---------------- | ------------------------------- | ------------------ |
| Kommandozentrale | Kern der Basis, Pflicht zuerst  | Kachel 2 (Bergbau) |
| Quartiere        | Erhöht max. Population          | –                  |
| Energiegenerator | Grundenergieversorgung          | –                  |

#### Kachel 2 – Bergbau
Zweite Kachel, wird nach Errichtung der Kommandozentrale freigeschaltet:
- **Metallmine**: produziert Metall über Zeit
- **Kristallbohrer**: produziert Kristall über Zeit
- Jedes Gebäude hat eine Bauzeit und danach eine Produktionsrate pro Tick

### Phase 2 – Forschung & Entwicklung
- Technologiebaum erforschen
- Kategorien: Bergbau, Energie, Raumfahrt, Waffen, Schilde, Biologie, KI
- Forschung schaltet neue Gebäude, Schiffe und Fähigkeiten frei

### Phase 3 – Raumfahrt & Expansion
- Raumschiffe bauen (Erkundungsschiffe, Frachter, Kampfschiffe)
- Benachbarte Planeten und Monde erkunden
- Neue Planeten besiedeln und ausbauen
- Ressourcen zwischen Planeten transportieren

### Phase 4 – Interaktion & Konflikte
- Andere Spieler entdecken und kontaktieren
- Handelsrouten aufbauen (Ressourcentausch, Verträge)
- Allianzen bilden
- Kämpfe um Planeten und Ressourcen führen
- NPC-Gegner und feindliche Fraktionen (z.B. Piraten, Aliens)

---

## Kernmechaniken

### Ressourcen
| Ressource     | Gewonnen durch           | Verwendung                        |
|---------------|--------------------------|-----------------------------------|
| Metall        | Minen                    | Gebäude, Schiffe                  |
| Kristall      | Kristallabbau            | Elektronik, Forschung, Schilde    |
| Energie       | Kraftwerke, Solar, Fusion| Alles                             |
| Nahrung       | Hydroponik-Anlagen       | Bevölkerung                       |
| Seltene Erden | Spezial-Minen            | Hochwertige Technologie, Waffen   |
| Credits       | Handel, Steuern          | Handel mit anderen Spielern       |

### Gebäude (Auswahl)
- Metallmine / Kristallmine / Energieanlage
- Forschungslabor
- Raumhafen
- Fabrik (Schiffe, Module)
- Kommandozentrale (Upgrades, Überblick)
- Verteidigungsgeschütz, Raketenbatterie, Schildgenerator
- Handelsposten

### Raumschiffe (Auswahl)
- Erkundungsschiff (schnell, unbewaffnet, Sensor-Boost)
- Frachter (großes Laderaum, langsam)
- Korvette (leicht bewaffnet, agil)
- Kreuzer (mittlere Bewaffnung + Schilde)
- Schlachtschiff (stark bewaffnet, langsam)
- Kolonieschiff (besiedelt neue Planeten)
- Trägerschiff (transportiert kleinere Schiffe)

### Forschungsbaum (Kategorien)
- **Bergbau**: Effizienz, neue Ressourcentypen
- **Energie**: bessere Kraftwerke, Fusionsreaktoren
- **Raumfahrt**: Reichweite, Geschwindigkeit, Sprungantrieb
- **Waffen**: Laser, Raketen, Partikelbeschleuniger
- **Schilde & Panzerung**: Schilde, Resistenzen
- **Biologie**: Bevölkerungswachstum, Terraforming
- **Diplomatie**: Handelsboni, bessere Vertragsoptionen
- **KI & Automation**: automatische Ressourcenverwaltung

---

## Multiplayer-System

- Persistente Spielwelt (Galaxie mit vielen Systemen)
- Echtzeit oder tick-basiert (z.B. alle 15 Minuten ein "Tick")
- Spieler können offline Angriffe planen, aber auch angegriffen werden
- Schutz für neue Spieler (Anfängerschutz für z.B. 72 Stunden)
- Chat, Diplomatiemenü, Allianzverwaltung

---

## Technologie-Stack (geplant)

### Frontend
- Vue 3 + Nuxt (bestehende Struktur)
- Canvas / WebGL für Galaxie-/Planetenansicht
- Socket.io oder WebSockets für Echtzeit-Updates

### Backend
- Node.js / Express oder Fastify
- WebSockets (Socket.io) für Live-Kommunikation
- Tick-System (Cron-Jobs für Ressourcenproduktion, Angriffe, etc.)
- REST API für Spielzustand, Aktionen

### Datenbank
- PostgreSQL (Spielerdaten, Planeten, Schiffe, Forschung)
- Redis (Sessions, schnelle Cache-Daten, Tick-Queue)

---

## Offene Fragen / To-Do

- [ ] Galaxie-Generator: prozedural oder fixed map?
- [ ] Kampfsystem: Echtzeit oder rundenbasiert / automatisch?
- [ ] Wirtschaftsbalancing
- [ ] Wie viele Spieler pro Galaxie?
- [ ] Saisonales Spielsystem (Reset nach X Wochen)?
- [ ] Mobile-Unterstützung?
- [ ] Name der Fraktionen / Alien-Rassen
- [ ] Lore / Story-Elemente?

---

## Nächste Schritte (klein beginnen)

1. Vue-Seite `hawk-star/index.vue` anlegen
2. Ressourcenleiste oben (Population, Metall, Kristall, Energie)
3. 3×3 Planetenraster rendern – Kachel 5 aktiv, Rest gesperrt
4. Basiskachel: Gebäude-Liste mit Bau-Button + Timer-Logik
5. Kommandozentrale fertig → Kachel 2 freischalten
6. Kachel 2: Bergbau-Gebäude mit Produktions-Tick
7. Danach: Backend / Persistenz anbinden
