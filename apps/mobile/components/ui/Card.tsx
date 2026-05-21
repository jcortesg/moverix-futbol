import { View, StyleSheet, ViewProps } from 'react-native'
import { colors, radius, spacing, shadows } from '../../lib/theme'

interface Props extends ViewProps {
  glow?: boolean
}

export function Card({ children, glow, style, ...rest }: Props) {
  return (
    <View style={[styles.card, glow && shadows.glowSoft, style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    ...shadows.card,
  },
})
