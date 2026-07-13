# Buscador de cliente en el formulario de Ticket — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el `<select>` de cliente en `TicketForm.vue` (hoy carga los ~1900 clientes completos) por un buscador tipo autocompletar que consulta Supabase con `ilike` a medida que el usuario escribe.

**Architecture:** Nueva función `buscarClientes` en `useClientes.ts` (consulta acotada, límite 8, mismo patrón `ilike` que `useBusquedaGlobal.ts`). Nuevo componente autocontenido `app/components/clientes/ClienteBuscador.vue` (input + dropdown, mismo patrón técnico que `GlobalSearch.vue`: debounce 300ms, mínimo 2 caracteres, cierre al click afuera). `TicketForm.vue` pasa a usarlo vía `v-model` en vez del `<select>` + `fetchClientes()`.

**Tech Stack:** Nuxt 4 / Vue 3 `<script setup>` con TypeScript, Supabase JS client (`useSupabaseClient()`), Tailwind (clases hex directas `border-gray-200` / `focus:ring-[#1075B5]/30`, mismo estilo que el resto de `app/components/clientes/` y `app/components/tickets/` — estos directorios no fueron migrados al sistema de design tokens, que hoy solo vive en `app/components/shared/`).

## Global Constraints

- Sin suite de tests automatizada en este repo (`package.json` no tiene script `test`) — la verificación de cada tarea es `npm run build` (compilación + chequeo de tipos de Nuxt) más una verificación manual descrita en cada tarea.
- Componentes/composables nuevos requieren `rm -rf .nuxt` antes de `npm run dev` para que el auto-import los detecte (hot-reload no alcanza).
- Nunca usar `git commit --no-verify` ni saltar hooks.
- Import de tipos con `import type { X } from '~/composables/useX'` (patrón ya usado en todo el repo).
- El `cliente_id` en el nuevo componente solo se fija al clickear un resultado del dropdown — nunca al tipear (ver spec, regla de integridad).

---

### Task 1: `buscarClientes` en `useClientes.ts`

**Files:**
- Modify: `app/composables/useClientes.ts:33-41` (agregar función nueva justo después de `getCliente`, antes de `createCliente`) y `app/composables/useClientes.ts:117` (agregar al objeto de retorno)

**Interfaces:**
- Consumes: `Cliente` interface ya definida en el mismo archivo (`app/composables/useClientes.ts:4-19`), `useSupabaseClient()` (auto-import global de Nuxt, ya usado en el resto del archivo).
- Produces: `buscarClientes(termino: string): Promise<Cliente[]>`, exportado desde el objeto de retorno de `useClientes()`. Tareas posteriores lo consumen como `const { buscarClientes } = useClientes()`.

- [ ] **Step 1: Agregar la función `buscarClientes`**

En `app/composables/useClientes.ts`, inmediatamente después del cierre de `getCliente` (línea 41: `  }`) y antes de `const createCliente = ...` (línea 43), agregar:

```ts
  // Búsqueda acotada para el picker de cliente (ClienteBuscador.vue) - no
  // reutiliza useBusquedaGlobal porque ese busca en paralelo sobre
  // clientes/leads/tickets con límite bajo (5), pensado para el buscador
  // global, no para un picker dedicado a clientes.
  const buscarClientes = async (termino: string): Promise<Cliente[]> => {
    const q = termino.trim().replace(/[%_]/g, (m) => `\\${m}`)
    if (q.length < 2) return []

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .or(`razon_social.ilike.%${q}%,nombre_contacto.ilike.%${q}%,rut.ilike.%${q}%`)
      .order('razon_social', { ascending: true })
      .limit(8)

    if (error) throw error
    return data as Cliente[]
  }
```

Luego, en el `return` al final del archivo (línea 117), agregar `buscarClientes` a la lista:

```ts
  return { fetchClientes, getCliente, createCliente, updateCliente, deleteCliente, importClientes, subirImagenCliente, buscarClientes }
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: termina sin errores (exit code 0). Si aparece un error de tipos en `useClientes.ts`, revisar que la función quedó dentro de `useClientes()` (antes del `return`) y que el `return` incluye `buscarClientes` sin coma de más ni de menos.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useClientes.ts
git commit -m "$(cat <<'EOF'
Agregar buscarClientes a useClientes

Búsqueda acotada (razón social/RUT/contacto, límite 8) para el picker
de cliente del formulario de ticket - ver
docs/superpowers/specs/2026-07-13-ticket-buscador-cliente-design.md
EOF
)"
```

---

### Task 2: Componente `ClienteBuscador.vue`

**Files:**
- Create: `app/components/clientes/ClienteBuscador.vue`

**Interfaces:**
- Consumes: `useClientes().buscarClientes` y `useClientes().getCliente` (Task 1 y ya existente), `Cliente` type desde `~/composables/useClientes`.
- Produces: componente Vue, auto-importado por Nuxt como `<ClientesClienteBuscador>` (convención de Nuxt: `components/clientes/ClienteBuscador.vue` → `<ClientesClienteBuscador>`). Props: `modelValue: string`. Emits: `update:modelValue: [value: string]`. Task 3 lo consume así: `<ClientesClienteBuscador v-model="form.cliente_id" />`.

- [ ] **Step 1: Crear el componente**

Crear `app/components/clientes/ClienteBuscador.vue` con este contenido completo:

```vue
<script setup lang="ts">
import type { Cliente } from '~/composables/useClientes'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { buscarClientes, getCliente } = useClientes()

const termino = ref('')
const resultados = ref<Cliente[]>([])
const cargando = ref(false)
const abierto = ref(false)
const contenedor = ref<HTMLElement | null>(null)

let debounceHandle: ReturnType<typeof setTimeout> | null = null
let sincronizando = false

function setTerminoSincronizado(valor: string) {
  if (termino.value === valor) return
  sincronizando = true
  termino.value = valor
}

onMounted(async () => {
  if (props.modelValue) {
    try {
      const cliente = await getCliente(props.modelValue)
      setTerminoSincronizado(cliente.razon_social)
    } catch {
      // el id ya no existe o no es visible por RLS - se deja el input vacío
    }
  }
  document.addEventListener('click', onClickFuera)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickFuera)
  if (debounceHandle) clearTimeout(debounceHandle)
})

watch(termino, (nuevo) => {
  if (debounceHandle) clearTimeout(debounceHandle)

  // escritura programática (prefill al montar o selección de un resultado) -
  // no dispara ni la búsqueda ni la limpieza de integridad, solo tipeo real
  if (sincronizando) {
    sincronizando = false
    return
  }

  // el usuario está editando el texto tras haber elegido un cliente -
  // el id ya no corresponde a lo que se ve en pantalla, se limpia
  if (props.modelValue) emit('update:modelValue', '')

  if (nuevo.trim().length < 2) {
    resultados.value = []
    abierto.value = nuevo.trim().length > 0
    return
  }

  cargando.value = true
  abierto.value = true
  debounceHandle = setTimeout(async () => {
    try {
      resultados.value = await buscarClientes(nuevo)
    } catch {
      resultados.value = []
    } finally {
      cargando.value = false
    }
  }, 300)
})

function elegir(cliente: Cliente) {
  setTerminoSincronizado(cliente.razon_social)
  abierto.value = false
  resultados.value = []
  emit('update:modelValue', cliente.id)
}

function onClickFuera(e: MouseEvent) {
  if (contenedor.value && !contenedor.value.contains(e.target as Node)) {
    abierto.value = false
  }
}
</script>

<template>
  <div ref="contenedor" class="relative">
    <input
      v-model="termino"
      type="text"
      placeholder="Buscar por razón social, RUT o contacto..."
      class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
      @focus="abierto = termino.trim().length > 0"
    />

    <div
      v-if="abierto"
      class="absolute mt-1 w-full bg-white border border-gray-100 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
    >
      <p v-if="termino.trim().length < 2" class="text-xs text-gray-400 px-3 py-2">
        Escribe al menos 2 caracteres...
      </p>
      <p v-else-if="cargando" class="text-xs text-gray-400 px-3 py-2">Buscando...</p>
      <p v-else-if="!resultados.length" class="text-xs text-gray-400 px-3 py-2">
        Sin resultados para "{{ termino }}"
      </p>
      <template v-else>
        <button
          v-for="c in resultados"
          :key="c.id"
          type="button"
          class="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors duration-150 flex flex-col"
          @click="elegir(c)"
        >
          <span class="text-sm font-medium text-gray-800">{{ c.razon_social }}</span>
          <span class="text-xs text-gray-400">{{ c.rut || c.nombre_contacto || '' }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
```

Nota: `v-for` y `v-else` nunca van en el mismo elemento (Vue no lo soporta de forma confiable) — el `v-for` va adentro de un `<template v-else>` que cierra la cadena `v-if/v-else-if/v-else`, mismo patrón exacto que ya usa `GlobalSearch.vue` para sus tres grupos de resultados.

Nota sobre `sincronizando`: `termino` se escribe programáticamente en dos lugares (`onMounted` al precargar, `elegir()` al elegir un resultado). Sin el flag, esas escrituras disparan igual el `watch(termino, ...)` como si el usuario hubiera tipeado — el precargado se autoborraría al instante (dispara la limpieza de integridad) y elegir un resultado reabriría el dropdown con una búsqueda nueva. `setTerminoSincronizado` marca `sincronizando = true` antes de escribir; el primer disparo del `watch` lo consume (lo vuelve a `false`) y sale sin ejecutar ni la limpieza ni la búsqueda — solo el tipeo real del usuario llega a esa lógica. (Encontrado en la revisión de Task 2, no en la primera versión de este plan — ver `.superpowers/sdd/task-2-report.md`.)

Dos ajustes más sobre el mismo guard, encontrados en una segunda ronda de revisión: (1) `setTerminoSincronizado` corta al principio si `valor` ya es igual a `termino.value` — Vue no dispara `watch` en una escritura que no cambia el valor (ej. el usuario tipeó la razón social completa y exacta, y después clickea ese mismo resultado), así que sin este corte el flag quedaba en `true` sin que nada lo resetee, y la siguiente tecla real del usuario quedaba absorbida por el guard en vez de disparar la limpieza de integridad. (2) `clearTimeout(debounceHandle)` se movió al principio del `watch`, antes del chequeo de `sincronizando` — así una búsqueda real pendiente siempre se cancela, incluso cuando la escritura que sigue resulta ser programática.

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores. Si Nuxt no reconoce `<ClientesClienteBuscador>` más adelante (Task 3), confirmar que el archivo quedó en `app/components/clientes/ClienteBuscador.vue` exactamente (mayúsculas/minúsculas del nombre de archivo importan para el auto-import).

- [ ] **Step 3: Verificación manual del componente aislado**

Run: `npm run dev`, abrir `/tickets/nuevo` en el navegador (aunque todavía use el `<select>` viejo, esto solo confirma que el dev server levanta sin errores de compilación tras crear el componente nuevo). Expected: la página carga sin errores en la consola del navegador relacionados a `ClienteBuscador`.

- [ ] **Step 4: Commit**

```bash
git add app/components/clientes/ClienteBuscador.vue
git commit -m "$(cat <<'EOF'
Agregar componente ClienteBuscador

Combobox de búsqueda de cliente (razón social/RUT/contacto), mismo
patrón técnico que GlobalSearch.vue - ver
docs/superpowers/specs/2026-07-13-ticket-buscador-cliente-design.md
EOF
)"
```

---

### Task 3: Conectar `ClienteBuscador` a `TicketForm.vue`

**Files:**
- Modify: `app/components/tickets/TicketForm.vue`

**Interfaces:**
- Consumes: `<ClientesClienteBuscador v-model="form.cliente_id" />` (Task 2).
- Produces: `TicketForm.vue` actualizado — no expone ninguna interfaz nueva a otros archivos (sus props/emits no cambian).

- [ ] **Step 1: Quitar la carga de la lista completa de clientes**

En `app/components/tickets/TicketForm.vue`, el archivo completo actual es:

```vue
<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'
import type { Cliente } from '~/composables/useClientes'

const props = defineProps<{
  modelValue?: Partial<Ticket>
  clienteIdFijo?: string
  clienteNombreFijo?: string
  cargando?: boolean
}>()
const emit = defineEmits<{ submit: [payload: Partial<Ticket>] }>()

const { fetchClientes } = useClientes()
const clientes = ref<Cliente[]>([])

onMounted(async () => {
  if (!props.clienteIdFijo) {
    clientes.value = await fetchClientes()
  }
})

const form = reactive<Partial<Ticket>>({
  cliente_id: props.modelValue?.cliente_id ?? props.clienteIdFijo ?? '',
  titulo: props.modelValue?.titulo ?? '',
  descripcion: props.modelValue?.descripcion ?? '',
  prioridad: props.modelValue?.prioridad ?? 'media',
})

const errores = reactive<Record<string, string>>({})

const validar = () => {
  errores.cliente_id = form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.titulo = form.titulo ? '' : 'El título es obligatorio'
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form })
}

const inputClase =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Cliente *</label>
      <select v-if="!clienteIdFijo" v-model="form.cliente_id" :class="inputClase">
        <option value="" disabled>Selecciona un cliente</option>
        <option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.razon_social }}</option>
      </select>
      <input
        v-else
        type="text"
        disabled
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500"
        :value="clienteNombreFijo ?? clienteIdFijo"
      />
      <p v-if="errores.cliente_id" class="text-sm text-red-600 mt-1">{{ errores.cliente_id }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Título *</label>
      <input v-model="form.titulo" type="text" :class="inputClase" />
      <p v-if="errores.titulo" class="text-sm text-red-600 mt-1">{{ errores.titulo }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Descripción</label>
      <textarea v-model="form.descripcion" rows="4" :class="inputClase"></textarea>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Prioridad</label>
      <select v-model="form.prioridad" :class="inputClase">
        <option value="baja">Baja</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
        <option value="urgente">Urgente</option>
      </select>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar ticket' }}
    </button>
  </form>
</template>
```

Reemplazar el archivo completo por:

```vue
<script setup lang="ts">
import type { Ticket } from '~/composables/useTickets'

const props = defineProps<{
  modelValue?: Partial<Ticket>
  clienteIdFijo?: string
  clienteNombreFijo?: string
  cargando?: boolean
}>()
const emit = defineEmits<{ submit: [payload: Partial<Ticket>] }>()

const form = reactive<Partial<Ticket>>({
  cliente_id: props.modelValue?.cliente_id ?? props.clienteIdFijo ?? '',
  titulo: props.modelValue?.titulo ?? '',
  descripcion: props.modelValue?.descripcion ?? '',
  prioridad: props.modelValue?.prioridad ?? 'media',
})

const errores = reactive<Record<string, string>>({})

const validar = () => {
  errores.cliente_id = form.cliente_id ? '' : 'Debes seleccionar un cliente'
  errores.titulo = form.titulo ? '' : 'El título es obligatorio'
  return !Object.values(errores).some(Boolean)
}

const onSubmit = () => {
  if (!validar()) return
  emit('submit', { ...form })
}

const inputClase =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]'
</script>

<template>
  <form class="space-y-4" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Cliente *</label>
      <ClientesClienteBuscador v-if="!clienteIdFijo" v-model="form.cliente_id" />
      <input
        v-else
        type="text"
        disabled
        class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500"
        :value="clienteNombreFijo ?? clienteIdFijo"
      />
      <p v-if="errores.cliente_id" class="text-sm text-red-600 mt-1">{{ errores.cliente_id }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Título *</label>
      <input v-model="form.titulo" type="text" :class="inputClase" />
      <p v-if="errores.titulo" class="text-sm text-red-600 mt-1">{{ errores.titulo }}</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Descripción</label>
      <textarea v-model="form.descripcion" rows="4" :class="inputClase"></textarea>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-gray-700">Prioridad</label>
      <select v-model="form.prioridad" :class="inputClase">
        <option value="baja">Baja</option>
        <option value="media">Media</option>
        <option value="alta">Alta</option>
        <option value="urgente">Urgente</option>
      </select>
    </div>

    <button
      type="submit"
      :disabled="cargando"
      class="bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {{ cargando ? 'Guardando...' : 'Guardar ticket' }}
    </button>
  </form>
</template>
```

Cambios exactos respecto al original: se quita el `import type { Cliente }`, se quita `const { fetchClientes } = useClientes()`, se quita `const clientes = ref<Cliente[]>([])`, se quita el bloque `onMounted` completo (ya no hace falta precargar nada — `ClienteBuscador` resuelve su propio estado inicial), y el `<select>` del template se reemplaza por `<ClientesClienteBuscador v-if="!clienteIdFijo" v-model="form.cliente_id" />`. Todo lo demás (título, descripción, prioridad, validación, botón) queda idéntico.

- [ ] **Step 2: Verificar que compila**

Run: `rm -rf .nuxt && npm run build`
Expected: termina sin errores. Si aparece `Property 'clientes' does not exist` o similar en algún otro archivo, revisar que ningún otro componente dependía del `ref` `clientes` que se quitó de `TicketForm.vue` (no debería, es una variable local del `<script setup>`, no una prop expuesta).

- [ ] **Step 3: Verificación manual end-to-end**

Run: `npm run dev`, iniciar sesión con un usuario que tenga permiso `tickets.create`, y verificar cada punto del plan de testing del spec (`docs/superpowers/specs/2026-07-13-ticket-buscador-cliente-design.md`, sección "Testing"):

1. `/tickets/nuevo` sin query param: el campo cliente aparece vacío; escribir ≥2 caracteres de una razón social/RUT/contacto existente trae resultados en un dropdown; clickear uno lo fija en el input y permite enviar el formulario.
2. Entrar a `/tickets/nuevo?cliente_id=<id-de-un-cliente-real>` (por ejemplo, navegando desde el detalle de un cliente y usando el botón de crear ticket): el campo sigue mostrando el input deshabilitado con el nombre fijo, sin buscador.
3. Editar un ticket existente en `/tickets/[id]`: el campo cliente debe mostrar precargada la razón social del cliente actual del ticket, sin que haga falta buscar nada.
4. Desde esa edición, buscar y elegir un cliente distinto, guardar: confirmar en `/admin/auditoria` (o releyendo el ticket) que quedó con el nuevo `cliente_id`.
5. Escribir en el input después de haber seleccionado un cliente, sin clickear ningún resultado nuevo, e intentar enviar el formulario: debe aparecer el error "Debes seleccionar un cliente" (el `cliente_id` se limpió al editar el texto).
6. Buscar un término sin coincidencias: debe verse el mensaje "Sin resultados para...", sin errores en la consola del navegador.

Si el entorno donde se ejecuta este plan no tiene forma de autenticarse contra Supabase (por ejemplo, un agente sin sesión de navegador), documentar cuáles de estos 6 puntos se pudieron verificar y pedirle al usuario que confirme el resto manualmente antes de dar la tarea por cerrada.

- [ ] **Step 4: Commit**

```bash
git add app/components/tickets/TicketForm.vue
git commit -m "$(cat <<'EOF'
Conectar ClienteBuscador al formulario de ticket

Reemplaza el <select> con todos los clientes cargados por el
combobox de búsqueda - ver
docs/superpowers/specs/2026-07-13-ticket-buscador-cliente-design.md
EOF
)"
```

---

## Cierre

Al terminar las 3 tareas, confirmar con `git log --oneline -5` que quedaron los 3 commits (más el del spec ya existente) y avisarle al usuario que confirme el push a `origin/master` (este entorno no tiene credenciales para pushear solo, ver gotcha #12 de `CONTEXTO_PROYECTO.md`).
