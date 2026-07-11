export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/google-fonts',
    '@nuxtjs/supabase',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vercel/analytics',
    '@vercel/speed-insights',
    'nuxt-charts',
    'nuxt-clarity-analytics'
  ],
  eslint: {
    checker: false
  }
})