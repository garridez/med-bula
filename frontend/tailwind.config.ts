import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        bula: {
          50: '#fdecec',
          100: '#fbd6d4',
          200: '#f5aaa7',
          300: '#ee7d79',
          400: '#e85751',
          500: '#e53935', // primary
          600: '#cc2e2a',
          700: '#a82220',
          800: '#871a18',
          900: '#671311',
          950: '#3d0807',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 4px 16px -2px rgb(0 0 0 / 0.06)',
        'soft-lg':
          '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 12px 28px -4px rgb(0 0 0 / 0.10)',
        'glow': '0 0 0 4px rgb(229 57 53 / 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 240ms ease-out',
        'slide-up': 'slideUp 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        // pulso cardíaco "lub-dub" — usado nos anéis do fundo da auth
        'heart-pulse': 'heartPulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        // pulso bem suave da própria logo (pulse opcional via prop)
        'badge-pulse': 'badgePulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // ritmo de batida cardíaca: lub (10%) -> volta -> dub menor (26%) -> repouso
        heartPulse: {
          '0%, 40%, 100%': { transform: 'scale(1)', opacity: '0.55' },
          '10%': { transform: 'scale(1.045)', opacity: '1' },
          '18%': { transform: 'scale(1.005)', opacity: '0.7' },
          '26%': { transform: 'scale(1.025)', opacity: '0.9' },
          '34%': { transform: 'scale(1)', opacity: '0.6' },
        },
        badgePulse: {
          '0%, 40%, 100%': { transform: 'scale(1)' },
          '10%': { transform: 'scale(1.04)' },
          '18%': { transform: 'scale(1.01)' },
          '26%': { transform: 'scale(1.025)' },
        },
      },
    },
  },
}
