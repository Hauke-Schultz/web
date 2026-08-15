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

**The dock tile lists every unit type, not just the two it launched with** *(2026-08-14)*. `dockInfo` in `HsPlanetGrid` walks a `UNITS` table (`🛸 recon · 🚀 colony · 📦 cargo · 🕵️ spy · 📡 satellite`) instead of naming two keys inline, and a chip appears as soon as one is parked or under construction — amber and pulsing while it builds. The **Activity** tile's in-progress counter walks the same list; before this it counted only recon and colony work, so a spy drone in the yard or a cargo run in flight raised no badge at all. Anything added to the dock later belongs in both lists, or it goes invisible on the planet grid.

Five chips would stack the dots column tall enough to grow the whole grid row, so they wrap **two per line** (`wrap-reverse`, bottom-aligned) rather than stacking.

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
| `defense` | Planetary shield (charged, not upgraded) · Orbital Defense (finds and shoots down foreign spy satellites) |
| `hightech` | Advanced material refinement (planet-exclusive) |
| `dock` | Ship management, missions and fleet operations — unlocked by Space Technology Lv 1; clicking opens `HsDockPanel` · the tile itself carries one chip per unit type in the dock (`🛸 🚀 📦 🕵️ 📡`) plus a dot per flight in the air |
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

Each planet type produces exactly **one** refined resource in its High-Tech building. The other three have to come from a colony of the right type via the cargo drone — or be taken off someone else's planet in a raid (there is no trade; see Combat).

**The resource bar marks what this planet can refine** *(2026-08-13)*. The five refined stocks sit in a `hs-res-card--mini` row on every planet, which made the type→good mapping easy to lose: nothing said which of the five was *yours*. The ones refinable here now carry a border in the **resource's own colour**, so the marker doubles as a reminder of which icon is which, and the dim-when-empty state is lifted to 0.65 for them — "you can make this here" is worth most at a stock of zero. On any planet that is exactly two cards: `🔋 power_cell` (universal) plus the one domain good.

The mapping is **derived from the buildings**, never written down a second time: a good is made by whichever building lists it as a conversion output, and that building's `planetTypes` is the answer — one unrestricted producer (`power_cell_lab`) makes a good universal. Hovering **any** card names its origin (`🧊 Gefroren — nur dort herstellbar`), so the row answers the question from every planet, not just the one you happen to be standing on.

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

### Ordering more than one — the batch  *(2026-08-13, reworked 2026-08-15)*

A 30-minute recipe with one run per click is not a decision, it is an alarm clock. The **×N picker** next to the Convert button orders up to `CONVERSION_MAX_QUEUE` (4) units at once: all costs are deducted immediately, and the facility then works the **whole order as one batch** — `×4` runs for 4 × `durationBase` (two hours) and delivers all four units together at the end.

**The order is a commitment, not a queue.** The first version resolved a queue one unit at a time and re-armed itself, so a ×4 order paid out after 30, 60, 90 and 120 minutes — the picker was pure convenience and nothing stopped a player from ordering four more the moment the first unit dropped. Now:

- **One batch, one delivery.** `runs` on `hs_conversion_queues` is the batch size; `resolve_conversions()` credits `output × runs` once and deletes the row. Nothing counts down any more (the old `remaining` column is migrated to `runs = remaining + 1` and dropped).
- **The recipe is locked while its batch runs.** `convert.php` refuses a second order for the same (building, recipe) — *Conversion already running* — and `canConvert()` mirrors that client-side, with the ×N stepper frozen at the running batch's size. **That lock is the production ceiling:** at most 4 units per 4 durations, no matter how often anyone clicks.
- **Throughput is still unchanged** relative to single runs — four units still take two hours. What the batch removes is the ability to *front-load* by re-ordering after every payout, and what it buys the player is absence.

The picker's ceiling is what the stock pays for (`maxConversionRuns()`, the minimum over the inputs), capped at `CONVERSION_MAX_QUEUE` and clamped on read — a count chosen while rich stays valid after spending. The server clamps the same way via `CONVERSION_MAX_BATCH` in `config.php` (mirror of the JS constant); the client caps the picker, the constant caps the request. The button's duration line shows the *total* for the order, so `×3` reads as ninety minutes up front, and the progress fill spans the whole batch — there is no per-unit reset to show.

Historical note: before the merge-into-one-row fix, `convert.php` did a plain `INSERT`, so clicking Convert while a job ran created a *second* row and two batches resolved side by side — a silent throughput doubling, invisible because `queueFor()` only ever finds the first row. The lock supersedes that fix: there is now never a second order to merge.

### Where refined goods are spent  *(2026-08-11)*

Until now only Duraplate had a consumer at all — Plasma Core, Superconductor and Vital Gel could be refined, shipped and salvaged, and then sat in the silo forever. Two buildings close that:

| Building | Tile | Gate | Recipe | Build cost |
|---|---|---|---|---|
| 🏥 **Med Station** | base | `command_center` Lv3 | 2 Vital Gel + 120 Metal → **1 population** (30 min) | 400 M · 200 C · 3 Vital Gel · 2 Superconductor |
| ⚙️ **Plasma Compressor** | techcenter | `laboratory` Lv2 | 1 Plasma Core + 150 Metal → **3 Power Cells** (30 min) | 500 M · 250 C · 4 Duraplate · 2 Superconductor |
| 🏗️ **Deep Shaft Frame** | mining | `metal_mine` Lv4 | 1 Duraplate + 100 Crystal → **1200 Metal** (30 min) | 600 M · 300 C · 2 Plasma Core · 2 Vital Gel |
| 🔭 **Deep Survey Array** | mining | `crystal_drill` Lv4 | 1 Superconductor + 100 Metal → **700 Crystal** (30 min) | 500 M · 400 C · 2 Plasma Core · 3 Duraplate |

The pattern is deliberate and should be kept for anything added later: **the recipe consumes one domain continuously, the construction cost demands two more once.** That way every new building needs goods from at least two planet types, which is what makes the cargo drone — and later the raid — necessary rather than decorative.

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
| **Spy Satellite** | 300 Metal · 150 Crystal · 1 Superconductor · 1 Duraplate | Stays in orbit and keeps that planet's finding current until it is shot down |

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

Implemented 2026-08-08 as the deliberately **simple** version; a real freighter (bigger hold, multi-leg routes) is a later design.

### Rules

- **One drone per planet — in existence, not in the dock.** Production, docked, loaded and in-flight all block a rebuild; the slot frees only when the drone lands back home.
- **Hold: 4 items total**, freely mixed (`2 × power_cell + 2 × duraplate` is as valid as `4 × superconductor`).
- **Loadable are only the five high-tech goods:** `power_cell`, `duraplate`, `plasma_core`, `superconductor`, `vital_gel`. Raw resources cannot be shipped.
- **Loading deducts immediately** from the origin planet — that is what stops the same unit being spent twice while in flight. Unloading before launch returns it; after launch the manifest is fixed.
- **One-way delivery:** unload everything at the target, fly home empty.
- **Target: any planet that is scanned *or* owned** — ownership is deliberately no condition, which keeps the door open for a future delivery to a foreign planet. The *or owned* half matters because the **home planet is never in `playerScannedPlanets`** (you don't scout your own start), so without it a colony could not ship anything home. `mission/cargo.php` re-checks this server-side; the frontend condition is not a security boundary.

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
| Reads | **planet type** + owner | the same, **plus the planetary shield** |
| Gives | one observation, then ages | keeps the entry **live until it is destroyed** |
| Role | look once, look again later | keep looking |

### What each unit reads  *(extended 2026-08-13)*

The two units differ in **what** they can measure, not only in how long the answer stays fresh — otherwise the satellite is just a subscription to the drone.

- **A drone flies past**, so it reads what a single pass gives: what kind of world this is, and who lives on it. The **planet type** is now part of that finding — it is the first thing that makes an unsurveyed foreign planet worth a flight even when you can guess who owns it, because the type decides whether the planet is worth colonizing or attacking later.
- **A satellite sits in the orbit and watches**, so it additionally reports the **planetary shield**: whether there is a generator at all, and what its charge is. That is the first piece of *military* intel in the game, and it is deliberately the expensive unit's exclusive: the shield is the one value that will decide a future attack.

Three distinctions the implementation depends on:

- **The type is not a snapshot.** Owner and shield charge both change, so both are stored with a date and age. A planet's type never changes, so once surveyed it is simply known — `planet.type` is null before the first flight and correct forever after.
- **"No generator" is a finding, not a gap.** `shield.charge === null` means the satellite looked and found nothing to measure; `shield === null` means nothing has ever measured. The UI draws the first as a greyed `🛡️ –` and the second as no chip at all.
- **The shield reading carries its own date.** A later drone flight refreshes `observed_at` without ever looking at the emitter, so sharing one timestamp would let an owner report make a week-old shield figure read as current. Hence `shield_seen_at` next to `observed_at` — and the shield ages far faster than the owner does, since it drains ~30 %/day.

Both are built at the **Drone Hangar** and fly the same route. The superconductor is the sensor package — espionage sits behind the **Control** domain; the satellite adds Duraplate for its frame, per the house rule that a build cost demands two domains the recipe itself does not.

### Rules

- **One-way.** Both units are consumed on arrival — the satellite because it stays there.
- **Target: one planet in a scanned foreign system.** Your own system needs no espionage, and an unscanned system cannot be targeted.
- **The drone always goes first.** A satellite is *placed*, not sent looking: it needs an orbit that has been surveyed once, so it can only be sent to a planet that already has a report. That is also what stops a satellite from being spent blind on an empty rock — the drone is what finds out whether the planet is worth watching. Checked on both sides; the 📡 button simply does not appear before the first report.
- **A stale report is not a blocker** — refreshing it is the drone's standing job, and re-spying is allowed at any time. The only refusal is a **live satellite** over that planet: it is already telling you everything the flight would.
- **One espionage flight at a time per launching planet**, same rule as the recon drone.
- **Flight time is the scan curve** — `max(2 h, distance × 180 s)` between star **systems**, so a neighbour is 2 h and the far side of the galaxy ~8 h. Inside a system every planet is the same trip.
- **Stale after 48 h** (`SPY_INTEL_STALE_HOURS`): keeping a planet current by drone alone is a chore every two days, and that is what makes the satellite worth its price.
- **A satellite has no lifetime — it orbits until it is shot down** *(2026-08-13)*. It used to expire after 168 h, on the reasoning that an unlimited satellite is a single purchase that settles espionage forever. That reasoning was right and the timer was the wrong answer to it: what limits a satellite now is the planet it watches. See **Orbital Defense** below — the timer was replaced by an opponent.
- **What it reveals:** the planet's type and who owns it — or that it is genuinely empty; the satellite adds the shield. Buildings, resources and fleets are a later step, and they *have* to be snapshots, which is the other reason the report model comes first.

### Orbital Defense — what ends a satellite  *(implemented 2026-08-13)*

🎯 **`orbital_defense`**, defense tile, single level, gated behind the `shield_generator`. **500 Metal · 300 Crystal · 2 Superconductor · 2 Plasma Core**, 10 energy, 3 workers. Control pays for the sensor that finds a satellite, Power for the gun that kills it — the two domains espionage itself is assembled from, which is the same rule every other build cost follows.

It does two things, and the first one matters more:

- **It is the detection.** Without the building a planet cannot tell that anything is in its orbit at all — `foreign_satellites()` returns an empty list before it stands, and the panel does not exist. That is what keeps a satellite worth placing over an undefended colony, and it means the building is bought on suspicion, not on evidence.
- **It shoots one down per click**, for **1 Power Cell** (`INTERCEPT_COST`). Deliberately cheap next to the 300 M · 150 C · 1 SC · 1 DP satellite it destroys: the expense was the battery, and a defender who owns one should never weigh whether a kill is worth it.

Three consequences that are the point of the design:

- **The wreck is identified.** The kill names the spy — portrait and username — so being watched becomes something a player can answer. Getting caught is now the satellite's real price, and that risk is what replaced the timer.
- **The spy is told.** `satellite_lost_at` doubles as an outbox: set when the satellite dies, cleared the moment `state.php` hands the loss over, so the message is delivered exactly once without a notification table. Losing a satellite has to be an event — the alternative is noticing weeks later that a chip quietly went missing from a list.
- **The report freezes at the moment of the kill.** The satellite transmitted right up to the end, so its last frame — owner *and* shield charge — is written into `hs_spy_intel` before the flag drops. The entry then ages like any drone finding. Espionage does not lose what it had; it loses the live feed.

The panel sits on the defense tile under the shield (`HsOrbitDefensePanel`): a red-tinted box with the bogey count, one row per satellite (portrait, name, *beobachtet seit …*) and a 🎯 button carrying its power-cell cost, exactly like the shield's crystal tag. With an empty orbit it says so — *"Orbit frei — keine fremden Satelliten geortet"* — because with this building an empty orbit is a finding, not a blank.

Dev cheat **🛰️ Bespitzeln** (`spy_on_me`) plants a satellite from any other player over the active planet; testing this otherwise needs a second account and a four-hour flight.

### What the server hides

| Field | Sent when |
|---|---|
| `planet.owner` | own planet · any planet in your home system · **live satellite** → current owner · otherwise the **stored observation** |
| `planet.type` | own space · any planet you have surveyed once. `null` before that — the type is bought with the flight, not with the star chart |
| `planet.known` | `false` means "not looked at yet", **not** "free" |
| `planet.intel` | `{ observedAt, live, satelliteSince, shield }` — only for foreign planets you have looked at; null for your own space. `satelliteSince` is when the satellite was **placed**, not when it expires — it does not |
| `planet.intel.shield` | only once a **satellite** has been there: `{ charge, observedAt, live }`. `charge: null` = no generator · `live: true` = read from the running satellite, so `observedAt` is null |
| `system.inhabited` | always (the map has always listed inhabited systems as the ones worth scanning) |
| `system.inhabitants` | only for a **scanned** system: portrait and name of each resident — **no planet count**, and never which planets |

**`known` is a property of the planet, never of whether it is occupied.** An earlier version returned `known: true` for empty foreign planets, which made the hidden ones exactly the occupied ones — the secret would have been readable straight off the list. Unspied means unknown either way, which is also what gives the drone a second use: finding empty planets in someone else's system.

**The planet count went the same way.** A scan reports *who* lives in a system and nothing else: on a six-planet system "owns 4" is nearly the whole answer, and the point is that every planet costs a flight.

### UI

**The system tile** carries a pulsing dot while something of ours is inbound — **violet for a drone, teal for a satellite** — in the **top-left** corner, opposite the red unread-message dot, so a system with both still reads as two signals rather than one blob. Its tooltip names the target planet and the countdown; that dot deliberately keeps `pointer-events`, since the tooltip is the only place that information appears on the tile row. The click still bubbles, so selecting the system keeps working.

The system card's planet list is the whole interface. Per planet, left to right: **the type icon**, the name, your colony / the reported owner or `Unkolonisiert`, **the shield chip**, and **how old that finding is** — grey while fresh, amber past 48 h, a teal `📡` while a satellite is transmitting. The satellite chip carries **no number**: there is no countdown left to print, and a figure there would read as a deadline that no longer exists. How long it has been watching lives in the tooltip instead. Then the actions: **🕵️ Ausspähen** (or *Neu* on an existing report) and **📡** for the satellite, each shown only when that unit is parked in the active planet's dock. A ❓ with a tooltip covers the case where nothing is available. One grey line under the list explains the whole mechanic. The dock panel gets two hangar rows (violet drone, teal satellite) and both appear in the mission list.

**The type sits in front of the name as an icon**, not as a word — it is one glyph on a row that already carries four things, and the tooltip names it. An unsurveyed planet keeps the slot and shows a **greyed 🪐**, the same "missing, not absent" rule the solar map uses for a colony without a shield; a hole in the row would say nothing at all. Since the row now holds type, owner, shield, age and two buttons, the **name** is the part that gives up width and truncates.

**The shield chip prints its number**, like the defense tile does and unlike the battery bar: `🛡️ 45 %` in blue for a standing shield, `🛡️ 0 %` in red for an emitter that is installed but empty, a greyed `🛡️ –` when the satellite found no generator, and nothing at all before a satellite has been there. A live satellite adds a faint teal glow — the same "this is current" signal the age label carries. The tooltip is the honest long form: what was measured *and* whether it is being measured right now or was read at the last contact.

### Implementation

- **`hs_spy_intel`** (`player_id`, `planet_id`, `owner_player_id`, `owner_faction_id`, `observed_at`, `satellite_until`, `satellite_active`, `satellite_lost_at`, `shield_seen_at`, `shield_charge`) is the report. `record_spy_intel()` is the **only** place it is written from a mission — anywhere else and the report would silently start following the truth; `destroy_spy_satellite()` is the one other writer, and it only ever freezes and switches off. New columns arrive through `ALTER`s guarded by `SHOW COLUMNS` probes inside `ensure_spy_intel_table()`.
- **Probe every column on its own — never a pair behind one probe.** This is not a style preference, it broke the game once: `satellite_active` and `satellite_lost_at` were added by a single `ALTER` guarded only by a probe for the first. A database that had picked up an intermediate deploy already had `satellite_active`, so the guard held forever and `satellite_lost_at` never arrived — and the next `lost_satellites()` call died with an uncaught `PDOException` on every state load. The migration now walks a `column => ddl` map and probes each entry, so a half-migrated table heals itself on the next request. Any backfill that belongs to one column (the `satellite_active=1` carry-over) fires only on the run that actually added it.
- **The two espionage reads in `state.php` swallow their own errors.** `foreign_satellites()` and `lost_satellites()` return `[]` on any exception. `state.php` is the endpoint the whole game hangs off; an empty satellite list is a survivable wrong answer, a white page over a notification is not. The writes are deliberately *not* wrapped — silence there would lose data.
- **"Still up there" became a flag.** `satellite_active` replaced the `satellite_until > NOW()` comparison; `satellite_until` stays as the record of when each satellite was **placed**, which is what the defender's list and the `📡 seit …` tooltip show. Satellites that were still transmitting under the old 168 h rule keep orbiting after the migration, expired ones stay dead.
- **The kill is claimed before it is paid for.** `destroy_spy_satellite()` returns false unless *its* `UPDATE … WHERE satellite_active=1` was the one that took the row, so two fast clicks on a stale list cannot burn two power cells on one satellite. `intercept.php` charges only after that returns true — the same claim-first pattern the anomaly resolver uses.
- **Only the satellite branch of `record_spy_intel()` writes the shield.** It reads it through `planet_shield_charge()`, which resolves the planet's **owner** first — a shield belongs to a `(planet, player)` pair and the spying player never appears in that lookup. `null` comes back for an uncolonized planet and for an owner without a finished generator, and both are stored as "measured, nothing there".
- **`spy_shield_report()` decides live vs. stored** in `/galaxy`: a transmitting satellite reads the emitter right now (`observedAt: null`, nothing to age), otherwise the last reading is served with its own date. The planet **type** needs no such branch — it cannot change, so the endpoint simply sends `p.type` when `$mine || $seen`, and `null` before that.
- **`spy_intel_map()` is read by `/galaxy`**, which then serves the current owner when `live`, and the stored observation otherwise. A snapshot names a player id, so the endpoint also loads every player's identity: the owner it reports may not be the current one, which is exactly the point.
- **The table backfills itself on creation** from completed `spy_drone` missions, so planets spied under the old "permanent live view" rule survive the change as an observation dated to the mission's arrival.
- **`migrate_spy_missions()` cannot ride along with `migrate_cargo_missions()`**: that one returns early as soon as the `leg` column exists, which is true for every database migrated before espionage. It probes the ENUM definition itself instead — and it probes for `spy_satellite`, the value added last.
- **One endpoint, two units.** `mission/spy.php` takes `unit`; the route, the gates and the flight time are identical, only `resolve_missions()` branches — the satellite passes `true` into the same recorder. Its "a live satellite already covers this planet" refusal needed no change: it reads `spy_intel_map()`'s `live`, which now comes from the flag. With no expiry that refusal simply lasts until somebody shoots the thing down.
- **A landed flight changes what the server will say**, so the tick calls `reloadGalaxy()` — re-fetching is the point, since the client never had the hidden data to unhide.
- Two things broke when owners disappeared from the response and are worth remembering as the pattern: the galaxy tile row filtered systems by `planets.some(p => p.owner)`, and `HsCommLog` decided whether to show the send bar the same way. Both now read the **system-level** `inhabited` / `inhabitants`. Anything else that wants "is somebody there" must do the same — per-planet owners are no longer a reliable population signal.
- **Two onboarding steps** close the checklist (`HsTilePanel`): *step10* first surveyed foreign planet (`spiedPlanets.length > 0`) and *step11* first satellite placed. The second reads `satelliteDeployments` — a server-side count of satellites **ever** placed, not of live ones, because a satellite that is lost must never un-tick a step that was achieved. Same pattern as `cargoDeliveries`. It is also counted locally on arrival so the tick ticks it, not the next state sync.
- Dev cheat **🕵️ Spionage** lands every espionage flight instantly.

### Files

`spy_drone` / `spy_satellite` in `UNIT_COSTS` + `SPY_*` / `INTERCEPT_COST` / `orbital_defense` in `api/star/config.php` · `migrate_spy_missions`, `ensure_spy_intel_table`, `record_spy_intel`, `spy_intel_map`, `planet_shield_charge`, `spy_shield_report`, `orbital_defense_level`, `foreign_satellites`, `destroy_spy_satellite`, `lost_satellites`, `system_distance`, `spy_flight_seconds` in `bootstrap.php` · `api/star/game/mission/spy.php` · `api/star/game/defense/intercept.php` · `spy_on_me` in `api/star/dev/cheat.php` · table `hs_spy_intel` · report filter in `api/star/galaxy/index.php` · `foreignSatellites` / `satellitesLost` in `game/state.php` · `spy*` / `planetIntel` / `isIntelStale` / `interceptSatellite` in `useHawkStar.js` + `mapGalaxy`/`reloadGalaxy` · `HsGalaxyMap.vue` planet list (`typeIcon`, `shieldReport`, `shieldLabel`, `shieldTitle`) · `HsOrbitDefensePanel.vue` · `HsDockPanel.vue`

---

## Combat — The Raid  *(concept, 2026-08-15 — not implemented)*

Phase 5, and the phase that replaces trade: **player trade is dropped from the roadmap** (2026-08-15). Without a market, plunder is the only reason to fly to another player's planet, which is exactly the intent — the cargo drone moves goods between *your own* planets, a raid moves them between *players*.

### Leitprinzip — a raid costs time, never progress

Nothing built is ever destroyed. **Buildings, research, units and population are untouchable**; a raid reads and empties the two values that already exist as meters — the **planetary shield** and the **reactor battery** — and, if the attacker orders it, takes the refined goods lying in the silo. The defender loses charge, crystal, production hours and stock. They never lose the colony.

This is what finally gives the shield a job. The shield section still says *"An empty shield has no side effect… Its charge is the value future combat will read."* This is that reading.

### The two layers, and what winning means

Firepower hits the **shield** first and spills into the **battery**. Both are 0–100, so a fully prepared planet is worth 200 points of defense.

> **Victory = shield 0 % AND battery 0 %.** Anything less is a repelled attack.

| Outcome | Condition | Effect |
|---|---|---|
| **Sieg** | firepower ≥ shield % + battery % | Both meters drop to **0**. Planet is in **blackout** — nothing produces until the defender recharges. Plunder is possible. |
| **Abgewehrt** | firepower < shield % + battery % | Damage still lands: shield first, the rest into the battery, but the battery never reaches 0. No plunder. |

**Partial damage persists on a repelled attack.** That is deliberate: it makes softening a target over two waves a real strategy, and it means the defender feels the near miss instead of shrugging it off. It also keeps the arithmetic honest — the same fleet either bounces off a charged planet or walks over a neglected one, so *when* you strike matters more than how big the fleet is.

Consequences worth stating outright:

- **A planet without a `shield_generator` counts as 0 %, a planet without a `power_plant` likewise.** An undeveloped colony is trivially raidable — and has nothing in its silo, so there is nothing to take.
- **Espionage stays half-blind, on purpose.** The satellite reads the **shield charge and nothing else** — the battery is never reported. So the attacker knows one of the two numbers they have to beat and has to guess the other. **Every raid keeps a real risk**, which is the point: a fully calculable battle would turn the fleet into a spreadsheet entry. It also means the shield is the value worth spying on, and the battery is the value worth hiding.

### The plunder choice — decided at launch

**The order is part of the attack command, not of the aftermath.** The fleet flies with sealed orders; there is no fleet waiting in orbit for its owner to log in and decide. Both orders empty shield and battery on a victory; only one takes goods:

| Order | Beute | Price |
|---|---|---|
| ⚡ **Nur Schild + Batterie** | none | — the fleet turns for home the moment the meters hit zero |
| 💰 **Schild + Batterie + Edelmetalle** | **every refined good on that planet** (`duraplate`, `plasma_core`, `superconductor`, `vital_gel`, `power_cell`) | The fleet has to **stay in orbit and load** (~30 min), and the `orbital_defense` **fires one more volley** at it while it does |

That loading window is what keeps the cheaper order meaningful: against a planet with a working orbital battery and power cells left in the silo, greed costs ships. It also needs no logged-in defender — the gun fires by itself, as it already does against satellites.

**The attacker is always named** in the defender's report, plundered or not. An earlier draft made the anonymous warning shot the reward for not looting; that was dropped because the defender's system card now keeps a raid history per player (see below), and a history full of "unknown fleet" would be worth very little.

Two rules that follow from the mechanics rather than from taste:

- **Only refined goods, never raw.** Same reason the cargo drone excludes them: raws are the capped resources, and `compute_resources()` clamps to the cap on every tick, so an overshooting haul would silently evaporate on the way into the attacker's silo. Refined goods are uncapped, so `credit_resources()` can pay out the whole take.
- **Everything on that planet, no hold limit.** Resources are stored per planet, so a raid strips **one colony**, not an empire — the per-planet storage model is the natural cap and no picker UI is needed. It hurts exactly as much as it should: a full silo of refined goods is many hours of locked refinery batches.
- **Plunder cooldown, 12 h per planet.** A raided planet can be knocked out again but gives up no goods a second time. Without this, a strong player farms a weak one on a timer.

### The raid history in the system card  *(decided 2026-08-15)*

Being raided must not be a thing that happens to you in a notification and then disappears. The **galaxy map's system card** keeps the record: in the owner list of a foreign system, every player carries **how often they have raided you and when the last one was**.

```
👤 Zerrak            ⚔️ 3 · zuletzt vor 2 h
👤 Malari            ⚔️ 1 · zuletzt vor 4 d
👤 Tovin
```

- **It counts raids against you, from that player, ever** — successful *and* repelled. A repelled attack is exactly the thing you want to see building up: three bounced attempts mean the next fleet will be bigger.
- **Aggregated per player, not per planet.** The card's owner list is a list of people, and "who is coming for me" is a question about people. Which of your colonies they hit belongs in the battle report.
- **No entry means no history** — an empty row is "this player has never attacked you", not "no data".
- The badge turns red while the last raid is recent (< 24 h) and fades to grey after that, so the list separates an active aggressor from an old grudge at a glance.
- Data comes straight from `hs_battle_reports` grouped by `attacker_id` for `defender_id = me`; nothing new has to be stored.

**This is why the attacker is always named** — see the plunder section above. It also makes the raid history the natural place from which a counter-raid is planned: you see who, you see how often, and their system is right there on the map.

### Settled

- **Order given at launch**, never after the battle. ⚡ shield + battery, or 💰 shield + battery + refined goods.
- **Satellite reports the shield only.** The battery stays hidden, so an attack always carries risk.
- **2 crew per Korvette.** A Lv3 fleet (12 ships) is 24 population — a multi-day project, and deliberately the sharpest brake in the whole concept.
- **The attacker is always identified** in the defender's report.

### Production — the Korvette  *(implemented 2026-08-15)*

The fleet is built at the existing `shipyard` and ordered as a **batch with a ×N picker**, exactly like a conversion: everything is paid up front, one timer runs over `count × buildTimeBase`, and the whole squadron lands together. Ordering four saves three clicks, never a minute — the same "the batch buys absence, not speed" promise the conversion row makes.

| | Korvette |
|---|---|
| Facility | `shipyard` |
| Cost | 250 Metal · 120 Crystal · 1 Duraplate · **2 crew** |
| Build time | 3 h per ship |
| Firepower | 20 points *(read by the raid, not yet used)* |
| Sortie fuel | 1 Power Cell per ship, paid at launch *(with the raid)* |

The crew is what makes a fleet a commitment: 2 population per ship, gone from the workforce the moment the ship is built, and gone for good when it is shot down. A maxed fleet is 24 people on a planet whose recruit pool caps at 18.

**`weapons_building` finally has a job.** It used to unlock a slot and then do nothing for the rest of the game. It is now the **fleet cap** — and a gate as much as a cap: **Lv1 = 4 berths, Lv2 = 8, Lv3 = 12**, and without the building a planet has no fleet at all. Four corvettes are 80 points of firepower, which cannot crack a charged planet (100 shield + 100 battery) but flattens a neglected one, so the building's level is what decides whether a player can threaten a prepared defender. Levels 2 and 3 cost Structure + Power (duraplate + plasma core, Lv3 adds superconductor), per the two-domains rule.

Three implementation notes worth keeping:

- **`build_count` on `hs_units` is the batch.** `resolve_units()` adds `GREATEST(1, build_count)` hulls in one step and resets the column to 1 — a squadron never trickles in one hull per tick. Added by a runtime `ALTER` probed on its own, per the migration rule.
- **Berths count hulls in the dock *and* hulls in the running batch** (`fleet_size()`), so an order can never be placed past the cap by ordering twice. The server clamps the requested count to the free berths and returns the number it actually built — the client trusts that number over its own.
- **Batching is opt-in per unit** (`UNIT_BATCH_KEYS`). Every other unit ignores `count` and stays at one per build, so nothing about the drone or colony-ship flow changed.

**UI.** A red ⚔️ row in the dock panel, under the colony ship: berth count (`🚩 Flotte 3 / 4`) under the description, the ×N stepper next to the Build button, and cost **and crew for the whole order** so the number under the picker is the one that will be spent. While a batch runs the row shows `Baut… ×3` and one bar. Without a weapons building the row reads `🔒 Waffenkammer` instead of a price.

**Launching.** From the galaxy map's system card, on a foreign planet you have **surveyed at least once** — the same gate the satellite uses. The order carries two things: **how many ships**, and **⚡ or 💰**. Both are fixed at launch; the fleet cannot be re-tasked in flight. Warships are slow: base flight 3 h plus distance (the spy drone's 2 h base is the fast end of the scale). The return leg is a second mission row with `leg='back'`, exactly as the cargo drone does it, carrying the loot.

**Defending.** `orbital_defense` gets its second job, the one noted when it was built. It fires **automatically** — the defender may well be offline — consuming **1 Power Cell per shot from the planet's stock, one destroyed corvette per shot**, up to a cap per attack. Stocking ammunition becomes a standing decision. A destroyed corvette takes its crew with it: that is the attacker's permanent loss.

It fires **twice against a plundering fleet**: once as the fleet arrives, and once while it sits in orbit loading the silo. That second volley is the entire price of the 💰 order, so a defender who keeps power cells in store makes greed genuinely expensive — and the attacker, who can see the shield but not the ammunition, is betting on it being empty.

**And the building is the sensor, again.** With an `orbital_defense` the defender sees the incoming fleet for the last ~30 minutes of its flight and can still charge the shield or buy ammunition. Without it, they learn about the raid from the report afterwards. Same rule as for satellites: *the building is the detection*.

### Protection rules — in from the start

- **Anfängerschutz** — no attacks on players below a size threshold or inside their first days.
- **Deterministic, no dice.** The anomaly design chose *"Entscheidungen, kein Zufall"*; a battle whose outcome can be computed beforehand belongs to the same game. The uncertainty is whether the defender logs in in time, not what the die says.
- **Both sides get a report**, materialised at resolve time the way an anomaly's outcomes are materialised at roll time. Delivery reuses the `satellite_lost_at` outbox trick — a flag cleared the moment `state.php` hands the event over, so a notification fires exactly once without a notification table.

### Files  *(production step)*

`corvette` + `UNIT_BATCH_KEYS` + `FLEET_PER_WEAPONS_LEVEL` + `weapons_building` Lv2/Lv3 in `api/star/config.php` · `build_count` column, `weapons_building_level`, `fleet_cap`, `fleet_size` in `bootstrap.php` (`ensure_units_table`, `resolve_units`, `units_state`) · batch + berth check in `api/star/game/unit/build.php` · `hs_units.build_count` in the schema · `FLEET_PER_WEAPONS_LEVEL` + `corvette` in `hawkStarConfig.js` · `corvette*` / `fleet*` / `maxCorvetteBatch` / `buildCorvette` in `useHawkStar.js` · `HsDockPanel.vue` fleet row · `HsPlanetGrid.vue` dock chips · `HsNotificationPanel.vue` ship builds · `hawkStar.dock.*` / `notifications.corvette*` in de/en

### Out of scope for v1

Damage to **buildings** (explicitly excluded), planet **conquest**, **fleet-versus-fleet** battles in open space, ship repair/damage states, and player **trade** — dropped, not postponed.

### What this reuses

Almost everything is already in the codebase: `hs_missions` + `leg='back'` (outbound and return), the `hs_cargo` hold (the loot manifest), `hs_spy_intel` (the targeting gate), `INTERCEPT_COST` + `orbital_defense` (the gun and its ammunition), `credit_resources()` (cap-safe payout), the conversion batch (the ×N fleet order), and the anomaly's materialise-at-resolve pattern (the battle report). Genuinely new: one unit, one table for reports, and the resolution function.

---

## Game Loop

A rough progression arc for a single player:

1. **Colony Phase** — Build up the home planet: unlock slots, raise Metal/Crystal income, balance Energy.
2. **Expansion** — Research the Star Map in the Comm Center (global, unlocks on all planets), scan nearby systems with Recon Drones, send Colony Ships to claim new planets.
3. **Specialization** — Each planet type produces a unique refined resource. Build a spread of planet types to cover all four functional domains (`duraplate`, `plasma_core`, `superconductor`, `vital_gel`).
4. **Contact & Diplomacy** — Research Interstellar Communication in the Comm Center, send signals to inhabited systems, negotiate Friend or Foe relationships with NPC factions and other players.
5. **Conflict** — Spy out foreign planets, then raid them: knock the shield and the reactor battery to zero and, if you are willing to be named for it, take their refined goods (Phase 5).

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
| Phase 3 — Player trade | ❌ Dropped (2026-08-15) — plunder replaces it |
| Phase 5 — Combat: raid concept (shield + battery only, plunder choice) | 📝 Concept |
| Phase 5 — Corvette + shipyard batch + fleet cap (`weapons_building` Lv1–3) | ✅ Implemented |
| Phase 4 — Espionage — spy drone (report that ages) + spy satellite (live) | ✅ Implemented |
| Phase 4 — Espionage — buildings / resources / fleet recon | ⬜ Planned |
| Phase 4 — Defense tile detects and destroys foreign satellites | ✅ Implemented |
| Phase 5 — Combat: raid mission, battle resolution, battle reports | ⬜ Planned |
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
