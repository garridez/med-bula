<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

// Redirect role-aware: doctor/secretary → /agenda · admin → /financeiro ·
// super_admin → /configuracoes (Drop 5e adiciona painel próprio depois).
definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    return navigateTo(auth.homeRoute, { replace: true })
  },
})
</script>

<template>
  <div />
</template>
