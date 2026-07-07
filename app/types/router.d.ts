// types/router.d.ts
// Le enseña a TypeScript que definePageMeta({ permiso: ... }) es válido.

import type { PermisoRequerido } from '~/middleware/permission'

declare module '#app' {
  interface PageMeta {
    permiso?: PermisoRequerido
  }
}

export {}
