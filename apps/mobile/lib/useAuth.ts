import { useEffect, useRef } from 'react'
import { initializeAuth, getAuth, onAuthStateChanged } from 'firebase/auth'
// @ts-expect-error — exported at runtime in RN bundles
import { getReactNativePersistence } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { app } from './firebase'
import { useAuthStore } from './store'

let _auth: Auth | null = null

/** Get or create the Firebase Auth instance. Safe to call after RN registers. */
export function getAuth_safe(): Auth {
  if (_auth) return _auth
  try {
    if (Platform.OS === 'web') {
      _auth = getAuth(app)
    } else {
      _auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      })
    }
  } catch {
    // Already initialized (hot-reload)
    _auth = getAuth(app)
  }
  return _auth
}

/** Hook: listens to auth state and updates zustand store. Call once in root layout. */
export function useAuthListener() {
  const { setUser, setReady } = useAuthStore()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const auth = getAuth_safe()
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setReady(true)
    })
    return unsub
  }, [])
}
