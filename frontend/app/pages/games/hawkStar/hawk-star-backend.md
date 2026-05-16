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
    register.php         ← POST /api/star/auth/register
    login.php            ← POST /api/star/auth/login
    logout.php           ← POST /api/star/auth/logout
    me.php               ← GET  /api/star/auth/me
  galaxy/
    index.php            ← GET  /api/star/galaxy
  game/
    state.php            ← GET  /api/star/game/state?planet_id=X
    build.php            ← POST /api/star/game/build
    research.php         ← POST /api/star/game/research
    convert.php          ← POST /api/star/game/convert
    missions.php         ← GET  /api/star/game/missions
    mission/
      drone.php          ← POST /api/star/game/mission/drone
      colony.php         ← POST /api/star/game/mission/colony

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
  pure_crystal, super_alloy, quantum_shard, nano_alloy, power_cell,
  resources_computed_at DATETIME
)

hs_planet_slots (planet_id, player_id, slot_index, unlocked TINYINT(1))
  -- 12 Slots pro Planet, Slot 5 startet freigeschaltet

hs_buildings (planet_id, player_id, building_key, level INT, build_ends_at DATETIME NULL)
  -- level=0 + build_ends_at = gerade im Bau (Level 1)
  -- level>0 + build_ends_at NULL = fertig

hs_global_research (player_id, building_key, level, build_ends_at DATETIME NULL)
  -- Keys: 'star_map', 'interstellar_comm'

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
hs_comm_log (id, player_id, system_id, direction ENUM('sent','received'), message_key, travel_ends_at, reply_ends_at, created_at)
```

---

## REST API (Phase 1 — implementiert)

```
-- Auth
POST /api/star/auth/register   { username, email, password, portrait?, disposition? }
POST /api/star/auth/login      { email, password }
POST /api/star/auth/logout
GET  /api/star/auth/me

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

-- Missionen
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

| Phase | Inhalt | Status |
|-------|--------|--------|
| **1** | Auth, Galaxie, Gebäude, Ressourcen, Forschung, Missionen, Konvertierung | ✅ **Implementiert** |
| **1b** | Auth-Modal (Login-Default, Remember-Me), API-Wrapper, initFromApi, Write-Actions, Apache-Fix, HsDockPanel | ✅ **Implementiert** |
| **1c** | LocalStorage-Save entfernen, API als alleinige Source of Truth | ✅ **Implementiert** |
| **2** | Scanning (`hs_system_contacts`), Player-Komm (`hs_comm_log`), server-seitig | ✅ **Implementiert** |
| **3** | Spieler-Interaktion (Trade, Player-Messaging) | ⬜ Offen |
| **4** | Espionage — Recon in fremden Systemen, Intel-DB | ⬜ Offen |
| **5** | Kampf — Kriegsschiffe, stat-basierter Combat | ⬜ Offen |

---

## Phase 1b — Frontend-Migration

### Phase 1b — Implementiert ✅

**`useHawkStarAuth.js`** — Auth-Singleton:
- `token`, `player`, `homePlanetId`, `authError`, `authLoading`, `isAuthenticated`, `rememberMe`
- `register(username, email, password)`, `login(email, password)`, `logout()`, `verifyToken()`
- **Remember me** (Standard: `true`): Token in `localStorage['hawk-star-token']`; bei `false` nur in `sessionStorage` (Tab-Session).
- Token wird beim Start aus beiden Stores gelesen (`localStorage || sessionStorage`).

**Auth-Modal** (`index.vue`):
- Standard-Tab: **Login** (nicht Register)
- Zwei Tabs: Login (mit „Remember me"-Checkbox) / Register, Inline-Fehlermeldungen
- Nach Erfolg → `initFromApi()` → Spiel startet

**Apache-Fix — Authorization-Header:**
- `api/.htaccess`: `RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]` als erste Regel (mod_rewrite übergibt Authorization sonst nicht an PHP).
- `api/star/bootstrap.php` `auth()`: liest aus `$_SERVER['HTTP_AUTHORIZATION']` → `$_SERVER['REDIRECT_HTTP_AUTHORIZATION']` → `getallheaders()['Authorization']` (Fallback-Chain).
- Galaxy-URL hat Trailing Slash `/galaxy/` in `useHawkStarApi.js` — verhindert Apache 301-Redirect auf absolute URL, der den Auth-Header beim Browser-Follow verliert.

**`useHawkStarApi.js`** — dünner API-Wrapper:
- `fetchGalaxy`, `fetchGameState(planetId)`, `postBuild`, `postResearch`, `postConvert`, `postDroneMission`, `postColonyMission`, `getMissions`

**`useHawkStar.js`** — Write-Actions auf API umgestellt:
- `startBuild(id)` — async, `postBuild`/`postResearch`, optimistische Deduktion + Rollback
- `sendReconDrone(planetId, fromId)` — direkt `postDroneMission` (kein Inventory-Step)
- `sendColonyShip(planetId, fromId)` — direkt `postColonyMission` (kein Inventory-Step)
- `startConversion(buildingId, ri, count)` — async, `postConvert`
- `canSendDrone` / `canSendColonyShip` — prüfen Building-Level + Affordability (kein Inventory)
- `buildError` ref — Fehlerfeedback für UI
- `gameLoaded` ref — `false` bis `initFromApi()` vollständig erfolgreich. `startBuild` blockt wenn `false`.
- `initError` ref — Fehlermeldung wenn Galaxy-Load oder Game-State-Load fehlschlägt, im UI als rote Zeile + Retry-Button.
- `initFromApi()` — lädt Galaxy + Game State, setzt alle Refs, ruft `saveGame()`. Setzt `gameLoaded = true` nur bei Erfolg.

**Loading-Screen** (`index.vue`):
- `v-if="isAuthenticated && !gameLoaded"` → zeigt „Loading galaxy data…" + immer sichtbaren Reload-Button.
- Bei Fehler: `initError`-Text statt der Lademeldung, Button wird zu „Retry".
- Hintergrund: Vite HMR resettet Module-Level-Refs (`gameLoaded = false`), läuft aber kein `onMounted` neu → Reload-Button als manueller Auslöser.

**Neues Drone/Colony-Modell:**
- `recon_drone`/`colony_ship` = Gebäude (Level 1 = Unit vorhanden, kein separater Build-Schritt)
- Mission deducts `UNIT_COSTS` resources direkt
- Kein Inventory (`reconDroneInventory` wird immer 0 im API-Modus)

**`HsDockPanel`** — an neues Missions-Modell angepasst:
- Kein „Build Drone" / „Build Colony Ship"-Button mehr
- Zeigt für jede Unit: Locked / Insufficient Resources / Ready (grün)
- Aktive Missionen mit Fortschrittsbalken darunter
- Hinweis „Launch units from the System Map" wenn keine Missionen laufen

### Phase 1c — Nächster Schritt ⬜

LocalStorage-Save (`hawk-star-save`) entfernen — API ist alleinige Source of Truth:
- `saveGame()` und `loadGame()` entfernen
- Tick-Loop vereinfachen: keine lokale Ressourcenproduktion mehr (server-seitig), nur Timer-Updates für Fortschrittsbalken
- `initFromApi()` als einzigen State-Provider etablieren

### Schritt (Phase 2+): Weiterer Rollout

**Noch ausstehend:**
1. Scanning + Comm Log (Phase 2 Backend + Frontend)
2. Scan-States aus `hs_system_contacts` laden in `initFromApi`
3. Mehrere eigene Planeten laden (jetzt nur Home Planet — andere Planeten bei Bedarf laden)
4. `buildTimeFactor` für Devmode bleibt bis Prod-Release

---

## Phase 2 — Scanning & Player Communication ✅

```
POST /api/star/galaxy/scan      { systemId }   → { systemId, scanEndsAt }  (409 wenn Scan läuft)
GET  /api/star/galaxy/contacts  → { [systemId]: { scanState, scanEndsAt } }
POST /api/star/comm/send        { systemId, messageKey } → { messageId, travelEndsAt }
GET  /api/star/comm/log         → alle comm_log-Einträge des Spielers
```

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

### Neue Spalten in `hs_comm_log`

| Spalte | Typ | Bedeutung |
|--------|-----|-----------|
| `sent_msg_id` | INT NULL | Rücklink zur Original-`sent`-Zeile (nur bei `received`-Einträgen) |
| `from_player_id` | INT NULL | Sender-Spieler-ID (nur bei `received`-Einträgen) |

### Initialisierung bei Registrierung

`init_system_contacts($db, $playerId, $homeSystemId)` wird in `register.php` aufgerufen → schreibt das Home-System sofort als `scanned` in `hs_system_contacts`.

### Neue Dateien

| Datei | Endpoint |
|-------|---------|
| `api/star/galaxy/contacts.php` | `GET /api/star/galaxy/contacts` |
| `api/star/galaxy/scan.php` | `POST /api/star/galaxy/scan` |
| `api/star/comm/send.php` | `POST /api/star/comm/send` |
| `api/star/comm/log.php` | `GET /api/star/comm/log` |

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

### Voraussetzungen

| Komponente | Strato-Setup |
|------------|--------------|
| Webserver | Apache mit `mod_rewrite` |
| PHP | 7.4+ (PHP 8.1 empfohlen) |
| MySQL | 5.7 oder 8.0 — **kein** `ADD COLUMN IF NOT EXISTS` in 5.7 (separate try-catch verwenden) |

### Pre-Deployment — Pflicht

1. **JWT Secret** — `api/db.config.php` ergänzen (gitignored, manuell hochladen):
   ```php
   define('JWT_SECRET', '<starker-zufalls-string-min-32-zeichen>');
   ```
   Ohne diesen Eintrag fällt `bootstrap.php` auf `'dev-secret'` zurück — **kritisches Sicherheitsrisiko**.

2. **`api/star/dev/` nicht uploaden** — `cheat.php` u.ä. nie auf Produktionsserver.

3. **DB-Schema einrichten** — einmalig per phpMyAdmin oder SSH:
   ```
   docker/mysql/init/002_hawk_star_schema.sql
   ```
   Enthält alle `hs_*`-Tabellen + Galaxy-Seed-INSERT.

### Build & Upload

```bash
cd frontend && npm run build
# Output: frontend/.output/public/
```

| Quelle | Ziel (Strato Webroot, z.B. `/html/`) |
|--------|--------------------------------------|
| `frontend/.output/public/` | `/html/` |
| `api/` (ohne `star/dev/`) | `/html/api/` |
| `api/db.config.php` | `/html/api/db.config.php` (gitignored, manuell) |

### API-Pfade

`useHawkStarApi.js` verwendet relative Pfade (`/api/star/...`) — kein API-URL-Config nötig, funktioniert automatisch auf jedem Webroot.

### `.htaccess` — SPA Routing

Webroot-`.htaccess` für direkten URL-Aufruf (nicht überschreiben: `api/.htaccess` ist der Authorization-Header-Fix):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### Pre-Launch Checkliste

- [ ] `JWT_SECRET` in `api/db.config.php` gesetzt (stark, zufällig, min. 32 Zeichen)
- [ ] `api/star/dev/` nicht hochgeladen
- [ ] DB-Schema auf Strato importiert (`002_hawk_star_schema.sql`)
- [ ] Webroot-`.htaccess` für SPA-Routing vorhanden
- [ ] `display_errors = Off` in `.htaccess`: `php_flag display_errors Off`
- [ ] Rate Limiting auf `POST /api/star/auth/login` + `/register` erwägen
- [ ] Nach erstem Login: 401-Redirect + JWT-Ablauf (7 Tage) testen
