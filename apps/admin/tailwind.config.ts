import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#1B2535',
          text: '#94A3B8',
          active: '#FFFFFF',
        },
        brand: {
          green: '#16A34A',
          'green-hover': '#15803D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
