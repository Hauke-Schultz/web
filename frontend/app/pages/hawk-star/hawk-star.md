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
| `research` | Technology development, unlocks other tiles |
| `communication` | Intel, navigation, interplanetary trade |
| `spacebase` | Launch pad for probes, colony ships, warships, freighters |
| `agriculture` | Food production and special crop cultivation |
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

Produced in High-Tech buildings, used for advanced construction and trade:
`pure_crystal`, `super_alloy`, `quantum_shard`, `nano_alloy`

### Weapon Ordnance

Produced in the Weapon Lab, equipped on warships:
`kinetic_round`, `plasma_cell`

---

## Planet Types

The planet type is assigned on colonization and restricts or enables certain buildings. Types map from raw galaxy mock data (`rock/gas/lava/ice/ocean`) via `MOCK_TYPE_TO_PLANET_TYPE`.

| Type | Icon | Traits |
|------|------|--------|
| **Terrestrial** | 🌍 | Balanced — all standard buildings, no restrictions |
| **Volcanic** | 🌋 | Metal-rich — `magma_forge`, `geothermal_tap`; limited agriculture |
| **Frozen** | 🧊 | Crystal-rich — `cryo_excavator`, `cryo_lab` |
| **Ocean** | 🌊 | Population paradise — `tidal_generator`; weak mining |

Each type also has exactly one trade crop (Agriculture tile): `terra_wheat` / `ember_root` / `frost_spore` / `sea_kelp`.

---

## Units

Units are built at the Space Base tile and consumed on missions. Build time scales with building level (`buildTimeBase / level`). Simultaneous missions are capped by building level (1/2/3).

| Unit | Cost | Purpose |
|------|------|---------|
| **Recon Drone** | 60 Metal · 25 Crystal | Reveals planet details within the home system |
| **Galaxy Probe** | 100 Metal · 50 Crystal | Reveals planet count in a remote star system |
| **Colony Ship** | 300 Metal · 150 Crystal | Colonizes a scanned uncolonized planet |
| **Warship** | 600 Metal · 300 Crystal | Combat vessel (Hawk Frigate class: 2 weapon slots) |
| **Freighter** | 400 Metal · 200 Crystal | Inter-system resource transport |

---

## Galaxy

The galaxy (`hawkStarGalaxyMock.js`) contains 9 star systems arranged at percentage-based x/y coordinates on a canvas. Each system has:

- `starClass` (cosmetic), `state` (`own`/`uncolonized`/`enemy`/`ally`), 4–8 planets
- `minLevel` — Star Map level required to reveal the system in the galaxy view

### Visibility Rules

- System visible in Galaxy Map → `starMapLevel >= system.minLevel`
- System detail visible → `reconDroneLevel >= system.minLevel` OR it's the home system
- Solar System view shows the home system at Star Map Lv1

### Planet States

`own` · `uncolonized` · `enemy` · `ally` · `unknown`

### Trade Routes

Defined in `TRADE_ROUTES` — rendered as dashed SVG lines between systems at Star Map Lv2+.

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
