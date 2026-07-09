# Integrakin CRM

CRM interno para Integrakin SpA — Nuxt 4 + Supabase + Vercel.

📄 **Documentación completa del proyecto (arquitectura, permisos, gotchas,
roadmap):** [`docs/CONTEXTO_PROYECTO.md`](./docs/CONTEXTO_PROYECTO.md)

## Setup

```bash
npm install --legacy-peer-deps
```

Crear `.env` con las credenciales de Supabase (ver `@nuxtjs/supabase` en
`nuxt.config.ts`).

## Desarrollo

```bash
npm run dev
```

Si agregás componentes o composables nuevos y no aparecen:
```bash
rm -rf .nuxt && npm run dev
```

## Producción

Desplegado en Vercel, deploy automático desde `master`.
