# Hawk-Star

A browser-based multiplayer space strategy game. Each player starts on a single planet, builds up a civilization, expands through a galaxy of star systems, and eventually interacts with other players through trade, alliances, or conflict.

---

## Views

The game has three nested views, each unlocked progressively via the Star Map building:

| View | Unlock condition | Shows |
|------|-----------------|-------|
| **Planet** | Always available | The active planet's 3×3 building grid |
| **Solar System** | Star Map Lv1 | All planets in the home system |
| **Galaxy Map** | Star Map Lv1+ | Star systems on a canvas, fog of war by Star Map level |

The NavBar (`HsNavBar.vue`) handles view switching and gate checks.

---

## Planet Grid

Each planet is divided into a 3×3 slot grid (9 tiles). Every slot has a fixed tile type defined in `PLANET_GRID` (`hawkStarConfig.js`):

```
[ Defense  ][ Mining    ][ Space Base ]
[ Energy   ][ Base      ][ Comm       ]
[ Agri     ][ Research  ][ High-Tech  ]
```

Slots start locked. They are unlocked by completing specific building levels (via the `unlocks` field on a building level). The center slot (slot 5, Base) and a few others start unlocked from the beginning.

### Tile Types

| ID | Description |
|----|-------------|
| `base` | Colony command center — must be built first |
| `mining` | Raw resource extraction (Metal, Crystal) |
| `energy` | Power generation — Energy is a utility, not stockpiled |
| `techcenter` | Technology Center — Space Building, Weapon Building, Laboratory |
| `research` | Global research — researched once, applied across all planets |
| `spacebase` | Launch pad for probes, colony ships, warships, freighters |
| `agriculture` | Reserved — no buildings yet (planned for later) |
| `defense` | Planetary shields and weapons platforms |
| `hightech` | Advanced material refinement (planet-exclusive) |

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

Components are produced in specialized labs and equipped on warships before deployment.

**Drive slot** (1 per ship) — boosts base stats:

| Component | Produced in | Effect |
|-----------|-------------|--------|
| `power_cell` | Power Cell Lab | +20 Shield · +4 Speed |

**Weapon slots** (2 per ship) — define combat output:

| Component | Produced in | Damage | Accuracy | Armor Piercing |
|-----------|-------------|--------|----------|----------------|
| `kinetic_round` | Weapon Lab | 25 | 85% | 5 |
| `plasma_cell` | Weapon Lab | 40 | 70% | 15 |

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
| **Warship** | 600 Metal · 300 Crystal | Combat vessel — see Warship Classes below |
| **Freighter** | 400 Metal · 200 Crystal | Inter-system resource transport |

### Warship Classes

Defined in `WARSHIP_CLASSES`. Each built warship gets a snapshot of its class stats plus empty slots that the player fills with components before deployment.

| Class | Hull | Shield | Speed | Drive Slots | Weapon Slots |
|-------|------|--------|-------|-------------|--------------|
| **Hawk Frigate** | 150 | 30 | 8 | 1 | 2 |

A `power_cell` in the drive slot adds +20 shield and +4 speed on top of the base stats.

---

## Game Loop

A rough progression arc for a single player:

1. **Colony Phase** — Build up the home planet: unlock slots, raise Metal/Crystal income, balance Energy.
2. **Expansion** — Unlock the Star Map, scan nearby systems with Recon Drones, send Colony Ships to claim new planets.
3. **Specialization** — Each planet type produces a unique refined resource. Build a spread of planet types to cover all four refined resources (`super_alloy`, `quantum_shard`, `pure_crystal`, `nano_alloy`).
4. **Military** — Research the Weapons Building, produce ship components (`power_cell`, `kinetic_round`, `plasma_cell`), assemble and equip Hawk Frigates.
5. **Diplomacy & Conflict** — Encounter allied and enemy factions across the galaxy. Trade via Freighters or push into contested systems with a war fleet.

---

## Galaxy

The galaxy (`hawkStarGalaxyMock.js`) contains 9 star systems arranged at percentage-based x/y coordinates on a canvas. Each system has:

- `starClass` (cosmetic), 4–8 planets
- `minLevel` — data field, not yet used for visibility in the current UI

### Visibility Rules (current)

- All 9 systems are always visible in the Galaxy Map — no fog of war active yet
- Solar System view shows the home system at Star Map Lv1

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
| `HsNavBar` | View switching (Planet / Solar System / Galaxy Map) + gate checks |
| `HsResourceBar` | Resource bar shown at top of all views |
| `HsPlanetGrid` | 3×3 slot grid for the active planet |
| `HsTilePanel` | Buildings & High-Tech conversions for the selected slot |
| `HsDockPanel` | Space Base tab — build & manage all ship types |
| `HsSolarSystem` | Home system view — all planets, drone & colony actions |
| `HsGalaxyMap` | Galaxy view — all star systems, planet detail card |
| `HsPlanetHeader` | Planet name + type header |
| `HsAllResourcePanel` | Full resource breakdown panel |

### State & Persistence

- **`useHawkStar.js`** is a singleton composable — all components read from and write to it directly, no props/emits for game state.
- Player state is saved to **LocalStorage** under the key `hawkStarSave`. Includes: resources, slot unlocks, building levels & progress, ship inventory, missions.
- A version guard discards outdated saves automatically.
- `allPlanetStates` is the core state object — keyed by `planetId`, each entry holds resources, buildings, dock, and conversion queues for that planet.

### Implementation Status

| Feature | Status |
|---------|--------|
| Planet grid, slot unlocks | ✅ Done |
| Buildings (all types) | ✅ Done |
| Energy & staff system | ✅ Done |
| Resources + storage caps | ✅ Done |
| High-Tech conversions | ✅ Done |
| Recon Drones | ✅ Done |
| Galaxy Probes | ✅ Done |
| Colony Ships | ✅ Done |
| Warships (Hawk Frigate, Drive + Weapon slots) | ✅ Done |
| Freighter transport | ✅ Done |
| Galaxy Map (simplified, all systems visible) | ✅ Done |
| Solar System view | ✅ Done |
| Combat system | ⬜ Planned |
| Fog of war / Star Map level gating | ⬜ Planned |
| Multiplayer / Backend API | ⬜ Planned |
