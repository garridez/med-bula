<template>
  <div class="min-h-screen flex">
    <!-- Painel esquerdo (vermelho com logo) -->
    <div
      class="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-bula-500
             items-center justify-center p-12"
    >
      <!-- Padrão decorativo + pulso cardíaco -->
      <div class="absolute inset-0">
        <!-- glows atmosféricos (estáticos) -->
        <div
          class="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full
                 blur-3xl"
        />
        <div
          class="absolute -bottom-24 -left-24 w-96 h-96 bg-white/10 rounded-full
                 blur-3xl"
        />

        <!-- Anéis com pulso cardíaco (lub-dub).
             O wrapper centra; o filho recebe o transform do animate, sem
             conflitar com o translate de centralização. -->
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                 motion-safe:animate-heart-pulse"
        >
          <div class="w-[640px] h-[640px] border-[3px] border-white/15 rounded-full" />
        </div>
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                 motion-safe:animate-heart-pulse"
          style="animation-delay: 180ms"
        >
          <div class="w-[460px] h-[460px] border-[3px] border-white/15 rounded-full" />
        </div>
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                 motion-safe:animate-heart-pulse"
          style="animation-delay: 360ms"
        >
          <div class="w-[300px] h-[300px] border-[3px] border-white/15 rounded-full" />
        </div>
        <!-- ponto-foco central, batendo no mesmo ritmo -->
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                 motion-safe:animate-heart-pulse"
          style="animation-delay: 540ms"
        >
          <div class="w-3 h-3 bg-white/30 rounded-full" />
        </div>
      </div>

      <div class="relative z-10 max-w-md text-white">
        <div class="flex items-center gap-3 mb-12">
          <BulaLogo size="lg" rounded="xl" badge-class="shadow-lg" />
          <div>
            <h2 class="text-3xl font-bold tracking-tight">med.bula</h2>
            <p class="text-bula-100 text-sm">gestão de consultório</p>
          </div>
        </div>

        <h1 class="text-4xl font-bold leading-tight mb-4">
          A gestão do seu<br />
          consultório, simples<br />
          e confiável.
        </h1>
        <p class="text-bula-50/90 text-lg leading-relaxed">
          Agenda, prontuário e emissão de receitas com certificado digital — em
          um só lugar.
        </p>

        <div class="mt-12 flex items-center gap-6 text-sm text-bula-50/80">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            ICP-Brasil
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            LGPD compliant
          </div>
        </div>
      </div>
    </div>

    <!-- Painel direito (formulário) -->
    <div class="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
      <div class="w-full max-w-md animate-slide-up">
        <slot />
      </div>
    </div>
  </div>
</template>
