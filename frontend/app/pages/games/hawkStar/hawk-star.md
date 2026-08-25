# Hawk-Star

A browser-based multiplayer space strategy game. Each player starts on a single planet, builds up a civilization, expands through a galaxy of star systems, and eventually interacts with other players and NPC factions through diplomacy, alliances, or conflict.

---

## Views

The game has three nested views, each unlocked progressively via the Star Map global research:

| View | Unlock condition | Shows |
|------|-----------------|-------|
| **Empire** | Always available | One status card per own planet — what is broken, what is idle, what is running |
| **Planet** | Always available | The active planet's 3×3 building grid |
| **Solar System** | Star Map Lv1 (global research) | All planets in the home system |
| **Galaxy Map** | Star Map Lv2 (global research) | Star systems on a canvas — all systems always visible |

The order is the reach of each view: the empire first, then one planet, then its system, then the galaxy.

The NavBar (`HsNavBar.vue`) handles view switching and gate checks. It also renders `HsPlanetHeader` as its first item (planet name + type), which doubles as the planet-view button.

---

## Empire Overview  *(implemented 2026-08-17)*

The answer to *"I have not played for two days — where did I leave off?"*. Before this, every session started on the home planet's base tile (`initFromApi` set `activePlanetId = homePlanetId` and `activeSlot = 5` unconditionally), and finding a blackout, a raid or an expiring anomaly on a colony meant visiting every planet in turn. Nothing told you where to look.

**An empire is at most four planets.** `mission/colony.php` refuses any target outside the home system and a system holds exactly four habitable planets, so this is a board of ≤ 4 cards, not a table — and it is designed for that size.

### What a card says

| Part | Content |
|---|---|
| Head | Type icon, name, 🏠, and the state badge in one word: **Blackout / Alarm / Baut / Wandelt um / Leerlauf / Nichts im Bau** |
| Meters | 🔋 battery and 🛡️ shield as bar + % + **remaining runtime** (`hält 28 h`) |
| Rows | Every finding, most serious first |

#### The badge says what the planet is doing, the frame says how it is  *(2026-08-18)*

Two functions, deliberately not one. `cardTone()` drives the card's **frame** and may only ever be severity — alarm red, warn amber, otherwise plain. `stateBadge()` drives the **word**, and its ladder is:

```
Blackout → Alarm → Baut → Wandelt um → Leerlauf → Nichts im Bau
```

**There is no calm state any more** *(2026-08-19)*. The bottom of the ladder went *Running* → *Produktiv* → **`Nichts im Bau`**, and the last step removed `stateOk` rather than renaming it again.

The reason is that the bottom rung was never really "everything is fine" — it is "no alarm, no warning, and nothing under way", and since a build would have been caught by *Baut* two rungs up, it **always** means nothing is being built. A word like *Produktiv* stated the least useful half of that. The badge now names the half a commander can act on, and a card that used to read "fine" and get closed without a click asks for a build instead.

`stateOk` is therefore unreachable and its i18n keys are deleted in both languages. Restoring a genuine "nothing left to do here" state would need a test for *has this planet anything worth building* — free unlocked slot, affordable upgrade — which does not exist yet.

**The nudge sits below the warn tier, not above it.** A storage that has actually stopped producing outranks an empty build queue, and its `--idle` badge tone is deliberately quieter than amber: this is a suggestion, not a fault.

**Activity outranks `Leerlauf` on purpose.** An empty build slot is a warn row on nearly every young planet, so a badge that let warn win would practically never get to say *Baut* — the feature would be dead on arrival. Nothing is lost by the swap: the amber frame stays, and the warning is still a row on the card. Alarms are the other way round — something broken always beats something under way.

`activity` is computed in `planetStatus()` from `st.buildings` / `st.conversionQueues` **directly, not from `rows`**: `running` is capped at `EMPIRE_RUNNING_MAX`, so a conversion can be cut off the card while still running, and the badge must not lie about that. Construction outranks a batch when both are going, being the longer commitment. **Ship builds are not counted** — the dock rows already say that, and letting them in would make *Baut* stop meaning a building.

**The meters print a runtime, not only a percentage.** `🛡️ 35 %` does not answer the question a returning player actually has; *hält noch 28 h* does. Both drains are known client-side (shield 1.25 %/h, battery level-scaled), so it costs nothing. A missing building is a greyed icon with *kein Schild* / *kein Reaktor* — the same "missing, not absent" rule the solar map and the galaxy card follow.

### The four row kinds

| Kind | Colour | Examples |
|---|---|---|
| **alarm** | red | Blackout · **energy deficit** · shield empty · foreign satellite in orbit |
| **warn** | amber | shield < 20 % · battery < 12 h · **energy tight** · anomaly waiting · **storage full** · **refinery idle** · recruit pool full · empty build slot |
| **running** | grey | building (never capped) · conversion batch · ship batch · raids (named target) · other flights (aggregated) |

#### Energy, on the board  *(2026-08-19)*

The board never said anything about energy, which was the biggest hole in it: a planet whose grid cannot cover its buildings has them switched off by the server, and nothing on the card mentioned it. Two rows now, both on the energy tile:

| Row | Kind | When |
|---|---|---|
| `rowEnergyDeficit` | alarm | `free < 0` — the grid cannot cover its own buildings and the server is taking them offline |
| `rowEnergyLow` | warn | `0 ≤ free < ENERGY_LOW_FREE` (6) — still covered, but the next upgrade will not be |

- **The threshold is a flat six spare, not a share of production** *(2026-08-19)*. It started out as `max(2, produced × 0.15)`, on the theory that tightness is relative. It is not: what decides whether the next building can be switched on is the number of units left over, and six spare is six spare on a starter colony and on a full one. One constant, `ENERGY_LOW_FREE`, and the resource bar turns amber off the very same number — the corner of the screen and the card can never disagree about what "tight" means.
- **Production counts finished levels, drain counts the level a building is upgrading to.** `energyBalanceOf()` repeats that asymmetry from the planet view on purpose: the upgrade's appetite arrives the moment it is queued and its output only when it lands, and that gap is exactly the window in which a planet quietly runs dry. This is why the warn can appear the second an upgrade is ordered — that is the useful moment, not the one after.
- **Neither row fires when nothing draws.** A bare planet with no power plant and no consumers is not in deficit, it is empty; `drain > 0` guards both.
- **Neither fires during a blackout either** — `energyBalanceOf()` returns null there, because production and drain are both zero and the blackout alarm already says everything worth saying.

**The resource bar carries the same warning** *(2026-08-19)*. On `energyLow` the ⚡ card turns amber — tint, value, and the `net/gross` rate line, which goes from green to amber and is where the state is actually read. No badge next to it: the number *is* the message, and a second element only competed with it. Amber sits one step short of the red deficit tint, so the two read as a sequence rather than as unrelated states.

**A trap worth remembering: all three `--low` rules were dead on arrival.** They were written *above* `.hs-res-card`, `.hs-res-value` and `.hs-res-prod` in the stylesheet. Same specificity, so the base rules won on source order and quietly repainted every one of them back to normal — the card kept its tint, the value its colour, the rate line its grey. Only the grey was noticed. Modifiers belong nested inside the block they modify, next to `--deficit`, which is where they are now.

**The warn tier is the point of the board, more than the alarms.** A blackout is noticed anyway. A crystal store that filled up and stopped the drill, or an `alloy_refinery` that has been standing idle since the last batch delivered, are silent losses that a returning player never spots — and the refinery case is worse than it looks, because *one refinery feeds exactly one converter*, so an idle one stalls a whole chain.

Deliberate asymmetries:

- **Raids get an individual row, other flights are aggregated** into `Missionen unterwegs: n`. A raid is the flight whose outcome you are waiting for; the dock and the Activity feed already list every drone one by one.
- **Running rows are capped at `EMPIRE_RUNNING_MAX` (4)**, sorted by arrival, with a `+ n weitere laufen` line. Alarms, warnings **and buildings under construction** are never capped — *"what am I building right now"* is the first thing anyone looks for on a card and must not be pushed out by four cargo flights. Only one building per tile can be under construction, so that list stays short by itself.
- **The build bar's start is derived, not stored.** `hs_buildings` and `hs_global_research` have a `build_ends_at` column and no `build_started_at`, so `buildStartOf()` reconstructs the start from the level's configured `buildTime` — the same formula `buildProgressStyle()` uses for the planet tile, which is the whole point: the two bars must never disagree. (Note that `HsNotificationPanel` reads a `buildStartedAt` the server never sends, so its building bars have always sat at 0 %.)

### The last attack, at the foot of the card  *(2026-08-17)*

Under the rows, every raided planet carries the attack it last took: portrait, attacker, outcome, how long ago — and on a plunder, **exactly what was carried off**.

```
👤 ⚔️ Zerrak · ausgeschaltet · vor 2 h
   Beute: 🔷 4  🔋 7
```

- **It is a footer, not a row.** Rows are things to act on; a battle already happened. Same reasoning that put *Letzte Gefechte* at the bottom of the galaxy card rather than into an accordion.
- **It comes from the server, not from the notification stream.** The first version read `battleReports`, which is the `unseen_battle_reports()` outbox: handed over once, flag cleared, gone on the next reload. `last_raids_on_planets()` reads `hs_battle_reports` directly — one row per planet via a `MAX(fought_at)` join, so the whole board costs one query and the record is still there a week later. It deliberately does **not** touch the seen flags; the outbox keeps its own job of firing the one-time notification.
- **Fresh is red, old is grey** (`EMPIRE_BATTLE_NEWS_HOURS`, 24 h) — the same rule the galaxy card's ⚔️ badge follows. A fresh raid also lifts the card to alarm severity and counts into the nav badge, *without* also appearing as a row: one battle, one place on the card.
- **`won` in a report always means the ATTACKER won**, so from this seat it reads *ausgeschaltet*; a repelled raid reads *abgewehrt*. `raidOutcome()` is the only place that flip happens here, mirroring `logOutcome()` in the galaxy card.
- **An empty haul on a plunder is a finding**, printed as such (*Plünderung — Lager war leer*): it means the silo was bare or the planet was still inside the 12 h plunder cooldown.
- **Only incoming attacks.** Our own raids target foreign planets, which have no card here — that story belongs to the galaxy map, which is where the targets live.

### Research sits above the cards

Global research is the one build the Activity feed misses entirely — that walks `allPlanetStates`, and research lives in `globalResearch`. It gets a violet strip **above** the planet cards, because it belongs to no planet: the server does not record which planet ordered it and the result applies everywhere. The jump goes to the **home** comm center (slot 6), the one planet guaranteed to have the tile.
- **A tile with nothing buildable on this planet type raises no empty-slot row** — an orbit tile is not "unused", it has nothing to build. Global research is excluded for the same reason: it lives in `globalResearch`, not in the planet's buildings, so the comm center would always read as empty.

### Every row is a jump

`focusPlanetTile(planetId, slot)` sets the active planet **and** the tile, then the page turns to the planet view. Unlike `setActivePlanet()` it does not force the base tile — the row knows which tile it is about, and falls back to the base tile only when that slot is still locked on the target planet. A finding you cannot act on from where it is shown is only half an answer.

### One entry point, deliberately

A persistent planet strip — a chip row under the nav bar with meters and a badge per colony, doubling as a planet switcher — was built alongside the board and **removed again** (2026-08-17). It was a second, permanently visible answer to the same question the board already answers, and the board reaches every planet in one click. The Empire tab is the single entry point; there is no ambient status furniture.

The tab therefore sits **first** in the nav bar, before Planet / System / Galaxy: it is where a session starts, and the views below it run outward from there.

### Where you land  *(simplified 2026-08-18)*

**Every session starts on the board — there is no rule.** `LANDING_VIEW` in `index.vue` is the constant `'empire'`, assigned on every init (not only at ref creation, so logging out and back in with another account cannot keep the last view).

The first version branched: the board when *you own more than one planet, or something is raising an alarm*, the planet view otherwise, because the onboarding checklist lived on the home base tile. That branch existed only to serve the beginner, and it was the wrong fix — **the checklist moved onto the board instead**, so the board now answers the beginner’s question *and* the returning commander’s. A `pickLandingView()` that can only ever return one value is not a decision worth keeping, and `ownPlanetIds` / `empireStatus` are no longer read in `index.vue` at all.

### Implementation notes

- **The board needs every colony's state, and `initFromApi` loads only the home planet.** `loadOwnPlanetStates()` moved out of `HsSolarSystem` into the composable and is fired at the end of `initFromApi` — **after** `gameLoaded`, so the game never waits on the colonies; each card appears as its planet arrives. Worst case that is three extra `state.php` calls. A `state.php?all=1` would be tidier and is the thing to build if it ever becomes noticeable.
- **Rows carry keys, not text.** `useI18n()` cannot be called at module scope, so a row ships `labelKey` + `labelParams`, plus `paramKeys` for parameters that are themselves translated (a resource name, a tile name, a unit name) — the component resolves those first and merges them in. Same reason notifications carry a `labelKey`.
- **Pipe-form i18n messages need the count as the third argument** (`t(key, { n }, n)`). Passed only as a named parameter, vue-i18n always picks the singular branch. Row labels therefore avoid plural forms entirely and use a `Label: n` shape, since they all go through one generic renderer.
- **The board reads battles from the table, not from the outbox** — see *The last attack* above. `notifications` (the Activity feed) is still session-only and still loses a report on reload; that is now the only place the outbox gap shows.
- **`hasBattery` repeats the `powerPlantLevel > 0` guard from `gridDownOn()`** — a planet without a power plant has no grid to lose, so its battery is not a meter that means anything yet.
- `empireStatus` recomputes on every tick because it reads `now`. With ≤ 4 planets and ~20 rows that is free; anything that makes this list longer should reconsider it.

### Files

`ownPlanetIds`, `loadOwnPlanetStates`, `storageCapsOf`, `tileHasBuildings`, `anyPlanetName`, `planetStatus`, `empireStatus`, `empireAlertCount`, `planetStatus.activity`, `energyBalanceOf` + `energyLow` + `ENERGY_LOW_FREE`, `focusPlanetTile`, `empireResearch`, `buildStartOf`, `lastRaids` + `EMPIRE_*` / `TILE_SLOT` / `EMPIRE_RANK` in `useHawkStar.js` · `last_raids_on_planets()` in `api/star/bootstrap.php` · `lastRaids` in `api/star/game/state.php` · `HsEmpirePanel.vue` · first tab + badge in `HsNavBar.vue` · `LANDING_VIEW` + view wiring in `pages/games/hawkStar/index.vue` · `hawkStar.empire.*` and `hawkStar.nav.empire` in de/en

---

## Onboarding Checklist

Eleven steps, from *build a command center* to *place a spy satellite*. Nothing ticks them off by hand — each step reads real state, so the list doubles as a progress overview for as long as it is still there.

**It lives on the empire board and nowhere else** *(2026-08-18)*. It used to sit on the home planet’s base tile as well; that was the reason `pickLandingView()` had to send beginners to the planet view, and dropping the second copy is what let the landing rule collapse into a constant (see *Where you land*). One checklist, one place, and every session opens on it.

**It is the last card in `.hs-empire-cards`**, not a strip under the grid — so it is a grid item like the planet cards: half width on desktop, full width below 720 px, and it fills the gap next to an odd number of planets. It shares the cards’ corner radius so a row lines up, keeps its own blue tint because it is a different kind of thing, and takes `align-self: start` so the grid does not stretch it to the height of a tall planet card. It comes after the planet cards on purpose: the cards answer *what needs me now*, the checklist answers *what comes next*.

**When every step is ticked it disappears** — permanently, without a dismiss button. A checklist with nothing left on it teaches nothing; leaving eleven struck-through lines on the board would only cost room.

**The steps are home-planet scoped.** `homeLevel()` reads `allPlanetStates[homePlanetId]` rather than the active planet, and step 3 uses `batteryChargeOf(homePlanetId)`. On the old base-tile copy “active planet” and “home” were the same thing by construction; on the board they are not, and *build a command center* must not un-tick because you last clicked a colony card.

Two steps are deliberately counted rather than measured, so an achievement cannot be lost again: `cargoDeliveries` (step 8) and `satelliteDeployments` (step 11) are server-side totals of deliveries/satellites **ever** completed. Four more guard against a freebie ticking a step: step 2 needs population ≥ 2 (you start with 1), step 6 needs a scanned planet that is not home (`playerScannedPlanets` is seeded with home), step 7 needs a second settlement, and step 9 needs a scanned system that is not the home system.

### Files

`onboardingSteps`, `onboardingDoneCount`, `onboardingComplete`, `homeLevel`, `foreignSystemScanned` in `useHawkStar.js` · `HsOnboardingPanel.vue` · rendered inside the cards grid in `HsEmpirePanel.vue` · `hawkStar.tile.onboarding.*` in de/en (the key prefix is still `tile.`, from when it lived there)

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

#### The three cost tags mean three different things  *(fixed 2026-08-19)*

They are drawn identically, which is why the difference has to be stated:

| Tag | Meaning | Value shown |
|---|---|---|
| resource | paid once, out of this planet's stock | the level's `cost` |
| ⚡ | **tied up, not paid** — continuous draw | `energyDelta()`, the difference to the current level |
| 👥 | tied up, not paid — workers assigned for good | `staffDelta()`, likewise a difference |

**The ⚡ tag used to print the level's total drain.** On a metal mine going Lv3 → Lv4 it read *⚡ 12* — a number that appears in no cost anywhere: Lv3 is already paying 9, so the upgrade asks for 3. Staff was a delta from the start and `hasEnoughPower()` had always *checked* the delta, so the display was the only thing out of step, and it was out of step with itself. `energyDelta()` now mirrors `staffDelta()` exactly.

Each tag also carries a title explaining which of the three it is, because "cost" is the wrong word for two of them and the row has no room to say so.

The resource tags read their stock through `stockOf()` rather than `playerResources` — no build cost is in a player-wide currency today, but the conversion row had exactly that bug with scrap and this is the same code shape.

#### Two things the config audit turned up

Both configs are duplicated by hand (`hawkStarConfig.js` / `config.php`) and the level texts restate numbers from them, so all three can drift. Comparing them mechanically found:

- **`interstellar_comm` Lv2 was unbuildable.** `config.php` had the level, both translations described it (*Signalreisezeit halbiert*), and `signalTravelTime()` halves its factor at level ≥ 2 — but the level was missing from `hawkStarConfig.js`, so `nextLevelDef()` returned null and the row showed MAX. An implemented feature no player could reach. Restored to the frontend rather than deleted from the backend, because everything except that one list agreed it should exist.
- **`weapons_building` Lv2 and Lv3 had no effect text in either language**, so the build row printed the raw i18n key. Both levels buy `FLEET_PER_WEAPONS_LEVEL` (4) corvette berths; the strings now say so.

Everything else checks out: 34 buildings, every level's cost / buildTime / energyDrain / staffDrain / popBonus identical between the two configs, and every number in every `lvN` string matching the level it describes. Worth knowing when reading those strings: **they state deltas, not totals** — *"+8 Metall/min · +900 Lager"* on mine Lv4 means 12 → 20 and 1500 → 2400.

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

## Power Battery  *(implemented · charging reworked 2026-08-25)*

Every `power_plant` has a battery (0–100 %) that slowly drains over time, independent of energy production. Charging is **free and unlimited** and worth **+10 % a go** — the battery only fills by hand, which is the return-to-play hook.

- **At 0 % the whole planet grid goes offline** — nothing produces until recharged. This is separate from the existing energy balance (production ≥ drain); both must hold for a building to run.
- Drain scales with `power_plant` level — higher level lasts longer (Lv1 ≈ 72 h full→empty … Lv6 ≈ 192 h).
- A newly built power plant starts at **0 %** (blackout) so the player learns to charge it.
- Backend: table `hs_power_battery` (charge + timestamp), resolved live from elapsed time; `POST /game/power/charge`. Dev cheat "🔋 Leeren" empties it for testing.

### The charge is a gesture, not a click

`HsPowerBattery` is a **block on the energy tile**, the same shape as the recruit deck and the salvage dial — not the slim button it was until 2026-08-25. The button was honest and did nothing: charging is the one piece of pure upkeep in the game, so it has to be the thing that is nice to *do*. **The server side is untouched** — one traverse asks for exactly the +10 % one click used to.

- **Drag the contact across the cell, left to right.** The gesture must **start in the left third** (`CELL_START = 0.34`) and **reach the far terminal** (`CELL_END = 0.94`), or a tap near the right edge would be a click again. In between it is forgiving: progress only ever grows, so a wobble never costs ground. Let go early and the pending charge drains back — a traverse never half-counts.
- **Sparks come off the contact as it travels**, and burst when the charge lands. They are decoration and are never read back, so a dropped frame costs a picture and never a percent.
- **The cell is divided into `max / clickPercent` segments** — ten of them — so "how many more swipes" is something you can see rather than something the hint has to say. Derived from config: change `clickPercent` and the cell re-divides itself.
- **The pending charge is drawn brighter and does not animate its width.** It *is* the finger. The charge behind it keeps its 0.35 s transition, because that one is a number arriving, not a hand moving.
- **`touch-action: none` on the cell and the breaker track.** The gesture is horizontal and so is the phone's scroll; without it the browser eats the swipe.
- **Enter/Space still charge in one press.** The game is the picture, and a picture must never be the only way to play — the keyboard path runs the same traverse on a rAF and lands the same charge.

### The blackout breaker

**At 0 % the cell cannot be swiped at all** — a dead grid does not come back by wiping a contact over it. A **main breaker** appears under the cell and has to be dragged from OFF to ON, and **slowly**: over `BREAKER_MAX_SPEED = 0.85` track widths per second it arcs and **trips straight back out**, and the whole travel may not take less than `BREAKER_MIN_MS = 900`. Under the limit the pull takes about a second and a half — long enough to feel like a decision, short enough not to be a chore.

- **The lever warns before it trips.** Past 60 % of the speed limit the knob goes amber (`--strained`); over it, red plus a shake plus sparks, and the knob springs back to OFF. Letting go halfway is not a failure — the spring simply takes it back.
- **It cannot be pushed back and re-run:** the knob keeps the furthest point it has reached (`Math.max`), because it is a lever, not a slider.
- **Throwing it over calls the same `chargeBattery()`**, which lifts the blackout at +10 % — so the breaker *is* the first charge, not an extra step before one. The panel loses the breaker as soon as `gridDown` clears, and the cell takes over.

Both mechanics use pointer events with pointer capture, so mouse and touch are one code path.

---

## Planetary Shield  *(reworked 2026-08-12 · charging reworked 2026-08-25)*

The `shield_generator` used to be a three-level building whose levels claimed "absorbs 20/40/60 % damage" — against nothing, since combat does not exist yet. It is now **a single level that is charged rather than upgraded**: strength is a 0–100 % value that fades over time and is topped up by hand, exactly like the reactor battery, with one deliberate difference — **charging costs crystal**.

- **+10 % per charge for 150 crystal**, drain **1.25 %/h** — **~30 % a day**, so a full shield stands for a good **three days** (80 h full → empty) and topping it up is a login-time chore, not an hourly one. One charge buys 8 h at full strength; holding it there costs ~19 crystal per hour — a real expense on a young colony, small change on a developed one.
- **A newly built generator starts at 0 %**, same as a fresh power plant.
- **An empty shield has no side effect on the planet.** This is the sharpest difference to the battery, where empty means the whole grid stops: a shield is protection, not infrastructure, so letting it fade costs nothing today. Its charge is the value future combat will read.
- **The defense tile carries the charge on its top edge** — the same 3 px status bar the energy tile uses for the battery and the base tile for the recruit pool, in the panel's blue, **plus the number** (`45 %`) in the corner. It is the only one of the three that prints its value: the bar alone answers "roughly how full", and for a battery or a recruit pool that is enough, but a shield click costs 150 crystal, so the decision to spend needs the exact figure without opening the tile. Below 20 % the bar turns amber, at 0 % it goes red — but it never pulses, since an empty shield is not an emergency the way a blackout is.
- **The solar map repeats it per planet**, together with the reactor battery, so "which colony is running and which one is protected" is answered without visiting each one. `shieldChargeOf(planetId)` / `batteryChargeOf(planetId)` / `gridDownOn(planetId)` in `useHawkStar.js` are the per-planet forms of the active-planet computeds (same anchor-and-decay, any planet — the computeds now call them with `activePlanetId`). Since the orbit map *(2026-08-25)* the two are no longer hairlines on a tile edge but **the things they physically are**: the battery is a **charge ring around the planet** (a conic gradient masked down to a 3 px band, filling clockwise from the top), the shield is **the bubble around it** (a radial glow whose opacity and border alpha are the charge). They read `allPlanetStates`, so a colony never opened this session shows nothing rather than a stale zero, and a planet without a power plant shows no ring at all (`battery_state()` returns null there). The exact numbers moved into the planet list beside the map, as `🔋 60 %` / `🛡️ 45 %` chips in the open row.
- **Only the blackout pulses.** An empty battery turns the bar red, flashes it and swaps 🔋 for ⚠️ — that planet has stopped producing. An empty shield goes red and stays still, because it costs nothing today. The same split holds on the planet grid.
- **On the map a shield at 0 % draws nothing at all.** An unshielded planet should look bare, not like it is wearing an empty bubble — the aura *is* the charge, so there is nothing to grey out. The "not built" case still needs saying, so the list row keeps the chips: they only appear once the planet's state is loaded, and a failed fetch never fakes a "not built".
- **The view loads every own planet on open** (`ownPlanetIds` + `loadOwnPlanetStates` in `HsSolarSystem`), instead of only the selected one. Meters on all tiles are the whole point, and `refreshPlanetState()` merely fills `allPlanetStates` — it does not touch the active planet. The galaxy typically arrives after mount, so the `watch` on `ownPlanetIds` is what fires on a cold open and `onMounted` covers re-entry; already-loaded planets are skipped, so switching views does not re-fetch.
- The charge is refused server-side when the shield is **already full** (the crystal would be burned for nothing) or when the crystal is missing. The holder mirrors both — it cannot be picked up at all — so a wasted charge is not possible.
- Building cost went to **400 Metal · 200 Crystal · 5 Duraplate** and the drain to 12 energy — it is the only level now, so it sits where the old Lv2 roughly did.

### The gesture is the payment  *(2026-08-25)*

`HsShieldPanel` is a **block on the defense tile** in the same shape as the battery block, and the two mechanics are still relatives — they just no longer share a button. **You drag a crystal shard out of its holder and into the emitter at the foot of the dome.** The rule that decides the whole design: the server hands out exactly +10 % for exactly 150 crystal, so **a mini-game here may never fail after the money is gone**. Hence a carry rather than a swipe — the shard is yours until it touches the core, dropping it anywhere else costs nothing, and `chargeShield()` is called at exactly one moment.

- **The dome is the meter.** An SVG arc over the planet's horizon with `pathLength="100"`, so the charge is a plain `stroke-dasharray="{pct} 100"` and no length ever has to be measured. `max / clickPercent` tick marks divide it into the ten shards a full shield costs.
- **The core has a pull.** Inside twice the catch radius the shard is lerped toward the emitter (up to 45 %), so the drop feels like the emitter *taking* the crystal instead of like hitting a target. The radius is computed in real pixels (`max(26, 15 % of the stage width)`), so it feels the same on a phone as on a wide panel.
- **While the shard is in the pull, the dome shows the stretch it would buy** as a pulsing ghost arc — the price tag drawn on the thing you are buying — and the core brightens. That preview is also the "let go now" signal, so the status line never has to be read.
- **One coordinate space for everything.** The stage is locked to the viewBox's `aspect-ratio`, so the emitter, the holder and the flying shard are all positioned in plain percentages of the same box and nothing is converted twice.
- **An empty shield still gets no ceremony.** The battery's blackout has a breaker to throw; the dome at 0 % just goes dark and waits — an empty shield costs the planet nothing today, and the UI must not claim otherwise.
- **Enter/Space still charge in one press**, with the shard flying the route by itself on a rAF.

### Implementation

Deliberately a copy of the power battery, table for table: `hs_shield` (charge + timestamp) resolved live from elapsed time, `shield_state()` / `ensure_shield()` / `shield_generator_level()` in `bootstrap.php`, `SHIELD_*` in `config.php`, `POST /game/defense/charge`, `shield` in `state.php`, `SHIELD` in `hawkStarConfig.js`, `shield*` in `useHawkStar.js`, `HsShieldPanel.vue` on the defense tile. No cron, no resolve step.

Two things differ from the battery and are the parts worth remembering:

- **The endpoint returns the fresh resource row alongside the new charge.** The battery is free, so it only ever had to send its own state back; the shield spends crystal, and without the resources in the same response the stock would sit stale until the next sync.
- **`shield_generator_level()` requires `build_ends_at IS NULL`,** where `power_plant_level()` deliberately ignores it. The battery must keep working while its plant is being upgraded; a shield that is still being built must not already be chargeable.

**Existing saves at Lv2/Lv3** are harmless: `nextLevelDef()` returns null for a level above the config, so the row simply shows as maxed. The extra levels are gone from the config, not from the database.

Dev cheat **🛡️ Leeren** empties the shield — otherwise testing the empty state means waiting out 40 h.

## Population Recruitment  *(implemented)*

Population starts at **1** — you grow it by recruiting on the base tile. A **recruit pool** fills over time (≈ 12/day) up to a **cap of 18**, so a long absence never queues hundreds. Each click moves one recruit from the pool into your population.

- Population is the workforce (`freeWorkers = population − Σ staffDrain`); recruited people are permanent.
- The old `quarters` building was **removed** — recruiting replaces its population role; `command_center` stays.
- Backend: table `hs_recruit_pool` (pool + timestamp), resolved live; `POST /game/base/recruit`.
- The **home planet** starts with a full pool (recruit right away). A **fresh colony** starts with an **empty** pool (`init_planet`) — its people have to grow at the normal rate.

### The muster deck  *(2026-08-24 — replaced the meter button)*

It was one slim button with a bar on its top edge and a number on its face. The number was honest and told you nothing. A pool that fills at twelve a day and caps at eighteen **is a queue of people waiting to be taken on** — that is a picture, and drawing it costs no rule changes at all.

```
👥 Rekrutierung                                  🏠 12
┌───────────────────────────────────┐ ┌──────────┐
│ ╭───────────────────────────────╮ │ │👤👤👤👤👤👤│
│ │      Arbeite auch nachts.     │ │ │◐· · · · ·│
│ ╰──┬────────────────────────────╯ │ │· · · · · ·│
│ 👤 → → →                 ╭─────╮  │ │   7 / 18 │
│                          │  ║  │  │ └──────────┘
└──────────────────────────╰─────╯──┘
   ↑ deck                    ↑ airlock
V. Ferrix-408          Nächste/r in 1h 12m
Wächst um ~12/Tag bis max. 18. …
```

- **Deck left, queue right** *(2026-08-24)*. They are the same fact twice — who is on offer, and how many are behind them — so they share one row, and the queue stopped needing a heading to say which is which. The deck takes what is left (`flex: 1 1 9rem`) and the two stack below that width, because a walkway you cannot walk is worse than a tall panel. The queue block sets the row height and the deck stretches to it, so they read as one object.
- **The queue is the pool, drawn.** Every slot the cap allows is on screen from the first visit, so the ceiling is something you can see instead of something the hint has to say — the same reason the salvage cabinet draws its locked slots. Six columns puts all eighteen in three rows in about 5.6 rem; at that size the *floor mark* under each place is what makes the empty ones countable, not the glyph.
- **The next person grows in front of you.** The fractional part of the pool is a figure clipped from the bottom (`clip-path: inset(…)`), beside a countdown to the next whole recruit. That fraction is the one number the old panel could not show at all, and it is what makes the queue worth looking at when it is empty.
- **The click target is a person, not a button.** A candidate steps out of the queue and paces the deck towards the airlock; clicking them signs them on. Reaching the far end without being clicked does nothing — they turn round and keep pacing, and every lap rolls a new designation.
- **They ask.** A speech bubble over their head — *Nimm mich!*, *Klick mich, Chef!*, *Sauerstoff dabei?* — eight lines rolled with the candidate, and clicking the words counts as clicking the person. It is the only thing that says *this one, click it* in the place you are already looking; the hint line says the same and nobody reads hint lines. It is also the only silly thing in the game, on purpose.

**The bubble is a sibling of the walker, not a child**, because its width has to be a share of the *deck* — up to 12.8 rem, wide enough that a line is a line — and inside the 3 rem figure a percentage would have meant nothing. That leaves it having to follow a walker it is four times wider than, without ever hanging over the edge of a deck that clips, at any tile width. Three things make that work:

- **Facing moved off the walker.** The walk's `scaleX(-1)` would have printed the shout backwards on the way home, so the flip lives on its own element with its own animation on the same 16 s clock.
- **The box is pinned at the turns, not clamped.** Left edge 0.2 rem in at the near end, right edge 0.2 rem in at the far one, and everything between is the browser interpolating. A centre-then-clamp correction depends on how wide the bubble ended up and is only right at one width; pinning is right at all of them.
- **The tail's offset inside the box interpolates too**, from 3.7 rem to `100% − 3.3 rem`. Since the walker's travel, the box and the tail all move linearly on the same keys, halfway through the lap the tail sits at `50% + 0.2 rem` of the box and the walker at `50% + 0.2 rem` of the deck — the same point. Simulated across deck widths from 9 to 22 rem: the tail is on the speaker's head to within **0.0000 rem** at every moment, and the box never crosses an edge.
- **A registry designation, rolled in the browser.** `V. Ferrix-408` — a sigil, a stem and a number, a quarter of a million of them, lost on reload exactly like a salvage cast. It says only *this is a specific person*, which is all the click needs and the same string in every language. An earlier build gave each candidate a **trade** (medic, pilot, hydroponics) and that was worse twice over: it promised a specialism the game does not have — a medic mans the mine like everybody else — and it needed a translated word to say something untrue.
- **Pace is the whole playability of it.** The first build crossed the deck in three seconds and was genuinely hard to hit, which turns a pastime into a test of aim. A lap is now **16 s** — about 34 px/s, roughly a step a second — and the candidate **stands still for 2.6 s of every lap** at the turns, so anyone who would rather wait than chase gets a stationary target twice a lap. The tap area is 3 rem. There is nothing to win by being quick here, so there must be nothing to lose by being slow.

**Why a moving target is safe here, and why it is not a second timing game.** The pool is already the ceiling: however fast or well anyone clicks, no more people come out of it than ≈ 12 a day. So skill can only ever save time, never earn more — the same argument that makes salvage fishing safe, arrived at from the other end. And there is deliberately **no window and no failure**: the timing toy belongs to the salvage beam, and a second one would wear both of them out. Missing costs nothing, because the only thing a miss can cost is a moment.

The airlock is **not clickable**. It is where the recruits go, and a second way to do the same thing would quietly turn the deck back into a button.

`prefers-reduced-motion` stops the walk and stands the candidate still on the deck, where they are clicked exactly as before.

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

## Salvage Fishing  *(designed 2026-08-18 · built 2026-08-19 · shop replaced by the smelter, same day)*

**The shop was cut before it was written.** Scrap does not buy finished goods from a menu; it feeds a **Salvage Smelter** that melts it back into raw material — see *Every refined good, on every planet* below. Everything in this section describes what the code does.

A small skill toy on its own tile, for the minutes you spend waiting on a build. Cast a salvage beam into the planet's debris field, a signal wobbles, lock on in time. The design rule it must never break: **a pastime must not become an obligation.**

### The unverifiable-skill problem, and the two caps

Timing happens in the browser. The server **cannot** check whether the click was on time — a faked response always hits. Everything else in the game is server-authoritative; this cannot be, by construction.

The answer is not anti-cheat, it is a ceiling: if the yield per unit of time is capped server-side, perfect cheating earns exactly what a perfect player earns. Two different ceilings do that, one per reward track:

| Track | Ceiling | Why it holds |
|---|---|---|
| **Bergungsschrott 🔩** (currency) | the **cargo hold** — a regenerating allowance, live from elapsed time, no cron | Hold empty → you still fish, the catch is thrown back. The toy stays available, the faucet closes. |
| **Fundstücke** (artefacts) | **each one is unique per player** | Once found, it leaves your table. There is nothing to farm, so it needs no rate limit at all. |

The second row is what lets finds bypass the hold: a repeatable bonus outside the cap would have reopened the hole the cap was there to close, but a one-time artefact cannot be farmed however hard the response is faked.

### Bergungsschrott is player-wide, not per planet

No entry in `RESOURCES`, no storage cap, no production — a single counter per player, the way `globalResearch` is global. Four planets sharing one purse is also what stops four planets being four incomes; the planet type changes only **what** bites (cryonite chunks on ice, obsidian shards on volcanic), never how much.

It therefore does **not** appear in the resource bar, which is per planet and stays that way. It shows on the salvage tile and in the profile panel.

### The loop

```
Cast → 4–12 s wait (rings) → BITE → contact closes in 1.8 s → click → result
```

Starting values, all of them tuning knobs:

- Hit window **±200 ms**, with a **±100 ms gold core** inside it; the tile's building widens both per level.
- **One bite per cast** *(2026-08-24, was three)* — the click ends the cast either way. Three bites made a miss cost nothing, and the mechanic needed its own bookkeeping to be legible at all: a pip row, a gap timer, an attempt counter. Casting again is free, which is the thing that was actually keeping the miss from hurting; the extra rounds only spent that leniency twice. The pips and `RING_GAP` went with them.
- A cast runs ~6–14 s → **~5 casts per minute**; a full hold is ≈ 5 minutes of play, which is about one tier-2 build.
- Cargo hold **120 🔩, +15/h**, player-wide. Same live-from-elapsed-time trick as `hs_recruit_pool`.

**Skill buys time, not access.** A good player fills the hold in ~20 casts, a weak one in ~40, and both end up with 120 🔩. That is the right way round for a pastime — missing must not hurt — and the reason finds exist at all: they are the one place where playing better pays more, because more casts per minute means more rolls on the artefact table.

**The judgement is arithmetic, the animation is CSS.** Timestamp at the bite, difference at the click. A dropped frame must never cost a catch.

#### Two zones, and a window you can actually see  *(2026-08-19)*

The first build drew a hairline target ring and printed *Jetzt!* for the whole approach. Both were wrong, and playtesting said so immediately: **±180 ms of travel is about five pixels**, so there was nothing to aim at, and a label that stands there for 1.8 s answers *what* but never *when*.

Three changes, all pulling the same way:

- **The target is the rule, drawn.** `targetStyle(halfWindow)` derives each circle's radius from `HIT_MS` / `PERFECT_MS`. What you aim at is exactly what the clock accepts, and widening a window widens its circle automatically — there is no second place to keep in sync. *(Originally `bandStyle()`, deriving radius **and** thickness from the shrinking ring's scale; re-derived from the contact's travel on 2026-08-24 when that ring went — see* One moving part *below.)*
- **The overshoot.** The moving part keeps going past the middle so that *too late* is something you watch happen rather than only feel. *(`OVERSHOOT_MS` 350 → 500 on 2026-08-24, when it also became the gap before the miss is announced — see* The beat between the window and the verdict *below.)*
- **Colour is information, not decoration.** The approach is cool grey; the button and both circles warm the instant the window opens, driven by the same `inWindow` flag as the label. The word and the light therefore cannot promise a window that has already shut.

**Precision now pays.** A hit anywhere in the band rolls `weight`; a hit in the gold core rolls `weightPerfect` — the same four catches, weighted 22/34/30/14 instead of 50/30/15/5. This is the one place in the feature where skill pays *more* rather than merely *faster*, and it is safe for the same reason everything else here is: the zone only picks a weight column, the hold still caps the day, so a client that claims `perfect` on every cast just reaches the same ceiling sooner. The endpoint treats anything that is not the literal string `'perfect'` as `'good'`, so a malformed report can only cost the player.

#### The dial: one object, everything else beside it  *(2026-08-24)*

The panel used to be five stacked blocks — intro, hold bar, circle, catch line, artefact card — of which exactly one was the game. Everything the cast produced sat *under* the circle, so on a phone the rare half (the artefact) landed below the fold while the ordinary half stayed in view. It is now two things side by side.

**Left: the dial.** `.hs-sal-dial` is a positioned box holding the button, the hold ring and every piece of confetti. Its size comes from `--hs-sal-circle` and its padding from `HOLD_GAP_REM`, both set inline from the script — the stylesheet no longer restates the button's diameter, which had been sitting in two places and was the obvious next thing to drift.

**The hold is the ring around the button**, not a bar above it: an SVG circle at `r=46` in a 0–100 viewBox, `stroke-dashoffset` driven by the same `holdPct` the bar used, rotated −90° so it fills from the top. It costs no vertical space, and it puts the one number that decides whether the next cast pays on the thing you are about to press. The exact figure stays in the text column, because a ring cannot give you `87 / 120`.

The button shrank to **8 rem** (`TARGET_R` to 1.4 with it, keeping `1.4 × 2.7 = 3.78 < 4.0`), so the dial including its ring is about what the bare button used to be.

**Right: everything written.** `.hs-sal-outcome` — intro, hold figure, catch line, artefact card — left-aligned, `flex: 1 1 11rem`, wrapping under the dial when the tile is too narrow for a line of text beside it.

#### Animation, and why a colour change was not enough

The old button changed colour and nothing else, which is why it read as a label rather than as a toy. Each animation answers a specific event, and none of them is load-bearing — the judgement is still arithmetic on timestamps, and `clearDeco()` drops all of it on unmount:

| Moment | What you see |
|---|---|
| Idle | `hs-sal-breathe` — a slow halo *behind* the button (`.hs-sal-dial--idle::after`, `z-index: -1`), so hover and press keep their own box-shadow. The invitation to press it. |
| Cast | An outward pulse (`.hs-sal-wave--cast`). The click has to leave the dial. |
| Waiting | A conic `.hs-sal-sweep` behind the two ripples — a beam turning in the debris field, for up to twelve seconds that would otherwise be a blank circle. |
| Bite | **A red contact closing on the centre** of a two-ring target — see below. |
| Landed | `hs-sal-pop`, gold pulse, then **scrap flies out of the dial** — `burst()` rolls angle, distance, spin and a stagger per particle, and the count follows the haul. |
| Dead centre | `hs-sal-pop-hard` — the same, harder, with a ring of light. |
| Miss | `hs-sal-shrug`. It shrugs; it does not punish. |
| Paid | `+N 🔩` rises off the dial and the purse in the header pops. Only when `gained > 0`, so a thrown-back catch still looks different from a paid one. |
| Artefact | The card fades in with a lilac flash — it appears on about one cast in seventy and is allowed to announce itself. |

Two rules hold this together. **Decoration never touches the four game timers**: `later()` / `clearDeco()` keep their own set, so nothing in the game can hang on a piece of confetti. And **the jolt fires on the click, not on the server's answer** — the hit was decided locally, so making the button wait for the network is what would make a good click feel unrewarded; only the scrap burst waits, because only the amount is the server's to say.

`prefers-reduced-motion` turns all of it off and keeps the contact, which is not an effect but the thing you aim at.

#### The contact  *(2026-08-24)*

The bite now reads as a radar scope. A **red blip** appears on the rim at a random bearing and closes on the centre; a faint crosshair marks where it is going; *Jetzt!* lights up as it arrives.

It is the same clock, not a second one:

- **Distance and duration come from the timing constants.** The blip leaves at `TARGET_R × RING_START` and is dead centre at `RING_MS`, the moment a click pays most. Linear, because an eased approach would make the last 200 ms — the only part that matters — unreadable.
- **It does not stop on the crosshair, it tears past it.** One straight pass from the rim to `BLIP_PAST_REM` on the far side, and because the speed is constant it crosses zero at `RING_MS` without any keyframe having to say so. The first build parked it dead centre until the miss fired 200 ms later, so arrival and failure looked simultaneous — *Entwischt* appeared while the dot was still sitting on the target, which reads as the game taking the catch away rather than as having been too slow.
- **Only the bearing is rolled**, once per bite in `startRing()`. A contact that also chose its own pace would be a second rule quietly contradicting the first; a contact that always came from the same side would teach the eye where to wait.
- **The picture is never asked what happened.** `strike()` still measures `Date.now()` against the bite timestamp. The blip is a reading of the clock, not the clock — which is why a dropped frame still cannot cost a catch.
- **The word lives in the lower third.** `.hs-sal-circle-label` is offset by `calc(var(--hs-sal-circle) * 0.26)` — derived from the button's size, so it stays put whatever `CIRCLE_REM` becomes. In *every* phase, not only during the bite: printed across the centre it covered the one thing it was telling you to look at, and moving only for the bite meant a label that had to be re-found each time it jumped.

#### One moving part  *(2026-08-24, later the same day)*

The white ring that shrank from the rim went with the next playtest, and the target had to be rebuilt around what was left.

**Why it went.** Ring and contact were two clocks for one instant, arriving together and saying the same thing. Once the blip was there, the ring was the redundant half: the dot is a *place* the eye can track, the ring was a *size* it had to judge.

**Why the target had to move with it.** The bands were drawn where the ring landed — `TARGET_R`, 1.4 rem out. The contact crosses that radius at **~1130 ms**, some 470 ms before the window opens. Left alone, the picture would have shown a gold ring being flown straight through at a moment that pays nothing: exactly the drift between rule and picture this whole design exists to prevent.

So the two circles are now derived from **the contact's own speed** — `BLIP_SPEED_REM_PER_MS × HIT_MS` and `× PERFECT_MS`, which puts them at 0.42 rem and 0.21 rem, dead centre:

| | radius | on screen |
|---|---|---|
| amber circle = `HIT_MS` | 0.42 rem | 13.4 px across — dot inside it, the click counts |
| gold core = `PERFECT_MS` | 0.21 rem | 6.7 px across — dot covering it, the better table |
| the blip itself | — | 7.2 px, sized against the core it lands on |

It is a small target, and it has to be: ±200 ms of the contact's travel *is* 0.42 rem, and drawing it any bigger would be a picture promising something the clock does not honour. The crosshair kept its hairlines and lost its circle — the target circles are the rings now, and a third one only muddled them.

#### The beat between the window and the verdict  *(2026-08-24)*

`OVERSHOOT_MS` went 350 → **500** and now does a second job: it is the delay between the hit window shutting and the miss being announced. Three moments where there used to be two, and each one is a different piece of information:

| ms | What happens | What the player sees |
|---|---|---|
| 1600–2000 | The window. `strike()` pays here, ±100 ms of `RING_MS` for the gold core. | *Jetzt!*, everything warm, the contact bright |
| 2000 | The window shuts (`lateTimer`). The catch is lost. | Everything goes cold at once, *Entwischt*, the contact starts fading |
| 2300 | `missed()` — the verdict (`ringTimer`, was `RING_MS + HIT_MS`) | The contact has finished leaving; the panel says so |

**The hit window is unchanged.** `HIT_MS` and `PERFECT_MS` are what they always were; only the moment the *announcement* lands moved, and the click that lands between 2000 and 2300 is a miss exactly as it was before — the difference is that it is now possible to make that click and watch why it failed.

**The clock is re-stamped on the first painted frame.** `ringStarted` was set in `startRing()`, but Vue renders on the next tick and the browser starts the CSS animations on the frame after that — so the judgement ran a frame or two ahead of the ring and the contact on screen, always in the same direction and always against the player. A `nextTick` + `requestAnimationFrame` re-stamp costs nothing, is guarded by `ringKey` so a stale frame cannot land on the next bite, and falls back to the old stamp if the frame never comes (a backgrounded tab). Without it, "dead centre" on screen was reliably a hair late in the arithmetic.

**A cast is client-only state and is lost on reload.** The server never hears about a cast until it is reported, so there is nothing to persist and no timer to resolve — unlike every other running thing in this game. Leaving the tile mid-cast simply drops it, which costs nothing, because a cast costs nothing.

### Catch table

| Catch | `weight` (band) | `weightPerfect` (core) | 🔩 |
|---|---|---|---|
| Debris shard | 50 | 22 | 3 |
| Hull fragment | 30 | 34 | 6 |
| Intact module | 15 | 30 | 12 |
| **Big haul** | 5 | 14 | 25 |

Ø 6.35 🔩 on the band, 9.8 🔩 in the core → 19 or 13 catches to fill the hold. Precision buys about a third off the time, and nothing else.

### Fundstücke  *(written 2026-08-19)*

Sixteen named artefacts, each findable **once per player**, rolled at ~1.5 % per catch and **not counted against the hold**. When the list is exhausted the roll stops. They are the collection layer under the currency, and the only skill-positive reward in the feature.

**A full hold still rolls for finds.** That is their whole purpose: once the scrap ceiling is reached the toy keeps a reason to be played, and that reason cannot be farmed. The catch is thrown back, the artefact is not.

**Sixteen and not twelve, because of the grid.** Four rows of four read as a board at any width; twelve was one long row on a desktop and three ragged ones on a phone. The cabinet is `repeat(4, minmax(0, 1fr))` capped at 13 rem, so the shape is the same on both and a slot stays a ~3 rem tap target.

#### The sixteen, and their four effects

| Effect | Artefacts | What it does |
|---|---|---|
| `hold` | 📡 Signalboje +10 · 🌀 Fangspule +15 · ⚓ Ankerwinde +20 · 🧰 Laderahmen +25 | Raises the cargo hold **permanently**, and credits the bonus as free room straight away |
| `scrap` | 🗃️ Schrottdepot +75 · 💰 Sold-Kassette +100 · 🚢 Wrack +150 | Straight into the purse, past the hold |
| `resources` | 🛢️ 500 Metall + 200 Kristall · ☢️ 3 Energiezellen · 🧪 2 Vitalgel · 🛠️ 2 Duraplatten · 🔥 1 Plasmakern + 1 Supraleiter | A one-off delivery to the planet that was fished, storage-capped like every other payout |
| `portrait` | 🎭 Leeremaske · 🪖 Pilotenhelm · 👑 Krone der Ersten Flotte · 🐙 Tiefenpilger | Appends an avatar to the profile picker |

**The hold ceiling stopped being a constant.** Four `hold` finds carry +70 between them, so `SALVAGE_HOLD_MAX` is now only the *base*: `salvage_hold_max($ownedFinds)` is what `salvage_state()`, `catch.php` and the `fill_salvage` cheat all ask instead. A complete cabinet ends at **190 🔩** — and at 15/h that is a ~12.7 h refill rather than the 8 h the base hold takes, so the documented "a full hold every 8 h" holds for a beginner, not for a collector. `SALVAGE_HOLD_PER_HOUR` is the knob if that turns out too generous; raising the ceiling was the deliberate choice, because the reward has to be felt.

**One `resources` artefact covers two goods** (🔥 Plasmakern + Supraleiter) so that all four refined goods appear somewhere in the cabinet. The other three each carry one.

**The bonus lands as free room, not merely as a higher ceiling.** A permanent +25 that only materialises over the next two hours of regeneration does not read as a reward at the moment it is found.

**No weights on the roll.** Uniform over what is not yet owned, because weighting would only change the *order* a collection is completed in — every entry is eventually taken and none of them repeats.

**Titles were dropped.** The sketch listed them alongside portraits, and nothing in the game shows one: there is no name plate, no profile line, no place a title would appear. Building that system for one reward is out of proportion, so the **lore line** carries the flavour instead — every artefact has two i18n strings, a name and a sentence, and the sentence is the whole reason to open the cabinet twice.

**Portraits are the one track the server does not pay out.** It records the find; `salvagePortraits` derives the avatars from the cabinet and `HsProfilePanel` appends them to its fixed twenty.

**…but the save was gated, and that was a bug** *(fixed 2026-08-24)*. `auth/profile.php` validates the portrait against a hard-coded list of the fixed twenty, written long before the cabinet existed. Picking an unlocked artefact avatar therefore looked like it worked — the picker closed, the panel flashed *gespeichert* — and reverted at the next reload, because the write had been refused the whole time. Two halves to the fix:

- **The server asks the cabinet.** `salvage_portraits()` in `profile.php` reads the owned finds and appends their `portrait` effects to the whitelist. It is only consulted when the pick is *not* one of the fixed twenty, so an ordinary portrait change still costs no query. The alternative — dropping the whitelist — was rejected: it is the only thing stopping an arbitrary string in the column that every other player's galaxy view renders.
- **A refused save no longer says saved.** `saveProfile()` always returned a boolean and `HsProfilePanel` always ignored it. It now flashes only on success and puts the previous portrait back on failure, which is what would have made this visible on day one.

The claim above is still true of the *payout*: no server-side grant, no column. What the server does own is which avatars a player may wear.

#### The cabinet

All sixteen slots are drawn from the very first cast, found or not. The locked ones are what make it a collection rather than a payout log, and the `4 / 16` counter is the only place the game says how many there are. A locked slot opens too and says only *Noch nicht geborgen* — naming an unfound artefact would give the collection away.

**What a find says it paid is the server's `grant`, not the catalogue.** The two are the same shape on purpose, so the toast and the cabinet share one `effectText()`; the difference is that a capped store can cut a delivery short, and the line under the toast should not promise what did not arrive.

**Recording comes before paying.** `INSERT IGNORE` first, then `salvage_apply_find()` — the hold bonus reads the cabinet back to work out the new ceiling, so the entry has to be in there for that number to include itself, and a race that inserts nothing (`rowCount() === 0`) pays nothing.

**The endpoint now takes a `planetId`**, which it did not before: a `resources` artefact has to land somewhere real. Ownership is checked, and a missing or foreign planet falls back to the **home planet** rather than dropping a once-per-player reward on the floor. Scrap and the hold ignore it — they are player-wide.

### What scrap is for

Nothing here is bought. The **Salvage Smelter** on the same tile turns scrap back into raw material, and that is its only sink — see the next chapter. A shop was designed and dropped: four fixed offers priced in scrap answered *what do I spend this on* but not *why can I not reach three of the four refined goods at all*, which was the real complaint underneath it.

### The tile — slot 12

`orbit` becomes `salvage`. Three things this touches:

- **The tile-type rename is frontend-only.** The spec claimed a two-file edit; it is not. `bootstrap.php` seeds `hs_planet_slots` by **index alone** and never stores a tile type, so `orbit` → `salvage` touched `hawkStarConfig.js` and the two i18n files and nothing else. The `unlocks` array *is* mirrored, and that is the real two-file edit.
- The tile is **`salvage` 🧲** — a salvage magnet reads as machinery rather than as angling, and no other tile uses that emoji.
- **Slot 12 is unlocked by no building today** (nor is slot 11); it needs a trigger. It gets **`command_center` Lv1**, alongside slots 2 and 4 — that build takes 20 s and costs nothing, so the toy is there from the first minute, which is exactly when a player has unlocked two tiles and nothing to do while they build. Consequence to watch: the shop is then also open at minute one. If that turns out to be too much, gate **shop entries** by progress rather than moving the tile — the toy should stay early even if its rewards do not.
- **The tile carries the `salvage_smelter`** — which is what makes it a real tile rather than a third panel tile, and why `HsSalvagePanel` renders *inside* the ordinary building panel (like `HsRecruitPanel` on the base tile) rather than replacing it: the tile needs its build rows and recipe section underneath the game. A rod-upgrade building that widens the hit window is still open.

#### Home planet only  *(2026-08-24)*

The beam is a fixture of the home base. On every other planet slot 12 is **locked** and reads 🔒 ***Nur Heimat*** — the reason goes in the tile's **label**, where the name would be, and the tile grows no unlock chip at all. `???` is the right label for a tile you have not reached yet: it is a question the game will answer. It is the wrong one for a tile that is simply somewhere else, which has no answer coming and exactly one thing worth saying — and a chip reading *build X to Lv1* underneath would promise something no amount of building will deliver.

- **`homeOnly: true` on the slot in `PLANET_GRID`**, and one predicate — `slotUsable(slot, planetId)` in `useHawkStar.js` — that everything walking a planet's slots asks. `unlocked` alone is read in four places (the grid, `selectSlot`, the empire board's *empty build slot* warning, `focusPlanetTile`), and a rule enforced in the picture only would have kept the tile out of sight while the empire board still nagged about the empty slot on it.
- **The stored state is left truthful.** The server's unlock flag is not rewritten; `playerSlots` closes the *view* of it, and `activeTileType` now returns nothing for a locked slot so a stale selection cannot render a game the planet does not have.
- **The endpoint stopped asking.** `salvage/catch.php` always fishes from the home planet and ignores the `planetId` it is sent — that argument only ever decided where an artefact's resource gift landed, and a foreign planet already fell back to home.

**The smelter goes with it, and that is a real change.** `salvage_smelter` sits on this tile, so scrap can now only be melted at home — the *every refined good on every planet* route in the chapter below is now *every refined good, at the home base*; colonies need a freighter. Smelters already built on a colony keep running server-side but have no tile to be seen on. If that is not wanted, the fix is to move `salvage_smelter` to a tile the colonies keep, not to unlock the beam again.

### Built differently from the sketch, on purpose

- **A miss never reaches the server.** The spec had every finished cast reported; the panel now reports only hits. The rate limit is on reports either way, a cheater would skip the misses regardless, and this halves the traffic for the honest player.
- **The endpoint returns the catch's icon and worth**, not just its key — otherwise the panel would need a mirror of `SALVAGE_CATCHES` and the two would drift. `worth` is what the catch was worth, `gained` what the hold had room for; the gap between them *is* the "thrown back" message.
- **`hold` is the room LEFT, not the load.** It starts at the cap, drains as you catch, and refills with time. The panel therefore labels it *Freier Laderaum* and its bar empties as you fish — calling a hold at 0 "full" would have been true physically and unreadable in a UI.
- **A new player starts with a full hold.** The tile opens with the very first build; an empty hold would have met a beginner with a toy that pays nothing.
- Note the pre-existing `ANOMALY_SALVAGE_POOL` / `'salvage' => n` keys in the anomaly config: unrelated, older, and they mean "roll n random high-tech goods". The new constants are all `SALVAGE_*` and do not collide, but the word is now overloaded in `config.php`.

### Backend sketch

```
hs_salvage       (player_id, scrap, hold, hold_updated_at)   -- player-wide, one row
hs_salvage_finds (player_id, find_id, found_at)              -- what is already taken
POST /game/salvage/catch  { planetId, hit }  → rolls the tier, checks the hold, grants 🔩 (+ maybe a find)
POST /game/salvage/buy    { itemId }         → charges and delivers
state.php: a salvage block { scrap, hold, holdMax, holdPerHour, finds }
```

`/catch` should refuse reports arriving faster than the shortest possible cast (a few seconds). It changes nothing about the ceilings — it only stops a script from emptying the artefact list in one burst.

**The cast itself needs no endpoint** — the server rolls only when the result is reported. A faker reports "hit" every time and collects the hold ceiling, which is what a perfect player collects; the find table cannot be farmed because its entries are unique. That is the accepted limit, and it is why both ceilings had to exist before the feature was worth building.

### What was considered and dropped

Recorded so the decisions are not reopened by accident:

| Idea | Why not |
|---|---|
| Reward = **resource nibbles** (metal/crystal shares like anomalies) | Feeds straight into the main economy, so every payout has to be balanced against mines and refineries. A separate currency makes the exchange rate one knob instead of many. |
| Reward = **temporary buffs** (−build time, +yield) | Serves the occasion perfectly, but then anyone who wants to play optimally *has* to fish. That is the one thing a pastime must never become. |
| Reward = **collection only**, no currency | Zero balance risk, but it carries the tile only if collecting alone motivates. It survives as the **second** track (Fundstücke) rather than the only one. |
| Limit = **bait pool** (casts capped, like `hs_recruit_pool`) | Consistent with an existing pattern, but it takes the toy away exactly when it is wanted. Capping the *catch* instead keeps casting free forever. |
| Limit = **cooldown per cast** | A waiting room inside a waiting room. |
| Home = **third panel tile** (the free cell in row 1) | Defensible — it is an activity, not a planet building — but a real tile can carry the Bergungsdrohne building later, and that is what ties the feature into the build economy. |
| Timing = **orbiting pointer on a dial** | Loops naturally and has two difficulty knobs, so it stays on the table for a later revision. The shrinking ring was less state and matched the original sketch; what it eventually became is the inbound contact, which is a pointer that travels in rather than around. |

### Not in v1

No rod levels (the salvage tile's building is the smelter, not a better rod), no catch log UI beyond the artefact list, no leaderboards.

### Nothing open

Everything in this chapter is built. What used to stand here:

1. ~~The Fundstück list~~ — **written 2026-08-19**: sixteen entries in `SALVAGE_FINDS`, four kinds of effect, names and lore in i18n. Titles were cut for want of anywhere to show one; see *Fundstücke* above.
2. ~~What the maintenance drone shortens~~ — **moot**: the shop was replaced by the smelter, so there is no maintenance drone.
3. ~~The `salvage` entry in `TILE_TYPES`~~ — **settled**: 🧲 *Bergung* / *Salvage*.
4. ~~A dev cheat that fills the hold~~ — **built**: 🔩 +500 in `HsSettingsPanel` (`fill_salvage`). Player-wide, so it takes no planetId; it tops the hold up and adds 500 scrap, because a refined-good recipe costs two full holds and testing that by waiting is not a plan. Its companion is ✨ **Fundstück** (`grant_find`), which hands out the next artefact in catalogue order and pays it exactly as a real catch would — at 1.5 % a roll there is no other way to see all sixteen cabinet entries, let alone check that their effects land.

### Suggested order

*(all five done 2026-08-19)*

1. ✅ **Config + tile.** `orbit` → `salvage` in `hawkStarConfig.js` *and* `api/star/config.php`, slot 12 added to `command_center` Lv1's `unlocks`. Nothing plays yet, but the tile is reachable and the two configs are in sync — the change most likely to be forgotten halfway.
2. ✅ **Backend.** Two tables, `/salvage/catch`, the salvage block in `state.php`. Testable with curl before any UI exists.
3. ✅ **Panel + timing.** `HsSalvagePanel.vue` — cast loop, ring, report. The part that is actually a game.
4. ✅ **Sink for the scrap** — built as the Salvage Smelter instead of a shop (2026-08-19). `/salvage/buy` was never written.
5. ✅ **The cabinet** — the sixteen Fundstücke, their effects and the collection UI in a 4×4 grid (2026-08-19).


---

## Every refined good, on every planet  *(2026-08-19)*

Before this, the planet type was a **hard gate** on three of the four refined goods. A one-planet commander on a frozen world could not make Duraplate, Plasma Cores or Vital Gel at all, except by luck from an anomaly or by colonising. That is the problem this solves — and the thing it deliberately does *not* do is make the planet type meaningless.

### The gate had two layers

| Type | Exclusive raw | Extractor | Refinery | Refined good |
|---|---|---|---|---|
| terrestrial | alloy 🧱 | `alloy_forge` | `alloy_refinery` | Duraplate 🔷 |
| volcanic | obsidian 🪨 | `obsidian_quarry` | `obsidian_foundry` | Plasma Core 🔥 |
| frozen | cryo ❄️ | `cryo_extractor` | `cryo_refinery` | Superconductor 🔌 |
| ocean | biomass 🌿 | `biomass_collector` | `bio_lab` | Vital Gel 🧬 |

`planetTypes` sat on **the building** *and* on **the raw resource**. Lifting only one changes nothing: an obsidian foundry on an ice world with no obsidian just stands there. `power_cell_lab` was already the precedent for a converter with no gate at all.

### What changed

1. **`planetTypes` came off the four refineries.** Four deleted lines, in `hawkStarConfig.js` and `config.php` both. Any planet can now build any refinery.
2. **A single-level `salvage_smelter` on slot 12** with two kinds of recipe:
   - **raw** — metal, crystal and **this planet's own** exclusive raw. Cheap, quick.
   - **refined** — all five finished goods, straight out of scrap. Costly, slow, and the actual answer for a commander who owns one planet.

The gate moves from *which planet you are on* to *what are you willing to pay*. Ungating the refineries is what makes an **imported** raw useful — ship obsidian in from a volcanic colony and refine it at home, far cheaper than melting scrap — while the smelter's refined recipes are the path that needs no colony at all.

### The recipes  *(retimed 2026-08-19)*

| # | Recipe | Time | Only on |
|---|---|---|---|
| 0 | 30 🔩 → 50 metal | **2 min** | |
| 1 | 40 🔩 → 30 crystal | **2 min** | |
| 2 | 60 🔩 → 20 alloy | 30 min | terrestrial |
| 3 | 60 🔩 → 20 obsidian | 30 min | volcanic |
| 4 | 60 🔩 → 20 cryo | 30 min | frozen |
| 5 | 60 🔩 → 20 biomass | 30 min | ocean |
| 6 | 140 🔩 → 1 Power Cell | **2 h** | |
| 7–10 | 250 🔩 → 1 Duraplate / Plasma Core / Superconductor / Vital Gel | **2 h each** | |

**The two ends were pulled apart on purpose.** Metal and crystal are the recipes a player runs while standing at the tile — they are bulk, they are cheap, and a 20-minute wait for 50 metal made the smelter feel like a chore rather than a use for the scrap just fished. Two minutes is short enough to run one, fish another cast, and collect.

The finished goods went the other way: **2 h each, Power Cells included**. They are the reason the smelter exists — the path to a refined good on a planet whose type does not offer it — and that path should cost a real part of a day, not an afternoon. Doubling the Power Cell's hour brought it in line with the other four rather than leaving it as the cheap way in.

**The exclusive raws stayed at 30 minutes.** They sit between the two: still a bulk material, but planet-restricted and the input to a refinery that is far cheaper than melting the finished good directly. Moving them would have blurred exactly the choice the chapter is about.

**Only the smelter was retimed.** The four refineries, the Deep Shaft, the Survey Array and the Power Cell Lab keep their 30 minutes — the smelter is the expensive alternative, and it is its own curve.

**`planetTypes` on a *recipe*** is new — the same idiom the buildings already use, one level down. It is what keeps the raw recipes to the planet's own exclusive material.

**Recipe order is load-bearing.** `recipe_index` is stored on running batches in `hs_conversion_queues`, so appending is safe and rearranging would make a batch in flight deliver a different recipe's goods. The panel filters *after* mapping the index for exactly that reason, and `convert.php` re-checks the restriction because the client is not the authority on it.

### Why it is deliberately poor

A native `alloy_forge` makes **60 alloy/h from level 1** and costs nothing but energy and staff. A whole salvage hold — 120 scrap, eight hours of regeneration — melts down to **40 alloy**, or a fifth of one refined good. Owning the right planet stays the good way; the smelter is the way that always exists — and since the retiming, the way that also takes two hours per unit.

**One level, like the refineries.** The recipes carry the cost curve; the building does not need one on top of it.

### Three things this broke, and how

- **A scrap-only recipe leaves the planet cost empty.** `convert.php` built its `UPDATE` from `array_keys($totalCost)`; with every smelter recipe paying in scrap alone, that is `SET` with nothing after it — a SQL syntax error, not a harmless no-op. The planet update is now guarded by `if ($totalCost)`.
- **Scrap is player-wide, conversion costs are per planet.** It has no column in `hs_planet_resources`, so it is split out of the cost before either the check or the deduction and settled against `hs_salvage` separately. On the client, `stockOf(res)` is the single place that knows the exception; `canAfford` and `maxConversionRuns` both go through it, and `convert.php` returns the fresh purse whenever a recipe spent from it.
- **The "made here" border in the resource bar had to change its source.** `producerTypes()` read a good's home off its building's `planetTypes` — which every refinery just lost, so all four goods began answering *buildable anywhere* and every card in the High-Tech row would have been bordered. It now derives the home from the raw a recipe **eats** (duraplate needs alloy, alloy is terrestrial) and skips scrap-fed recipes, since the smelter makes everything everywhere and counting it would mark everything again. The border means "this planet makes it the cheap way", and it resolves to exactly the same four goods it did before the ungating.
- **Recipe costs are coloured through `stockOf()`.** The affordability class compared against `playerResources` directly, which reads 0 for scrap — every smelter recipe would have shown as permanently unaffordable while its button worked fine. `stockOf` is exported from the composable for this; `HsResourceBar` needs the same exception for its scrap card.
- **Foreign raws had no storage cap, so they are no longer made.** `credit_resources()` leaves anything without a cap entry **unclamped**, and caps come from buildings' `storageCapacity` — all of them planet-type-gated. An earlier version had the smelter make all four exclusive raws and carry bins of its own for them; a frozen planet would otherwise have held *infinite* alloy while a terrestrial one stopped at 150. Restricting the raw recipes to the planet's **own** material removed the problem instead of papering over it: metal, crystal and the native raw all already have a cap here, so the smelter needs no storage of its own and the planet's existing maximum simply applies.

One more consequence, on the empire board: **scrap-fed converters are exempt from the *refinery idle* warning.** That rule assumes the input piles up by itself, so idling wastes production; scrap only arrives when the player goes fishing, and an idle smelter is the normal state. Warning about it would nag forever and teach the player to stop reading the warn tier.

### The scrap card in the resource bar

Salvage scrap closes the High-Tech stock row: 🔩 plus its count, in its own gold border rather than the border-when-local rule the other cards follow. It is the odd one out on purpose — **player-wide, not per planet**, so it does not change when you switch planets, and the hover hint says so. It sits last because it is what the smelter turns into every card to its left.

### Files

`salvage_smelter` + the four ungated refineries in `hawkStarConfig.js` and `api/star/config.php` · recipe-level `planetTypes` filter in `availableConversions` (`HsTilePanel.vue`) and its check in `convert.php` · `scrap` in `RESOURCES` (with `currency: true`) and in `EXCLUDED_IDS` in `HsAllResourcePanel.vue` · `stockOf()` + the scrap branch in `startConversion` in `useHawkStar.js` · the cost split in `api/star/game/convert.php` · `salvageScrap` card + `producerTypes()` in `HsResourceBar.vue` · `fill_salvage` in `api/star/dev/cheat.php` + its button in `HsSettingsPanel.vue` · `hawkStar.buildings.salvage_smelter.*`, `hawkStar.res.scrap` and `hawkStar.resourceBar.scrapHint` in de/en

---

### Files

`SALVAGE_HOLD_MAX` / `SALVAGE_HOLD_PER_HOUR` / `SALVAGE_MIN_CAST_SECONDS` / `SALVAGE_CATCHES` / `SALVAGE_FIND_CHANCE` / `SALVAGE_FINDS` (the sixteen) / `salvage_roll_catch()` / `salvage_hold_max()` in `api/star/config.php` · `ensure_salvage()`, `salvage_owned_finds()`, `salvage_state()`, `salvage_roll_find()`, `salvage_apply_find()` in `api/star/bootstrap.php` · `api/star/game/salvage/catch.php` · `fill_salvage` + `grant_find` in `api/star/dev/cheat.php` · tables `hs_salvage` + `hs_salvage_finds` · salvage block in `api/star/game/state.php` · `HsSalvagePanel.vue` (game **and** cabinet) · `salvage` in `TILE_TYPES`, slot 12 in `PLANET_GRID` and the `SALVAGE_FINDS` mirror in `hawkStarConfig.js` plus `planet_grid_slots` (`config.php`) · `salvageScrap` / `salvageHold` / `salvageHoldMax` / `salvageHoldEmpty` / `salvageFinds` / `salvageCabinet` / `salvagePortraits` / `reportSalvageCatch` in `useHawkStar.js` · the unlocked-portrait list in `HsProfilePanel.vue` **and** `salvage_portraits()` in `api/star/auth/profile.php` (the picker and the whitelist must agree, or the save silently reverts) · an `isSalvageTile` branch in `HsTilePanel.vue` · `homeOnly` on slot 12 in `PLANET_GRID` + `slotUsable()` / `isHomePlanet` in `useHawkStar.js` + the `lockedToHome` chip in `HsPlanetGrid.vue` · `hawkStar.salvage.*` (incl. `finds.*` and `effects.*`), `hawkStar.tile.homeOnly*` and `hawkStar.tiles.salvage.*` in de/en

---

## The orbit map  *(2026-08-25 — replaced the tile row)*

The solar view used to be a row of tiles with three action rows stacked under it, one per unit class, aligned column-wise so every planet had a drone cell, a colony cell and a cargo cell. It worked, and it read like a spreadsheet. What it never conveyed is that these are **planets in a system**, at different distances, which is the one thing the flight times are actually made of.

It is now a square **orbit map**: the star in the middle, one ring per planet, the planets slowly circling on them.

### Why the rings are honest

Distance in this game is `|index difference|` (see `droneFlightTimeBetween`) — a neighbour is one hop, the far end of the system is five. Ordering the rings by planet index is therefore not decoration: **the picture and the flight times agree**, and "that one is far" is now something you see before you read the timer.

### Geometry: percentages, not pixels

Everything is a percentage of a square `aspect-ratio: 1/1` box, so the whole system scales from a 360 px phone to a wide desktop with **no media query and no measurement**:

- `--r` (16 % → 41 % across the planets) positions and sizes both the ring and the orbiter: `left: calc(50% - var(--r))`, `width: calc(var(--r) * 2)`. The box is square, so one value serves left/top and width/height.
- The outer bound is 41 %, not 45 %: the marker's own radius, the shield bubble (`inset: -9px`) and the label under it all have to stay inside a box that clips.
- `--marker` is the single pixel-ish value, and it grows exactly once (1.85 rem → 2.3 rem at 640 px).

### The motion is pure CSS

An orbiter is a circle the size of its ring, rotating with `animation: hs-orbit var(--period) linear infinite`. The marker sits on its **top edge** and counter-rotates with the same duration, the same negative delay and `reverse` — so glyph, label and mission badge stay upright while the planet travels. No JavaScript ticks, no per-frame reactivity: 14 transform animations the compositor handles alone.

- **Outer planets are slower** (`90 + i·45` seconds) and no two share a period, so the constellation never repeats. The pace is deliberately slow — the inner ring takes a minute and a half per lap. A planet should drift while you read the list beside it, not pull your eye off it.
- **Phases are spread by the golden ratio** (`-(period · (i·0.618 mod 1))` as the delay), so the planets start scattered instead of lined up on one ray, and neighbouring rings drift apart instead of moving in lockstep.
- **Reduced motion pauses rather than disables.** A paused animation still honours its negative delay, so the planets keep their scattered positions — `animation: none` would collapse them all onto the top ray.
- Markers on neighbouring rings **do** cross each other. That is what a solar system looks like; `z-index` rises with the orbit index and the selected planet floats above everything, so the one you are looking at stays readable when it happens.

### The marker carries state, the list carries names and numbers

The tile used to print everything. A 30 px disc cannot, so each thing moved to the form that suits a disc:

| | On the marker | In the list |
|---|---|---|
| Identity | the type glyph + the roman numeral (`shortLabel` = last word of the name) | full name |
| State | border colour per `effectivePlanetState` | the coloured state label, and the row's border |
| Battery | a charge ring around the planet, red and pulsing on a blackout | `🔋 60 %` chip in the open row |
| Shield | the bubble around it, opacity = charge | `🛡️ 45 %` chip in the open row |
| Inbound mission | a badge above the marker: unit icon + countdown | the same pill on the row, so a closed row still shows it |

### The list, not a panel for one planet  *(2026-08-25)*

The first cut of this rebuild put a panel for the **selected** planet under the map. It answered "what is this one" but not "what is there" — and the map alone cannot answer the second question either, because a marker has no room for a name.

So the panel became a **list of every planet**, one row each, with the selected one unfolded — desktop to the right of the map, stacked below it under 768 px. One row is open at a time because the map has exactly one selection; `selectedPlanetId` drives both, so tapping a marker opens its row and tapping a row highlights its marker.

A tap on the map also **scrolls the row into view** (`block: 'nearest'`), since on a phone the list starts a whole map-height below the marker and opening a row off-screen would look like nothing happened. That uses one ref on the `<ul>` plus a `data-planet` attribute, not a function ref per row: the component re-renders every tick, and a per-row ref callback would churn once per planet per second for nothing.

### One op list instead of three rows

The three parallel unit rows collapsed into `targetOps` — every researched unit class contributes at most one row, and only inside the open planet's row. Everything still flies **from the active planet**; the rule is stated once, in the `Start: <planet>` line, instead of once per column.

### Arming a unit turns the list into a target picker  *(2026-08-25)*

`targetOps` answers *"what can I do about this planet"*, which is the wrong question when you already know what you want to send. Comparing two destinations meant opening two rows, and the flight time — the only number that decides it — was two clicks deep.

Picking a unit in the **hangar strip** now arms it. `armedUnit` (which also drives that unit's build accordion, so the two can never disagree) puts the list into dispatch mode: **every row the unit can reach grows a send button with its flight time**, collapsed rows included, so the whole system is one glance.

- **The bar sits outside `hs-plist__row`**, which is itself a `<button>` — a send button nested in it would be invalid HTML and unclickable.
- **The three classes are a table, not three branches.** `DISPATCH` maps each key to the composable functions that answer the same four questions (`target` / `ready` / `flight` / `send`), and `dispatchByPlanet` builds the whole row set once per tick rather than calling that table three times per planet per re-render.
- **A flight in progress needs no case.** Every `isXTarget` goes false while one is running — one flight per class at a time — so arming a unit mid-flight simply offers no targets, which is the truth. The countdown is already on the target's row as a mission pill.
- **`targetOps` steps aside while a unit is armed.** The bars say the same thing on every row; printing it again inside the open one would be the duplication the rebuild set out to remove.
- **Selecting a row does not move the active planet while armed.** It otherwise would: tapping a colony makes it active, which moves the hangar out from under the unit you were about to send — and that is the single most likely gesture in dispatch mode, since a cargo run targets your own planets. Anything that *does* move the active planet (the empire board, a *Zum Planeten* jump) disarms through the `activePlanetId` watch, because the armed unit is no longer standing where the buttons said it was.

### The hangar sits in the planet's own row  *(2026-08-25)*

The **hangar strip** first went under the map, on the argument that building happens at the active planet whatever you are looking at. In practice it read as a property of the *system* — a panel below the star chart, next to nothing it belonged to — and the eye had to travel from a planet's row on the right to a build button on the left to answer one question about one planet.

It now lives in the **open row of the active planet**, below that row's chips, where a row shows either what you can *send to* this planet (`targetOps`) or what you can *build at* it (the hangar) — never both, because `targetOps` is empty by construction for the active planet. A planet that is neither keeps the plain `📍 Aktueller Standort` line. The build accordions (`toggleBuildRow` / `expandedBuildRow`) come along unchanged and open underneath the strip.

Two things follow from the move: the head no longer repeats the planet name (the row already carries it), and the strip gained `flex-wrap` plus a `6rem` basis per button, because the list column is roughly a third of the width the map column had.

Its gate is the **hangar building, not the dock tile**. The dock (slot 10) unlocks with `space_building`, together with the spacebase tile and long before anything stands on either, so it never answered "can this planet build a drone". Every entry in the strip carries its own facility requirement instead — the drones need `drone_hangar`, the colony ship the `shipyard` — so an empty list hides the block by itself, and on a colony that is exactly "has a drone hangar", since the shipyard is `homeOnly`. The cargo op row asks the same question through `planetHasHangar(activePlanetId)`, so the two can no longer disagree.

### What was dropped

`hs-solar-planet-panel` — the big info block with the `HsAllResourcePanel` accordion — is gone, and so is the short-lived `hs-sp` panel that replaced it. The list says what both said, and the resource breakdown belongs to the planet view, one tap away.

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

### Everything that flies is built at home  *(2026-08-25)*

A colony is a **resource base, not a second shipyard**. Every unit carries `homeOnly: true` except the **cargo drone**, which is exactly the exception that makes a colony worth having: a colony that cannot ship its output home does nothing.

The consequence that gives the rule its teeth is not the build button, it is the **fleet logistics**. One home planet means one place where drones and ships accumulate, one place a recon sweep or a colonisation wave starts from, and a real reason to keep hauling goods inward — instead of four self-sufficient planets that each quietly run their own little navy.

**Where the rule lives:**

| | |
|---|---|
| Data | `homeOnly` on the unit in `UNIT_COSTS` — `hawkStarConfig.js` **and** `config.php` |
| Server | `unit/build.php` reads `po.is_home` in the ownership query and refuses a `homeOnly` unit off the home planet. This is the authority; everything below is presentation. |
| Client | `reconDroneLevel` / `colonyShipLevel` / `spyDroneLevel` return **0 off the home planet**. They read as *"what can this planet produce"*, not *"what is built here"* — one gate reaches the build UI, the send buttons and the mission targeting at once. `canBuildCorvette` states it directly, since the fleet has no level computed of its own. |

- **The colony's hangar still exists**, and should: the cargo drone needs it. Only what it *produces* is narrowed.
- **The shipyard does not.** Every ship it builds is `homeOnly`, so the building carries the flag too and is **filtered out of a colony's Space Base tile** rather than shown as locked — there is nothing a colony could ever unlock there. `buildingsForActiveSlot` drops it client-side, `build.php` refuses it server-side.
- **The dock panel drops the rows instead of locking them** (`v-if="isHomePlanet"`), and says why once: *"Drohnen und Schiffe werden nur am Heimatplaneten gebaut"* (`hawkStar.dock.colonyCargoOnly`). A colony dock with one row and no explanation reads as broken.
- **Sending follows building.** Because the capability computeds are the gate, a colony offers no recon or colonisation launches either — those flights start at home. A unit parked at a colony from before this change has no send button; there is no migration for it.

### Colony ship crew & the new colony

A colony ship only leaves with settlers aboard: building it requires **6 free workers** (`UNIT_COSTS.colony_ship.crew`, `freeWorkers = population − Σ staffDrain`) and takes them off the planet's population right at build time — server-side check in `unit/build.php` via `free_workers()`.

On landing, the new colony is deliberately small: `init_planet()` gives it **6 population** (`COLONY_START_POP`) and an **empty recruit pool**. The rest of the crew is not simply handed over — the colony has to grow through normal recruitment (≈ 12/day, cap 18).

### Facilities vs. units

Units are produced by a **facility** on the Space Base tile, and one facility serves a whole class of units:

| Facility | Builds | Key | Where |
|----------|--------|-----|-------|
| 🛸 Drone Hangar | every drone type (`recon_drone`, `cargo_drone`, `spy_drone`, `spy_satellite`) | `drone_hangar` | any planet — but only the **cargo drone** off the home planet |
| 🚀 Shipyard | every starship type (`colony_ship`, `corvette`) | `shipyard` | home planet only — `homeOnly`, not shown elsewhere |

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

**Solar System view** *(rebuilt on the orbit map, 2026-08-25)* — the cargo drone is one of the three units in the **hangar strip** under the map (accent **amber** `#fbbf24` next to drone amber and colony blue) and one of the rows in the **selected planet's op list**. The hangar button shows `n / 4` once a drone is docked and opens the **cargo picker** instead of a build row; the picker is unchanged (all five goods with stock, a `−`/`+` stepper, an `n / 4` counter and *Unload all*) and still expands through `toggleBuildRow` / `expandedBuildRow`, key `'cargo'`. The send button appears in the open planet row's op list only, disabled until the hold is non-empty and only for planets passing the scanned-or-owned check. Visibility follows the drone: facility built + the **active** planet has a dock.

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
- **What it reveals:** the planet's type and who owns it — or that it is genuinely empty; the satellite adds the shield. **Buildings, resources and fleets are never reported** — that is the whole of espionage, and the gap is deliberate: see the raid section on why a half-blind report keeps every attack a risk.

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
- **Two onboarding steps** close the checklist (`HsOnboardingPanel`): *step10* first surveyed foreign planet (`spiedPlanets.length > 0`) and *step11* first satellite placed. The second reads `satelliteDeployments` — a server-side count of satellites **ever** placed, not of live ones, because a satellite that is lost must never un-tick a step that was achieved. Same pattern as `cargoDeliveries`. It is also counted locally on arrival so the tick ticks it, not the next state sync.
- Dev cheat **🕵️ Spionage** lands every espionage flight instantly.

### Files

`spy_drone` / `spy_satellite` in `UNIT_COSTS` + `SPY_*` / `INTERCEPT_COST` / `orbital_defense` in `api/star/config.php` · `migrate_spy_missions`, `ensure_spy_intel_table`, `record_spy_intel`, `spy_intel_map`, `planet_shield_charge`, `spy_shield_report`, `orbital_defense_level`, `foreign_satellites`, `destroy_spy_satellite`, `lost_satellites`, `system_distance`, `spy_flight_seconds` in `bootstrap.php` · `api/star/game/mission/spy.php` · `api/star/game/defense/intercept.php` · `spy_on_me` in `api/star/dev/cheat.php` · table `hs_spy_intel` · report filter in `api/star/galaxy/index.php` · `foreignSatellites` / `satellitesLost` in `game/state.php` · `spy*` / `planetIntel` / `isIntelStale` / `interceptSatellite` in `useHawkStar.js` + `mapGalaxy`/`reloadGalaxy` · `HsGalaxyMap.vue` planet list (`typeIcon`, `shieldReport`, `shieldLabel`, `shieldTitle`) · `HsOrbitDefensePanel.vue` · `HsDockPanel.vue`

---

## Combat — The Raid  *(implemented 2026-08-16)*

Phase 5, and what stands in place of a market: **the game has no player trade and will not get one**. Without a market, plunder is the only reason to fly to another player's planet, which is exactly the intent — the cargo drone moves goods between *your own* planets, a raid moves them between *players*.

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
- **Berths count hulls in the dock, hulls in the running batch *and* hulls in the air** (`fleet_size()`), so an order can never be placed past the cap by ordering twice. The server clamps the requested count to the free berths and returns the number it actually built — the client trusts that number over its own.

  **A fleet on a sortie keeps its berths reserved** *(2026-08-17)*. `mission/raid.php` takes the hulls out of `hs_units` at launch, so until this was fixed a raid emptied the dock and freed its berths: launch four, immediately order four replacements, and the survivors came home to a fleet over the cap. `fleet_away()` sums the `ships` of this planet's `in_flight` raid rows — the **outbound** leg carries what launched, the **return** leg what survived, so the reservation shrinks to the real number the moment the battle resolves, and a fleet wiped out over the target releases its berths entirely. An incoming enemy raid reserves nothing, since the rows are keyed by `player_id`. The frontend mirrors it in `fleetAway`, and the dock's berth line prints `(2 unterwegs)` — otherwise the count looks broken: the hulls are visibly gone from the dock but the number does not move.
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

### Launch, flight, resolution  *(implemented 2026-08-16)*

`POST /game/mission/raid { fromPlanetId, toPlanetId, ships, order }`. The gates, in the order the endpoint checks them: the launching planet is yours, the target belongs to **somebody else**, that somebody is **past beginner protection** (`RAID_NEWBIE_PROTECTION_DAYS`, 3 days), the planet has been **surveyed** (inside your own home system ownership is public, so no flight is needed there), **no other fleet from this planet is out**, corvettes are in the dock, and there is **one power cell per hull** as sortie fuel. Hulls and fuel are taken at launch.

The flight is `hs_missions` with `type='raid'` and `leg='out'`, three new columns alongside: `ships`, `raid_order`, `loot`. `RAID_FLIGHT_MIN` is 3 h (a same-system strike) plus distance at `RAID_FLIGHT_PER_DIST`. The return leg is a second row with `leg='back'` carrying the survivors and the haul, exactly as the cargo drone does it.

Four things in the resolution are worth remembering:

- **The battle is fought against the meters as they were at ARRIVAL, not at resolve time.** `meter_charge_at()` rewinds the shield and battery to the mission's `ends_at`. Without it the game had a free exploit: launch, then stay logged out until the target's shield has drained itself to nothing (1.25 %/h) and let the delay win the fight. If the defender charged *after* the fleet arrived there is nothing to rewind and the stored value is used as it stands — that favours the defender, which is the safe direction to be wrong in. The report is stamped with the arrival too, so the raid history does not read as though the fleet turned up whenever the attacker next opened the game.
- **`resolve_missions()` has a re-entrancy guard, and the raid is why.** Resolving an attack calls `resolve_timers()` for the *defender* so their meters are current, and the defender may have a raid of their own in flight against the attacker. Two players raiding each other would otherwise resolve each other forever.
- **The orbital battery fires itself**, once as the fleet arrives and a second time while a plundering fleet loads, one power cell per kill out of the defender's own stock, `RAID_INTERCEPT_SHOTS` per volley. It produces a genuinely good emergent case: a defender who spends their power cells shooting has none left in the silo for the raider to steal.
- **A fleet wiped out over the target starts no return leg** — there is nothing left to fly it.
- **A repelled raid loses no hulls of its own accord.** Attrition scaled to the surviving defence was proposed and **rejected** (2026-08-16): losses stay a question of what the defender *built*, not of how the battle ended. The known consequence is accepted — a small squadron can fly repeatedly to grind a shield down for the price of one power cell per hull, and softening over two waves stays cheap.

The client cannot resolve an arrival itself, because the battle reads another player's state. The tick therefore only clears the countdown and calls `refreshPlanetState()`; the server answers with the outcome.

### Reports and the raid history

`hs_battle_reports` is read by both sides. `seen_by_attacker` / `seen_by_defender` are outboxes in the spirit of `satellite_lost_at`: `unseen_battle_reports()` hands each side its news exactly once and clears the flag in the same call, so there is still no notification table in this codebase. Four notification texts, because the same battle reads differently from each chair: raid won / raid repelled / knocked out by X / attack from X repelled.

`raid_history()` is a `GROUP BY` over the same table and needs no storage of its own. It rides along on every state load and returns, keyed by the *other* player's id, the full record between the two of you:

- `count` / `lastAt` — **their** raids on you, the red `⚔️ 3 · vor 2 h` badge in the galaxy card's owner list
- `outCount` / `outLastAt` — **your** raids on them, the amber `🎯 2 · vor 5 h` badge next to it
- `log` — the last `RAID_LOG_ENTRIES` (5) battles **from either direction**, newest first

The two directions are counted apart because they read as opposite news, but the log interleaves them: a feud is one story and reads best in one column, with a role icon (🎯 we flew, 🛡️ they flew) saying which way each battle went. It is symmetric by construction — a battle names both sides, so the attacker's log entry is the same row as the defender's, only read from the other seat.

The card merges the logs of *all* commanders living in the selected system into one chronology (`systemBattles`, capped at `BATTLE_LOG_MAX` = 5, deduplicated by report id because two colonies can belong to the same player). The entries are deliberately **not** filtered to this system's planets: a raid they flew hit one of our colonies somewhere else, and dropping those would leave the list showing only half of every feud.

Counts come from an exact aggregate; only the detail list is capped, at `RAID_LOG_SCAN` (200) rows scanned, which covers five per opponent many times over. Note that `won` in a report always means *the attacker* won, so from the defender's chair `won: true` is the loss — `logOutcome()` in `HsGalaxyMap` is the one place that translation happens.

### UI

The **⚔️ button** sits at the end of a planet row in the system card, next to the espionage buttons but red, and only appears on a foreign colony you have surveyed while a fleet is parked in the active planet's dock. It opens the **attack order** inline under the planet list: ship count against what is in the dock, the firepower that buys (`n × 20`) with its fuel cost, and the two orders as a pair of cards — ⚡ *Ausschalten* and 💰 *Plündern*, the second spelling out that the fleet has to load in orbit and takes another volley for it. Both legs then show up in the dock's mission list with the order in the label, so an in-flight fleet says what it is going to do.

The **two badges** at the end of an owner row are the running count only. The single battles live in **Letzte Gefechte** at the foot of the card, always open and never folded away: it is the one part of the card that is history rather than a control, and it belongs at the bottom for exactly that reason. Each entry is a three-line block, bordered on the left in amber for our sorties and red for theirs:

1. role icon · target planet · opponent · outcome (*erobert / abgewehrt / ausgeschaltet / gehalten*) · how long ago — the outcome turns green whenever the fight went our way, whichever chair we sat in, and the opponent is named on every line because a system can hold several commanders
2. `🚀 4 −1` hulls launched and shot down · `💥 60` firepower · `🛡️ 40 → 0 %` · `🔋 15 → 0 %`, the meters as before/after rather than a delta, so the drop is visible; a target with neither generator nor reactor says *ohne Schild und Batterie* instead of printing zeros
3. the haul, on plunder orders only — green when we carried it off, red when we lost it, and an explicit *keine Beute* when a plunder came home empty because the silo was bare or on cooldown

Dev cheat **⚔️ Überfall** (`complete_raid_missions`) runs both legs — the battle and the way home — since waiting out two three-hour flights is not a test.

### Files  *(raid)*

`RAID_*` in `api/star/config.php` · `migrate_raid_missions`, `ensure_battle_reports_table`, `raid_flight_seconds`, `planet_plunder_locked`, `player_is_protected`, `orbital_volley`, `set_meter_charge`, `meter_charge_at`, `resolve_raid_battle`, the `raid` branch in `resolve_missions_inner`, `unseen_battle_reports`, `raid_history` in `bootstrap.php` · `api/star/game/mission/raid.php` · `hs_battle_reports` + `hs_missions.ships/raid_order/loot` in the schema · `complete_raid_missions` in `dev/cheat.php` · `battleReports` / `raidHistory` in `game/state.php` · `RAID` in `hawkStarConfig.js` · `battleReports` / `raidHistory` / `raidsAgainstMe` / `raidsByMe` / `raidLog` / `startRaid` / `isRaidTarget` / `raidFlightTime` / `activeRaids` in `useHawkStar.js` · raid dialog + `⚔️`/`🎯` badges + raid log in `HsGalaxyMap.vue` · raid rows in `HsDockPanel.vue` · `hawkStar.galaxy.raid*` / `notifications.raid*` in de/en

### Files  *(production step)*

`corvette` + `UNIT_BATCH_KEYS` + `FLEET_PER_WEAPONS_LEVEL` + `weapons_building` Lv2/Lv3 in `api/star/config.php` · `build_count` column, `weapons_building_level`, `fleet_cap`, `fleet_size`, `fleet_away` in `bootstrap.php` (`ensure_units_table`, `resolve_units`, `units_state`) · batch + berth check in `api/star/game/unit/build.php` · `hs_units.build_count` in the schema · `FLEET_PER_WEAPONS_LEVEL` + `corvette` in `hawkStarConfig.js` · `corvette*` / `fleet*` / `maxCorvetteBatch` / `buildCorvette` in `useHawkStar.js` · `HsDockPanel.vue` fleet row · `HsPlanetGrid.vue` dock chips · `HsNotificationPanel.vue` ship builds · `hawkStar.dock.*` / `notifications.corvette*` in de/en

### Out of scope for v1

Damage to **buildings** (explicitly excluded), planet **conquest**, **fleet-versus-fleet** battles in open space, ship repair/damage states, and player **trade** — none of these are postponed, they are not coming.

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
| `HsNavBar` | View switching (Empire / Planet / Solar System / Galaxy Map) + gate checks. **Empire is the first tab**, never gated, and carries the alert badge; the planet tab doubles as `HsPlanetHeader` (planet name + type). |
| `HsEmpirePanel` | Empire board — one status card per own planet (verdict, meters with runtime, alarm/news/warn/running rows). Every row jumps to the planet + tile it is about. |
| `HsResourceBar` | Compact resource bar shown at top of all views. Two rows: the raw resources (icon, name, amount, rate) and below them a High-Tech stock row (`hs-res-card--mini`) showing only icon + count for `power_cell` and the four refined resources. Both rows are per active planet. |
| `HsPlanetGrid` | 5×3 unified tile grid — 2 panel tiles (row 1) + 12 planet building slots (rows 2–5). Manages single active-tile state across all 15 cells. |
| `HsTilePanel` | Right-column panel — renders different content based on `activePanel` prop: `'resources'` → `HsAllResourcePanel`, `'notifications'` → `HsProfilePanel` + `HsNotificationPanel` + `HsSettingsPanel`, `'dock'` → `HsDockPanel`, `null` → building detail for the active planet slot |
| `HsOnboardingPanel` | Early-game checklist — the last card in the empire board’s grid, and the only place it appears. Renders nothing once every step is ticked. |
| `HsSalvagePanel` | Salvage fishing on slot 12 — cast loop, radar contact closing on a two-ring target, scrap balance, hold ring around the button, artefact cabinet. See *Salvage Fishing*. |
| `HsRecruitPanel` | The muster deck on the base tile — the recruit pool drawn as a queue, a named candidate pacing towards the airlock, click them to sign them on. See *The muster deck*. |
| `HsDockPanel` | Space Base panel — build & manage ships (recon drones, colony ships) + active missions |
| `HsSolarSystem` | Home system view — the **orbit map** and the active planet's hangar on the left, the **planet list** on the right (stacked below 768 px). See *The orbit map*. Tapping a planet on either side selects it (`hs-pl--selected` / `hs-plist__item--open`) and opens its row; if it is one of your own, it also becomes the **active planet** — the state is fetched first when it was never loaded, since `setActivePlanet()` ignores unknown planets. The **home planet** gets the brighter ring plus a 🏠 corner badge (`hs-pl--home`) — blue alone only says "mine", and every colony is blue too. |
| `HsGalaxyMap` | Galaxy view — all star systems, planet detail card |
| `HsPlanetHeader` | Planet name + type tile — lives inside `HsNavBar` as the first nav item |
| `HsAllResourcePanel` | Full resource breakdown (all non-utility resources with amount, rate, cap). Shown in right panel when Planet Info tile is active. |
| `HsProfilePanel` | Commander profile editor — portrait picker (twenty fixed emoji plus any unlocked by salvage artefacts), editable name (max 12 chars), disposition selector (friendly / neutral / hostile). Shown at the top of the Activity panel. |
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
| `hawkStar.salvage.*` | HsSalvagePanel — cast/bite/catch copy, catch names, hold labels |
| `hawkStar.recruit.*` | HsRecruitPanel — queue and deck copy, the next-recruit countdown. Candidate designations are rolled, not translated. |
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

Phases 1 + 2 fully implemented and live (since 2026-06-01). Everything built since:

| Feature | Status |
|---------|--------|
| Empire overview — status board + planet switcher, landing view after a break | ✅ Implemented |
| Phase 5 — Raid: launch, battle, plunder, reports, raid history | ✅ Implemented |
| Phase 5 — Corvette + shipyard batch + fleet cap (`weapons_building` Lv1–3) | ✅ Implemented |
| Phase 4 — Espionage — spy drone (report that ages) + spy satellite (live) | ✅ Implemented |
| Phase 4 — Defense tile detects and destroys foreign satellites | ✅ Implemented |
| Power battery (power_plant, click-to-charge, blackout when empty) | ✅ Implemented |
| Population recruitment (+1 click, pool with cap, quarters removed) | ✅ Implemented |
| Cargo drone (one per planet, 4 items, one-way delivery + empty return) | ✅ Implemented |
| Slot 7 — anomaly tile (timed events, two guaranteed outcomes each) | ✅ Implemented |
| Med Station + Plasma Compressor (first consumers for Vital Gel / Plasma Core) | ✅ Implemented |
| Deep Shaft Frame + Survey Array (recurring sinks for Duraplate / Superconductor) | ✅ Implemented |
| Slot 12 — Salvage Fishing (timing game, cargo hold as the ceiling, 16 Fundstücke) | ✅ Implemented |
| Salvage Smelter + ungated refineries — every refined good reachable on every planet | ✅ Implemented |

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
