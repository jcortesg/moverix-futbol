import { useEffect, useCallback } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { Slot, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useFonts, Rajdhani_500Medium, Rajdhani_700Bold } from '@expo-google-fonts/rajdhani'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../lib/store'
import { useAuthListener } from '../lib/useAuth'
import { colors } from '../lib/theme'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

function useProtectedRoute() {
  const { user, ready } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useAuthListener()

  useEffect(() => {
    if (!ready) return
    const inAuth = segments[0] === '(auth)'
    if (!user && !inAuth) router.replace('/(auth)/login')
    else if (user && inAuth) router.replace('/(tabs)')
  }, [user, ready, segments])

  return { ready }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Rajdhani_500Medium, Rajdhani_700Bold })
  const { ready } = useProtectedRoute()

  const onReady = useCallback(async () => {
    if (fontsLoaded && ready) await SplashScreen.hideAsync()
  }, [fontsLoaded, ready])

  useEffect(() => { onReady() }, [onReady])

  if (!fontsLoaded || !ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.green.primary} />
      </View>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Slot />
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
