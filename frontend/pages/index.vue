<script setup lang="ts">
// Redireciona pra agenda — agenda é a home padrão do consultório
definePageMeta({ middleware: () => navigateTo('/agenda', { replace: true }) })
</script>

<template>
  <div />
</template>
