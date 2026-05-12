<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const route = useRoute()

interface NavItem {
  label: string
  path: string
  icon: string
  show: () => boolean
}

const nav = computed<NavItem[]>(() => [
  {
    label: 'Agenda',
    path: '/agenda',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    show: () => auth.canAccessAgenda,
  },
  {
    label: 'Pacientes',
    path: '/pacientes',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    show: () => !auth.isSuperAdmin,
  },
  {
    label: 'Documentos',
    path: '/documentos',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    show: () => auth.canAccessDocumentos,
  },
  {
    label: 'Convênios',
    path: '/convenios',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    show: () => auth.isClinicAdmin,
  },
  {
    label: 'Financeiro',
    path: '/financeiro',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    show: () => auth.isClinicAdmin,
  },
  {
    label: 'Médicos',
    path: '/medicos',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    show: () => auth.isAdmin,
  },
  {
    label: 'Secretárias',
    path: '/secretarias',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    show: () => auth.isAdmin || (auth.isDoctor && auth.isConsultorio),
  },
  {
    label: 'Clínicas',
    path: '/admin/clinicas',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    show: () => auth.isSuperAdmin,
  },
  {
    label: 'Métricas',
    path: '/admin/metricas',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    show: () => auth.isSuperAdmin,
  },
  {
    label: 'Configurações',
    path: '/configuracoes',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    show: () => true,
  },
])

const visibleNav = computed(() => nav.value.filter((n) => n.show()))

const initials = computed(() => {
  if (!auth.user?.fullName) return '?'
  return auth.user.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')
})

const roleLabel = computed(() => {
  if (auth.role === 'super_admin') return 'Super Admin'
  if (auth.role === 'admin') return 'Administrador'
  if (auth.role === 'doctor') {
    return auth.isConsultorio ? 'Médico (Consultório)' : 'Médico'
  }
  if (auth.role === 'secretary') return 'Secretária'
  return ''
})

const isActive = (path: string) =>
  path === '/agenda'
    ? route.path === '/' || route.path.startsWith('/agenda')
    : route.path.startsWith(path)
</script>

<template>
  <div class="min-h-screen flex bg-slate-50">
    <aside class="w-64 bg-white border-r border-slate-200 flex flex-col">
      <!-- Logo -->
      <div class="px-6 py-5 border-b border-slate-100">
        <div class="flex items-center gap-2.5">
          <div
            class="w-9 h-9 bg-bula-500 rounded-lg flex items-center justify-center shadow-sm"
          >
            <svg viewBox="0 0 100 100" class="w-6 h-6" fill="white">
              <path
                d="M20 15 L20 85 L55 85 C72 85 80 75 80 60 C80 52 76 46 70 43 C75 40 78 35 78 28 C78 18 70 15 55 15 Z M35 28 L52 28 C58 28 62 31 62 36 C62 41 58 44 52 44 L35 44 Z M35 56 L54 56 C61 56 65 60 65 65 C65 70 61 73 54 73 L35 73 Z"
              />
            </svg>
          </div>
          <div>
            <div class="font-bold text-slate-900 text-base leading-tight">
              med.bula
            </div>
            <div class="text-[11px] text-slate-500 leading-tight">
              {{ auth.user?.clinic?.name || 'med.bula' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-0.5">
        <NuxtLink
          v-for="item in visibleNav"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="
            isActive(item.path)
              ? 'bg-bula-50 text-bula-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          "
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
          </svg>
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- User card -->
      <div class="border-t border-slate-100 p-3">
        <div class="flex items-center gap-3 px-2 py-2">
          <div
            class="w-9 h-9 rounded-full bg-bula-500 text-white font-semibold flex items-center justify-center text-sm shrink-0"
          >
            {{ initials }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-slate-900 truncate">
              {{ auth.user?.fullName }}
            </div>
            <div class="text-xs text-slate-500 truncate">{{ roleLabel }}</div>
          </div>
          <button
            @click="auth.logout()"
            class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Sair"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
