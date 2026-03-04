# Web Project

A modern full-stack web project built with **Nuxt 3 (Vue + Vite + SSR)** on the frontend and **Kirby CMS (PHP)** on the backend, with multilingual support (DE / EN) and accessible dark/light mode.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [Nuxt 3](https://nuxt.com/) | SSR framework (Vue 3 + Vite) |
| Vue 3 | UI component framework |
| Vite | Build tool & dev server |
| CSS Custom Properties | Global theming (dark / light mode) |

### Backend / CMS
| Technology | Purpose |
|---|---|
| [Kirby CMS](https://getkirby.com/) | Headless / hybrid CMS |
| PHP 8.2+ | Server runtime |
| SQLite / MySQL | Database for content persistence |

### Features
- Server-Side Rendering (SSR) via Nuxt 3
- Accessible dark / light mode (`prefers-color-scheme` + manual toggle)
- Multilingual: **de** (default) and **en** via Nuxt i18n
- Language switcher in navigation
- Content managed via Kirby CMS panel
- REST API / Content API bridge between Kirby and Nuxt

---

## Project Structure

```
/
├── frontend/                  # Nuxt 3 application
│   ├── assets/
│   │   └── styles/
│   │       └── style.css      # Global CSS with CSS custom properties
│   ├── components/
│   │   ├── AppHeader.vue      # Navigation + language switcher + theme toggle
│   │   └── ThemeToggle.vue    # Dark / light mode button
│   ├── composables/
│   │   └── useTheme.ts        # Theme state management
│   ├── layouts/
│   │   └── default.vue        # Base layout
│   ├── pages/
│   │   └── index.vue          # Homepage
│   ├── i18n/
│   │   ├── de.json            # German translations
│   │   └── en.json            # English translations
│   ├── nuxt.config.ts         # Nuxt configuration (SSR, i18n, modules)
│   └── package.json
│
├── backend/                   # Kirby CMS
│   ├── site/
│   │   ├── blueprints/        # Page / field definitions
│   │   ├── templates/         # PHP templates (optional, used headlessly)
│   │   └── config/
│   │       └── config.php     # Kirby config (API, languages, DB)
│   ├── content/               # Flat-file content (Kirby default)
│   ├── kirby/                 # Kirby core (via Composer)
│   ├── index.php              # Kirby entry point
│   └── composer.json
│
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- PHP >= 8.2
- Composer
- (Optional) MySQL/MariaDB — SQLite works out of the box

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev         # Dev server with HMR (http://localhost:3000)
npm run build       # Production SSR build
npm run preview     # Preview production build
```

---

### Backend Setup (Kirby CMS)

```bash
cd backend
composer install
```

Start a local PHP server:
```bash
php -S localhost:8000
```

Access the Kirby panel at: `http://localhost:8000/panel`

---

### Environment Variables

Create a `.env` file in `frontend/`:

```env
NUXT_PUBLIC_API_BASE=http://localhost:8000/api
```

---

## Global Styles & Theming

`frontend/assets/styles/style.css` defines all design tokens as CSS custom properties.

### Light / Dark Mode Strategy

- **Automatic**: respects `prefers-color-scheme` media query (OS-level setting)
- **Manual override**: user can toggle via the theme button — persisted in `localStorage`
- **Accessible**: sufficient contrast ratios (WCAG AA minimum) for both modes

```css
:root {
  /* Light mode (default) */
  --color-background: #ffffff;
  --color-surface:    #f5f5f5;
  --color-text:       #1a1a1a;
  --color-text-muted: #6b7280;
  --color-primary:    #2563eb;
  --color-border:     #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0f172a;
    --color-surface:    #1e293b;
    --color-text:       #f1f5f9;
    --color-text-muted: #94a3b8;
    --color-primary:    #60a5fa;
    --color-border:     #334155;
  }
}

[data-theme="dark"]  { /* same dark values, applied via JS toggle */ }
[data-theme="light"] { /* same light values, applied via JS toggle */ }
```

---

## Multilingual (i18n)

Powered by [`@nuxtjs/i18n`](https://i18n.nuxtjs.org/).

### Supported languages

| Code | Language | Default |
|------|----------|---------|
| `de` | Deutsch  | yes     |
| `en` | English  | no      |

### URL structure

```
/          → de homepage
/en        → en homepage
/de/...    → German pages
/en/...    → English pages
```

### Language switcher

A `<LanguageSwitcher>` component in the header renders links to the same page in each available locale using Nuxt i18n's `switchLocalePath()`.

---

## Kirby CMS — Content API

Kirby runs headlessly and exposes content via its built-in **Content Representations** or custom **API routes**.

### Kirby Languages

Kirby is configured with the same two languages (`de`, `en`) to mirror the frontend:

```php
// backend/site/config/config.php
return [
  'languages' => true,
  'api'       => ['allowInsecure' => true],
];
```

Content is created and translated directly inside the Kirby panel.

### Example API endpoint

```
GET http://localhost:8000/api/pages/home
Authorization: Basic <base64(user:pass)>
```

The Nuxt frontend fetches this data server-side using `useFetch` / `useAsyncData` for full SSR.

---

## Roadmap

- [x] Project structure definition
- [ ] Nuxt 3 project bootstrap
- [ ] Global CSS with dark/light tokens
- [ ] `ThemeToggle` component + `useTheme` composable
- [ ] Nuxt i18n setup (de / en)
- [ ] Language switcher component
- [ ] Kirby CMS installation & panel setup
- [ ] Kirby language configuration (de / en)
- [ ] Kirby → Nuxt API bridge (homepage)
- [ ] Homepage page + layout
- [ ] Deployment setup

---

## License

MIT
