# Hawk-Star

A browser-based multiplayer online strategy game set in space.
Each player starts on their own planet, builds a civilization from scratch, expands through the galaxy, and eventually competes or cooperates with other players.

---

## Roadmap

### ✅ Step 1 – Planet Base (Frontend Prototype)

**Goal:** Playable single-player prototype — build and manage your home planet.

- [x] `hawkStarConfig.js` — all static game data separated from component logic
  - `RESOURCES`, `TILE_TYPES`, `PLANET_GRID`, `BUILDINGS` with full level definitions
  - DB-ready structure (maps 1:1 to future tables)
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
  - Power buildings produce energy/s
  - All other buildings have `energyDrain` (ongoing consumption)
  - Net energy shown as `⬆ output / ⬇ drain` with +/- flow rate
  - Energy deficit highlighted in red
  - Cannot build/upgrade drain buildings when energy would go negative
  - Power plants always buildable regardless of current energy balance

**Open / Next session:**

- [x] Population as a workforce resource
  - Each building requires a `staffDrain` (workers assigned while active)
  - Cannot build/upgrade if not enough free population
  - "Need staff" indicator on button, similar to energy check
  - Quarters increase max population → more workers available
- [ ] Balance pass — build times, costs and production values need tuning
- [ ] Visual feedback when a building goes offline (energy deficit in future)
- [ ] Tile lock visuals — show what's needed to unlock a locked tile (tooltip or label)

---

### 🔲 Step 2 – Backend & Persistence

**Goal:** Save player state to a database so progress persists across sessions.

- [ ] Backend setup (Node.js + Express or Fastify)
- [ ] Database schema (PostgreSQL)
  - `players` — auth, profile
  - `player_resources` — current amounts per player
  - `player_planet_slots` — unlocked state per slot
  - `player_buildings` — `{ playerId, buildingId, level, buildEndsAt }`
- [ ] REST API endpoints
  - `GET /planet` — load full player state
  - `POST /build` — queue a build / upgrade
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

- **Step 3** — Research tree (Laboratory tile)
- **Step 4** — Spaceships & galaxy map
- **Step 5** — Multiplayer: trading, diplomacy
- **Step 6** — Combat: PvP and NPC enemies (pirates, alien factions)
