'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { type User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  getToken: async () => null,
})

const AUTH_COOKIE = 'moverix-auth'

function setAuthCookie(value: boolean) {
  if (value) {
    document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Strict; max-age=3600`
  } else {
    document.cookie = `${AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
      setAuthCookie(!!firebaseUser)
    })
    return unsubscribe
  }, [])

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null
    return auth.currentUser.getIdToken()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
