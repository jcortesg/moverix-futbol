/** Moverix Futbol — Design Tokens */

export const colors = {
  // Base (dark UI)
  bg: {
    primary: '#050B10',
    secondary: '#0A1620',
    card: '#0F1F2B',
    elevated: '#142A36',
  },

  // Verde Moverix
  green: {
    primary: '#7BFF00',
    secondary: '#5CFF1A',
    soft: '#1F7A4C',
    glow: '#7BFF00AA',
    dim: '#7BFF0020',
  },

  // Neutrales
  text: {
    primary: '#FFFFFF',
    secondary: '#A8C1D1',
    muted: '#6B8A99',
  },
  border: {
    subtle: '#1E3A46',
  },

  // Stats funcionales
  stat: {
    blue: '#4DA3FF',
    purple: '#B36BFF',
    orange: '#FF9F40',
  },
  result: {
    win: '#2ECC71',
    loss: '#FF4D4F',
    draw: '#95A5A6',
  },
} as const

export const fonts = {
  heading: 'Rajdhani_700Bold',
  body: 'Rajdhani_500Medium',
  label: 'Rajdhani_500Medium',
  stats: 'Rajdhani_700Bold',
} as const

export const fontSize = {
  xl: 28,
  lg: 22,
  md: 16,
  sm: 14,
  xs: 12,
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const

export const shadows = {
  glow: {
    shadowColor: '#7BFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  glowSoft: {
    shadowColor: '#7BFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
} as const
