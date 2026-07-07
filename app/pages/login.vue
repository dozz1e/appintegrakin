<script setup lang="ts">
// Ruta pública - declarada en RUTAS_PUBLICAS dentro de middleware/auth.global.ts
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const cargando = ref(false)
const error = ref('')

const onSubmit = async () => {
  cargando.value = true
  error.value = ''

  const { error: errLogin } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  if (errLogin) {
    error.value = 'Email o contraseña incorrectos'
    cargando.value = false
    return
  }

  // Justo después de signInWithPassword, useSupabaseUser() puede tardar un
  // instante en reflejar la sesión (el listener corre en un microtask aparte).
  // Si navegamos antes de que se actualice, el middleware todavía ve
  // user.value = null y rebota a /login - por eso a veces había que loguearse
  // dos veces. Se espera explícitamente acá, máximo 2 segundos.
  let intentos = 0
  while (!user.value && intentos < 40) {
    await new Promise((r) => setTimeout(r, 50))
    intentos++
  }

  const destino = (route.query.redirect as string) || '/'
  await router.push(destino)
  cargando.value = false
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
    <form class="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-5" @submit.prevent="onSubmit">
      <div class="flex justify-center mb-2">
        <SharedAppLogo />
      </div>
      <p class="text-center text-sm text-gray-400 -mt-2">Ingresa a tu CRM</p>

      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Email</label>
        <input
          v-model="email"
          type="email"
          required
          class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">Contraseña</label>
        <input
          v-model="password"
          type="password"
          required
          class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1075B5]/30 focus:border-[#1075B5]"
        />
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="submit"
        :disabled="cargando"
        class="w-full bg-[#1075B5] hover:bg-[#0C5D91] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {{ cargando ? 'Ingresando...' : 'Ingresar' }}
      </button>

      <p class="text-xs text-gray-400 text-center">
        ¿Primera vez? Revisa tu correo de invitación para crear tu contraseña.
      </p>
    </form>

    <SharedToastContainer />
  </div>
</template>
