export default defineNuxtConfig({
  compatibilityDate: '2024-09-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  ssr: true,
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3333',
    },
  },
  app: {
    head: {
      title: 'med.bula — Gestão de consultório',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Sistema de gestão de consultório médico',
        },
        // cor da barra do navegador no mobile / PWA
        { name: 'theme-color', content: '#e53935' },
        { name: 'apple-mobile-web-app-status-bar-style', content: '#e53935' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/favicon.png' },
        // SVG da marca pra share/preview que aceitam SVG
        { rel: 'mask-icon', href: '/logo.svg', color: '#e53935' },
      ],
    },
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.ts',
  },
})
