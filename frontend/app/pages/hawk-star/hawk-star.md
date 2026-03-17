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
- [x] Communication tile — slot 6, unlocked by Laboratory Lv1
  - [x] `recon_drones` — scout drones, 3 levels (intel gating for galaxy screen)
  - [x] `star_map` — galaxy navigation hub, 3 levels (prerequisite for Step 2 galaxy screen)
  - [x] `trade_harbor` — interplanetary docking, 3 levels (prerequisite for Step 3 trading)

---

### 🔲 Step 2 – Galaxy & Planet Network (Frontend)

**Goal:** Give the player a sense of place in the galaxy — what they own, what's contested, where enemies are. Gated behind Communication tile buildings.

#### 2a — Planet & System Data (frontend mock)
- [ ] Static mock galaxy config — ~20 star systems, each with 1–3 planets, x/y coords
- [ ] Planet states: `own` · `uncolonized` · `enemy` · `ally` · `unknown`
- [ ] Visibility rules: home planet always visible; others revealed by Recon Drone & Star Map level

#### 2b — Galaxy Map Screen
- [ ] Galaxy map accessible via "Galaxy" button in HUD — shown once Star Map Lv1 is built
- [ ] 2D grid/scatter view — each node = one star system
- [ ] Color-coded by ownership: own = blue · enemy = red · uncolonized = grey · fog of war = dark
- [ ] Hover/click on a system → system card (planet list, owner, fleet presence if known)
- [ ] Star Map Lv1 → known systems visible · Lv2 → trade routes · Lv3 → full galaxy, fog of war lifted
- [ ] Recon Drones Lv1 → reveals nearest 3 systems · Lv2 → enemy movement hints · Lv3 → real-time flags
- [ ] Player's home system always visible regardless of map level

#### 2c — Planet Detail
- [ ] Click a known planet → planet card: owner name, tile count, defense level, last-seen time
- [ ] Own planet links back to the base-building view

#### 2d — Future DB schema (planned for Step 4)
- `galaxy_systems` — id, name, x, y, star_class
- `planets` — id, system_id, name, slot_count, owner_id (nullable), conquered_at
- `planet_visibility` — player_id, planet_id, last_seen_at, visibility_level (0–3)
- `fleets` — id, owner_id, location_planet_id, destination_planet_id, arrives_at, ship_count

---

### 🔲 Step 3 – Backend & Persistence

**Goal:** Move state to the server so progress survives sessions and multiple players can coexist.

- [ ] Backend setup (Node.js + Express or Fastify)
- [ ] Database schema (PostgreSQL)
  - `players` — auth, profile
  - `player_resources` — current amounts per player
  - `player_planet_slots` — unlocked state per slot
  - `player_buildings` — `{ playerId, buildingId, level, buildEndsAt }`
  - Galaxy tables from Step 2d
- [ ] REST API endpoints
  - `GET /planet` — load full player state
  - `POST /build` — queue a build / upgrade
  - `GET /galaxy` — visible systems for the requesting player
- [ ] Server-side tick system — resource production calculated server-side on save/load
- [ ] Auth — login, session, player identity
- [ ] Frontend connects to API instead of local `ref` state

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
- **Step 5** — Spaceships & fleet movement (launch fleets, intercept, colonize)
- **Step 6** — Multiplayer: live trading via Trade Harbor, diplomacy, alliances
- **Step 7** — Combat: PvP and NPC enemies (pirates, alien factions, siege mechanics)
