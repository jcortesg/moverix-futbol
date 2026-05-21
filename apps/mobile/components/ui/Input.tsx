import { useState } from 'react'
import { View, TextInput, Pressable, StyleSheet, TextInputProps } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors, fonts, fontSize, radius, spacing } from '../../lib/theme'

interface Props extends TextInputProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap
  isPassword?: boolean
}

export function Input({ icon, isPassword, style, ...rest }: Props) {
  const [secure, setSecure] = useState(isPassword)

  return (
    <View style={styles.container}>
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={colors.green.primary}
          style={styles.icon}
        />
      )}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.text.muted}
        secureTextEntry={secure}
        autoCapitalize="none"
        {...rest}
      />
      {isPassword && (
        <Pressable onPress={() => setSecure(!secure)} hitSlop={8}>
          <MaterialCommunityIcons
            name={secure ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={colors.text.muted}
          />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
})
