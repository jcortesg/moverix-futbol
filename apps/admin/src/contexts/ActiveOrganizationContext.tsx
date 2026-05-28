'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { OrganizationFromApi } from '@/lib/leagues'

const STORAGE_KEY = 'moverix:activeOrganization'

type ActiveOrganizationContextValue = {
  activeOrg: OrganizationFromApi | null
  organizations: OrganizationFromApi[]
  setActiveOrg: (org: OrganizationFromApi) => void
  setOrganizations: (orgs: OrganizationFromApi[]) => void
  clearActiveOrg: () => void
  ready: boolean
}

const ActiveOrganizationContext = createContext<ActiveOrganizationContextValue | undefined>(undefined)

export function ActiveOrganizationProvider({ children }: { children: React.ReactNode }) {
  const [activeOrg, setActiveOrgState] = useState<OrganizationFromApi | null>(null)
  const [organizations, setOrganizationsState] = useState<OrganizationFromApi[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setActiveOrgState(JSON.parse(raw) as OrganizationFromApi)
    } catch { /* ignore */ }
    setReady(true)
  }, [])

  const setActiveOrg = useCallback((org: OrganizationFromApi) => {
    setActiveOrgState(org)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(org)) } catch { /* ignore */ }
  }, [])

  const setOrganizations = useCallback((orgs: OrganizationFromApi[]) => {
    setOrganizationsState(orgs)
  }, [])

  const clearActiveOrg = useCallback(() => {
    setActiveOrgState(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  return (
    <ActiveOrganizationContext.Provider value={{ activeOrg, organizations, setActiveOrg, setOrganizations, clearActiveOrg, ready }}>
      {children}
    </ActiveOrganizationContext.Provider>
  )
}

export function useActiveOrganization(): ActiveOrganizationContextValue {
  const ctx = useContext(ActiveOrganizationContext)
  if (!ctx) throw new Error('useActiveOrganization must be used within ActiveOrganizationProvider')
  return ctx
}
