import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  ssr: true,

  css: ['~/assets/styles/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },


  app: {
    head: {
      link: [
        { rel: 'manifest', href: '/site.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
      ],
      meta: [
        { name: 'theme-color', content: '#4F46E5' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: "Games" },
      ],
      script: [
        {
          innerHTML: `(function(){try{var t=localStorage.getItem('theme')||((window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          tagPosition: 'head',
        },
        {
          innerHTML: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js');})}`,
          tagPosition: 'bodyClose',
        },
      ],
    },
  },

  modules: ['@nuxtjs/i18n'],

  i18n: {
    locales: [
      { code: 'de', language: 'de-DE', name: 'Deutsch', files: ['de.json', 'hawk-star/de.json'] },
      { code: 'en', language: 'en-US', name: 'English', files: ['en.json', 'hawk-star/en.json'] },
    ],
    defaultLocale: 'de',
    langDir: './',
    strategy: 'prefix_except_default',
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000/api',
    },
  },

  // Im Dev-Modus: /api/* wird an den lokalen PHP-Docker weitergeleitet
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://localhost:8000/api',
        changeOrigin: true,
      },
    },
  },
})
