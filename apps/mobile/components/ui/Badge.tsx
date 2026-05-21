import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts, fontSize, radius, spacing } from '../../lib/theme'

type Variant = 'success' | 'info' | 'warning' | 'danger'

const variantColors: Record<Variant, { bg: string; text: string }> = {
  success: { bg: colors.green.dim, text: colors.green.primary },
  info: { bg: '#4DA3FF20', text: colors.stat.blue },
  warning: { bg: '#FF9F4020', text: colors.stat.orange },
  danger: { bg: '#FF4D4F20', text: colors.result.loss },
}

interface Props {
  label: string
  variant?: Variant
}

export function Badge({ label, variant = 'success' }: Props) {
  const c = variantColors[variant]
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.label,
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
})
