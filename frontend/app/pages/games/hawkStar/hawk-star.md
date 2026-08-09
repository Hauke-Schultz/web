# Hawk-Star

A browser-based multiplayer space strategy game. Each player starts on a single planet, builds up a civilization, expands through a galaxy of star systems, and eventually interacts with other players and NPC factions through diplomacy, alliances, or conflict.

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

### Planet building slots (rows 2–5)

Every slot has a fixed tile type defined in `PLANET_GRID` (`hawkStarConfig.js`). Slots start locked and are unlocked by completing specific building levels (via the `unlocks` field on a building level). The center slot (slot 5, Base) and a few others start unlocked from the beginning.

### Tile Types

| ID | Description |
|----|-------------|
| `base` | Colony command center — must be built first |
| `mining` | Raw resource extraction (Metal, Crystal) |
| `energy` | Power generation — Energy is a utility, not stockpiled |
| `techcenter` | Technology Center — Space Building, Weapon Building, Laboratory |
| `comm_center` | Comm Center — global research tile. Technologies researched here apply across all planets |
| `spacebase` | Launch pad for drones and colony ships |
| `defense` | Planetary shields and weapons platforms |
| `hightech` | Advanced material refinement (planet-exclusive) |
| `dock` | Ship management, missions and fleet operations — unlocked by Space Technology Lv 1; clicking opens `HsDockPanel` |
| `warship_bay` | Placeholder — no buildings yet |
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
  - `energyDrain` — energy consumed
  - `staffDrain` — population workers permanently assigned
  - `storageCapacity` — adds to the resource storage cap
  - `unlocks` — planet slots unlocked on completion

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

Each planet type produces exactly **one** refined resource in its High-Tech building. The other three must be acquired via trade.

The four are built around **functional domains**, not tiers of quality. Each one covers a capability the other three do not, so a recipe that asks for two of them is a real decision and no planet can supply everything on its own:

| Planet Type | High-Tech Building | Produces | Domain | Input |
|-------------|-------------------|----------|--------|-------|
| Terrestrial | `alloy_refinery` | 🔷️ `duraplate` | **Structure** — hull, armour, framing | 150 Metal + 60 Alloy |
| Volcanic | `obsidian_foundry` | 🔥 `plasma_core` | **Power** — reactors, thrusters, weapons | 80 Crystal + 80 Obsidian |
| Frozen | `cryo_refinery` | 🔌 `superconductor` | **Control** — computing, sensors, targeting | 100 Crystal + 50 Cryonite |
| Ocean | `bio_lab` | 🧬 `vital_gel` | **Life support** — crew, range, medical | 120 Metal + 40 Biomass |
| *(any)* | `power_cell_lab` | 🔋 `power_cell` | Universal starship fuel cell | 200 Metal + 100 Crystal |

> **Design note (2026-08-07).** These replaced an earlier set — `super_alloy`, `quantum_shard`, `pure_crystal`, `nano_alloy`. That set failed because three of the four were simply "metal or crystal, but better": they differed in origin, not in function, which made them interchangeable and left no way to write an interesting recipe. Their icons and colours also collided badly (two blue diamonds, two grey tools, three shades of blue). The replacements carry one distinct function, icon and colour each. The old names survive only in `REFINED_RENAMES` in `bootstrap.php`, which migrates existing stock.

All High-Tech buildings (the four refineries plus `power_cell_lab`) are deliberately **single-level** — they are built once and never upgraded, to keep the early game simple. Conversion speed is therefore fixed at `durationBase` (`convert.php` divides by the building level, which is always 1). Throughput is tuned via `durationBase`, not via upgrades.

Every recipe runs at **1800 s (30 min)** per unit. Refined output is deliberately slow *and* expensive — one unit is a half-hour plus roughly half of what the mines produce in that window. These are intended as pre-products for future starship construction and small orbital installations, so they are meant to accumulate slowly. All inputs still fit inside level-1 storage caps, so no recipe can soft-lock a fresh planet.

**First consumer: `shield_generator`.** The planetary shield costs 3 / 7 / 15 Duraplate on top of its metal and crystal — plating a shield emitter is a Structure job, so it cannot be built from raw metal alone. This is the first place a refined resource gates a building rather than a ship.

Consequence worth knowing: Duraplate is produced by `alloy_refinery`, which is **terrestrial only**. Until goods can move between planets, a volcanic, frozen or ocean colony cannot build a shield at all. That is the intended shape of the domain system — no planet is self-sufficient. The **Cargo Drone** (see below) is what closes this gap: the Duraplate is shipped in from a terrestrial planet.

Planned consumers (not implemented yet): satellites (Structure + Control), repair drones (Structure + Life support), sensor buoys (Control), gun turrets (Structure + Power) and escape pods (Life support + Structure) — small builds that use the domains before large starships exist.


---

The planet type is assigned on colonization and restricts or enables certain buildings.

| Type | Icon | Traits |
|------|------|--------|
| **Terrestrial** | 🌍 | Balanced — all standard buildings, no restrictions · `alloy_refinery` (High-Tech) |
| **Volcanic** | 🌋 | Metal-rich — `geothermal_tap`; limited agriculture · `obsidian_foundry` (High-Tech) |
| **Frozen** | 🧊 | Crystal-rich — `cryo_extractor`, `cryo_reactor` · `cryo_refinery` (High-Tech) |
| **Ocean** | 🌊 | Population paradise — `tidal_generator`; weak mining · `bio_lab` (High-Tech) |
| **Uninhabitable** | 🌑 | Hostile or barren — colonization not possible, shown as locked in the solar system |

---

## Power Battery  *(implemented)*

Every `power_plant` has a battery (0–100 %) that slowly drains over time, independent of energy production. Click **⚡ Charge +10 %** (free, unlimited) to top it up — the battery only fills by clicking, which is the return-to-play hook.

- **At 0 % the whole planet grid goes offline** — nothing produces until recharged. This is separate from the existing energy balance (production ≥ drain); both must hold for a building to run.
- Drain scales with `power_plant` level — higher level lasts longer (Lv1 ≈ 72 h full→empty … Lv6 ≈ 192 h).
- A newly built power plant starts at **0 %** (blackout) so the player learns to charge it.
- Backend: table `hs_power_battery` (charge + timestamp), resolved live from elapsed time; `POST /game/power/charge`. UI: bar + "holds ~Xh" countdown + charge button on the energy tile (`HsPowerBattery`). Dev cheat "🔋 Leeren" empties it for testing.

---

## Population Recruitment  *(implemented)*

Population starts at **1** — you grow it by recruiting on the base tile. A **recruit pool** fills over time (≈ 12/day) up to a **cap of 18**, so a long absence never queues hundreds. Click **+1 👥 Recruit** to move one recruit from the pool into your population. No timer, no mini-game.

- Population is the workforce (`freeWorkers = population − Σ staffDrain`); recruited people are permanent.
- The old `quarters` building was **removed** — recruiting replaces its population role; `command_center` stays.
- Backend: table `hs_recruit_pool` (pool + timestamp), resolved live; `POST /game/base/recruit`. UI: pool bar + `+1 Recruit` button on the base tile (`HsRecruitPanel`).
- The **home planet** starts with a full pool (recruit right away). A **fresh colony** starts with an **empty** pool (`init_planet`) — its people have to grow at the normal rate.

---

## Units

Units are built at the Space Base tile and consumed on missions. Each unit type has exactly **one level** — no upgrades. Only **one active mission** per unit type at a time.

| Unit | Build cost | Purpose |
|------|-----------|---------|
| **Recon Drone** | 60 Metal · 25 Crystal | Reveals planet details within the home system |
| **Colony Ship** | 300 Metal · 150 Crystal · 1 Power Cell · **6 crew** | Colonizes a scanned uncolonized planet |
| **Cargo Drone** | 120 Metal · 60 Crystal · 2 Power Cells | Ships up to 4 high-tech goods to any known planet |

> The cargo drone is the one exception to "only one active mission per unit type": it is limited to **one drone per planet in existence**, which is stricter. See the Cargo Drone section below.

### Colony ship crew & the new colony

A colony ship only leaves with settlers aboard: building it requires **6 free workers** (`UNIT_COSTS.colony_ship.crew`, `freeWorkers = population − Σ staffDrain`) and takes them off the planet's population right at build time — server-side check in `unit/build.php` via `free_workers()`.

On landing, the new colony is deliberately small: `init_planet()` gives it **6 population** (`COLONY_START_POP`) and an **empty recruit pool**. The rest of the crew is not simply handed over — the colony has to grow through normal recruitment (≈ 12/day, cap 18).

### Facilities vs. units

Units are produced by a **facility** on the Space Base tile, and one facility serves a whole class of units:

| Facility | Builds | Key |
|----------|--------|-----|
| 🛸 Drone Hangar | every drone type (`recon_drone`, `cargo_drone`) | `drone_hangar` |
| 🚀 Shipyard | every starship type (currently `colony_ship`) | `shipyard` |

Each unit names its facility explicitly via `UNIT_COSTS[unit].facility`; `unit/build.php` reads that field to check the requirement. Before 2026-08-08 the facility was derived from the unit key itself (building key == unit key), which only worked while each facility built exactly one unit. Adding a second drone or ship type now needs no backend change — just a `UNIT_COSTS` entry pointing at the existing facility.

`UNIT_COSTS` holds the per-unit resource cost, `buildTimeBase` and `facility`. Note that `recon_drone` and `colony_ship` remain in use as **unit keys** (`hs_units.unit_key`) and as **mission types** (`hs_missions.type`) — only the building keys were renamed.

Beyond the facility, the colony ship also costs **1 Power Cell**. That puts expansion behind a second tech branch: `command_center` L2 → slot 8 (techcenter) → `laboratory` L1 → slot 9 (hightech) → `power_cell_lab`. Note that resources are per-planet, so a young colony cannot build colony ships of its own until it has its own `power_cell_lab`. The recon drone stays deliberately ungated so early scouting is possible before the laboratory exists.

### Build → dock inventory → mission

A unit is **built first and launched later** — the facility alone never allows a launch:

1. **Build** — `POST /game/unit/build` `{planetId, unitKey}` checks the finished facility, deducts `UNIT_COSTS[unit].cost` and starts a timer (`buildTimeBase`). One unit per type in production at a time.
2. **Inventory** — when the timer expires (`resolve_units()` in `bootstrap.php`, called from `resolve_timers()`) the unit lands in `hs_units.quantity` for that planet. `state.php` returns it as `units`, so the inventory survives a reload.
3. **Launch** — `/game/mission/drone` and `/game/mission/colony` call `consume_unit()`, which decrements the inventory and fails with *"No … available"* when it is empty. Missions cost **no** resources — they were paid at build time.

Frontend mirror: `reconDroneInventory` / `colonyShipInventory` come from `state.units`; `canSendDrone` / `canSendColonyShip` require inventory > 0, while `isDroneTarget` / `isColonyTarget` hold the target-side conditions only, so the solar map can show *"no drone in dock"* instead of hiding the button. Dev cheat `complete_units` finishes running unit builds on the active planet.

---

## Cargo Drone  *(implemented)*

Resources are stored **per planet** and refined goods are planet-type exclusive — a frozen colony can never produce Duraplate and therefore cannot build a `shield_generator` on its own. The cargo drone is the first way to move goods between planets, and the missing half of the functional-domain system.

Implemented 2026-08-08 as the deliberately **simple** version; a real freighter (bigger hold, multi-leg routes, two-way trade) is a later design.

### Rules

- **One drone per planet — in existence, not in the dock.** Production, docked, loaded and in-flight all block a rebuild; the slot frees only when the drone lands back home.
- **Hold: 4 items total**, freely mixed (`2 × power_cell + 2 × duraplate` is as valid as `4 × superconductor`).
- **Loadable are only the five high-tech goods:** `power_cell`, `duraplate`, `plasma_core`, `superconductor`, `vital_gel`. Raw resources cannot be shipped.
- **Loading deducts immediately** from the origin planet — that is what stops the same unit being spent twice while in flight. Unloading before launch returns it; after launch the manifest is fixed.
- **One-way delivery:** unload everything at the target, fly home empty.
- **Target: any planet that is scanned *or* owned** — ownership is deliberately no condition, which makes this the base for player trade later. The *or owned* half matters because the **home planet is never in `playerScannedPlanets`** (you don't scout your own start), so without it a colony could not ship anything home. `mission/cargo.php` re-checks this server-side; the frontend condition is not a security boundary.

### Flow

```
build  →  load (≤4 items, deducted here)  →  choose target  →  outbound flight
                     ↑                                              ↓
                     └──────  return flight (empty)  ←────  unload at target
```

1. **Build** — normal unit build, `cargo_drone` / `facility: 'drone_hangar'`. Cost **120 Metal + 60 Crystal + 2 Power Cells**, `buildTimeBase` **5400 s** (1.5 h).
2. **Load** — pick up to 4 items from the five allowed resources. Deducted from the planet on confirm.
3. **Launch** — pick a target planet. `flightTimeBase` **3600 s** per distance step, same as the recon drone, so a neighbour is 1 h out and 1 h back.
4. **Arrive** — the full cargo is added to the target planet's resources, then the return leg starts automatically.
5. **Return** — the drone is added back to the origin planet's `hs_units.quantity`, empty and ready to load again.

The Power Cell cost puts the drone behind `power_cell_lab`, which sits on the **same High-Tech tile as the refineries** (slot 9) and has no planet-type restriction. Any planet that can refine goods can therefore also build the drone to ship them — the two buildings coexist on one tile, so there is no chicken-and-egg problem. It does mean a planet without a High-Tech tile can never send anything, only receive.

### UI

**Solar System view** — a third unit row below the drone and colony rows, same pattern (`hs-solar-cargo-row`, accent **amber** `#fbbf24` next to drone green and colony blue). The active planet's cell (`hs-solar-cargo-cell--active`) holds the drone: build trigger while there is none, **cargo picker** once one is docked. Every other cell shows the send button, disabled until the hold is non-empty and only for planets passing the scanned-or-owned check. The picker expands under the row via the existing accordion (`toggleBuildRow` / `expandedBuildRow`, key `'cargo'`) and lists all five goods with stock, a `−`/`+` stepper, an `n / 4` counter and *Unload all*. Row visibility follows the drone row: facility built + planet has a dock.

**Dock panel** — build only, listed after the Recon Drone (same hangar). Once a drone exists the build button becomes a **"Bereit"** status with `Laderaum n / 4` and a pointer to the system map; loading and dispatching stay exclusive to the solar view. Both legs appear in the active-missions list (`Cargo → target`, `Cargo ← origin`).

### Implementation notes

- **`hs_cargo`** (`planet_id`, `player_id`, `cargo` JSON, `mission_id`), keyed by the drone's **home** planet. Created when the build is queued and **never deleted** — this row is what enforces one drone per planet. `mission_id` doubles as the in-flight flag: non-null means the manifest is frozen.
- **The return leg is a second mission row** with `leg='back'`, created by `resolve_missions()` on arrival, so every row still describes exactly one flight. Its branch does an `INSERT … ON DUPLICATE KEY UPDATE quantity+1` on `hs_units` — the only place a unit is added outside a completed build.
- **`hs_missions.type` is an ENUM:** `migrate_cargo_missions()` (`bootstrap.php`) adds the enum value and the `leg` column on first access, guarded by a `SHOW COLUMNS … LIKE 'leg'` probe. Fresh installs get both from the schema.
- **Endpoints:** `POST /game/cargo/load` takes the **full desired manifest**, not a delta — the server diffs it against the stored hold, which makes it idempotent and turns *unload all* into a plain write of `{}`. `POST /game/mission/cargo` launches.
- **Delivery to an uncolonized planet** has no resource row to unload into: `deliver_cargo()` returns false and the drone flies home **still loaded** rather than dropping goods on an empty rock. Hence the return leg clears `mission_id` but never the cargo.
- **No storage-cap handling needed:** `compute_resources()` clamps to `$caps` on *every* tick, so an overshooting delivery would silently evaporate — but none of the five loadable goods has a `storageCapacity`, so no clamp applies. **Any future freighter carrying raw resources must handle this explicitly.**
- **Dev cheat** `✓ Fracht` (`complete_cargo_missions`) resolves twice: land the delivery + create the return leg, then bring the drone home.

### Out of scope for v1

Return cargo · more than one drone per planet · targets outside the home system (`flightTimeBase × dist` uses the planet index within the home system) · cancelling or redirecting in flight · raw resources · queued deliveries.

### Files

| File | Role |
|------|------|
| `api/star/bootstrap.php` | `ensure_cargo_table`, `migrate_cargo_missions`, `planet_distance`, `cargo_state`, `deliver_cargo`, cargo branch in `resolve_missions` |
| `api/star/config.php` | `cargo_drone` in `UNIT_COSTS`, `CARGO_LOADABLE`, `CARGO_CAPACITY` |
| `api/star/game/cargo/load.php` | Set the manifest (load / unload / unload-all) |
| `api/star/game/mission/cargo.php` | Launch, incl. the server-side known-or-owned target check |
| `api/star/game/unit/build.php` | One-drone-per-planet gate + claims the `hs_cargo` slot |
| `api/star/game/state.php` | Returns `cargo` and the mission `leg` |
| `frontend/app/composables/useHawkStar.js` | Cargo state, `setCargo`, `sendCargoDrone`, tick handling for both legs |
| `frontend/app/components/hawk-star/HsSolarSystem.vue` | Third unit row + cargo picker |

---

## Game Loop

A rough progression arc for a single player:

1. **Colony Phase** — Build up the home planet: unlock slots, raise Metal/Crystal income, balance Energy.
2. **Expansion** — Research the Star Map in the Comm Center (global, unlocks on all planets), scan nearby systems with Recon Drones, send Colony Ships to claim new planets.
3. **Specialization** — Each planet type produces a unique refined resource. Build a spread of planet types to cover all four functional domains (`duraplate`, `plasma_core`, `superconductor`, `vital_gel`).
4. **Contact & Diplomacy** — Research Interstellar Communication in the Comm Center, send signals to inhabited systems, negotiate Friend or Foe relationships with NPC factions and other players.
5. **Conflict** — Hostile factions may attack; allied factions open future trade and coordination options (Phase 4+).

---

## Galaxy

The galaxy is **shared between all players** and grows dynamically: each new player registration creates a new star system. There is no fixed seed and no NPC factions for now — the galaxy is populated by real players.

### Generation (backend)

When a player registers, `create_player_system()` (in `api/star/config.php`) runs:
- Picks an unused name from a 40-name pool (e.g. "Arix System", "Vega System")
- Picks a position ≥ 15 units away from all existing systems (random within 0–100)
- Creates a random star class (G / K / M / F)
- Generates **6–7 planets**: exactly 4 habitable types + 2–3 uninhabitable, shuffled
- Returns the new system ID + the ID of the home planet (a random habitable planet)

### Planet States

**Planets** carry individual states: `own` · `uncolonized` · `uninhabitable` · `scanning` · `colonizing` · `unknown`

The displayed planet state is derived at runtime: if `playerColonizedPlanets` (from `useHawkStar`) contains the planet ID, the state is shown as `own` regardless of the mock value.

---

## Communication

### Scope (current phase)

No conflicts, no ally/enemy decisions. The goal of this phase is purely:

1. **Scan** — discover who inhabits a system
2. **See** — show inhabitants on the Galaxy Map
3. **Message** — send and receive predefined messages via dropdown

Everything else (alliances, declarations, conflict) is explicitly out of scope here.

---

### Step 1 — Scanning Systems

All 9 systems are always visible on the Galaxy Map. However, **who lives there is hidden by default**. A system can be in one of three scan states:

| Scan State | What the player sees |
|------------|---------------------|
| `unscanned` | Star + system name only — inhabitants unknown |
| `scanning` | Pulsing 📶 badge + countdown timer |
| `scanned` | Inhabitants revealed (name, number of planets owned) |

**How scanning works:**

- Research `star_map` Lv3 in the Comm Center — this is the unlock gate for galaxy scanning.
- This unlocks a **"Scan System"** button on the Galaxy Map for any `unscanned` system.
- **Only one scan can run at a time.** While a scan is in progress all other unscanned systems show ⏳.
- Click → starts a scan signal. Duration is distance-based: **min. 2 hours**, up to ~8 hours for the farthest systems (formula: `max(7200, dist × 180)` seconds, scaled by `buildTimeFactor` for dev).
- When the scan completes, the system transitions to `scanned` and a notification fires.
- The player's own home system is always `scanned` from the start.

Scanning is one-way and permanent — a scanned system stays scanned.

---

### Step 2 — Seeing Inhabitants

Once a system is `scanned`, its **system card** on the Galaxy Map shows:

- Which planets are owned and by whom (player username + portrait)
- How many planets that player controls in this system

---

### Step 3 — Emoji Messages

Once a system is `scanned`, the player can **send a row of up to 5 emojis** to its inhabitants.

**How it works:**

- The Comm Log panel (left side of the Galaxy Map panel) has a send bar at the bottom.
- The player picks 1–5 emojis from the picker — each click **adds** to a staging tray. Clicking a staged emoji removes it again.
- A **Send** button (active once ≥1 emoji is staged) dispatches the whole row at once.
- The emoji row travels at signal speed (distance-based, same formula as scanning).
- On arrival, the row appears in the target player's Comm Log.
- Sent rows appear as right-aligned bubbles; received rows as left-aligned with portrait + username.

**Sendable emoji pool (`COMM_EMOJIS` in `hawkStarConfig.js`):**

`👋 🤝 🌟 ✌️ 😊 🕊️ 🌿 💫 🌈 💎 💰 📦 🔭 📡 🛸 ⚠️ 💥 🔥`

**Limits (enforced on both backend and frontend):**
- Max **5 emojis per row** — validated on send; picker disables once 5 are staged.
- Max **10 rows stored per `(player_id, system_id)` pair** — backend deletes oldest row(s) on each INSERT so the table never grows unbounded.

No free text, no game-state change from messaging (that comes later).

---

### Data Model

**`systemContacts`** — stored in `useHawkStar.js`, loaded from API:

```js
systemContacts: {
  [systemId]: {
    scanState:    'unscanned' | 'scanning' | 'scanned',
    scanEndsAt:   null | timestamp,
    mutualScan:   boolean,  // true = they have also scanned our home system
    theyScannedMe: boolean, // true = they scanned us, but we haven't scanned them yet
  }
}
```

**`commLog`** — list of sent/received message rows, stored in `useHawkStar.js`:

```js
commLog: [
  {
    id:           'msg_1234',
    direction:    'sent' | 'received',
    systemId:     42,
    systemName:   'Arix System',
    owners:       [{ username: 'Froppy', portrait: '👨‍🚀' }],
    messageKey:   '👋 🤝 🌟',   // 1–5 emojis, space-separated
    timestamp:    1234567890,
    travelEndsAt: null,          // null once delivered, timestamp while in transit
  }
]
```

`messageKey` is a space-separated string of 1–5 emojis. The UI splits on spaces to render individual bubbles within a row.

---

### Research: `star_map`

Global building in the `comm_center` tile. Three levels:

| Level | Effect |
|-------|--------|
| Lv1 | Unlocks Solar System view |
| Lv2 | Unlocks Galaxy Map view |
| Lv3 | Enables deep-space scanning (one scan at a time, takes several hours) |

Levels unlock features only when **fully researched** — in-progress research does not count.

### Research: `interstellar_comm`

Global building in the `comm_center` tile. **Requires `star_map` Lv3.** Two levels:

| Level | Effect |
|-------|--------|
| Lv1 | Unlock messaging for all scanned systems |
| Lv2 | Halve signal travel time |

---

### Galaxy Map Layout

The Galaxy Map shows two areas below the tile row:

```
[tile row: all systems]
┌────────────────────────┬────────────────────┐
│  Comm Log              │  System Card       │
│  · chat bubbles        │  · system name     │
│  · staging tray        │  · faction list    │
│  · send button         │  · planet list     │
└────────────────────────┴────────────────────┘
```

- Side-by-side on desktop (≥640 px), stacked on mobile.
- The home system is **pre-selected** when entering the Galaxy Map.
- Clicking a system tile toggles its selection; clicking the selected tile deselects it.
- The card + Comm Log only appear for home or fully `scanned` systems.

**Tile states:**
- `unscanned`: star icon + system name — no inhabitants shown.
- `scanning`: pulsing amber 📶 + countdown.
- `scanned` (inhabited): player portrait + username.
- `scanned` (empty): free/uncolonized label.
- Home system: always shown as own colony (blue).
- "Scan" button visible when: `star_map` Lv3 researched + system is `unscanned` + no other scan active.
- 🔒 shown when `star_map` < Lv3.
- ⏳ shown when `star_map` >= Lv3 but another scan is already running.

---

### `HsCommLog` Component (`components/hawk-star/HsCommLog.vue`)

Reusable chat-log component used in the Galaxy Map. Props: `systemId` (string).

**Display:**
- Messages filtered by `systemId`, sorted oldest → newest (top → bottom).
- Consecutive messages from the same direction are **grouped into one row** and displayed as side-by-side emoji bubbles.
- Always shows the last **10 rows** (groups). If more exist, a **"↑ Ältere Nachrichten anzeigen"** button appears at the top.
- Sent messages: right-aligned, blue bubble.
- Received messages: left-aligned, teal bubble, with player portrait and username above the bubble row.
- Messages in transit are shown at reduced opacity with a small countdown timer.
- Auto-scrolls to the bottom on new messages.

**Send bar** (visible when `canMessageSystem(systemId)` is true):
- **Staging tray**: shows 0–5 staged emoji chips with a remove (×) button each.
- **Emoji picker**: grid of `COMM_EMOJIS` at `1.5rem`. Click to add to tray. Picker buttons disabled once 5 are staged.
- **Send button**: active when tray has ≥1 emoji. Dispatches the row, clears the tray.
- Sends `messageKeys: string[]` to `POST /api/star/comm/send`.

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
| `utils/hawkStarConfig.js` | Static game data: `PLANET_TYPES`, `BUILDINGS`, `RESOURCES`, `UNIT_COSTS` |
| `utils/hawkStarGalaxyMock.js` | Galaxy generator: `generateGalaxy()` — 2 fixed NPC systems + 7 random systems |

### Components

| Component | Role |
|-----------|------|
| `HsNavBar` | View switching (Planet / Solar System / Galaxy Map) + gate checks. First item is `HsPlanetHeader` (planet name + type, clickable to switch to planet view). |
| `HsResourceBar` | Compact resource bar shown at top of all views. Two rows: the raw resources (icon, name, amount, rate) and below them a High-Tech stock row (`hs-res-card--mini`) showing only icon + count for `power_cell` and the four refined resources. Both rows are per active planet. |
| `HsPlanetGrid` | 5×3 unified tile grid — 2 panel tiles (row 1) + 12 planet building slots (rows 2–5). Manages single active-tile state across all 15 cells. |
| `HsTilePanel` | Right-column panel — renders different content based on `activePanel` prop: `'resources'` → `HsAllResourcePanel`, `'notifications'` → `HsProfilePanel` + `HsNotificationPanel` + `HsSettingsPanel`, `'dock'` → `HsDockPanel`, `null` → building detail for the active planet slot |
| `HsDockPanel` | Space Base panel — build & manage ships (recon drones, colony ships) + active missions |
| `HsSolarSystem` | Home system view — all planets + one action row per unit class (drone / colony / cargo). Clicking a planet tile selects it (`hs-solar-tile--selected`); if it is one of your own, it also becomes the **active planet** — the state is fetched first when it was never loaded, since `setActivePlanet()` ignores unknown planets. |
| `HsGalaxyMap` | Galaxy view — all star systems, planet detail card |
| `HsPlanetHeader` | Planet name + type tile — lives inside `HsNavBar` as the first nav item |
| `HsAllResourcePanel` | Full resource breakdown (all non-utility resources with amount, rate, cap). Shown in right panel when Planet Info tile is active. |
| `HsProfilePanel` | Commander profile editor — portrait picker (12 emoji options), editable name (max 12 chars), disposition selector (friendly / neutral / hostile). Shown at the top of the Activity panel. |
| `HsNotificationPanel` | Live activity feed — buildings/ships in progress + completed events (persistent until dismissed) |
| `HsSettingsPanel` | Dev tuning controls (tick rate, build factor, game reset). Shown below `HsNotificationPanel` in the Activity view. |

### Auth & Session

The game requires an account. On first open an **auth modal** appears (replaced the old "Commander Name" setup modal).

**Two modes — switchable by tab (default: Login):**

| Mode | Fields |
|------|--------|
| **Login** | Email · Password · "Remember me" checkbox |
| **Register** | Commander name (username, 2–64 chars) · Email · Password (min. 6 chars) |

- Portrait and disposition are **not** asked at register — they belong in the in-game profile (`HsProfilePanel`).
- **Remember me** (default: on): token stored in `localStorage['hawk-star-token']` (survives tabs/restarts). Off: token only in `sessionStorage` (gone when the tab closes).
- On load: token from localStorage or sessionStorage → verify token → straight into the game; invalid/missing → auth modal.
- Token expiry (7 days): the next API call returns 401 → show the modal again.
- Errors appear inline in the modal (username already taken, wrong password, etc.).

**Composables:**
- `useHawkStarAuth.js` — auth singleton: token, player, rememberMe, register/login/logout/verifyToken
- `useHawkStarApi.js` — thin API wrapper: all game actions (fetchGalaxy, postBuild, postDroneMission, …)
- `useHawkStar.js` — local UI state logic (active slot, active view, tick, resource UI)

### State & Persistence

- **`useHawkStar.js`** is a singleton composable — all components read and write it directly, no props/emits for game state.
- **`gameLoaded`** ref (bool): only becomes `true` after `initFromApi()` fully succeeds. `startBuild` and other write actions depend on it — while `false` they are blocked.
- **`initError`** ref (string): holds the error message when the galaxy load or game-state load fails. Shown in the UI as a red line above the retry button.
- State comes solely from the backend API (`GET /api/star/game/state?planet_id=X`). LocalStorage only holds the JWT token and dev settings.
- `allPlanetStates` is the core state object — keyed by `planetId`, holds resources, buildings, dock and conversion queues per planet.
- `galaxySystems`: loaded from `GET /api/star/galaxy/` after `initFromApi()`.

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
| `hawkStar.comm.*` | HsGalaxyMap — scan states, message keys, NPC responses, comm log |
| `hawkStar.profile.*` | HsProfilePanel — title, name placeholder, disposition labels |
| `hawkStar.starClass.*` | Star class labels (G/K/M/F) |
| `hawkStar.tiles.*` | Tile display names + descriptions |
| `hawkStar.planetTypes.*` | Planet type names + descriptions |
| `hawkStar.buildings.*` | Building names, descriptions, per-level effect text |
| `hawkStar.res.*` | Resource display names |

**In components:** `const { t } = useI18n()` → `t('hawkStar.nav.planet')`.

**In `useHawkStar.js`:** Cannot call `useI18n()` at module scope. Notification objects store `labelKey` + `labelParams`; the component resolves them with `t(n.labelKey, n.labelParams ?? {})`.

**Not yet translated:** Building/resource names in `hawkStarConfig.js` — planned after backend (names will come from DB).

### Implementation Status

Phases 1 + 2 fully implemented and live (since 2026-06-01). Planned:

| Feature | Status |
|---------|--------|
| Phase 3 — Player interaction (trade, player messaging) | ⬜ Planned |
| Phase 4 — Espionage (recon in other players' systems) | ⬜ Planned |
| Phase 5 — Combat (warships, stat-based combat) | ⬜ Planned |
| Slot 7 — new tile type (agriculture removed, concept open) | ⬜ Planned |
| Power battery (power_plant, click-to-charge, blackout when empty) | ✅ Implemented |
| Population recruitment (+1 click, pool with cap, quarters removed) | ✅ Implemented |
| Cargo drone (one per planet, 4 items, one-way delivery + empty return) | ✅ Implemented |

See `hawk-star-backend.md` for the full backend concept.

---

### Update-Prozess

```bash
cd frontend && npm run build
# Output: frontend/.output/public/
```

| Quelle | Ziel |
|--------|------|
| `frontend/.output/public/` | `/html/` |
| `api/` (ohne `star/dev/`) | `/html/api/` |
| `api/db.config.php` | `/html/api/db.config.php` (gitignored, manuell) |
