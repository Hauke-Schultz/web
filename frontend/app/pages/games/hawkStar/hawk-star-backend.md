# Hawk-Star — Backend & Multiplayer

Stack: **PHP + MySQL 8** (Docker local, Strato prod).
URL-Prefix: `/api/star/` — getrennt von allen anderen Games.
Alle Shared Functions in `api/star/bootstrap.php`, alle Spielkonfiguration in `api/star/config.php`.

---

## Dateistruktur

```
api/star/
  bootstrap.php          ← ok(), fail(), auth(), init_planet(), resolve_*(), compute_resources()
  config.php             ← BUILDINGS, RESOURCES, UNIT_COSTS, GLOBAL_BUILDINGS, building_def(), level_def(), create_player_system()
  jwt.php                ← jwt_sign(), jwt_verify() — minimales HS256 ohne Composer
  auth/
    register.php         ← POST   /api/star/auth/register
    login.php            ← POST   /api/star/auth/login
    logout.php           ← POST   /api/star/auth/logout
    me.php               ← GET    /api/star/auth/me
    profile.php          ← POST   /api/star/auth/profile  (portrait, username, disposition)
    delete.php           ← DELETE /api/star/auth/delete   (löscht den eigenen Account + alle Spielerdaten)
  galaxy/
    index.php            ← GET  /api/star/galaxy
  game/
    state.php            ← GET  /api/star/game/state?planet_id=X
    build.php            ← POST /api/star/game/build
    research.php         ← POST /api/star/game/research
    convert.php          ← POST /api/star/game/convert
    missions.php         ← GET  /api/star/game/missions
    unit/
      build.php          ← POST /api/star/game/unit/build
    mission/
      drone.php          ← POST /api/star/game/mission/drone
      colony.php         ← POST /api/star/game/mission/colony
  dev/
    cheat.php            ← POST /api/star/dev/cheat  (complete_buildings, max_resources, …)

docker/mysql/init/
  002_hawk_star_schema.sql   ← alle hs_* Tabellen + Galaxy-Seed
```

---

## Authentifizierung

JWT-Token (HS256, kein Composer), Secret aus `.env` → `JWT_SECRET=...`.
Token-Lebensdauer: 7 Tage. Jede gespeicherte Session in `hs_sessions`.

```
POST /api/star/auth/register   { username, email, password, portrait?, disposition? }
  → { token, player, homePlanetId }

POST /api/star/auth/login      { email, password }
  → { token, player, homePlanetId }

POST /api/star/auth/logout
GET  /api/star/auth/me
  → { player, homePlanetId }
```

Alle anderen Endpoints: `Authorization: Bearer <token>` erforderlich.

---

## Ressourcenberechnung — Lazy, Event-Driven

**Kein Polling. Kein Cron.**

Ressourcen werden nur berechnet wenn der Spieler eine Aktion ausführt oder die Seite lädt. Der Server berechnet das Delta seit der letzten Berechnung:

> stored + (production_rate × seconds_elapsed)

- Jeder Planet hat `resources_computed_at` in `hs_planet_resources`
- `compute_resources()` läuft am Anfang jedes Write-Requests + auf `GET /game/state`
- Energiebilanz: wenn `sum(production_energy) - sum(energyDrain) < 0` → alle Produktionen stoppen
- Storage-Caps aus `storageCapacity` der Gebäude
- Max. 24h Offline-Cap

### Timer-Resolution

`resolve_timers()` läuft ebenfalls bei jedem `GET /game/state` (vor dem Laden):
- `resolve_buildings()` — fertige Gebäude → level+1, build_ends_at=NULL, Slot-Unlocks, popBonus
- `resolve_global_research()` — fertige Forschungen → level+1
- `resolve_missions()` — colony_ship → Planet-Ownership anlegen + init_planet(); beide Typen → status='done'
- `resolve_conversions()` — Output liefern, Queue weiterschieben oder löschen

---

## Dynamische Galaxie

**Die Galaxie wächst mit jedem neuen Spieler.** Kein Fixed Seed.

Bei jeder Registrierung erstellt `create_player_system()`:
- Wählt einen unbenutzten Namen aus einem 40-Namen-Pool
- Wählt eine Position mit ≥ 15 Units Abstand zu bestehenden Systemen
- Zufälliger Star Class (G / K / M / F)
- 4 bewohnbare Planeten (terrestrial, volcanic, frozen, ocean, gemischt) + 2–3 unbewohnbare
- Gibt `['systemId' => int, 'planetId' => int]` zurück (Home Planet = zufälliger bewohnbarer Planet)

Nur echte Spieler — keine NPCs.

---

## Datenbankschema

Alle Tabellen haben das Präfix `hs_`. Vollständige Definition in `docker/mysql/init/002_hawk_star_schema.sql`.

```sql
-- ── Shared world ──────────────────────────────────────────────────────────────

hs_galaxies (id, name, created_at)
  -- Seed: INSERT INTO hs_galaxies (id, name) VALUES (1, 'Hawk-Star')

hs_star_systems (id, galaxy_id, name, x FLOAT, y FLOAT, star_class CHAR(1))

hs_planets (id, system_id, name, type ENUM('terrestrial','volcanic','frozen','ocean','uninhabitable'))

-- (Vorbereitet für spätere NPC-Fraktionen — aktuell leer)
hs_npc_factions (id, system_id, name, portrait, disposition ENUM('friendly','neutral','hostile'))
hs_npc_planet_ownership (planet_id PK, faction_id)


-- ── Per-player state ──────────────────────────────────────────────────────────

hs_players (id, username UNIQUE, email UNIQUE, password_hash, portrait, disposition, created_at, last_seen_at)

hs_sessions (id, player_id, token_hash, expires_at, created_at)

hs_planet_ownership (
  id, planet_id, player_id,
  is_home TINYINT(1),
  colonized_at,
  UNIQUE (planet_id)        -- ein Besitzer pro Planet
)

hs_planet_resources (
  planet_id, player_id,            -- PK
  metal, crystal, population,
  alloy, obsidian, cryo, biomass,  -- planetenspezifische Rohstoffe
  duraplate, plasma_core, superconductor, vital_gel, power_cell,
  resources_computed_at DATETIME
)
  -- Hinweis: die Agriculture-Reste wurden am 2026-08-07 vollständig entfernt —
  --   die Spalten food/red_seed/green_seed/blue_seed/white_seed/xenopilz und
  --   die Tabelle hs_agriculture.

hs_planet_slots (planet_id, player_id, slot_index, unlocked TINYINT(1))
  -- 12 Slots pro Planet, Slot 5 startet freigeschaltet

hs_buildings (planet_id, player_id, building_key, level INT, build_ends_at DATETIME NULL)
  -- level=0 + build_ends_at = gerade im Bau (Level 1)
  -- level>0 + build_ends_at NULL = fertig

hs_global_research (player_id, building_key, level, build_ends_at DATETIME NULL)
  -- Keys: 'star_map', 'interstellar_comm'

hs_units (
  planet_id, player_id, unit_key,
  quantity INT,                -- fertige Einheiten im Dock
  build_ends_at DATETIME NULL, -- läuft gerade eine Produktion?
  build_started_at DATETIME NULL
)
  -- Keys: 'recon_drone', 'colony_ship' (Einheiten-Keys, NICHT die Gebäude-Keys —
  --   die Produktionsanlagen heißen 'drone_hangar' und 'shipyard')
  -- resolve_units() bucht fertige Builds nach quantity; Missionen ziehen per consume_unit() ab

hs_missions (
  id, player_id,
  type ENUM('recon_drone','colony_ship'),
  from_planet_id, to_planet_id,
  ends_at DATETIME,
  status ENUM('in_flight','done')
)

hs_conversion_queues (
  id, planet_id, player_id,
  building_key, recipe_index INT,
  ends_at DATETIME,
  remaining INT     -- verbleibende Batches nach dem laufenden
)

-- ── Phase 2: Communication ─────────────────────────────────────────────────────

hs_system_contacts (player_id, system_id, scan_state ENUM('unscanned','scanning','scanned'), scan_ends_at)
hs_comm_log (id, player_id, system_id, direction ENUM('sent','received'), message_key, travel_ends_at, sent_msg_id, from_player_id, created_at)

-- ── Rate limiting ──────────────────────────────────────────────────────────────

hs_rate_limits (id, ip VARCHAR(45), endpoint VARCHAR(64), hits INT, window_start DATETIME)
  -- Login: 10 hits / 15 min · Register: 5 hits / 1 h · check_rate_limit() in bootstrap.php
```

---

## REST API (Phase 1 — implementiert)

```
-- Auth
POST   /api/star/auth/register  { username, email, password, portrait?, disposition? }
POST   /api/star/auth/login     { email, password }
POST   /api/star/auth/logout
GET    /api/star/auth/me
POST   /api/star/auth/profile   { portrait?, username?, disposition? }  → { player }
DELETE /api/star/auth/delete    — löscht Account + alle Spielerdaten

-- Game State (Seitenaufruf + nach jeder Aktion)
GET  /api/star/game/state?planet_id=X
  → { planet, resources, buildings, globalResearch, slots, missions, conversionQueues }
  (Führt resolve_timers() + compute_resources() aus bevor State geladen wird)

-- Gebäude (planetenspezifisch)
POST /api/star/game/build      { planetId, buildingKey }
  → { buildingKey, endsAt }

-- Globale Forschung (star_map, interstellar_comm)
POST /api/star/game/research   { buildingKey }
  → { buildingKey, endsAt }

-- Konvertierungen
POST /api/star/game/convert    { planetId, buildingKey, recipeIndex, count }
  → { endsAt, count, totalDuration }

-- Einheiten bauen (Dock-Inventar)
POST /api/star/game/unit/build { planetId, unitKey }   -- 'recon_drone' | 'colony_ship'
  → { unitKey, endsAt, buildStartedAt, crew }
  (zieht UNIT_COSTS ab; fertige Einheit landet in hs_units.quantity)
  (prüft die Produktionsanlage über UNIT_COSTS[unit].facility — 'drone_hangar'
   bzw. 'shipyard'; eine Anlage bedient jeweils eine ganze Einheitenklasse)
  (colony_ship: braucht 6 freie Arbeiter (free_workers), die sofort von der
   Bevölkerung abgezogen werden — neue Kolonie startet mit COLONY_START_POP=6
   und leerem Recruit-Pool)

-- Missionen (verbrauchen je 1 fertige Einheit aus dem Dock, kosten keine Ressourcen)
POST /api/star/game/mission/drone   { fromPlanetId, toPlanetId }
  → { missionId, endsAt }
POST /api/star/game/mission/colony  { fromPlanetId, toPlanetId }
  → { missionId, endsAt }
GET  /api/star/game/missions
  → [{ id, type, fromPlanetId, toPlanetId, endsAt }]

-- Galaxie
GET  /api/star/galaxy
  → [{ id, name, x, y, starClass, factions[], planets[{id, name, type, owner}] }]
```

---

## Phase-Übersicht

| Phase | Inhalt                                                                                                    | Status |
|-------|-----------------------------------------------------------------------------------------------------------|--------|
| **1** | Auth, Galaxie, Gebäude, Ressourcen, Forschung, Missionen, Konvertierung                                   | ✅ **Implementiert** |
| **1b** | Auth-Modal (Login-Default, Remember-Me), API-Wrapper, initFromApi, Write-Actions, Apache-Fix, HsDockPanel | ✅ **Implementiert** |
| **1c** | LocalStorage-Save entfernen, API als alleinige Source of Truth; `auth/profile`, `auth/delete`             | ✅ **Implementiert** |
| **2** | Scanning (`hs_system_contacts`), Player-Komm (`hs_comm_log`), server-seitig                               | ✅ **Implementiert** |
| **2b** | Agriculture-Tile — Slot 7 frei für neues Konzept                                                | ⬜ Offen |
| **3** | Spieler-Interaktion (Trade, Player-Messaging)                                                             | ⬜ Offen |
| **4** | Espionage — Recon in fremden Systemen, Intel-DB                                                           | ⬜ Offen |
| **5** | Kampf — Kriegsschiffe, stat-basierter Combat                                                              | ⬜ Offen |

---

## Phase 2 — Scanning & Player Communication ✅

```
POST /api/star/galaxy/scan      { systemId }   → { systemId, scanEndsAt }  (409 wenn Scan läuft)
GET  /api/star/galaxy/contacts  → {
                                    contacts: { [systemId]: { scanState, scanEndsAt, mutualScan } },
                                    theyScannedMe: systemId[]   ← Systeme, deren Bewohner uns schon gescannt haben (aber wir nicht sie)
                                  }
POST /api/star/comm/send        { systemId, messageKeys: string[] }  → { messageId, travelEndsAt }
GET  /api/star/comm/log         → alle comm_log-Einträge des Spielers
```

**`mutualScan`** — `true`, wenn der Inhaber des gescannten Systems uns (das Home-System des Scannenden) ebenfalls gescannt hat. Wird in der Galaxy Map verwendet um gegenseitige Kontakte zu kennzeichnen.

**`theyScannedMe`** — Liste von System-IDs, deren Bewohner unser Home-System bereits gescannt haben, auch wenn wir sie noch nicht zurückgescannt haben. Damit kann das Frontend dem Spieler zeigen, dass er "beobachtet" wird.

### Scan-Mechanik

- Gate: `star_map >= 3`, nur ein Scan gleichzeitig
- Dauer: `max(7200, dist × 180)` Sekunden (dist = euklidische Distanz auf dem 0–100-Grid)
- `resolve_system_contacts()` läuft vor jedem `GET /galaxy/contacts`

### Komm-Mechanik

- Gate: `interstellar_comm >= 1` für Send; System muss `scanned` sein
- Travel-Time: `max(10, dist × (icLevel >= 2 ? 0.5 : 1))` Sekunden
- Delivery: lazy — `resolve_comm_deliveries()` läuft beim `GET /comm/log` des Empfängers
  - Findet `sent`-Einträge anderer Spieler, deren Zielsystem Planeten des Empfängers enthält
  - Erstellt `received`-Einträge mit `sent_msg_id`-Rücklink (verhindert Doppel-Delivery)
  - Sender-System wird aus `hs_planet_ownership WHERE is_home=1` des Senders ermittelt

### Initialisierung bei Registrierung

`init_system_contacts($db, $playerId, $homeSystemId)` wird in `register.php` aufgerufen → schreibt das Home-System sofort als `scanned` in `hs_system_contacts`.

---

## Phase 3 — Spieler-Interaktion

- Spieler-zu-Spieler-Messaging (extend `hs_comm_log` oder neues `hs_messages`)
- Frachter-Trade: Ressourcen zwischen eigenen Planeten transferieren
  - Ein Frachter pro Planet; fliegt zwischen eigenen Kolonien
  - Später: Trade-Angebote zwischen Spielern

---

## Phase 4 — Espionage

- Recon Drones in **fremden** Systemen enthüllen Planet-Ownership + Gebäude-Level-Ranges
- Ergebnisse pro Spieler gespeichert — was du gescoutet hast, ist dein Intel (wird stale)

```sql
hs_intel (
  id, player_id, planet_id,
  scouted_at DATETIME,
  data JSON    -- building ranges, owner, etc.
)
```

---

## Phase 5 — Combat

Ein Kriegsschiff pro Planet (kein Fleet-Konzept). Stat-basierter Combat.

```sql
hs_warships (id, player_id, planet_id, hull, shield, speed, status ENUM('hangar','in_flight','returning'))
hs_combat_logs (id, attacker_id, defender_id, planet_id, attacker_won, result JSON, fought_at)
```

**Attack Flow:**
1. Spieler klickt "Attack" auf feindlichen Planeten → `POST /game/warship/attack { fromPlanetId, toPlanetId }`
2. Server setzt Kriegsschiff auf `in_flight`, berechnet `arrives_at`
3. On Arrival: Combat-Resolution (hull × 0.6 Basis-Schaden, reduziert durch Planet-Defenses)
4. Ergebnis in `hs_combat_logs`, Kriegsschiff → `returning`
5. Nach Rückflug: Kriegsschiff zurück im `hangar` — beschädigter Hull bleibt (kein Destroy in Phase 5)

---

## Deployment (Strato Shared Hosting)

**Live: https://haukeschultz.com/games/hawk-star/** — PHP 8.3, MySQL, Apache + mod_rewrite.

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

**Hinweise:**
- PHP läuft als CGI/FPM — kein `php_flag` in `.htaccess`, für `display_errors` stattdessen `.user.ini` verwenden
- `api/.htaccess` nie überschreiben (Authorization-Header-Fix + CORS drin)
- Neue DB-Tabellen per phpMyAdmin aus `002_hawk_star_schema.sql` importieren
- `api/star/dev/` (cheat.php) nie hochladen
