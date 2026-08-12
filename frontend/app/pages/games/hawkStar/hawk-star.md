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
| `base` | Colony command center — must be built first · Med Station (Vital Gel → population) |
| `mining` | Raw resource extraction (Metal, Crystal) · Deep Shaft Frame + Survey Array (refined goods → raw) |
| `energy` | Power generation — Energy is a utility, not stockpiled |
| `techcenter` | Technology Center — Space Building, Weapon Building, Laboratory, Plasma Compressor |
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

### Upgrade curve  *(rebalanced 2026-08-11)*

Two rules every multi-level building follows, checkable with a script over `BUILDINGS`:

1. **The gain per level never shrinks.** `1 → 2 → 4 → 8` is the house shape (the four raw collectors); flatter is fine, backwards is not.
2. **The cost per point of gain rises smoothly.** Later levels are worse value — that is what makes them a decision — but the slope stays gentle. Nothing may be *cheaper per point* than the level before it, because then the earlier upgrade was a trap.

Levels 4+ of `power_plant`, `metal_mine` and `crystal_drill` broke both rules: they had been appended after the original three-level curves and their increments went flat while their costs kept climbing. The power plant's Lv5 was the clearest case — more metal, more crystal *and an extra worker* for **+4 energy**, while Lv3 had given +13. Measured in metal-equivalent (`metal + 2 × crystal`, roughly the mine ratio) it cost 107 per point where the top solar array costs 32.

New values:

| Building | Levels | Gain per level | Cost per point |
|---|---|---|---|
| `power_plant` | 5 · 12 · 25 · **40 · 56 · 75** | 5/7/13/**15/16/19** | 10/20/28/**30/36/42** |
| `metal_mine` | 2 · 5 · 12 · **20 · 30 · 42** /min | 2/3/7/**8/10/12** | 15/40/49/**60/72/85** |
| `crystal_drill` | 1 · 3 · 7 · **11 · 17 · 24 · 33** /min | 1/2/4/**4/6/7/9** | 50/85/110/**135/160/190/224** |

The mines' **energy drain now scales past Lv3** as well (metal 9 → 12/16/21, crystal 7 → 9/12/15/19) — it used to flatline, which is why the late mine levels felt free apart from the resource cost. A fully built planet needs **135** energy and the two universal sources give **113**, so the planet-exclusive reactor stays the thing that closes the gap. Storage caps were widened to match the higher rates (metal 3000 → 5200, crystal 2500 → 4000); anomaly payouts follow automatically, since they are cap shares.

> Any change here has to be made in **both** `hawkStarConfig.js` and `api/star/config.php` — the server computes production, the client only draws it. A drifted number shows up as a UI that promises something the backend never pays.

### Building row layout

`hs-building-row` (in `HsTilePanel`) splits along one question: *what is this* on the left, *what does the next level cost me* on the right.

| Left (`hs-building-ident`) | Right (`hs-building-action`) |
|---|---|
| Icon with the `Lv n` badge, building name, description (`hawkStar.buildings.<id>.desc`) | Cost tags (resources, ⚡ energy, 👥 workers) → build/upgrade button → one grey line with ⏱ build time and the next level's effect (`…lv<n>`) |

Below 640 px the two stack; above it they sit side by side, split by a border, with the right column at a fixed `12.5rem`. The statuses (building / offline / max / locked) and the progress bar all live in the right column and replace cost + button while they apply.

**The effect line states the *gain from that upgrade*, not the new total** (2026-08-11). It sits under the Build/Upgrade button and answers "what do I get for this click", exactly like the cost tags next to it — `staffDelta()` has always shown the extra workers rather than the new headcount. Energy was where a total actively misled: a Lv6 power plant reading `+40 Energie` looked like a huge upgrade when the step from Lv5 was worth **+4**. Every producing building now carries per-level deltas for **both** rate and storage (`+8 Metall/min · +900 Lager`). Level 1 is unchanged — from nothing, the delta *is* the total.

The rate unit was corrected at the same time: `compute_resources()` multiplies by `elapsed / 60`, so production is **per minute**. The old `/s` in the mine and collector strings was simply wrong; the resource bar had `+X/m` right all along.

The per-level production tags that used to sit under the name were **removed** — they repeated the effect line in a different unit and made the row read as two competing summaries. For the same reason the level effect strings (`…lvN`) in `de.json` / `en.json` no longer carry **worker counts or energy drain**: both already appear as cost tags on the right, so `"+2 Metall/s · 300 Lager · 3 Energie · 2 Arbeiter"` is now just `"+2 Metall/s · 300 Lager"`. Energy *production* stays (`"+12 Energie"` is a power plant's whole point) — only the `N Energie` / `uses N energy` drain segments went.

`HsDockPanel` uses the same two columns for its unit rows: left the ship icon with its inventory badge, name and description; right the cost, the build button and ⏱ build time. The cargo drone's *Bereit* / hold state and the colony ship's missing-crew warning are statuses, so they sit in the right column too.

**The storage cap is the summed `storageCapacity` of the finished buildings — nothing is added on top.** A resource with no capacity building has no cap at all and is not clamped. `maxStorage` in `useHawkStar.js` and `storage_caps_from_levels()` in `bootstrap.php` must produce the same number: the server is the side that enforces it, so any extra the frontend invents shows up as a max the player can never reach.

**A full store pauses production**, and the display has to show that. The counter between the minute syncs is a *preview*: the last server value plus the elapsed share of this minute's rate. `resourceDisplay(id)` in `useHawkStar.js` is the single place that computes it, and it clamps at the cap — an unclamped preview ran a full mine up to 2001, 2002 … before the next sync snapped it back. `isStorageFull(id)` goes with it: both the bar and the resource panel strike the rate through and turn the cap amber while it applies.

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

### Where refined goods are spent  *(2026-08-11)*

Until now only Duraplate had a consumer at all — Plasma Core, Superconductor and Vital Gel could be refined, shipped and salvaged, and then sat in the silo forever. Two buildings close that:

| Building | Tile | Gate | Recipe | Build cost |
|---|---|---|---|---|
| 🏥 **Med Station** | base | `command_center` Lv3 | 2 Vital Gel + 120 Metal → **1 population** (30 min) | 400 M · 200 C · 3 Vital Gel · 2 Superconductor |
| ⚙️ **Plasma Compressor** | techcenter | `laboratory` Lv2 | 1 Plasma Core + 150 Metal → **3 Power Cells** (30 min) | 500 M · 250 C · 4 Duraplate · 2 Superconductor |
| 🏗️ **Deep Shaft Frame** | mining | `metal_mine` Lv4 | 1 Duraplate + 100 Crystal → **1200 Metal** (30 min) | 600 M · 300 C · 2 Plasma Core · 2 Vital Gel |
| 🔭 **Deep Survey Array** | mining | `crystal_drill` Lv4 | 1 Superconductor + 100 Metal → **700 Crystal** (30 min) | 500 M · 400 C · 2 Plasma Core · 3 Duraplate |

The pattern is deliberate and should be kept for anything added later: **the recipe consumes one domain continuously, the construction cost demands two more once.** That way every new building needs goods from at least two planet types, which is what makes the cargo drone — and later trade — necessary rather than decorative.

- The **Med Station** is the only conversion whose output is a person. The recruit pool hard-caps growth at ~12/day; this is the way past it, priced so recruiting stays worthwhile (one head ≈ an hour of bio lab plus 360 metal). No backend work was needed: `resolve_conversions()` writes its output straight into `hs_planet_resources`, `population` is a normal column there, and `compute_resources()` deliberately never touches population.
- The **Plasma Compressor** gives the power domain its purpose. The `power_cell_lab` makes one cell per 30 min from raw material; the compressor makes three in the same slot if fed a core. Same `durationBase` on purpose — the gain is **throughput, not a discount** — which turns volcanic planets into the fleet's fuel supply.

- The **mining pair** spends the two domains that only had one-off costs. Note the direction: duraplate is not *turned into* metal — Structure is hull, armour and framing, so the plating is **built into a shaft frame** and the metal is what the new seam yields. Superconductor likewise drives the **sensor array** that finds a rich vein, which is exactly what Control (computing, sensors) is for.

Three properties of the mining pair are deliberate and worth keeping if they are ever retuned:

- **One refinery feeds exactly one of them.** An `alloy_refinery` produces 1 Duraplate per 30 min — the shaft consumes 1 per 30 min. Same for `cryo_refinery` → survey array. That is what keeps a refinery running forever instead of only until the next building is paid for.
- **They feed each other.** The shaft eats crystal and yields metal, the array eats metal and yields crystal.
- **Output is roughly one extra maxed mine** (40/min vs. the Lv6 mine's 42; 23/min vs. the Lv7 drill's 33) — strong enough to be worth the logistics, not so strong that mines stop mattering.

Since Duraplate is terrestrial and Superconductor frozen, these two make those planet types valuable to the whole empire and give the cargo drone a standing route rather than one-off deliveries.

All four are single-level like the refineries.

**Conversion output is now cap-aware.** `resolve_conversions()` used to do a plain `SET res = res + amt`; the next `compute_resources()` tick then shaved any overshoot back to the cap. With 1 Power Cell per run that never showed, with 1200 Metal it would. It now pays out through `credit_resources()` (the helper the anomalies already use), which fills to the cap and stops. Overshoot is lost either way — the difference is that the number in the silo is honest immediately. Population passes through uncapped, since it has no storage building.

**Conversions are no longer a High-Tech privilege.** `HsTilePanel` used to gate the whole recipe section on `isHightechTile`; it now shows wherever the active tile holds a *built* building with `conversions`. The two High-Tech-specific empty states ("no refinery built" / "this planet type has none") stayed behind that tile check, because conversion is that tile's entire purpose. `convert.php` never needed a change — it only ever checked that the building has recipes and stands finished.

**First building consumer: `shield_generator`.** The planetary shield costs 3 / 7 / 15 Duraplate on top of its metal and crystal — plating a shield emitter is a Structure job, so it cannot be built from raw metal alone. This is the first place a refined resource gates a building rather than a ship.

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

## Planetary Shield  *(reworked 2026-08-12)*

The `shield_generator` used to be a three-level building whose levels claimed "absorbs 20/40/60 % damage" — against nothing, since combat does not exist yet. It is now **a single level that is charged rather than upgraded**: strength is a 0–100 % value that fades over time and is topped up click by click, exactly like the reactor battery, with one deliberate difference — **charging costs crystal**.

- **+10 % per click for 150 crystal**, drain **1.25 %/h** — **~30 % a day**, so a full shield stands for a good **three days** (80 h full → empty) and topping it up is a login-time chore, not an hourly one. One click buys 8 h at full strength; holding it there costs ~19 crystal per hour — a real expense on a young colony, small change on a developed one.
- **A newly built generator starts at 0 %**, same as a fresh power plant.
- **An empty shield has no side effect on the planet.** This is the sharpest difference to the battery, where empty means the whole grid stops: a shield is protection, not infrastructure, so letting it fade costs nothing today. Its charge is the value future combat will read.
- **The defense tile carries the charge on its top edge** — the same 3 px status bar the energy tile uses for the battery and the base tile for the recruit pool, in the panel's blue, **plus the number** (`45 %`) in the corner. It is the only one of the three that prints its value: the bar alone answers "roughly how full", and for a battery or a recruit pool that is enough, but a shield click costs 150 crystal, so the decision to spend needs the exact figure without opening the tile. Below 20 % the bar turns amber, at 0 % it goes red — but it never pulses, since an empty shield is not an emergency the way a blackout is.
- **The solar map repeats it per planet**, together with the reactor battery, so "which colony is running and which one is protected" is answered without visiting each one. `shieldChargeOf(planetId)` / `batteryChargeOf(planetId)` / `gridDownOn(planetId)` in `useHawkStar.js` are the per-planet forms of the active-planet computeds (same anchor-and-decay, any planet — the computeds now call them with `activePlanetId`), and `HsSolarSystem` draws **two stacked hairlines on the top edge** (battery above, shield below) plus a `🔋 60 % 🛡️ 45 %` line on every own tile. They read `allPlanetStates`, so a colony never opened this session shows nothing rather than a stale zero, and a planet without a power plant shows no battery at all (`battery_state()` returns null there). The bars sit on the **top** edge because the bottom one belongs to the flight progress bars.
- **Only the blackout pulses.** An empty battery turns the bar red, flashes it and swaps 🔋 for ⚠️ — that planet has stopped producing. An empty shield goes red and stays still, because it costs nothing today. The same split holds on the planet grid.
- **A missing building shows as a greyed-out icon, not as a gap.** `🛡️ –` in grey says "this colony has no shield" — the thing actually worth spotting on the map — where an empty space says nothing. An emoji ignores `color`, so the icon is greyed with `filter: grayscale(1)`. The chips only appear once the planet's state is loaded, so a failed fetch never fakes a "not built".
- **The view loads every own planet on open** (`ownPlanetIds` + `loadOwnPlanetStates` in `HsSolarSystem`), instead of only the selected one. Meters on all tiles are the whole point, and `refreshPlanetState()` merely fills `allPlanetStates` — it does not touch the active planet. The galaxy typically arrives after mount, so the `watch` on `ownPlanetIds` is what fires on a cold open and `onMounted` covers re-entry; already-loaded planets are skipped, so switching views does not re-fetch.
- The click is refused server-side when the shield is **already full** (the crystal would be burned for nothing) or when the crystal is missing. The button mirrors both, so a wasted click is not possible.
- Building cost went to **400 Metal · 200 Crystal · 5 Duraplate** and the drain to 12 energy — it is the only level now, so it sits where the old Lv2 roughly did.

### Implementation

Deliberately a copy of the power battery, table for table: `hs_shield` (charge + timestamp) resolved live from elapsed time, `shield_state()` / `ensure_shield()` / `shield_generator_level()` in `bootstrap.php`, `SHIELD_*` in `config.php`, `POST /game/defense/charge`, `shield` in `state.php`, `SHIELD` in `hawkStarConfig.js`, `shield*` in `useHawkStar.js`, `HsShieldPanel.vue` on the defense tile. No cron, no resolve step.

Two things differ from the battery and are the parts worth remembering:

- **The endpoint returns the fresh resource row alongside the new charge.** The battery is free, so it only ever had to send its own state back; the shield spends crystal, and without the resources in the same response the stock would sit stale until the next sync.
- **`shield_generator_level()` requires `build_ends_at IS NULL`,** where `power_plant_level()` deliberately ignores it. The battery must keep working while its plant is being upgraded; a shield that is still being built must not already be chargeable.

**Existing saves at Lv2/Lv3** are harmless: `nextLevelDef()` returns null for a level above the config, so the row simply shows as maxed. The extra levels are gone from the config, not from the database.

Dev cheat **🛡️ Leeren** empties the shield — otherwise testing the empty state means waiting out 40 h.

## Population Recruitment  *(implemented)*

Population starts at **1** — you grow it by recruiting on the base tile. A **recruit pool** fills over time (≈ 12/day) up to a **cap of 18**, so a long absence never queues hundreds. Click **+1 👥 Recruit** to move one recruit from the pool into your population. No timer, no mini-game.

- Population is the workforce (`freeWorkers = population − Σ staffDrain`); recruited people are permanent.
- The old `quarters` building was **removed** — recruiting replaces its population role; `command_center` stays.
- Backend: table `hs_recruit_pool` (pool + timestamp), resolved live; `POST /game/base/recruit`. UI: pool bar + `+1 Recruit` button on the base tile (`HsRecruitPanel`).
- The **home planet** starts with a full pool (recruit right away). A **fresh colony** starts with an **empty** pool (`init_planet`) — its people have to grow at the normal rate.

---

## Anomalies  *(implemented)*

Every few hours something drifts past a planet and waits on the **anomaly tile** (slot 7, the old agriculture placeholder). Each anomaly is a fork between **two guaranteed, fully visible outcomes** — the randomness sits in *which* anomaly turns up, never in what a choice pays out. Ignoring one costs nothing but the opportunity: every outcome is a gift, and an untouched anomaly simply expires.

| Type | Weight | Choice A | Choice B |
|------|--------|----------|----------|
| ☄️ Meteor Shower | 20 | crystal share | metal share |
| 🛰️ Derelict Freighter | 20 | 2 high-tech goods (rolled at creation, shown up front) | metal + crystal share |
| 🌞 Solar Storm | 20 | battery +40 % | 2 × power cell |
| 👥 Refugee Convoy | 15 | +4 population, costs metal | 2 × power cell |
| 🧊 Comet Core | 15 | planet-exclusive raw (costs 2 power cells) | crystal share |
| 🏗️ Drifting Drydock | 8 | **2 × duraplate**, costs metal | metal share (large) |
| 🔥 Ejected Reactor Core | 8 | **2 × plasma core**, costs crystal | 2 × power cell |
| 📶 Dead Relay | 8 | **2 × superconductor**, costs crystal | crystal share |
| 🦠 Crashed Bio Pod | 8 | **2 × vital gel**, costs metal | planet-exclusive raw share |
| ⛽ Lost Fuel Depot | 8 | **3 × power cell**, costs metal | metal + crystal share |
| 🤝 Wandering Trader | 10 | 2 high-tech goods, costs a lot of metal | crystal share |
| 👻 Ghost Ship | 8 | 3 high-tech goods, costs 1 power cell | 1 high-tech good, free |
| 🌌 Stardust Cloud | 12 | planet-exclusive raw share (free) | metal + crystal share |

### One event per high-tech good

The five middle rows exist so that **every refinery output can also arrive from the sky** on a planet that cannot produce it. They all share one shape: pay a share of a raw stock for the finished good, or skip it and take a plain raw haul.

The paid side is deliberately **strongest early and mid game**: the cost is a share of the storage cap while the payout is a flat 2–3 units, so a late-game planet with a big silo pays a lot for very little and will simply take option B. That is the intended curve — this is a young colony's stopgap until it has its own refinery or a cargo drone route, never a replacement for either.

### Rules

- **One open anomaly per planet.** Lifetime `ANOMALY_TTL_HOURS` (12 h), next roll no earlier than `ANOMALY_INTERVAL_HOURS` (6 h) after the tile last became free.
- **Rolled on read**, from elapsed time — same no-cron trick as the recruit pool. An absent player never accumulates a backlog.
- **The tile must be unlocked** (`command_center` Lv2) before anomalies start landing, otherwise the first ones would tick away behind a lock.
- Anomalies that would produce a dud option are **filtered out before the roll**: the solar storm needs a `power_plant` to charge, the comet needs a planet type with an exclusive raw resource.

### Panel

The open anomaly is drawn as **one closed card**: the head (icon, name, description, ⏳ remaining) sits on a tinted strip, below it the line *"Wähle eine der beiden Optionen — die andere verfällt"*, and at the bottom the two options **side by side, left and right, split by an "oder"**. The fork is the layout, so the tile no longer needs to be read to be understood. Each option button carries its label plus its deltas stacked one per line (green gains, red costs) — legible even in a half-width column. Without an open anomaly the tile shows only the dashed idle hint.

### Implementation notes

- **Choices are materialised at creation, not at resolve.** The roll turns each template into concrete deltas and stores them as JSON on the row. That is what lets the panel promise exact numbers, and it means a later config or storage-cap change can never alter an offer the player is already looking at.
- **Raw payouts are a share of the planet's storage cap, not a flat number.** `compute_resources()` clamps to the cap on every tick, so a flat amount tuned for the late game would silently evaporate on an early planet. `ANOMALY_CAP_BASELINE` stands in before any storage building exists, where the real cap is still 0.
- The exclusive raws sit on much smaller caps than crystal, so the comet's **paid** option needs the *larger* share (0.60 vs 0.20) to stay worth paying for.
- **The payout is credited through `credit_resources()`, which clamps at the storage cap** (`LEAST(res + amt, GREATEST(res, cap))`). A haul landing on a nearly full silo fills it to the cap and stops. Without that the stock briefly showed an over-cap number that the next `compute_resources()` tick silently shaved back down. Stock already sitting above its cap is left untouched — the helper only ever adds.
- **The interval measures from `MAX(COALESCE(resolved_at, expires_at))`** — the moment the tile last became free. Measuring from `created_at` would let an anomaly that sat around longer than the interval spawn its successor the instant it is answered.
- **`apply_anomaly_choice()` is the only place an effect executes**, for every type. Adding an anomaly is a config entry, not code. Resource keys come out of stored JSON straight into SQL column names, so they are checked against `RESOURCE_KEYS` first.
- Resolving **claims the row first** (`UPDATE … WHERE resolved_at IS NULL`) and only then pays out — a double click cannot collect twice. If the cost turns out to be unaffordable the claim is rolled back so the other option stays open.
- Dev cheat **☄️ Anomalie** forces an immediate roll — otherwise testing means waiting out the 6 h interval. The dropdown next to it **forces one specific type** (empty = the normal weighted roll); with thirteen types, waiting for a particular one to come up is not a test plan. `ANOMALY_TYPES` in `hawkStarConfig.js` feeds that dropdown and is the only frontend mirror of the anomaly list — the game itself never needs it, since an open anomaly arrives from the server with icon and materialised choices.

### Files

`ANOMALY_*` / `ANOMALIES` in `api/star/config.php` · `anomaly_state`, `create_anomaly`, `materialize_anomaly_choice`, `apply_anomaly_choice`, `credit_resources` in `api/star/bootstrap.php` · `api/star/game/anomaly/resolve.php` · table `hs_anomalies` · `HsAnomalyPanel.vue` · `anomaly`/`hasAnomaly`/`resolveAnomaly` in `useHawkStar.js`

---

## Units

Units are built at the Space Base tile and consumed on missions. Each unit type has exactly **one level** — no upgrades. Only **one active mission** per unit type at a time.

| Unit | Build cost | Purpose |
|------|-----------|---------|
| **Recon Drone** | 60 Metal · 25 Crystal | Reveals planet details within the home system |
| **Colony Ship** | 300 Metal · 150 Crystal · 1 Power Cell · **6 crew** | Colonizes a scanned uncolonized planet |
| **Cargo Drone** | 120 Metal · 60 Crystal · 2 Power Cells | Ships up to 4 high-tech goods to any known planet |
| **Spy Drone** | 150 Metal · 80 Crystal · 1 Superconductor | Reports once who owns one planet in a scanned foreign system (one-way) |
| **Spy Satellite** | 300 Metal · 150 Crystal · 1 Superconductor · 1 Duraplate | Stays in orbit and keeps that planet's finding current for 7 days |

> The cargo drone is the one exception to "only one active mission per unit type": it is limited to **one drone per planet in existence**, which is stricter. See the Cargo Drone section below.

### Colony ship crew & the new colony

A colony ship only leaves with settlers aboard: building it requires **6 free workers** (`UNIT_COSTS.colony_ship.crew`, `freeWorkers = population − Σ staffDrain`) and takes them off the planet's population right at build time — server-side check in `unit/build.php` via `free_workers()`.

On landing, the new colony is deliberately small: `init_planet()` gives it **6 population** (`COLONY_START_POP`) and an **empty recruit pool**. The rest of the crew is not simply handed over — the colony has to grow through normal recruitment (≈ 12/day, cap 18).

### Facilities vs. units

Units are produced by a **facility** on the Space Base tile, and one facility serves a whole class of units:

| Facility | Builds | Key |
|----------|--------|-----|
| 🛸 Drone Hangar | every drone type (`recon_drone`, `cargo_drone`, `spy_drone`, `spy_satellite`) | `drone_hangar` |
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

## Espionage — Spy Drone  *(implemented 2026-08-12)*

A deep-space scan tells you **who** lives in a system — a name and a portrait, nothing more. It deliberately does not say **which** planets are theirs, nor even **how many**: a count is a strong hint on a six-planet system, and the point is that every planet costs a drone.

Before this, `/galaxy` handed every client the full ownership map and the UI simply chose not to draw parts of it. Ownership is now filtered **server-side**, because a secret that only the UI keeps is not a secret.

### A report, not a permission

The central decision: what comes back is **an observation with a timestamp**, not access to the live value. A drone writes down what it saw the moment it arrived, and that entry never changes again. If the target is colonized tomorrow, your report still says what it said — until you fly again.

An earlier version stored a "spied" flag and then served the **current** owner forever, which meant espionage never went stale, drones were a one-time purchase, and a satellite would have had nothing left to add. Both units only make sense once intel can age.

| | Spy Drone | Spy Satellite |
|---|---|---|
| Cost | 150 M · 80 C · 1 Superconductor | 300 M · 150 C · 1 Superconductor · 1 Duraplate |
| Build | 2 h | 4 h |
| Gives | one observation, then ages | keeps the entry **live for 7 days** |
| Role | look once, look again later | keep looking |

Both are built at the **Drone Hangar** and fly the same route. The superconductor is the sensor package — espionage sits behind the **Control** domain; the satellite adds Duraplate for its frame, per the house rule that a build cost demands two domains the recipe itself does not.

### Rules

- **One-way.** Both units are consumed on arrival — the satellite because it stays there.
- **Target: one planet in a scanned foreign system.** Your own system needs no espionage, and an unscanned system cannot be targeted.
- **The drone always goes first.** A satellite is *placed*, not sent looking: it needs an orbit that has been surveyed once, so it can only be sent to a planet that already has a report. That is also what stops a satellite from being spent blind on an empty rock — the drone is what finds out whether the planet is worth watching. Checked on both sides; the 📡 button simply does not appear before the first report.
- **A stale report is not a blocker** — refreshing it is the drone's standing job, and re-spying is allowed at any time. The only refusal is a **live satellite** over that planet: it is already telling you everything the flight would.
- **One espionage flight at a time per launching planet**, same rule as the recon drone.
- **Flight time is the scan curve** — `max(2 h, distance × 180 s)` between star **systems**, so a neighbour is 2 h and the far side of the galaxy ~8 h. Inside a system every planet is the same trip.
- **Stale after 48 h** (`SPY_INTEL_STALE_HOURS`), which is deliberately well under the satellite's 168 h: keeping a planet current by drone alone is a chore every two days, and that is what makes the satellite worth its price.
- **The satellite's lifetime is the point.** An unlimited one would be a single purchase that settles espionage forever; with an expiry it stays a standing decision about which planets are worth watching. It is also the natural hook for the defense tile later — a scanner that detects and shoots down foreign satellites.
- **What it reveals:** who owns that planet — or that it is genuinely empty. Buildings, resources and fleets are a later step, and they *have* to be snapshots, which is the other reason the report model comes first.

### What the server hides

| Field | Sent when |
|---|---|
| `planet.owner` | own planet · any planet in your home system · **live satellite** → current owner · otherwise the **stored observation** |
| `planet.known` | `false` means "not looked at yet", **not** "free" |
| `planet.intel` | `{ observedAt, live, satelliteUntil }` — only for foreign planets you have looked at; null for your own space |
| `system.inhabited` | always (the map has always listed inhabited systems as the ones worth scanning) |
| `system.inhabitants` | only for a **scanned** system: portrait and name of each resident — **no planet count**, and never which planets |

**`known` is a property of the planet, never of whether it is occupied.** An earlier version returned `known: true` for empty foreign planets, which made the hidden ones exactly the occupied ones — the secret would have been readable straight off the list. Unspied means unknown either way, which is also what gives the drone a second use: finding empty planets in someone else's system.

**The planet count went the same way.** A scan reports *who* lives in a system and nothing else: on a six-planet system "owns 4" is nearly the whole answer, and the point is that every planet costs a flight.

### UI

**The system tile** carries a pulsing dot while something of ours is inbound — **violet for a drone, teal for a satellite** — in the **top-left** corner, opposite the red unread-message dot, so a system with both still reads as two signals rather than one blob. Its tooltip names the target planet and the countdown; that dot deliberately keeps `pointer-events`, since the tooltip is the only place that information appears on the tile row. The click still bubbles, so selecting the system keeps working.

The system card's planet list is the whole interface. Per planet: your colony, the reported owner or `Unkolonisiert`, and next to it **how old that finding is** — grey while fresh, amber past 48 h, teal `📡 5 d` while a satellite is transmitting. Then the actions: **🕵️ Ausspähen** (or *Neu* on an existing report) and **📡** for the satellite, each shown only when that unit is parked in the active planet's dock. A ❓ with a tooltip covers the case where nothing is available. One grey line under the list explains the whole mechanic. The dock panel gets two hangar rows (violet drone, teal satellite) and both appear in the mission list.

### Implementation

- **`hs_spy_intel`** (`player_id`, `planet_id`, `owner_player_id`, `owner_faction_id`, `observed_at`, `satellite_until`) is the report. `record_spy_intel()` is the **only** place it is written, and only from a landing mission — anywhere else and the report would silently start following the truth.
- **`spy_intel_map()` is read by `/galaxy`**, which then serves the current owner when `live`, and the stored observation otherwise. A snapshot names a player id, so the endpoint also loads every player's identity: the owner it reports may not be the current one, which is exactly the point.
- **The table backfills itself on creation** from completed `spy_drone` missions, so planets spied under the old "permanent live view" rule survive the change as an observation dated to the mission's arrival.
- **`migrate_spy_missions()` cannot ride along with `migrate_cargo_missions()`**: that one returns early as soon as the `leg` column exists, which is true for every database migrated before espionage. It probes the ENUM definition itself instead — and it probes for `spy_satellite`, the value added last.
- **One endpoint, two units.** `mission/spy.php` takes `unit`; the route, the gates and the flight time are identical, only `resolve_missions()` branches — the satellite passes `SPY_SATELLITE_HOURS` into the same recorder.
- **A landed flight changes what the server will say**, so the tick calls `reloadGalaxy()` — re-fetching is the point, since the client never had the hidden data to unhide.
- Two things broke when owners disappeared from the response and are worth remembering as the pattern: the galaxy tile row filtered systems by `planets.some(p => p.owner)`, and `HsCommLog` decided whether to show the send bar the same way. Both now read the **system-level** `inhabited` / `inhabitants`. Anything else that wants "is somebody there" must do the same — per-planet owners are no longer a reliable population signal.
- **Two onboarding steps** close the checklist (`HsTilePanel`): *step10* first surveyed foreign planet (`spiedPlanets.length > 0`) and *step11* first satellite placed. The second reads `satelliteDeployments` — a server-side count of satellites **ever** placed, not of live ones, because an expiring satellite must never un-tick a step that was achieved. Same pattern as `cargoDeliveries`. It is also counted locally on arrival so the tick ticks it, not the next state sync.
- Dev cheat **🕵️ Spionage** lands every espionage flight instantly.

### Files

`spy_drone` / `spy_satellite` in `UNIT_COSTS` + `SPY_*` in `api/star/config.php` · `migrate_spy_missions`, `ensure_spy_intel_table`, `record_spy_intel`, `spy_intel_map`, `system_distance`, `spy_flight_seconds` in `bootstrap.php` · `api/star/game/mission/spy.php` · table `hs_spy_intel` · report filter in `api/star/galaxy/index.php` · `spy*` / `planetIntel` / `isIntelStale` in `useHawkStar.js` + `mapGalaxy`/`reloadGalaxy` · `HsGalaxyMap.vue` planet list · `HsDockPanel.vue`

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
| `HsSolarSystem` | Home system view — all planets + one action row per unit class (drone / colony / cargo). Clicking a planet tile selects it (`hs-solar-tile--selected`); if it is one of your own, it also becomes the **active planet** — the state is fetched first when it was never loaded, since `setActivePlanet()` ignores unknown planets. The **home planet** is marked three ways (`hs-solar-tile--home`): brighter border, lit background and a 🏠 corner badge — blue alone only says "mine", and every colony is blue too. The badge is absolute-positioned on purpose: the collapsed mobile tile hides every text line, including the *Heimat* chip, so the badge is the only marker left there. |
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
| Phase 4 — Espionage — spy drone (report that ages) + spy satellite (live) | ✅ Implemented |
| Phase 4 — Espionage — buildings / resources / fleet recon | ⬜ Planned |
| Phase 4 — Defense tile detects and destroys foreign satellites | ⬜ Planned |
| Phase 5 — Combat (warships, stat-based combat) | ⬜ Planned |
| Power battery (power_plant, click-to-charge, blackout when empty) | ✅ Implemented |
| Population recruitment (+1 click, pool with cap, quarters removed) | ✅ Implemented |
| Cargo drone (one per planet, 4 items, one-way delivery + empty return) | ✅ Implemented |
| Slot 7 — anomaly tile (timed events, two guaranteed outcomes each) | ✅ Implemented |
| Med Station + Plasma Compressor (first consumers for Vital Gel / Plasma Core) | ✅ Implemented |
| Deep Shaft Frame + Survey Array (recurring sinks for Duraplate / Superconductor) | ✅ Implemented |

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
