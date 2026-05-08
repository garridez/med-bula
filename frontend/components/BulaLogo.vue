<script setup lang="ts">
/**
 * BulaLogo — marca padrão do med.bula.
 *
 * Renderiza o "B" branco (assets/logo.svg) dentro de um badge vermelho
 * arredondado. É o único lugar do projeto que conhece a forma da logo —
 * qualquer ajuste de marca passa por aqui.
 *
 * Uso:
 *   <BulaLogo />                    -> tamanho md (40px), rounded-xl
 *   <BulaLogo size="sm" />          -> sidebar (36px)
 *   <BulaLogo size="lg" pulse />    -> hero da auth, com pulso cardíaco
 *   <BulaLogo size="xl" rounded="2xl" />
 */
defineOptions({ name: 'BulaLogo' })

const props = withDefaults(
  defineProps<{
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    rounded?: 'md' | 'lg' | 'xl' | '2xl' | 'full'
    /** anima o badge com leve pulso cardíaco */
    pulse?: boolean
    /** classes extras pro badge (ex.: shadow customizado) */
    badgeClass?: string
  }>(),
  {
    size: 'md',
    rounded: 'xl',
    pulse: false,
    badgeClass: '',
  }
)

const sizeClasses: Record<NonNullable<typeof props.size>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
}

// proporção do svg (4340x4954 ≈ 0.876) — usar % do badge mantém o "ar" certo
const innerScale: Record<NonNullable<typeof props.size>, string> = {
  xs: 'h-[60%]',
  sm: 'h-[62%]',
  md: 'h-[62%]',
  lg: 'h-[64%]',
  xl: 'h-[64%]',
}

const roundedClasses: Record<NonNullable<typeof props.rounded>, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
}
</script>

<template>
  <div
    :class="[
      'bg-bula-500 flex items-center justify-center shrink-0',
      sizeClasses[size],
      roundedClasses[rounded],
      pulse ? 'animate-badge-pulse' : '',
      badgeClass,
    ]"
    aria-label="med.bula"
    role="img"
  >
    <svg
      :class="['w-auto', innerScale[size]]"
      viewBox="0 0 4340 4954"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <path
        d="M889 893l823 0 0 1115 -823 0c-298,0 -541,-251 -541,-557l0 0c0,-307 243,-558 541,-558z"
      />
      <path
        d="M1711 4954l1 -900 1159 0c304,0 552,-257 552,-570l0 0c0,-314 -248,-571 -552,-571l-1159 0 0 -905 726 0c298,0 541,-251 541,-557l0 0c0,-307 -243,-558 -541,-558l-726 0 0 -892 796 -1c1398,-2 1659,1637 1217,2217 910,633 918,2551 -716,2736 -433,0 -865,1 -1298,1z"
      />
      <path
        d="M552 2913l1160 0 0 1141 -1160 0c-303,0 -552,-257 -552,-570l0 0c0,-314 249,-571 552,-571z"
      />
    </svg>
  </div>
</template>
