-- ── Hawk-Star Schema ──────────────────────────────────────────────────────────

-- ── Shared world ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hs_galaxies (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(128),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_star_systems (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  galaxy_id  INT NOT NULL REFERENCES hs_galaxies(id),
  name       VARCHAR(128),
  x          FLOAT,
  y          FLOAT,
  star_class CHAR(1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_planets (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  system_id INT NOT NULL REFERENCES hs_star_systems(id),
  name      VARCHAR(128),
  type      ENUM('terrestrial','volcanic','frozen','ocean','uninhabitable') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_npc_factions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  system_id   INT NOT NULL REFERENCES hs_star_systems(id),
  name        VARCHAR(128),
  portrait    VARCHAR(16),
  disposition ENUM('friendly','neutral','hostile') DEFAULT 'neutral'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_npc_planet_ownership (
  planet_id  INT PRIMARY KEY REFERENCES hs_planets(id),
  faction_id INT NOT NULL REFERENCES hs_npc_factions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Per-player state ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hs_players (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  portrait      VARCHAR(16) DEFAULT '👨‍🚀',
  disposition   ENUM('friendly','neutral','hostile') DEFAULT 'neutral',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_sessions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  player_id  INT NOT NULL REFERENCES hs_players(id),
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_planet_ownership (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  planet_id    INT NOT NULL REFERENCES hs_planets(id),
  player_id    INT NOT NULL REFERENCES hs_players(id),
  is_home      TINYINT(1) DEFAULT 0,
  colonized_at DATETIME,
  UNIQUE (planet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_planet_resources (
  planet_id             INT NOT NULL,
  player_id             INT NOT NULL,
  metal                 FLOAT DEFAULT 0,
  crystal               FLOAT DEFAULT 0,
  population            FLOAT DEFAULT 0,
  alloy                 FLOAT DEFAULT 0,
  obsidian              FLOAT DEFAULT 0,
  cryo                  FLOAT DEFAULT 0,
  biomass               FLOAT DEFAULT 0,
  duraplate             FLOAT DEFAULT 0,
  plasma_core           FLOAT DEFAULT 0,
  superconductor        FLOAT DEFAULT 0,
  vital_gel             FLOAT DEFAULT 0,
  power_cell            FLOAT DEFAULT 0,
  resources_computed_at DATETIME NOT NULL,
  PRIMARY KEY (planet_id, player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_planet_slots (
  planet_id  INT NOT NULL,
  player_id  INT NOT NULL,
  slot_index INT NOT NULL,
  unlocked   TINYINT(1) DEFAULT 0,
  PRIMARY KEY (planet_id, player_id, slot_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_buildings (
  planet_id     INT NOT NULL,
  player_id     INT NOT NULL,
  building_key  VARCHAR(64) NOT NULL,
  level         INT DEFAULT 0,
  build_ends_at DATETIME NULL,
  PRIMARY KEY (planet_id, player_id, building_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_global_research (
  player_id     INT NOT NULL,
  building_key  VARCHAR(64) NOT NULL,
  level         INT DEFAULT 0,
  build_ends_at DATETIME NULL,
  PRIMARY KEY (player_id, building_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Power-grid battery: drains over time, click to recharge, blackout when empty.
CREATE TABLE IF NOT EXISTS hs_power_battery (
  planet_id         INT NOT NULL,
  player_id         INT NOT NULL,
  charge            FLOAT NOT NULL DEFAULT 100,
  charge_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (planet_id, player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Population recruit pool: grows over time up to a cap; +1 click → population.
CREATE TABLE IF NOT EXISTS hs_recruit_pool (
  planet_id       INT NOT NULL,
  player_id       INT NOT NULL,
  pool            FLOAT NOT NULL DEFAULT 0,
  pool_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (planet_id, player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dock unit inventory: units are built here first, missions consume one.
CREATE TABLE IF NOT EXISTS hs_units (
  planet_id        INT NOT NULL,
  player_id        INT NOT NULL,
  unit_key         VARCHAR(64) NOT NULL,
  quantity         INT NOT NULL DEFAULT 0,
  build_ends_at    DATETIME NULL,
  build_started_at DATETIME NULL,
  PRIMARY KEY (planet_id, player_id, unit_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_missions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  player_id      INT NOT NULL,
  type           ENUM('recon_drone','colony_ship') NOT NULL,
  from_planet_id INT NULL REFERENCES hs_planets(id),
  to_planet_id   INT NULL REFERENCES hs_planets(id),
  ends_at        DATETIME NOT NULL,
  status         ENUM('in_flight','done') DEFAULT 'in_flight',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_conversion_queues (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  planet_id    INT NOT NULL,
  player_id    INT NOT NULL,
  building_key VARCHAR(64) NOT NULL,
  recipe_index INT NOT NULL,
  ends_at      DATETIME NOT NULL,
  remaining    INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Phase 2: Communication ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hs_system_contacts (
  player_id    INT NOT NULL,
  system_id    INT NOT NULL REFERENCES hs_star_systems(id),
  scan_state   ENUM('unscanned','scanning','scanned') DEFAULT 'unscanned',
  scan_ends_at DATETIME NULL,
  PRIMARY KEY (player_id, system_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hs_comm_log (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  player_id      INT NOT NULL,
  system_id      INT NOT NULL REFERENCES hs_star_systems(id),
  direction      ENUM('sent','received') NOT NULL,
  message_key    VARCHAR(64) NOT NULL,
  travel_ends_at DATETIME NULL,
  sent_msg_id    INT NULL REFERENCES hs_comm_log(id),
  from_player_id INT NULL REFERENCES hs_players(id),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Rate limiting ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hs_rate_limits (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  ip           VARCHAR(45) NOT NULL,
  endpoint     VARCHAR(64) NOT NULL,
  hits         INT DEFAULT 1,
  window_start DATETIME NOT NULL,
  INDEX idx_ip_endpoint (ip, endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Galaxy seed (leer — Systeme wachsen dynamisch bei Registrierung) ──────────

INSERT INTO hs_galaxies (id, name) VALUES (1, 'Hawk-Star');
