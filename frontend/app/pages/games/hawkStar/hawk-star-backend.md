# Hawk-Star — Backend & Multiplayer

Stack: **PHP + MySQL 8** (Docker local, existing PHP server for prod).
All game state lives in the database — no LocalStorage in multiplayer mode.

---

## User Management

Every player needs an account before entering the game.

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
POST /auth/register   { username, email, password }
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

This means:
- Server load is minimal — only active players generate requests
- No WebSockets or background jobs needed for Phase 1
- Resources are always accurate when returned

---

## Shared Galaxy

All players share one galaxy instance. Planet ownership is tracked per player. This is what makes real multiplayer possible — colonization, territory, conflict.

The galaxy is seeded once on first server setup from the static mock data (`GALAXY_SYSTEMS`). Later: multiple seasons or game instances are possible.

---

## Database Schema

```sql
-- Shared world
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
  star_class CHAR(1),
)

planets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  system_id  INT NOT NULL REFERENCES star_systems(id),
  name       VARCHAR(128),
  type       ENUM('terrestrial','volcanic','frozen','ocean') NOT NULL,
  slot_count INT DEFAULT 9
)

-- Per-player state
planet_ownership (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  planet_id    INT NOT NULL REFERENCES planets(id),
  player_id    INT NOT NULL REFERENCES players(id),
  is_home      TINYINT(1) DEFAULT 0,
  colonized_at DATETIME,
  UNIQUE (planet_id, player_id)
)

planet_resources (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  planet_id             INT NOT NULL,
  player_id             INT NOT NULL,
  metal                 FLOAT DEFAULT 0,
  crystal               FLOAT DEFAULT 0,
  population            FLOAT DEFAULT 0,
  super_alloy           FLOAT DEFAULT 0,
  quantum_shard         FLOAT DEFAULT 0,
  pure_crystal          FLOAT DEFAULT 0,
  nano_alloy            FLOAT DEFAULT 0,
  kinetic_round         FLOAT DEFAULT 0,
  plasma_cell           FLOAT DEFAULT 0,
  power_cell            FLOAT DEFAULT 0,
  resources_computed_at DATETIME NOT NULL,
  UNIQUE (planet_id, player_id)
)

planet_slots (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  planet_id  INT NOT NULL,
  player_id  INT NOT NULL,
  slot_index INT NOT NULL,
  unlocked   TINYINT(1) DEFAULT 0,
  UNIQUE (planet_id, player_id, slot_index)
)

buildings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  planet_id     INT NOT NULL,
  player_id     INT NOT NULL,
  building_key  VARCHAR(64) NOT NULL,
  level         INT DEFAULT 0,
  build_ends_at DATETIME NULL,
  UNIQUE (planet_id, player_id, building_key)
)

missions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  player_id      INT NOT NULL,
  type           ENUM('recon_drone','galaxy_probe','colony_ship','freighter','warship') NOT NULL,
  from_planet_id INT NULL,
  to_planet_id   INT NULL,
  to_system_id   INT NULL,
  cargo          JSON NULL,
  ends_at        DATETIME NOT NULL,
  status         ENUM('in_flight','arrived','done') DEFAULT 'in_flight',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
)

warships (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  planet_id INT NOT NULL,      -- home planet (one warship per planet)
  name      VARCHAR(128),
  class_id  VARCHAR(64) DEFAULT 'frigate',
  hull      INT,
  shield    INT,
  speed     INT,
  status    ENUM('hangar','in_flight','returning') DEFAULT 'hangar'
  -- Note: drive/weapon slots intentionally omitted for now.
  -- Equipment system can be added when combat is designed end-to-end.
)

-- One freighter per planet. No inventory count — boolean presence.
-- When in transit the row is absent or status = 'in_flight'; on arrival it is recreated at the destination.
-- Alternatively modelled as a nullable FK on planet_ownership and tracked via the missions table.
freighters (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  planet_id INT NOT NULL,      -- current home planet (changes on arrival)
  status    ENUM('hangar','in_flight') DEFAULT 'hangar',
  UNIQUE (player_id, planet_id)
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
```

---

## REST API

All routes require `Authorization: Bearer <token>` except `/auth/*`.
Every write endpoint runs lazy resource computation before executing its action.

```
-- Auth
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me

-- Game state (page load + after each action)
GET  /game/state/:planetId     → resources, buildings, slots, missions, dock

-- Building
POST /game/build               { planetId, buildingKey }

-- Conversions
POST /game/convert             { planetId, buildingKey, recipeIndex, count }

-- Colony
POST /game/mission/drone       { fromPlanetId, toPlanetId }
POST /game/mission/colony      { fromPlanetId, toPlanetId }
GET  /game/missions            → all active missions for player

-- Galaxy
GET  /galaxy                   → all systems + planet ownership (all players)
GET  /galaxy/system/:id        → system detail

-- Warship (Phase 1: build only)
POST /game/warship/build       { planetId }

-- Warship (Phase 4: combat)
POST /game/warship/attack      { fromPlanetId, toPlanetId }
GET  /game/warship/status      → warship state (hangar / in_flight / returning)
```

---

## Feature Phases

### Phase 1 — Bauen & Besiedeln (current focus)

- User registration & login
- Home planet with full building system
- Resource production (lazy computation)
- Colony Ships: colonize planets in the home system
- Recon Drones: scan planets before colonizing
- Galaxy Map: see all systems, see which planets are owned by which player
- No combat, no trade, no communication yet

### Phase 2 — Handel & Kommunikation

**Freighter Trade:**
- One freighter per planet (boolean hangar state — either present or in transit)
- Freighters fly between your own colonies to redistribute resources; on arrival the freighter is available at the destination planet
- Later: trade offers between players — a player posts an offer (X metal for Y crystal), another accepts

**Kommunikation:**
- In-game message system between players
- Messages tied to a planet or system (e.g. "I claim this system")
- Simple inbox/outbox per player
- Table: `messages (id, from_player_id, to_player_id, subject, body, sent_at, read_at)`

### Phase 3 — Ausspionieren

- Galaxy Probes reveal system info (planet count, types)
- Recon Drones in foreign systems reveal planet ownership + building level ranges (not exact)
- Results are stored per player — what you've scouted is your intelligence
- Table: `intel (id, player_id, planet_id, scouted_at, data JSON)` — data becomes stale over time

### Phase 4 — Kampf

**Warship Model:** One warship per planet (no fleet concept for now). The ship sits in the hangar after construction. Drive/weapon slots are intentionally absent — a simpler stat-based combat keeps the scope manageable and the backend schema clean.

**Attack Flow:**
1. Player selects an enemy planet on the Galaxy Map → clicks "Attack"
2. Frontend sends `POST /game/warship/attack { fromPlanetId, toPlanetId }`
3. Server sets warship `status = 'in_flight'`, calculates `arrives_at` from ship speed
4. On arrival, server resolves combat using attacker/defender hull+shield stats
5. Result written to `combat_logs`, warship set to `status = 'returning'`
6. After return flight, warship back in `'hangar'` — damaged hull is carried over

**Combat Resolution (server-side):**
- Attacker deals damage = ship hull × 0.6 (base formula, tunable)
- Defender's planet defenses reduce incoming damage
- If defender hull reaches 0 → attacker wins (planet ownership transfers or is raided)
- Ships take damage regardless — no permanent destruction in Phase 4 (hull resets after return)

**Tables:**
```sql
combat_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  attacker_id  INT NOT NULL REFERENCES players(id),
  defender_id  INT NOT NULL REFERENCES players(id),
  planet_id    INT NOT NULL REFERENCES planets(id),
  attacker_won TINYINT(1),
  result       JSON,   -- hull remaining, damage dealt, resources raided
  fought_at    DATETIME
)
```

**Not in Phase 4:** Fleet battles (multiple ships), weapon loadouts, orbital bombardment — these depend on how the combat system feels in practice.

---

## Frontend Migration Plan

1. Create `composables/useHawkStarApi.js` — wraps all API calls, returns the same data shape as current `useHawkStar`
2. Add `const USE_API = false` flag in `useHawkStar.js` — toggle between LocalStorage and API during transition
3. All write actions (build, mission, convert) become `POST` requests; the response returns the updated state
4. `GET /game/state/:planetId` is called on page load and after every action — no background polling
5. Building timers and mission timers still run visually in the frontend (countdown from `ends_at`) — no need to poll for completion
6. Once API is stable: remove LocalStorage fallback and the `USE_API` flag
