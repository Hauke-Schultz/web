# Web Project

A full-stack web project built with **Nuxt 4 (Vue 3 + Vite, SPA-Modus)** on the frontend and **PHP 8.2 + MySQL 8.0** on the backend, mit mehrsprachiger Unterstützung (DE / EN), Dark/Light Mode und PWA-Support.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [Nuxt 4](https://nuxt.com/) | SPA-Framework (Vue 3 + Vite, SSR disabled) |
| Vue 3 | UI component framework |
| Vite | Build tool & dev server |
| Tailwind CSS 4 | Utility-first styling |
| Matter.js | Physics engine (Games) |
| @nuxtjs/i18n | Multilingual routing (DE / EN) |
| CSS Custom Properties | Global theming (dark / light mode) |

### Backend
| Technology | Purpose |
|---|---|
| PHP 8.2 | REST API endpoints |
| MySQL 8.0 | Database (live: Strato Shared Hosting) |
| Apache | Web server (PHP via mod_php) |

### Local Development
| Tool | Purpose |
|---|---|
| Docker Desktop | Container runtime |
| docker compose | Orchestrates PHP + MySQL + phpMyAdmin |
| phpMyAdmin | Database GUI (http://localhost:8080) |

---

## Project Structure

```
/
├── frontend/                        # Nuxt 4 SPA
│   ├── app/
│   │   ├── assets/styles/
│   │   │   └── main.css             # Global CSS + design tokens
│   │   ├── components/
│   │   │   ├── AppHeader.vue        # Navigation + language switcher + theme toggle
│   │   │   ├── LanguageSwitcher.vue
│   │   │   ├── ThemeToggle.vue
│   │   │   └── party/               # Party-page components (LevelUp, Confetti, …)
│   │   ├── composables/
│   │   │   └── useTheme.ts
│   │   ├── pages/
│   │   │   ├── index.vue            # Homepage
│   │   │   ├── party/               # Party-Einladungsseite
│   │   │   ├── party-admin.vue      # Admin-Dashboard (RSVP + Highscores)
│   │   │   └── games/               # Spieleplattform
│   │   │       ├── index.vue        # Games-Hub / Menü
│   │   │       ├── profile/         # Spielerprofil
│   │   │       ├── shop/            # In-Game Shop
│   │   │       ├── hawkCoin/        # Hawk Coin (Coin-Trading)
│   │   │       ├── hawkDoubleUp/    # Hawk Double Up (Betting)
│   │   │       ├── hawkFruit/       # Hawk Fruit (Suika-Style Physik-Puzzle)
│   │   │       ├── hawkStar/        # Hawk Star (Space Strategy)
│   │   │       └── hawkTower/       # Hawk Tower (Tower Builder)
│   │   └── i18n/
│   │       ├── de.json              # Deutsche Übersetzungen
│   │       └── en.json              # Englische Übersetzungen
│   ├── public/
│   │   ├── sw.js                    # Service Worker (PWA, auto-versioniert per Build)
│   │   ├── site.webmanifest         # PWA Manifest
│   │   └── .htaccess                # SPA-Routing + Cache-Control + Kompression
│   ├── scripts/
│   │   └── bump-sw.mjs              # SW-Version vor jedem Build automatisch updaten
│   ├── nuxt.config.ts               # Nuxt-Config (SPA, i18n, devProxy → PHP)
│   └── package.json
│
├── api/                             # PHP Backend
│   ├── db.php                       # PDO Database Helper
│   ├── db.config.php                # Datenbank-Konfiguration
│   ├── rsvp.php                     # GET / POST / DELETE  /api/rsvp
│   ├── highscores.php               # GET / POST / PUT / DELETE  /api/highscores
│   └── .htaccess                    # Extension-less URLs + CORS Headers
│
├── docker/
│   ├── php/
│   │   ├── Dockerfile               # PHP 8.2-apache + pdo_mysql
│   │   └── apache.conf              # VirtualHost + CORS für localhost:3000
│   └── mysql/
│       └── init/                    # SQL-Dateien für den ersten Start
│
├── docker-compose.yml               # PHP (8000) · MySQL (3306) · phpMyAdmin (8080)
├── .env                             # Lokale Secrets – NICHT in git
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

### 1 · Backend starten (Docker)

```bash
# Einmalig: Images bauen und Container starten
docker compose up -d --build

# Danach nur noch:
docker compose up -d

# Logs anschauen
docker compose logs -f php
```

| Service    | URL                       |
|------------|---------------------------|
| PHP API    | http://localhost:8000/api |
| phpMyAdmin | http://localhost:8080     |
| MySQL      | localhost:3306            |

---

### 2 · Frontend starten

```bash
cd frontend
npm install
npm run dev         # Dev server mit HMR (http://localhost:3000)
```

Im Dev-Modus leitet Nuxt `/api/*` automatisch an `http://localhost:8000/api` weiter (konfiguriert via `nitro.devProxy` in `nuxt.config.ts`).

---

### 3 · Production Build (für FTP-Upload)

```bash
cd frontend
npm run generate    # → frontend/.output/public/
```

Vor dem Build läuft automatisch `scripts/bump-sw.mjs` und setzt die Service-Worker-Version auf den aktuellen Timestamp. Damit erkennt der Browser nach jedem Deployment den neuen SW und leert den alten Cache.

Den Inhalt von `.output/public/` + den `api/`-Ordner per FTP auf den Server laden.

---

### Environment Variables

Kopiere `.env` und passe die Werte an:

```env
# Docker / Datenbank
MYSQL_ROOT_PASSWORD=rootsecret
DB_NAME=myapp
DB_USER=appuser
DB_PASS=secret

# Nuxt
NUXT_PUBLIC_API_BASE=http://localhost:8000/api
```

Auf dem Live-Server: `NUXT_PUBLIC_API_BASE=https://haukeschultz.com/api`

---

## API Endpoints

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/rsvp` | Alle RSVPs laden (Admin) |
| GET | `/api/rsvp?guestId=` | RSVP eines Gastes laden |
| POST | `/api/rsvp` | RSVP erstellen / aktualisieren |
| DELETE | `/api/rsvp?guestId=` | RSVP löschen |
| GET | `/api/highscores` | Highscore-Liste laden |
| POST | `/api/highscores` | Highscore speichern |
| PUT | `/api/highscores` | Highscore bearbeiten (Admin) |
| DELETE | `/api/highscores?playerId=` | Highscore löschen (Admin) |

---

## PWA & Caching

Die App ist als Progressive Web App installierbar.

**Service Worker** (`public/sw.js`):
- Navigation: network-first (immer frische HTML-Shell)
- Statische Assets: stale-while-revalidate (sofort aus Cache, im Hintergrund aktualisiert)
- `/_nuxt/*`-Bundles: werden vom SW übersprungen (Nuxt Content-Hash übernimmt die Versionierung)

**Cache-Strategie** (`.htaccess`):
- `sw.js` + `site.webmanifest` → `no-cache, no-store` (immer frisch vom Server)
- `/_nuxt/*` → `immutable, max-age=1 Jahr` (Content-Hash im Dateinamen)
- Sonstige Assets → `max-age=1 Jahr` via mod_expires

---

## Global Styles & Theming

`frontend/app/assets/styles/main.css` definiert alle Design-Tokens als CSS Custom Properties.

### Light / Dark Mode

- **Standard**: Dark Mode (unabhängig von der OS-Einstellung)
- **Manuell**: Toggle-Button speichert Auswahl in `localStorage`
- Kein FOUC dank Inline-Script im `<head>` (gesetzt in `nuxt.config.ts`)

---

## Multilingual (i18n)

Powered by [`@nuxtjs/i18n`](https://i18n.nuxtjs.org/).

| Code | Sprache | Standard |
|------|---------|----------|
| `en` | English | ja |
| `de` | Deutsch | nein |

### URL-Struktur

```
/        → English Homepage (default)
/de      → Deutsche Homepage
/games   → Games platform (EN, default)
/de/games → Spieleplattform (DE)
/party   → Party invitation (EN, default)
/de/party → Party-Einladung (DE)
```

---

## License

MIT
