# Hawk-Star

A browser-based multiplayer online strategy game set in space.
Each player starts on their own planet, builds a civilization from scratch, expands through the galaxy, and eventually competes or cooperates with other players.

---

## Roadmap

### ✅ Step 1 – Planet Base (Frontend Prototype)

**Goal:** Playable single-player prototype — build and manage your home planet.

- [x] `hawkStarConfig.js` — all static game data separated from component logic
- [x] Resource bar — Population, Metal, Crystal, Energy always visible
- [x] 3×3 planet grid — slot 5 (center) starts unlocked, others locked
- [x] Tile selection — click unlocked tile to open its building panel
- [x] Building system — Build button with timer, progress bar, countdown
- [x] Upgrade system — all buildings have up to 3 levels, button switches Build → Upgrade
- [x] Level badge on built buildings, MAX indicator at max level
- [x] Config-driven unlock system — completing a building level unlocks new tiles
- [x] Production tick — built buildings produce resources every second
- [x] Upgrade keeps current production — upgrading doesn't pause output
- [x] Energy as utility, not stockpile
- [x] Population as a workforce resource
- [x] Resource bar improvements
- [x] Storage caps for metal & crystal
- [x] Balance pass — build times, costs and production values tuned
- [x] Visual feedback when a building goes offline (energy deficit)
- [x] Tile lock visuals — show what's needed to unlock a locked tile
- [x] LocalStorage save/load — persist progress across page refreshes
- [x] Current stats on built buildings — show active production/drain instead of only next-level effect
- [x] Power Plant moved to Energy tile (Base: Command Center + Quarters · Energy: Power Plant + Solar Array + Fusion Reactor)
- [x] Communication tile — slot 6, unlocked by Laboratory
- [x] Research tile — Laboratory (unlocks Communication tile) + Space Technology (unlocks Space Base tile)
- [x] Space Base tile — slot 3, unlocked by Space Technology Lv1

---

### ✅ Step 2a – Galaxy & Planet Network (Frontend Mock)

**Goal:** Give the player a sense of place in the galaxy — what they own, what's contested, where enemies are. Gated behind Space Base buildings.

- [x] Static mock galaxy config (`hawkStarGalaxyMock.js`) — 9 star systems, each with 4–8 planets, x/y coords, star class, trade routes
- [x] Planet states: `own` · `uncolonized` · `enemy` · `ally` · `unknown`
- [x] NavBar — switch between Planet / Solar System / Galaxy views, gated by Star Map level
- [x] Solar System view (`HsSolarSystem.vue`) — shows home system planets as tiles with state/type
- [x] Galaxy Map view (`HsGalaxyMap.vue`) — star field canvas, system nodes with glow rings, fog of war by Star Map level
- [x] Trade routes visible at Star Map Lv2 as dashed SVG lines
- [x] System detail card — click system node to reveal name, planet count, state

---

### ✅ Step 2b – Unit System (Drones, Probes, Colony Ships)

**Goal:** Ships and drones are buildable units — each mission consumes one unit from inventory.

- [x] `UNIT_COSTS` in config — per-unit cost and base build time for each unit type
- [x] **Recon Drone** — build drones (60⚙️ 25💎, 90s base), send one per planet in home system; arrives and reveals planet details permanently
- [x] **Galaxy Probe** — build probes (100⚙️ 50💎, 150s base), send one per star system; arrives and reveals planet count
- [x] **Colony Ship** — build ships (300⚙️ 150💎, 300s base), send to scanned uncolonized planet; arrives and colonizes it
- [x] Build time scales with building level (base / level)
- [x] Simultaneous missions capped by building level (Lv1 = 1, Lv2 = 2, Lv3 = 3)
- [x] Drone/colony progress bars on planet tiles (yellow = drone, blue = colony ship)
- [x] Probe inventory bar in Galaxy Map with build button and in-flight count
- [x] Drone + colony ship inventory bar in Solar System status bar
- [x] Savegame version guard — old saves (pre-unit system) are automatically discarded

---

### 🔲 Step 2c – Pre-Backend Features (Frontend)

**Goal:** Round out the frontend prototype before connecting a backend. All features stay client-side for now.

#### Space Units on Planet View
- [x] Space Base tile shows a "Space Units" section in the tile panel
- [x] Build Recon Drones, Galaxy Probes and Colony Ships directly from the planet view
- [x] Build progress bar + countdown visible in the planet tile panel
- [x] Inventory count shown as badge on each unit icon

#### Defense Tile
- [x] New `defense` tile type at slot 1 — unlocked by Weapons Research Lv1
- [x] New `weapons_research` building in the Research tile (unlocks slot 1)
- [x] `shield_generator` — 3 levels, absorbs 20/40/60% incoming damage (only defense building for now)

#### Planet Types
- [x] 4 planet types: **Terrestrial** 🌿, **Volcanic** 🌋, **Frozen** ❄️, **Ocean** 🌊
- [x] Type assigned at start from mock planet data (`MOCK_TYPE_TO_PLANET_TYPE` lookup)
- [x] Planet type badge shown right of planet name, color-coded per type
- [x] Type-specific special buildings: `magma_forge` + `geothermal_tap` (volcanic), `cryo_excavator` + `cryo_lab` (frozen), `tidal_generator` (ocean)
- [x] Buildings filtered in tile panel — only show buildings valid for current planet type

#### Agriculture Refactor
- [x] Removed all old crop/farm buildings; single generic `farm` building (all types, 3 levels)
- [x] One trade crop per planet type: `terra_wheat` (terrestrial), `ember_root` (volcanic), `frost_spore` (frozen), `sea_kelp` (ocean)
- [x] Crops filtered by planet type — only the matching crop is visible in the agriculture tile panel

#### First-Run Setup
- [x] Random uncolonized planet assigned from galaxy mock on first run (dynamic `buildStartPool()`)
- [x] Setup overlay (teleport) — shows assigned system + planet + type, commander name input
- [x] Player name displayed left of planet name in planet header
- [x] Dynamic `homeSystemId`/`homePlanetId` refs — Solar System and Galaxy Map fully reflect assigned home
- [x] All build times capped at 60 s for testing

#### Planets & Colonization
- [ ] Colonized planets get a basic planet view (separate grid from home planet)
- [ ] Each colonized planet starts with its own empty 3×3 grid (same building system)
- [ ] Switch between owned planets via NavBar or planet list

---

### 🔲 Step 3 – Backend & Persistence

**Goal:** Move state to the server so progress survives sessions and multiple players can coexist.

- [ ] Backend setup (Node.js + Express or Fastify)
- [ ] Database schema (PostgreSQL)
- [ ] REST API endpoints
- [ ] Server-side tick system — resource production calculated server-side on save/load
- [ ] Auth — login, session, player identity
- [ ] Frontend connects to API instead of local `ref` state

#### Planned DB schema
- `galaxy_systems` — id, name, x, y, star_class
- `planets` — id, system_id, name, slot_count, owner_id (nullable), conquered_at
- `planet_visibility` — player_id, planet_id, last_seen_at, visibility_level (0–3)
- `player_units` — player_id, unit_type, inventory_count, build_ends_at
- `unit_missions` — id, player_id, unit_type, target_id, arrives_at
- `fleets` — id, owner_id, origin_id, destination_id, arrives_at, ship_count

---

## Tech Stack

### Frontend
- Vue 3 + Nuxt (existing structure)
- Scoped CSS for game UI (no Tailwind dependency for game layout)
- WebSockets for real-time updates (later steps)

### Backend
- Node.js + Express or Fastify
- REST API for game actions
- Tick system (server-side, cron or event-driven)
- WebSockets (Socket.io) for live sync (later steps)

### Database
- PostgreSQL — player data, buildings, planets, research
- Redis — sessions, cache, tick queue (later steps)

---

## Vision (future steps)

- **Step 4** — Research tree (Laboratory tile — tech unlocks, research queue)
- **Step 5** — Combat: PvP fleets, intercept mechanics, siege
- **Step 6** — Multiplayer: live trading via Trade Harbor, diplomacy, alliances
- **Step 7** — NPC factions (pirates, alien empires), events, galaxy events
