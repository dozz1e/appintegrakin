<!-- app/pages/clientes/[id].vue -->
<!-- La ficha de cliente vive en /clientes?cliente_id=... (split-view en una
     sola página). Esta ruta ya no existe como página propia, pero quedan
     links/bookmarks viejos apuntando a /clientes/:id - se redirige. -->
<script setup lang="ts">
definePageMeta({
  redirect: (to) => `/clientes?cliente_id=${to.params.id}`,
})
</script>
