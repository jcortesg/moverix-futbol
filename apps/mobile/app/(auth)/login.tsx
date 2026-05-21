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
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { getAuth_safe } from '../../lib/useAuth'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { colors, fonts, fontSize, spacing } from '../../lib/theme'

const { height } = Dimensions.get('window')

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Ingresa correo y contraseña')
      return
    }
    setLoading(true)
    try {
      await signInWithEmailAndPassword(getAuth_safe(), email.trim(), password)
      // Auth gate in _layout.tsx redirects to (tabs) on success
    } catch (err: any) {
      const msg =
        err.code === 'auth/invalid-credential'
          ? 'Correo o contraseña incorrectos'
          : err.code === 'auth/too-many-requests'
            ? 'Demasiados intentos. Intenta más tarde'
            : err.code === 'auth/user-not-found'
              ? 'No existe una cuenta con este correo'
              : err.code === 'auth/wrong-password'
                ? 'Contraseña incorrecta'
                : 'Error al iniciar sesión'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    if (!email.trim()) {
      Alert.alert('Recuperar contraseña', 'Ingresa tu correo electrónico primero')
      return
    }
    try {
      await sendPasswordResetEmail(getAuth_safe(), email.trim())
      Alert.alert('Listo', 'Te enviamos un correo para restablecer tu contraseña')
    } catch {
      Alert.alert('Error', 'No pudimos enviar el correo. Verifica la dirección')
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
          colors={['transparent', 'rgba(5,11,16,0.6)', colors.bg.primary]}
          locations={[0, 0.4, 0.65]}
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
          <View style={{ height: height * 0.30 }} />

          {/* Logo */}
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />

          {/* Tagline */}
          <Text style={styles.tagline}>
            <Text style={styles.taglineGreen}>ENTRENA </Text>
            COMO JUEGAS
          </Text>

          {/* Form */}
          <View style={styles.form}>
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
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />

            <View style={{ height: spacing.lg }} />

            <Button
              title="INICIAR SESIÓN"
              onPress={handleLogin}
              loading={loading}
              icon={
                !loading ? (
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#000" />
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

            {/* Forgot */}
            <Pressable onPress={handleForgot} hitSlop={12}>
              <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
            </Pressable>

            <View style={{ height: spacing.md }} />

            {/* Register link */}
            <Pressable onPress={() => router.push('/(auth)/register')} hitSlop={12}>
              <Text style={styles.registerText}>
                ¿No tienes cuenta?{' '}
                <Text style={styles.registerLink}>Regístrate</Text>
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
    height: height * 0.55,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  logo: {
    width: 220,
    height: 110,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  tagline: {
    fontFamily: fonts.heading,
    fontSize: fontSize.md,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: spacing.xl,
  },
  taglineGreen: {
    color: colors.green.primary,
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
  link: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.green.primary,
    textAlign: 'center',
  },
  registerText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },
  registerLink: {
    color: colors.green.primary,
    fontWeight: '700',
  },
})
