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
| `spacebase` | Launch pad for drones and colony ships |
| `agriculture` | Reserved — no buildings yet (planned for later) |
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

| Planet Type | High-Tech Building | Produces | Input |
|-------------|-------------------|----------|-------|
| Terrestrial | `alloy_refinery` | `super_alloy` | Metal + Alloy |
| Volcanic | `obsidian_foundry` | `quantum_shard` | Crystal + Obsidian |
| Frozen | `cryo_refinery` | `pure_crystal` | Crystal + Cryonite |
| Ocean | `bio_lab` | `nano_alloy` | Metal + Biomass |


---

## Planet Types

The planet type is assigned on colonization and restricts or enables certain buildings.

| Type | Icon | Traits |
|------|------|--------|
| **Terrestrial** | 🌍 | Balanced — all standard buildings, no restrictions · `alloy_refinery` (High-Tech) |
| **Volcanic** | 🌋 | Metal-rich — `geothermal_tap`; limited agriculture · `obsidian_foundry` (High-Tech) |
| **Frozen** | 🧊 | Crystal-rich — `cryo_extractor`, `cryo_reactor` · `cryo_refinery` (High-Tech) |
| **Ocean** | 🌊 | Population paradise — `tidal_generator`; weak mining · `bio_lab` (High-Tech) |
| **Uninhabitable** | 🌑 | Hostile or barren — colonization not possible, shown as locked in the solar system |

---

## Units

Units are built at the Space Base tile and consumed on missions. Each unit type has exactly **one level** — no upgrades. Only **one active mission** per unit type at a time.

| Unit | Build cost | Purpose |
|------|-----------|---------|
| **Recon Drone** | 60 Metal · 25 Crystal | Reveals planet details within the home system |
| **Colony Ship** | 300 Metal · 150 Crystal | Colonizes a scanned uncolonized planet |

The `recon_drone` and `colony_ship` entries in `BUILDINGS` gate availability (the building must be constructed before units can be built). `UNIT_COSTS` holds the per-unit resource cost and `buildTimeBase`.

---

## Game Loop

A rough progression arc for a single player:

1. **Colony Phase** — Build up the home planet: unlock slots, raise Metal/Crystal income, balance Energy.
2. **Expansion** — Research the Star Map in the Comm Center (global, unlocks on all planets), scan nearby systems with Recon Drones, send Colony Ships to claim new planets.
3. **Specialization** — Each planet type produces a unique refined resource. Build a spread of planet types to cover all four refined resources (`super_alloy`, `quantum_shard`, `pure_crystal`, `nano_alloy`).
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

### Frontend (current, pre-migration)

Until the frontend migrates to the backend API, `generateGalaxy()` in `hawkStarGalaxyMock.js` still provides the local mock galaxy for the frontend:
- Returns **9 systems**: 2 fixed NPC systems (Kepler/Asha, Vorn/Krath) + 7 random empty systems
- Stored in the save and restored on reload
- Will be replaced by `GET /api/star/galaxy` once frontend migration is complete

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

- Which planets are owned and by whom (NPC name or future: player name)
- How many planets that faction controls in this system
- The faction's portrait/icon placeholder (for NPCs: defined in `hawkStarGalaxyMock.js`)

Example: Kepler system scanned → shows "Asha · 2 planets".

NPCs in `hawkStarGalaxyMock.js` get a `portrait` field (emoji or icon id) for display.

---

### Step 3 — Emoji Messages

Once a system is `scanned`, the player can **send an emoji** to its inhabitants.

**How it works:**

- The Comm Log panel (right side of the Galaxy Map card) shows a **"📡 Nachricht senden ▾"** button at the bottom.
- Clicking opens an emoji picker. Clicking an emoji **sends immediately** — no separate send button.
- The emoji travels (same signal time as the scan — distance-based).
- On arrival, the NPC picks an auto-response emoji from a predefined pool based on their `disposition`.
- Both the sent emoji and the NPC response appear as chat bubbles in the **Comm Log**.

**Sendable emoji pool (`COMM_EMOJIS` in `hawkStarConfig.js`):**

`👋 🤝 🌟 ✌️ 😊 🕊️ 🌿 💫 🌈 💎 💰 📦 🔭 📡 🛸 ⚠️ 💥 🔥`

**NPC auto-response pool — displayed as emojis, keyed by `disposition`:**

| Disposition | Response keys | Displayed emoji |
|-------------|--------------|-----------------|
| `friendly` | `npc_welcome`, `npc_glad`, `npc_peace_back` | 👋, 😊, 🕊️ |
| `neutral` | `npc_acknowledged`, `npc_received`, `npc_noted` | ✅, 📨, 📝 |
| `hostile` | `npc_stay_away`, `npc_not_interested`, `npc_channel_closed` | ✋, 🚫, 🔒 |

The emoji mapping lives in `HsCommLog.vue` (`NPC_EMOJI` constant). No free text, no game-state change from messaging (that comes later).

---

### Data Model

**`systemContacts`** — stored in `useHawkStar.js`, persisted in save:

```js
systemContacts: {
  [systemId]: {
    scanState:  'unscanned' | 'scanning' | 'scanned',
    scanEndsAt: null | timestamp,
  }
}
```

**`commLog`** — list of sent/received messages, stored in `useHawkStar.js`:

```js
commLog: [
  {
    id:          'msg_1234',
    direction:   'sent' | 'received',
    systemId:    'kepler',
    systemName:  'Kepler',
    factions:    [{ name: 'Asha', portrait: '🌺', disposition: 'friendly' }],
    messageKey:  '👋',             // emoji string (sent) or NPC key e.g. 'npc_welcome' (received)
    timestamp:   1234567890,
    travelEndsAt: null | timestamp, // null once delivered
    replyEndsAt:  null,
  }
]
```

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
│  System Card           │  Comm Log          │
│  · system name/meta    │  · chat bubbles    │
│  · faction list        │  · send bar        │
│  · planet list         │                    │
└────────────────────────┴────────────────────┘
```

- Side-by-side on desktop (≥640 px), stacked on mobile.
- The home system is **pre-selected** when entering the Galaxy Map.
- Clicking a system tile toggles its selection; clicking the selected tile deselects it.
- The card + Comm Log only appear for home or fully `scanned` systems.

**Tile states:**
- `unscanned`: star icon + system name — no inhabitants shown.
- `scanning`: pulsing amber 📶 + countdown.
- `scanned` (inhabited): faction portrait + name.
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
- Received messages: left-aligned, teal bubble, with faction avatar and faction name above the bubble row.
- Messages in transit are shown at reduced opacity with a small countdown timer.
- Auto-scrolls to the bottom on new messages.

**Send bar** (visible when `canMessageSystem(systemId)` is true):
- A single `📡 Nachricht senden ▾` button opens the emoji picker.
- Clicking an emoji sends immediately — no separate send button.
- Picker shows `COMM_EMOJIS` at `1.5rem` icon size.

---

### Files Changed

| File | Change | Status |
|------|--------|--------|
| `hawkStarConfig.js` | Added `interstellar_comm` building (global, `comm_center`, 2 levels) + `COMM_MESSAGES`, `NPC_RESPONSES`, `SIGNAL_SPEED_BASE` exports | ✅ Done |
| `hawkStarGalaxyMock.js` | Added `factions` array with `disposition` + `portrait` to Kepler system | ✅ Done |
| `useHawkStar.js` | Added `systemContacts`, `commLog`, `interstellarCommLevel`, `scanSystem()`, `sendMessage()`, `canScanSystem()`, `canMessageSystem()`, `signalTravelTime()`, `_deliverMessage()`, signal tick loop | ✅ Done |
| `HsGalaxyMap.vue` | Scan button, scanning indicator (pulsing badge), scanned faction display, message dropdown + Comm Log section | ✅ Done |
| `en.json` / `de.json` | Added keys under `hawkStar.comm.*` and `hawkStar.buildings.interstellar_comm` | ✅ Done |

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
| `utils/hawkStarConfig.js` | Static game data: `PLANET_TYPES`, `BUILDINGS`, `RESOURCES`, `UNIT_COSTS` |
| `utils/hawkStarGalaxyMock.js` | Galaxy generator: `generateGalaxy()` — 2 fixed NPC systems + 7 random systems |

### Components

| Component | Role |
|-----------|------|
| `HsNavBar` | View switching (Planet / Solar System / Galaxy Map) + gate checks. First item is `HsPlanetHeader` (planet name + type, clickable to switch to planet view). |
| `HsResourceBar` | Compact resource bar shown at top of all views |
| `HsPlanetGrid` | 4×3 unified tile grid — 3 panel tiles (row 1) + 9 planet building slots (rows 2–4). Manages single active-tile state across all 12 tiles. |
| `HsTilePanel` | Right-column panel — renders different content based on `activePanel` prop: `'resources'` → `HsAllResourcePanel`, `'notifications'` → `HsProfilePanel` + `HsNotificationPanel` + `HsSettingsPanel`, `'dock'` → `HsDockPanel`, `null` → building detail for the active planet slot |
| `HsDockPanel` | Space Base panel — build & manage ships (recon drones, colony ships) + active missions |
| `HsSolarSystem` | Home system view — all planets, drone & colony actions |
| `HsGalaxyMap` | Galaxy view — all star systems, planet detail card |
| `HsPlanetHeader` | Planet name + type tile — lives inside `HsNavBar` as the first nav item |
| `HsAllResourcePanel` | Full resource breakdown (all non-utility resources with amount, rate, cap). Shown in right panel when Planet Info tile is active. |
| `HsProfilePanel` | Commander profile editor — portrait picker (12 emoji options), editable name (max 12 chars), disposition selector (friendly / neutral / hostile). Shown at the top of the Activity panel. |
| `HsNotificationPanel` | Live activity feed — buildings/ships in progress + completed events (persistent until dismissed) |
| `HsSettingsPanel` | Dev tuning controls (tick rate, build factor, game reset). Shown below `HsNotificationPanel` in the Activity view. |

### Auth & Session

Das Spiel benötigt einen Account. Beim ersten Öffnen erscheint das **Auth-Modal** (ersetzt das alte "Commander Name"-Setup-Modal).

**Zwei Modi — umschaltbar per Tab (Standard: Login):**

| Modus | Felder |
|-------|--------|
| **Anmelden** | E-Mail · Passwort · „Remember me"-Checkbox |
| **Registrieren** | Commander-Name (username, 2–64 Zeichen) · E-Mail · Passwort (min. 6 Zeichen) |

- Portrait und Disposition werden **nicht** beim Register abgefragt — das gehört ins In-Game-Profil (`HsProfilePanel`).
- **Remember me** (Standard: an): Token landet in `localStorage['hawk-star-token']` (bleibt über Tabs/Neustarts hinaus). Deaktiviert: Token nur in `sessionStorage` (verschwindet beim Tab-Schließen).
- Beim Laden: Token in localStorage oder sessionStorage → Token verify → direkt ins Spiel; ungültig/fehlend → Auth-Modal.
- Token-Ablauf (7 Tage): beim nächsten API-Call bekommt der Client 401 → Modal wieder zeigen.
- Fehlermeldungen erscheinen inline im Modal (Username bereits vergeben, falsches Passwort, etc.).

**Composables:**
- `useHawkStarAuth.js` — Auth-Singleton: Token, Player, rememberMe, register/login/logout/verifyToken
- `useHawkStarApi.js` — dünner API-Wrapper: alle Game-Actions (fetchGalaxy, postBuild, postDroneMission, …)
- `useHawkStar.js` — lokale UI-State-Logik (aktiver Slot, aktive View, Tick, Ressourcen-UI)

### State & Persistence

- **`useHawkStar.js`** ist ein Singleton-Composable — alle Komponenten lesen und schreiben direkt darin, keine Props/Emits für Game-State.
- **`gameLoaded`** ref (bool): wird erst `true`, nachdem `initFromApi()` vollständig erfolgreich war. `startBuild` und andere Write-Actions sind davon abhängig — solange `false`, werden sie geblockt.
- **`initError`** ref (string): enthält die Fehlermeldung, wenn Galaxy-Load oder Game-State-Load fehlschlägt. Im UI sichtbar als rote Zeile über dem Retry-Button.
- Aktuell: Player-State zusätzlich in **LocalStorage** unter `hawk-star-save` (Ressourcen, Slot-Unlocks, Gebäude-Fortschritt, Missionen, Galaxie-Layout, Profil). Soll entfernt werden, sobald die LocalStorage-Migration abgeschlossen ist.
- Nach Frontend-Migration: State kommt ausschließlich aus der Backend-API (`GET /api/star/game/state?planet_id=X`), LocalStorage enthält nur noch den JWT-Token.
- `allPlanetStates` ist das Kern-State-Objekt — keyed by `planetId`, enthält Ressourcen, Gebäude, Dock, Conversion-Queues pro Planet.
- `galaxySystems`: nach `initFromApi()` von `GET /api/star/galaxy/` geladen (echter API-Stand). Fallback über `generateGalaxy()` bleibt im Code für HMR-Initialisierung, wird aber durch API-Daten überschrieben.
- `playerPortrait` und `playerDisposition` werden im In-Game-Profil (`HsProfilePanel`) gespeichert und per API aktualisiert.

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

| Feature                                       | Status |
|-----------------------------------------------|--------|
| Planet grid, slot unlocks                     | ✅ Done |
| Buildings (all types)                         | ✅ Done |
| Energy & staff system                         | ✅ Done |
| Resources + storage caps                      | ✅ Done |
| High-Tech conversions                         | ✅ Done |
| Recon Drones                                  | ✅ Done |
| Colony Ships                                  | ✅ Done |
| Galaxy Map (simplified, all systems visible)  | ✅ Done |
| Solar System view                             | ✅ Done |
| Dev mode — tick rate & build time factor      | ✅ Done |
| Notification Panel                            | ✅ Done |
| Localisation (i18n) — all components          | ✅ Done |
| Research → Comm Center rename + Star Map global | ✅ Done |
| NPC factions in mock (Asha/Kepler, disposition) | ✅ Done |
| `interstellar_comm` research (Comm Center, global, requires star_map Lv3) | ✅ Done |
| System scanning — `systemContacts`, one scan at a time, hours-based duration | ✅ Done |
| Galaxy scanning gate — `star_map` Lv3, uses actual completed level (not in-progress) | ✅ Done |
| Galaxy Map — scan button, scanning indicator, scanned display, ⏳ busy state | ✅ Done |
| Predefined emoji messages + `commLog` + NPC auto-response | ✅ Done |
| Comm log in Galaxy Map view | ✅ Done |
| i18n — `hawkStar.comm.*` + `hawkStar.buildings.interstellar_comm` | ✅ Done |
| Procedural galaxy generator (`generateGalaxy()`) — per-player, persisted in save | ✅ Done |
| Two NPC factions — Asha (friendly) + Krath (hostile) | ✅ Done |
| `recon_drone` + `colony_ship` simplified to 1 level, 1 active mission at a time | ✅ Done |
| Commander profile — portrait picker, name edit, disposition selector (`HsProfilePanel`) | ✅ Done |
| `formatTime` — supports s / m s / h m / t h m s formats | ✅ Done |
| Backend — Phase 1: Foundation (auth, galaxy, building, resources, research, missions) | ✅ Done |
| Auth-Modal — Register/Login, JWT-Token in localStorage (`useHawkStarAuth.js`) | ✅ Done |
| Auth: Login-Tab als Standard, „Remember me"-Checkbox (localStorage vs. sessionStorage) | ✅ Done |
| Auth: 401-Fix — `.htaccess` Authorization-Header-Passthrough + `bootstrap.php` Fallback-Chain | ✅ Done |
| `useHawkStarApi.js` — API-Wrapper für alle Game-Actions | ✅ Done |
| `initFromApi` — lädt Galaxy + Game State nach Auth, ersetzt Mock | ✅ Done |
| `gameLoaded` / `initError` — Loading-Screen + Retry-Button in `index.vue` | ✅ Done |
| Write-Actions auf API: `startBuild`, `sendReconDrone`, `sendColonyShip`, `startConversion` | ✅ Done |
| Drone/Colony — kein Inventory mehr, direktes Mission-Modell (Building = Unit) | ✅ Done |
| `HsDockPanel` — an neues Missions-Modell angepasst (kein Build-Step, direkte Mission-Anzeige) | ✅ Done |
| Frontend migration — LocalStorage-Save entfernen, API als alleinige Source of Truth | ⬜ Next |
| Backend — Phase 2: Scanning & NPC Comm (system_contacts, comm_log server-side) | ⬜ Planned |
| Backend — Phase 3: Player Interaction (trade, player messaging) | ⬜ Planned |
| Backend — Phase 4: Espionage | ⬜ Planned |
| Backend — Phase 5: Combat | ⬜ Planned |

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

Systeme sind auf der Galaxy Map immer sichtbar (Name, Stern, Planetanzahl), aber **Bewohner sind versteckt** bis ein Scan-Signal eintrifft. Das ist die aktuelle Implementierung via `systemContacts`. Eine tiefere Dunkel-Schicht (System komplett unsichtbar bis erkundet) ist für einen späteren Phase geplant.

# Colony Projects (Queue kleiner Aufgaben)                                                                                                                                      

Eine kurze Warteschlange mit 30s–3min-Aufgaben: "Recrute Kolonisten" (+1 Pop), "Vorräte aufbauen" (+30 Metal), "Reparaturtrupp" (reduziert Bauzeit des nächsten Gebäudes). Jedes

# Schwarzmarkt / Barter
Konvertiere überschüssige Ressourcen schnell zu anderen — aber zu schlechtem Kurs (3:1 oder 4:1). Metal → Crystal, Crystal → Alloy etc. Kein langer Build, nur ein Klick + kurze

