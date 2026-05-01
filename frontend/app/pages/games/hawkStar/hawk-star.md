# Hawk-Star

A browser-based multiplayer space strategy game. Each player starts on a single planet, builds up a civilization, expands through a galaxy of star systems, and eventually interacts with other players through trade, alliances, or conflict.

---

## Views

The game has three nested views, each unlocked progressively via the Star Map global research:

| View | Unlock condition | Shows |
|------|-----------------|-------|
| **Planet** | Always available | The active planet's 3×3 building grid |
| **Solar System** | Star Map Lv1 (global research) | All planets in the home system |
| **Galaxy Map** | Star Map Lv2 (global research) | Star systems on a canvas — all systems always visible |

The NavBar (`HsNavBar.vue`) handles view switching and gate checks. It also renders `HsPlanetHeader` as its first item (planet name + type), which doubles as the planet-view button.

---

## Planet Grid

`HsPlanetGrid` renders a 5×3 tile grid (15 tiles total). The first row contains two **panel tiles** and one empty cell; rows 2–5 contain the twelve **planet building slots**.

```
[ Planet Info ][ Activity  ][            ]   ← panel tiles (row 1, 3rd cell empty)
[ Defense     ][ Mining    ][ Space Base ]   ← planet slots (rows 2–5)
[ Energy      ][ Base      ][ Comm Center]
[ Agri        ][ Tech Ctr  ][ High-Tech  ]
[ Dock        ][ Warship Bay][ Orbit     ]
```

**Only one tile can be active at a time** across all 15. Clicking a panel tile deselects any active planet slot, and vice versa.

### Panel tiles (row 1)

| Tile | `activePanel` value | Right panel shows |
|------|--------------------|--------------------|
| **Planet Info** | `'resources'` | `HsAllResourcePanel` — full resource breakdown |
| **Activity** | `'notifications'` | `HsNotificationPanel` + `HsSettingsPanel` (dev controls) |
| *(empty)* | — | — |

### Planet building slots (rows 2–4)

Every slot has a fixed tile type defined in `PLANET_GRID` (`hawkStarConfig.js`). Slots start locked and are unlocked by completing specific building levels (via the `unlocks` field on a building level). The center slot (slot 5, Base) and a few others start unlocked from the beginning.

### Tile Types

| ID | Description |
|----|-------------|
| `base` | Colony command center — must be built first |
| `mining` | Raw resource extraction (Metal, Crystal) |
| `energy` | Power generation — Energy is a utility, not stockpiled |
| `techcenter` | Technology Center — Space Building, Weapon Building, Laboratory |
| `comm_center` | Comm Center — global research tile. Technologies researched here apply across all planets |
| `spacebase` | Launch pad for probes, colony ships, warships, freighters |
| `agriculture` | Reserved — no buildings yet (planned for later) |
| `defense` | Planetary shields and weapons platforms |
| `hightech` | Advanced material refinement (planet-exclusive) |
| `dock` | Ship management, missions and fleet operations — unlocked by Space Technology Lv 1; clicking opens `HsDockPanel` |
| `warship_bay` | Heavy warship construction — placeholder |
| `orbit` | Orbital infrastructure — placeholder |

Each tile can hold one or more buildings. Buildings have up to 3 upgrade levels. Only one building per tile can be under construction at a time.

---

## Buildings

All buildings are defined in `BUILDINGS` (`hawkStarConfig.js`). Each building entry contains:

- **`tileType`** — which tile it belongs to
- **`levels[]`** — array of level objects (index 0 = level 1)
  - `cost` — one-time resource cost to queue the build
  - `buildTime` — seconds until completion
  - `production` — resources added per tick while active
  - `energyDrain` — energy consumed per tick
  - `staffDrain` — population workers permanently assigned
  - `storageCapacity` — adds to the resource storage cap
  - `unlocks` — planet slots unlocked on completion
  - `popBonus` — flat max-population increase

A building goes offline (stops producing) if energy is in deficit.

---

## Resources

Resources are defined in `RESOURCES` (`hawkStarConfig.js`).

### Universal

| Resource | Role |
|----------|------|
| **Metal** | Primary construction material, hard cap via storage |
| **Crystal** | Secondary material, hard cap via storage |
| **Population** | Workforce — workers are assigned to buildings via `staffDrain` |
| **Energy** | Utility — not stockpiled, must balance production vs. drain |

### Planet-Specific (raw)

Each planet type produces one exclusive raw resource from its High-Tech tile:

| Resource | Planet Type |
|----------|-------------|
| Alloy | Terrestrial |
| Obsidian | Volcanic |
| Cryonite | Frozen |
| Biomass | Ocean |

### Refined Resources

Each planet type produces exactly **one** refined resource in its High-Tech building. The other three must be acquired via trade or freighter transport.

| Planet Type | High-Tech Building | Produces | Input |
|-------------|-------------------|----------|-------|
| Terrestrial | `alloy_refinery` | `super_alloy` | Metal + Alloy |
| Volcanic | `obsidian_foundry` | `quantum_shard` | Crystal + Obsidian |
| Frozen | `cryo_refinery` | `pure_crystal` | Crystal + Cryonite |
| Ocean | `bio_lab` | `nano_alloy` | Metal + Biomass |

### Ship Components

Ship component resources (`power_cell`, `kinetic_round`, `plasma_cell`) are defined in config and produced by tech labs, but are **not yet used** — the equip/slot system has been removed in favor of a simpler warship model. They may return when the combat system is fleshed out.

---

## Planet Types

The planet type is assigned on colonization and restricts or enables certain buildings. Types map from raw galaxy mock data (`rock/gas/lava/ice/ocean`) via `MOCK_TYPE_TO_PLANET_TYPE`.

| Type | Icon | Traits |
|------|------|--------|
| **Terrestrial** | 🌍 | Balanced — all standard buildings, no restrictions · `alloy_refinery` (High-Tech) |
| **Volcanic** | 🌋 | Metal-rich — `geothermal_tap`; limited agriculture · `obsidian_foundry` (High-Tech) |
| **Frozen** | 🧊 | Crystal-rich — `cryo_extractor`, `cryo_reactor` · `cryo_refinery` (High-Tech) |
| **Ocean** | 🌊 | Population paradise — `tidal_generator`; weak mining · `bio_lab` (High-Tech) |

---

## Units

Units are built at the Space Base tile and consumed on missions. Build time scales with building level (`buildTimeBase / level`). Simultaneous missions are capped by building level (1/2/3).

| Unit | Cost | Purpose |
|------|------|---------|
| **Recon Drone** | 60 Metal · 25 Crystal | Reveals planet details within the home system |
| **Galaxy Probe** | 100 Metal · 50 Crystal | Reveals planet count in a remote star system |
| **Colony Ship** | 300 Metal · 150 Crystal | Colonizes a scanned uncolonized planet |
| **Warship** | 600 Metal · 300 Crystal | One combat vessel per planet — attack target coming in Phase 4 |
| **Freighter** | 400 Metal · 200 Crystal | Inter-system resource transport |

### Warship Model (simplified)

One warship per planet, built in the Warship Bay. No drive or weapon slots — stats come directly from the ship class.

| Class | Hull | Shield | Speed |
|-------|------|--------|-------|
| **Hawk Frigate** | 150 | 30 | 8 |

The warship sits in the hangar after construction. The **Attack** button (sending it to a target planet and receiving it back after combat) is a placeholder for Phase 4. Drive/weapon slot complexity has been removed — equipment can be reintroduced once the combat system is designed end-to-end with the backend.

---

## Game Loop

A rough progression arc for a single player:

1. **Colony Phase** — Build up the home planet: unlock slots, raise Metal/Crystal income, balance Energy.
2. **Expansion** — Research the Star Map in the Comm Center (global, unlocks on all planets), scan nearby systems with Recon Drones, send Colony Ships to claim new planets.
3. **Specialization** — Each planet type produces a unique refined resource. Build a spread of planet types to cover all four refined resources (`super_alloy`, `quantum_shard`, `pure_crystal`, `nano_alloy`).
4. **Military** — Build a Hawk Frigate in the Warship Bay. Send it to attack enemy planets once Phase 4 is implemented.
5. **Diplomacy & Conflict** — Encounter allied and enemy factions across the galaxy. Trade via Freighters or push into contested systems with a war fleet.

---

## Galaxy

The galaxy (`hawkStarGalaxyMock.js`) contains 9 star systems arranged at percentage-based x/y coordinates on a canvas. Each system has:

- `starClass` (cosmetic), 4–8 planets

### Visibility

All 9 systems are always visible in the Galaxy Map. Solar System view shows the home system.

### Star vs Planet States

**Stars** are displayed neutrally. 

**Planets** carry individual states: `own` · `uncolonized` · `enemy` · `ally`

The displayed planet state is derived at runtime: if `playerColonizedPlanets` (from `useHawkStar`) contains the planet ID, the state is shown as `own` regardless of the mock value.

### Trade Routes

`TRADE_ROUTES` is defined in the mock file but not rendered in the current Galaxy Map view.

---

## Data Architecture

All static game data lives in `hawkStarConfig.js` and is structured to map 1:1 to future database tables:

| JS export | Future DB table |
|-----------|----------------|
| `RESOURCES` | `resources` |
| `TILE_TYPES` | `tile_types` |
| `PLANET_GRID` | `planet_grid_slots` |
| `BUILDINGS` | `buildings` |
| `BUILDINGS[id].levels` | `building_levels` (composite PK: buildingId + level) |

Player state (resources, slot unlock status, building progress) is currently persisted in **LocalStorage** and will migrate to a backend API. Saves include a version guard — outdated saves are automatically discarded.

---

## Tech Stack

- **Vue 3 + Nuxt** (existing project structure)
- **Scoped CSS** for all game UI (no Tailwind dependency within the game)
- **Canvas** for the Galaxy Map star field (`HsGalaxyMap.vue`)

---

## Architecture

### File Locations

| File | Role |
|------|------|
| `pages/hawk-star/index.vue` | Page root — layout, view switching |
| `pages/hawk-star/hawk-star.md` | This file — game concept & technical reference |
| `composables/useHawkStar.js` | Central singleton state — all game logic & player data |
| `utils/hawkStarConfig.js` | Static game data: `PLANET_TYPES`, `BUILDINGS`, `RESOURCES`, `WARSHIP_CLASSES`, `SHIP_COMPONENTS`, `UNIT_COSTS` |
| `utils/hawkStarGalaxyMock.js` | Galaxy data: `GALAXY_SYSTEMS`, `TRADE_ROUTES` |

### Components

| Component | Role |
|-----------|------|
| `HsNavBar` | View switching (Planet / Solar System / Galaxy Map) + gate checks. First item is `HsPlanetHeader` (planet name + type, clickable to switch to planet view). |
| `HsResourceBar` | Compact resource bar shown at top of all views |
| `HsPlanetGrid` | 4×3 unified tile grid — 3 panel tiles (row 1) + 9 planet building slots (rows 2–4). Manages single active-tile state across all 12 tiles. |
| `HsTilePanel` | Right-column panel — renders different content based on `activePanel` prop: `'resources'` → `HsAllResourcePanel`, `'notifications'` → `HsNotificationPanel` + `HsSettingsPanel`, `'dock'` → `HsDockPanel`, `null` → building detail for the active planet slot |
| `HsDockPanel` | Space Base panel — build & manage all ship types (drones, probes, colony ships, warships, freighters) + active missions |
| `HsSolarSystem` | Home system view — all planets, drone & colony actions |
| `HsGalaxyMap` | Galaxy view — all star systems, planet detail card |
| `HsPlanetHeader` | Planet name + type tile — lives inside `HsNavBar` as the first nav item |
| `HsAllResourcePanel` | Full resource breakdown (all non-utility resources with amount, rate, cap). Shown in right panel when Planet Info tile is active. |
| `HsNotificationPanel` | Live activity feed — buildings/ships in progress + completed events (persistent until dismissed) |
| `HsSettingsPanel` | Dev tuning controls (tick rate, build factor, game reset). Shown below `HsNotificationPanel` in the Activity view. |

### State & Persistence

- **`useHawkStar.js`** is a singleton composable — all components read from and write to it directly, no props/emits for game state.
- Player state is saved to **LocalStorage** under the key `hawkStarSave`. Includes: resources, slot unlocks, building levels & progress, ship inventory, missions.
- A version guard discards outdated saves automatically.
- `allPlanetStates` is the core state object — keyed by `planetId`, each entry holds resources, buildings, dock, and conversion queues for that planet.

### Offline Production

When the game is closed and reopened, the engine calculates how many production ticks were missed while offline and applies them all at once on load, before the first live tick fires. The save file stores `savedAt` (the timestamp of the last save). On load, `offlineTicks = floor((now - savedAt) / tickRateMs)` is computed and capped at 24 hours. Per-planet offline production mirrors the live tick logic exactly: gross output per building level × ticks, energy deficit handled (negative net energy floors resources at 0), storage caps applied. Buildings/ships/missions that completed while offline are resolved on the first live tick as normal — their endsAt timestamps are in the past, so the tick loop completes them immediately.

### Dev Mode

The settings panel (`HsSettingsPanel`) exposes two tuning controls: **Tick Rate (ms)** adjusts how often the game tick fires, and **Build Time Factor** scales all build durations globally (buildings, ships, conversions). Values are saved to `hawk-star-dev` in localStorage independently of the game save. The goal is to find balanced build times where level 1 buildings feel fast and higher levels scale up noticeably.

### Localisation (i18n)

Uses **`@nuxtjs/i18n`** with `defaultLocale: 'de'` and `strategy: 'prefix_except_default'`. Translation files:

```
i18n/
  en.json / de.json          ← general site strings (empty)
  hawk-star/en.json          ← all Hawk-Star strings (English, complete)
  hawk-star/de.json          ← all Hawk-Star strings (German, complete)
```

All Hawk-Star keys live under `hawkStar.*`:

| Namespace | Covers |
|-----------|--------|
| `hawkStar.notifications.*` | HsNotificationPanel — activity feed |
| `hawkStar.nav.*` | HsNavBar — view tabs, lock tooltips |
| `hawkStar.tile.*` | HsTilePanel — build buttons, status, conversions |
| `hawkStar.dock.*` | HsDockPanel — ship names, build buttons, slots |
| `hawkStar.solar.*` | HsSolarSystem — planet states, mission actions |
| `hawkStar.galaxy.*` | HsGalaxyMap — planet states, star meta |
| `hawkStar.starClass.*` | Star class labels (G/K/M/F) |

**In components:** `const { t } = useI18n()` → `t('hawkStar.nav.planet')`.

**In `useHawkStar.js`:** Cannot call `useI18n()` at module scope. Notification objects store `labelKey` + `labelParams`; the component resolves them with `t(n.labelKey, n.labelParams ?? {})`.

**Not yet translated:** Building/resource names in `hawkStarConfig.js` — planned after backend (names will come from DB).

### Implementation Status

| Feature                                       | Status |
|-----------------------------------------------|--------|
| Planet grid, slot unlocks                     | ✅ Done |
| Buildings (all types)                         | ✅ Done |
| Energy & staff system                         | ✅ Done |
| Resources + storage caps                      | ✅ Done |
| High-Tech conversions                         | ✅ Done |
| Recon Drones                                  | ✅ Done |
| Galaxy Probes                                 | ✅ Done |
| Colony Ships                                  | ✅ Done |
| Warship (Hawk Frigate, one per planet, hangar) | ✅ Done |
| Warship attack mission (Phase 4)               | ⬜ Planned |
| Freighter transport                           | ✅ Done |
| Galaxy Map (simplified, all systems visible)  | ✅ Done |
| Solar System view                             | ✅ Done |
| Dev mode — tick rate & build time factor      | ✅ Done |
| Notification Panel                            | ✅ Done |
| Localisation (i18n) — all components          | ✅ Done |
| Research → Comm Center rename + Star Map global | ✅ Done |
| Backend — User login & registration           | ⬜ Planned |
| Backend — Bauen & Besiedeln (Phase 1)         | ⬜ Planned |
| Backend — Handel & Kommunikation (Phase 2)    | ⬜ Planned |
| Backend — Ausspionieren (Phase 3)             | ⬜ Planned |
| Backend — Kampf (Phase 4)                     | ⬜ Planned |

See `hawk-star-backend.md` for the full backend & multiplayer concept.

### Notes

# Agriculture-Gebäude

Das Agriculture-Tile existiert, ist freigeschaltet (slot 7), aber hat null Gebäude. Ocean-Planeten sind als "Farming paradise, enormous population potential" beschrieben — das
wäre der Ort für Bevölkerungs-/Food-Gebäude.

# Comm Center — Weitere Global-Forschungen

Das Comm Center ist jetzt der Ort für alle globalen Technologien (star_map u.a.). Weitere geplante Forschungen könnten hier hinzugefügt werden (z.B. schnellere Schiffe, verbesserte Sichtweite). Das `global: true`-Flag in hawkStarConfig.js genügt, damit eine Technologie automatisch global behandelt wird.

# Balancing-Pass

Bevor Backend kommt, sollten die Zahlen stimmen: Bauzeiten, Kosten, Produktionsraten, Storage-Caps. Am besten einmal durchspielen und alle Dev-Einstellungen aufschreiben, die
sich "richtig" anfühlen — sonst baut das Backend auf unbalancierten Daten auf.

# Fog of War / Sichtbarkeit

Galaxy Map zeigt aktuell alle 9 Systeme immer vollständig. Das Konzept sieht eigentlich vor, dass man Systeme erst sondieren muss. Das könnte lokal vollständig umgesetzt werden,
bevor der Backend-State das übernimmt.

# Einfaches lokales Kampfsystem

Warships werden gebaut, ausgerüstet — aber es passiert nichts mit ihnen. Zumindest ein simpulierter PvE-Kampf (Angriff auf Mock-Enemy-Planeten) würde den Gameplay-Loop schließen
und das Kampfsystem vor dem Backend definieren.

# Colony Projects (Queue kleiner Aufgaben)                                                                                                                                      

Eine kurze Warteschlange mit 30s–3min-Aufgaben: "Recrute Kolonisten" (+1 Pop), "Vorräte aufbauen" (+30 Metal), "Reparaturtrupp" (reduziert Bauzeit des nächsten Gebäudes). Jedes

# Schwarzmarkt / Barter
Konvertiere überschüssige Ressourcen schnell zu anderen — aber zu schlechtem Kurs (3:1 oder 4:1). Metal → Crystal, Crystal → Alloy etc. Kein langer Build, nur ein Klick + kurze

