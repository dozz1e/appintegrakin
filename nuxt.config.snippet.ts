// nuxt.config.ts (fragmento — fusionar con tu configuración existente)
//
// @nuxtjs/supabase trae su propio sistema de redirect basado en sesión.
// Lo desactivamos (redirect: false) porque ya lo manejamos a mano en
// middleware/auth.global.ts + middleware/permission.ts, donde además
// resolvemos permisos granulares (RBAC + overrides), no solo "hay sesión o no".

export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],
  supabase: {
    redirect: false,
  },
  // Estas NO llevan prefijo "public" a propósito: runtimeConfig (sin public.)
  // solo existe en el servidor, nunca se envía al navegador. Ideal para
  // service_role key, secretos de n8n, credenciales de Kame, etc.
  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET,
    kame: {
      baseUrl: process.env.KAME_API_BASE_URL,
      user: process.env.KAME_API_USER,
      password: process.env.KAME_API_PASSWORD,
    },
  },
})
