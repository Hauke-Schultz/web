# Web Project

A modern full-stack web project built with **Nuxt 4 (Vue 3 + Vite + SSR)** on the frontend and **PHP 8.2 + MySQL 8.0** on the backend, with multilingual support (DE / EN) and accessible dark/light mode.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [Nuxt 4](https://nuxt.com/) | SSR framework (Vue 3 + Vite) |
| Vue 3 | UI component framework |
| Vite | Build tool & dev server |
| Tailwind CSS 4 | Utility-first styling |
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
├── frontend/                        # Nuxt 4 application
│   ├── app/
│   │   ├── assets/styles/
│   │   │   └── main.css             # Global CSS + design tokens
│   │   ├── components/
│   │   │   ├── AppHeader.vue        # Navigation + language switcher + theme toggle
│   │   │   ├── LanguageSwitcher.vue
│   │   │   ├── ThemeToggle.vue
│   │   │   └── party/               # Party-page components (LevelUp game, Confetti, …)
│   │   ├── composables/
│   │   │   └── useTheme.ts
│   │   ├── pages/
│   │   │   ├── index.vue            # Homepage
│   │   │   ├── party/               # Party invitation page
│   │   │   ├── party-admin.vue      # Admin dashboard (RSVP + Highscores)
│   │   │   ├── hawk-star/           # Hawk-Star page
│   │   │   └── hawk-fruit/          # Hawk-Fruit page
│   │   └── i18n/
│   │       ├── de.json              # German translations
│   │       └── en.json              # English translations
│   ├── nuxt.config.ts               # Nuxt config (SSR, i18n, devProxy → PHP)
│   └── package.json
│
├── api/                             # PHP backend
│   ├── db.php                       # PDO database helper
│   ├── rsvp.php                     # GET / POST / DELETE  /api/rsvp
│   ├── highscores.php               # GET / POST / PUT / DELETE  /api/highscores
│   └── .htaccess                    # Extension-less URLs + CORS headers
│
├── docker/
│   ├── php/
│   │   ├── Dockerfile               # PHP 8.2-apache + pdo_mysql
│   │   └── apache.conf              # VirtualHost + CORS für localhost:3000
│   └── mysql/
│       └── init/                    # SQL-Dateien, die beim ersten Start ausgeführt werden
│
├── docker-compose.yml               # PHP (8000) · MySQL (3306) · phpMyAdmin (8080)
├── .env                             # Lokale Secrets – NICHT in git
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (für lokales Backend)

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
npm run generate    # Statischer Build → frontend/.output/public/
```

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

| Method   | Endpoint             | Beschreibung                      |
|----------|----------------------|-----------------------------------|
| GET      | `/api/rsvp`          | Alle RSVPs laden (Admin)          |
| GET      | `/api/rsvp?guestId=` | RSVP eines Gastes laden           |
| POST     | `/api/rsvp`          | RSVP erstellen / aktualisieren    |
| DELETE   | `/api/rsvp?guestId=` | RSVP löschen                      |
| GET      | `/api/highscores`    | Highscore-Liste laden             |
| POST     | `/api/highscores`    | Highscore speichern               |
| PUT      | `/api/highscores`    | Highscore bearbeiten (Admin)      |
| DELETE   | `/api/highscores?playerId=` | Highscore löschen (Admin) |

---

## Global Styles & Theming

`frontend/app/assets/styles/main.css` definiert alle Design-Tokens als CSS Custom Properties.

### Light / Dark Mode

- **Automatisch**: respektiert `prefers-color-scheme` (OS-Einstellung)
- **Manuell**: Toggle-Button speichert Auswahl in `localStorage`
- Kein FOUC dank Inline-Script im `<head>` (wird in `nuxt.config.ts` gesetzt)

---

## Multilingual (i18n)

Powered by [`@nuxtjs/i18n`](https://i18n.nuxtjs.org/).

| Code | Sprache  | Standard |
|------|----------|----------|
| `de` | Deutsch  | ja       |
| `en` | English  | nein     |

### URL-Struktur

```
/          → Deutsche Homepage
/en        → Englische Homepage
/party     → Party-Einladung (DE)
/en/party  → Party invitation (EN)
```

---

## License

MIT
