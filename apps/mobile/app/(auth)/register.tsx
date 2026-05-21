import { useState } from 'react'
import {
  View,
  Text,
  ImageBackground,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { getAuth_safe } from '../../lib/useAuth'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { colors, fonts, fontSize, spacing } from '../../lib/theme'

const { height } = Dimensions.get('window')

export default function RegisterScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Completa todos los campos')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(getAuth_safe(), email.trim(), password)
      await updateProfile(user, { displayName: name.trim() })
      // Auth gate in _layout.tsx redirects to (tabs) automatically
    } catch (err: any) {
      const msg =
        err.code === 'auth/email-already-in-use'
          ? 'Ya existe una cuenta con este correo'
          : err.code === 'auth/weak-password'
            ? 'La contraseña es muy débil'
            : err.code === 'auth/invalid-email'
              ? 'El correo no es válido'
              : 'Error al crear la cuenta'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/login-bg.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(5,11,16,0.7)', colors.bg.primary]}
          locations={[0, 0.3, 0.55]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={StyleSheet.absoluteFill}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={{ height: height * 0.18 }} />

          {/* Logo */}
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />

          <Text style={styles.title}>CREAR CUENTA</Text>
          <Text style={styles.subtitle}>Únete a la comunidad de fútbol amateur</Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              icon="account-outline"
              placeholder="Nombre completo"
              autoComplete="name"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />

            <View style={{ height: spacing.md }} />

            <Input
              icon="email-outline"
              placeholder="Correo electrónico"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
            />

            <View style={{ height: spacing.md }} />

            <Input
              icon="lock-outline"
              placeholder="Contraseña"
              isPassword
              value={password}
              onChangeText={setPassword}
              returnKeyType="next"
            />

            <View style={{ height: spacing.md }} />

            <Input
              icon="lock-check-outline"
              placeholder="Confirmar contraseña"
              isPassword
              value={confirm}
              onChangeText={setConfirm}
              returnKeyType="go"
              onSubmitEditing={handleRegister}
            />

            <View style={{ height: spacing.lg }} />

            <Button
              title="CREAR CUENTA"
              onPress={handleRegister}
              loading={loading}
              icon={
                !loading ? (
                  <MaterialCommunityIcons name="account-plus" size={20} color="#000" />
                ) : undefined
              }
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>O CONTINÚA CON</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <Button
              title="Continuar con Google"
              variant="outline"
              onPress={() => Alert.alert('Google Sign-In', 'Próximamente')}
              icon={<MaterialCommunityIcons name="google" size={20} color={colors.green.primary} />}
            />

            <View style={{ height: spacing.lg }} />

            {/* Login link */}
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.loginText}>
                ¿Ya tienes cuenta?{' '}
                <Text style={styles.loginLink}>Inicia sesión</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.45,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  logo: {
    width: 160,
    height: 80,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSize.xl,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 3,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  form: {
    flex: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  dividerText: {
    fontFamily: fonts.label,
    fontSize: fontSize.xs,
    color: colors.text.muted,
    letterSpacing: 2,
    marginHorizontal: spacing.md,
  },
  loginText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },
  loginLink: {
    color: colors.green.primary,
    fontWeight: '700',
  },
})
