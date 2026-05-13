# Hawk-Star — Backend & Multiplayer

Stack: **PHP + MySQL 8** (Docker local, existing PHP server for prod).
All game state lives in the database — no LocalStorage in multiplayer mode.

Frontend is feature-complete for Phases 1 & 2. Backend implementation starts here.

---

## User Management

**Flow:**
1. Player registers with username + email + password
2. Password hashed server-side with bcrypt
3. Login returns a **JWT token** — sent as `Authorization: Bearer <token>` on every request
4. Token expires after N hours; a refresh endpoint extends the session

**Tables:**

```sql
players (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  portrait      VARCHAR(16) DEFAULT '👨‍🚀',
  disposition   ENUM('friendly','neutral','hostile') DEFAULT 'neutral',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  DATETIME
)

sessions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  player_id  INT NOT NULL REFERENCES players(id),
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Endpoints:**

```
POST /auth/register   { username, email, password, portrait?, disposition? }
POST /auth/login      { email, password } → { token, player }
POST /auth/logout
GET  /auth/me         → current player info
```

---

## Resource Computation — Lazy, Event-Driven

**No polling. No cron jobs.**

Resources are only computed when the player takes an action or opens the game. The server calculates how much was produced since the last computation:

> stored + (production_rate × seconds_since_last_computation)

Each planet stores a `resources_computed_at` timestamp. The server runs this delta calculation at the start of every write request (build, mission, etc.) and on the initial page load. The client gets fresh values as a response to its own actions — not from a background ticker.

- Server load is minimal — only active players generate requests
- No WebSockets or background jobs needed for Phases 1 & 2
- Resources are always accurate when returned
- Energy is not stored — it is computed on-demand as `sum(production) - sum(drain)` across all buildings

---

## Shared Galaxy

All players share **one galaxy instance**. Planet ownership is tracked per player. This replaces the frontend's per-player procedurally generated galaxy.

The galaxy is seeded once on first server setup from `generateGalaxy()` output (or a fixed seed). Two NPC systems (Kepler/Asha, Vorn/Krath) are always included. All other systems are empty at game start — available for colonization.

NPC factions are seeded data: they own their planets from day 1 but never expand.

---

## Database Schema

```sql
-- ── Shared world ──────────────────────────────────────────────────────────────

galaxies (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(128),
  created_at DATETIME
)

star_systems (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  galaxy_id  INT NOT NULL REFERENCES galaxies(id),
  name       VARCHAR(128),
  x          FLOAT,
  y          FLOAT,
  star_class CHAR(1)
)

planets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  system_id  INT NOT NULL REFERENCES star_systems(id),
  name       VARCHAR(128),
  type       ENUM('terrestrial','volcanic','frozen','ocean','uninhabitable') NOT NULL,
  slot_count INT DEFAULT 9
)

-- NPC factions (seeded data, never mutated at runtime)
npc_factions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  system_id   INT NOT NULL REFERENCES star_systems(id),
  name        VARCHAR(128),
  portrait    VARCHAR(16),
  disposition ENUM('friendly','neutral','hostile') DEFAULT 'neutral'
)

npc_planet_ownership (
  planet_id  INT PRIMARY KEY REFERENCES planets(id),
  faction_id INT NOT NULL REFERENCES npc_factions(id)
)

-- ── Per-player state ──────────────────────────────────────────────────────────

planet_ownership (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  planet_id    INT NOT NULL REFERENCES planets(id),
  player_id    INT NOT NULL REFERENCES players(id),
  is_home      TINYINT(1) DEFAULT 0,
  colonized_at DATETIME,
  UNIQUE (planet_id)          -- one owner per planet at a time
)

planet_resources (
  planet_id             INT NOT NULL,
  player_id             INT NOT NULL,
  metal                 FLOAT DEFAULT 0,
  crystal               FLOAT DEFAULT 0,
  population            FLOAT DEFAULT 0,
  alloy                 FLOAT DEFAULT 0,
  obsidian              FLOAT DEFAULT 0,
  cryo                  FLOAT DEFAULT 0,
  biomass               FLOAT DEFAULT 0,
  pure_crystal          FLOAT DEFAULT 0,
  super_alloy           FLOAT DEFAULT 0,
  quantum_shard         FLOAT DEFAULT 0,
  nano_alloy            FLOAT DEFAULT 0,
  power_cell            FLOAT DEFAULT 0,
  resources_computed_at DATETIME NOT NULL,
  PRIMARY KEY (planet_id, player_id)
)

planet_slots (
  planet_id  INT NOT NULL,
  player_id  INT NOT NULL,
  slot_index INT NOT NULL,
  unlocked   TINYINT(1) DEFAULT 0,
  PRIMARY KEY (planet_id, player_id, slot_index)
)

-- Per-planet buildings (planet-specific)
buildings (
  planet_id     INT NOT NULL,
  player_id     INT NOT NULL,
  building_key  VARCHAR(64) NOT NULL,
  level         INT DEFAULT 0,
  build_ends_at DATETIME NULL,
  PRIMARY KEY (planet_id, player_id, building_key)
)

-- Global research (star_map, interstellar_comm — apply across all planets)
global_research (
  player_id     INT NOT NULL,
  building_key  VARCHAR(64) NOT NULL,         -- 'star_map' | 'interstellar_comm'
  level         INT DEFAULT 0,
  build_ends_at DATETIME NULL,
  PRIMARY KEY (player_id, building_key)
)

missions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  player_id      INT NOT NULL,
  type           ENUM('recon_drone','colony_ship') NOT NULL,
  from_planet_id INT NULL REFERENCES planets(id),
  to_planet_id   INT NULL REFERENCES planets(id),
  ends_at        DATETIME NOT NULL,
  status         ENUM('in_flight','done') DEFAULT 'in_flight',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
)

conversion_queues (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  planet_id    INT NOT NULL,
  player_id    INT NOT NULL,
  building_key VARCHAR(64) NOT NULL,
  recipe_index INT NOT NULL,
  ends_at      DATETIME NOT NULL,
  remaining    INT DEFAULT 0
)

-- ── Communication (Phase 2) ──────────────────────────────────────────────────

-- One row per player per system — scan state
system_contacts (
  player_id    INT NOT NULL,
  system_id    INT NOT NULL REFERENCES star_systems(id),
  scan_state   ENUM('unscanned','scanning','scanned') DEFAULT 'unscanned',
  scan_ends_at DATETIME NULL,
  PRIMARY KEY (player_id, system_id)
)

-- Emoji messages between player and NPC faction (or future: player-to-player)
comm_log (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  player_id      INT NOT NULL,
  system_id      INT NOT NULL REFERENCES star_systems(id),
  direction      ENUM('sent','received') NOT NULL,
  message_key    VARCHAR(64) NOT NULL,    -- emoji string (sent) or NPC response key (received)
  travel_ends_at DATETIME NULL,           -- NULL once delivered
  reply_ends_at  DATETIME NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## REST API

All routes require `Authorization: Bearer <token>` except `/auth/*`.
Every write endpoint runs lazy resource computation before executing its action.

```
-- Auth
POST /auth/register   { username, email, password, portrait?, disposition? }
POST /auth/login      { email, password }
POST /auth/logout
GET  /auth/me

-- Game state (page load + after each action)
GET  /game/state/:planetId
  → { resources, buildings, globalResearch, slots, missions, dock, conversionQueues }

-- Building (planet-specific)
POST /game/build              { planetId, buildingKey }

-- Global research (star_map, interstellar_comm)
POST /game/research           { buildingKey }

-- Conversions
POST /game/convert            { planetId, buildingKey, recipeIndex, count }

-- Missions
POST /game/mission/drone      { fromPlanetId, toPlanetId }
POST /game/mission/colony     { fromPlanetId, toPlanetId }
GET  /game/missions           → all active missions for player

-- Galaxy
GET  /galaxy                  → all systems + ownership (players + NPCs)
GET  /galaxy/system/:id       → system detail

-- Scanning & Comm (Phase 2)
POST /galaxy/scan             { systemId }    -- starts scan; 409 if scan already active
GET  /galaxy/contacts         → { [systemId]: { scanState, scanEndsAt } }
POST /comm/send               { systemId, messageKey }
GET  /comm/log                → all comm_log entries for player
```

---

## Feature Phases

### Phase 1 — Foundation

Core multiplayer backbone. Everything the frontend already does, now server-side.

- User registration & login (JWT auth)
- Shared galaxy served from DB (`GET /galaxy`)
- Planet ownership: home planet assigned on first login
- Full building system per planet (lazy resource computation)
- Global research (`global_research` table) — star_map + interstellar_comm
- Recon Drone + Colony Ship missions
- Conversion queues
- `GET /game/state/:planetId` as the single source of truth on load and after actions

**Frontend change:** swap `useHawkStar.js` LocalStorage logic for `useHawkStarApi.js` calls. See migration plan below.

---

### Phase 2 — Scanning & NPC Communication

Frontend-complete. Backend needs:

- `system_contacts` table + scan endpoint (enforce one-scan-at-a-time server-side)
- Scan duration formula mirrors frontend: `max(7200, dist × 180)` seconds
- NPC auto-response logic server-side (disposition → response key pool)
- `comm_log` table + send/receive endpoints
- `GET /galaxy/contacts` returns all scan states for player

---

### Phase 3 — Player Interaction

- Player-to-player messaging (extend `comm_log` or add `messages` table)
- Freighter trade: redistribute resources between own planets
  - One freighter per planet; flies between own colonies
  - Later: trade offers between players

```sql
-- Extend missions table with type 'freighter' when implementing
-- Or track via separate freighter_missions table
```

---

### Phase 4 — Espionage

- Recon Drones in **foreign** systems reveal planet ownership + building level ranges
- Results stored per player — what you've scouted is your intelligence, becomes stale over time

```sql
intel (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  player_id   INT NOT NULL,
  planet_id   INT NOT NULL REFERENCES planets(id),
  scouted_at  DATETIME,
  data        JSON    -- building ranges, owner, etc.
)
```

---

### Phase 5 — Combat

One warship per planet (no fleet concept). Stat-based combat — no loadout system yet.

```sql
warships (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  planet_id INT NOT NULL,
  hull      INT,
  shield    INT,
  speed     INT,
  status    ENUM('hangar','in_flight','returning') DEFAULT 'hangar'
)

combat_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  attacker_id  INT NOT NULL REFERENCES players(id),
  defender_id  INT NOT NULL REFERENCES players(id),
  planet_id    INT NOT NULL REFERENCES planets(id),
  attacker_won TINYINT(1),
  result       JSON,
  fought_at    DATETIME
)
```

**Attack flow:**
1. Player clicks "Attack" on an enemy planet → `POST /game/warship/attack { fromPlanetId, toPlanetId }`
2. Server sets warship `status = 'in_flight'`, computes `arrives_at` from ship speed
3. On arrival: server resolves combat (hull × 0.6 base damage, reduced by planetary defenses)
4. Result written to `combat_logs`, warship set to `returning`
5. After return flight: warship back in `hangar` — damaged hull carried over (no destruction in Phase 5)

---

## Frontend Migration Plan

1. Create `composables/useHawkStarApi.js` — wraps all API calls, returns the same data shapes as current `useHawkStar.js`
2. `GET /game/state/:planetId` is called on page load and after every action — no background polling
3. All write actions (build, research, mission, convert, scan, send) become `POST` requests; response returns updated state
4. Building timers and mission timers run visually in the frontend (countdown from `ends_at`) — no polling needed
5. Keep `buildTimeFactor` dev flag active during integration testing; strip when going live
6. Once API is stable: remove LocalStorage fallback entirely

**Migration order (suggested):**
1. Auth + player session
2. Galaxy load + planet ownership
3. Building + global research
4. Resource computation (lazy)
5. Missions (drone + colony)
6. Conversions
7. Scanning + comm log
