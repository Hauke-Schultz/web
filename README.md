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

### Features
- Server-Side Rendering (SSR) via Nuxt 3
- Accessible dark / light mode (`prefers-color-scheme` + manual toggle)
- Multilingual: **de** (default) and **en** via Nuxt i18n
- Language switcher in navigation

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
├── backend/                   
│
└── README.md
```

---

## Getting Started

### Prerequisites

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

### Backend Setup 

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

## License

MIT
