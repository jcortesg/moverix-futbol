'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'moverix:activeEdition'

export type ActiveEdition = {
  id: string
  name: string
  season: string
  leagueId: string
  leagueName: string
  logoUrl: string | null
  bannerUrl: string | null
}

type ActiveEditionContextValue = {
  activeEdition: ActiveEdition | null
  setActiveEdition: (ed: ActiveEdition) => void
  clearActiveEdition: () => void
  ready: boolean
}

const ActiveEditionContext = createContext<ActiveEditionContextValue | undefined>(undefined)

export function ActiveEditionProvider({ children }: { children: React.ReactNode }) {
  const [activeEdition, setActiveEditionState] = useState<ActiveEdition | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setActiveEditionState(JSON.parse(raw) as ActiveEdition)
    } catch {
      // ignore
    }
    setReady(true)
  }, [])

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return
      setActiveEditionState(e.newValue ? JSON.parse(e.newValue) as ActiveEdition : null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setActiveEdition = useCallback((ed: ActiveEdition) => {
    setActiveEditionState(ed)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ed)) } catch { /* ignore */ }
  }, [])

  const clearActiveEdition = useCallback(() => {
    setActiveEditionState(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  return (
    <ActiveEditionContext.Provider value={{ activeEdition, setActiveEdition, clearActiveEdition, ready }}>
      {children}
    </ActiveEditionContext.Provider>
  )
}

export function useActiveEdition(): ActiveEditionContextValue {
  const ctx = useContext(ActiveEditionContext)
  if (!ctx) throw new Error('useActiveEdition must be used within ActiveEditionProvider')
  return ctx
}
