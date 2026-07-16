# Responsive Fase 1: Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sidebar y topbar de `app/layouts/default.vue` responsive — drawer superpuesto debajo de `lg` (1024px), comportamiento actual sin cambios en `lg` y para arriba.

**Architecture:** Un solo archivo (`app/layouts/default.vue`). Estado `mobileMenuAbierto` + clases Tailwind responsive (`lg:`) sobre el `<aside>` existente, backdrop nuevo, botón hamburguesa nuevo en el `<header>`. Sin componentes nuevos, sin cambios a `NavLink.vue`/`GlobalSearch.vue`/`NotificationBell.vue`/`UserMenu.vue`.

**Tech Stack:** Nuxt 4 / Vue 3 / TypeScript, Tailwind.

## Global Constraints

- Solo `app/layouts/default.vue` — nada de tablas/Kanban/formularios (spec, "Fuera de alcance").
- Sin gesto de swipe, solo botón + backdrop + cierre al navegar.
- Sin suite de tests automatizada — verificación manual, la hace el usuario.

---

### Task 1: Sidebar responsive con drawer + botón hamburguesa

**Files:**
- Modify: `app/layouts/default.vue`

**Interfaces:** Ninguna consumida/producida fuera de este archivo.

- [ ] **Step 1: Agregar estado `mobileMenuAbierto` y cerrarlo al navegar**

Ubicar el bloque de `const route = useRoute()` y demás refs al tope del `<script setup>` (líneas 5-8 actuales) y agregar:

```ts
const mobileMenuAbierto = ref(false)

watch(() => route.path, () => {
  mobileMenuAbierto.value = false
})
```

- [ ] **Step 2: Convertir el `<aside>` en drawer responsive**

Reemplazar:

```html
<aside class="w-64 bg-surface border-r border-border flex flex-col shrink-0">
```

por:

```html
<aside
  class="fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 lg:shrink-0"
  :class="mobileMenuAbierto ? 'translate-x-0' : '-translate-x-full'"
>
```

No tocar nada del contenido interno del `<aside>` (logo, `<nav>`, links) — solo la clase del tag de apertura.

- [ ] **Step 3: Agregar el backdrop**

Justo antes de la etiqueta `<aside` (o inmediatamente después de su cierre `</aside>` — cualquiera de las dos posiciones funciona porque ambos son `fixed`), agregar:

```html
<div
  v-if="mobileMenuAbierto"
  class="fixed inset-0 bg-black/50 z-30 lg:hidden"
  @click="mobileMenuAbierto = false"
/>
```

- [ ] **Step 4: Agregar el botón hamburguesa y ajustar el `<header>`**

Reemplazar:

```html
<header class="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
  <div class="flex-1 max-w-md">
    <SharedGlobalSearch />
  </div>

  <div class="flex items-center gap-3">
    <SharedNotificationBell />
    <SharedUserMenu />
  </div>
</header>
```

por:

```html
<header class="h-16 bg-surface border-b border-border flex items-center gap-3 px-4 sm:px-6 shrink-0">
  <button
    type="button"
    class="lg:hidden text-ink-secondary hover:text-ink p-2 -ml-2"
    @click="mobileMenuAbierto = true"
  >
    <Icon name="mdi:menu" class="w-6 h-6" />
  </button>

  <div class="flex-1 min-w-0 max-w-md">
    <SharedGlobalSearch />
  </div>

  <div class="flex items-center gap-3 shrink-0">
    <SharedNotificationBell />
    <SharedUserMenu />
  </div>
</header>
```

- [ ] **Step 5: Build de verificación**

```bash
rm -rf .nuxt .output && npm run build 2>&1 | tail -20
```

Expected: `✨ Build complete!`.

- [ ] **Step 6: Levantar dev server y verificar en el navegador (lo hace el usuario)**

```bash
rm -rf .nuxt && npm run dev
```

Seguir los 6 pasos de "Testing (manual)" de la spec
(`docs/superpowers/specs/2026-07-16-responsive-shell-design.md`):
angostar ventana, abrir/cerrar drawer con botón y backdrop, navegar
cierra el drawer, ensanchar a ≥1024px vuelve al comportamiento actual,
topbar no se solapa en mobile.

- [ ] **Step 7: Commit**

```bash
git add app/layouts/default.vue
git commit -m "feat: sidebar responsive con drawer en mobile"
```
