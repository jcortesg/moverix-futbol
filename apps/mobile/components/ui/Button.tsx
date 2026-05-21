import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native'
import { colors, fonts, fontSize, radius, shadows, spacing } from '../../lib/theme'

type Variant = 'primary' | 'outline' | 'ghost'

interface Props {
  title: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  style?: ViewStyle
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: Props) {
  const isPrimary = variant === 'primary'
  const isOutline = variant === 'outline'

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isOutline && styles.outline,
        variant === 'ghost' && styles.ghost,
        pressed && { opacity: 0.85 },
        (disabled || loading) && { opacity: 0.5 },
        isPrimary && shadows.glow,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#000' : colors.green.primary} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              isPrimary && styles.textPrimary,
              isOutline && styles.textOutline,
              variant === 'ghost' && styles.textGhost,
              icon ? { marginLeft: spacing.sm } : undefined,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  primary: {
    backgroundColor: colors.green.primary,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.green.primary,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  text: {
    fontFamily: fonts.heading,
    fontSize: fontSize.md,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  textPrimary: {
    color: '#000',
    fontWeight: '700',
  },
  textOutline: {
    color: colors.green.primary,
  },
  textGhost: {
    color: colors.green.primary,
  },
})
