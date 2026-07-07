// scripts/seed-usuarios.mjs
//
// Crea (invita por email) a los 9 usuarios iniciales y les asigna su rol.
// Se corre UNA vez, manualmente: node scripts/seed-usuarios.mjs
//
// Este script vive FUERA de Nuxt (es un script node suelto), así que no lee
// el .env automáticamente como sí lo hace el server de Nuxt. Dos opciones:
//   a) node --env-file=.env scripts/seed-usuarios.mjs   (Node 20.6+)
//   b) npm install dotenv, y descomentar la línea de abajo
//
// Requiere en el .env (o exportadas a mano en la terminal):
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=...   (la service_role, NO la anon)

// import 'dotenv/config' // <- descomenta esta línea si usas la opción (b)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Reemplazar email y full_name reales antes de correr.
// role debe coincidir exactamente con el `name` en la tabla roles.
const USUARIOS = [
  { email: 'duena@integrakin.cl', full_name: 'Nombre Dueña', role: 'dueña' },
  { email: 'finanzas@integrakin.cl', full_name: 'Nombre Finanzas', role: 'finanzas' },
  { email: 'postventa@integrakin.cl', full_name: 'Nombre Post Venta', role: 'post_venta' },
  { email: 'ventas1@integrakin.cl', full_name: 'Nombre Ventas 1', role: 'ventas' },
  { email: 'ventas2@integrakin.cl', full_name: 'Nombre Ventas 2', role: 'ventas' },
  { email: 'marketing@integrakin.cl', full_name: 'Nombre Marketing', role: 'marketing' },
  { email: 'tecnico@integrakin.cl', full_name: 'Nombre Servicio Técnico', role: 'servicio_tecnico' },
  { email: 'logistica@integrakin.cl', full_name: 'Nombre Logística', role: 'logistica' },
  { email: 'operaciones@integrakin.cl', full_name: 'Nombre Operaciones', role: 'operaciones' },
]

async function main() {
  const { data: roles, error: errRoles } = await supabase.from('roles').select('id, name')
  if (errRoles) throw errRoles
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]))

  for (const u of USUARIOS) {
    const roleId = roleMap[u.role]
    if (!roleId) {
      console.error(`Rol "${u.role}" no existe en la tabla roles, se salta ${u.email}`)
      continue
    }

    const { data: invitado, error: errInvite } = await supabase.auth.admin.inviteUserByEmail(
      u.email,
      { data: { full_name: u.full_name } }
    )

    if (errInvite) {
      console.error(`Error invitando a ${u.email}:`, errInvite.message)
      continue
    }

    // El trigger ya creó el profile - acá solo actualizamos el role_id
    const { error: errUpdate } = await supabase
      .from('profiles')
      .update({ role_id: roleId, full_name: u.full_name })
      .eq('id', invitado.user.id)

    if (errUpdate) {
      console.error(`Error asignando rol a ${u.email}:`, errUpdate.message)
    } else {
      console.log(`OK: ${u.email} invitado con rol "${u.role}"`)
    }
  }
}

main().catch(console.error)
