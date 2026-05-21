import { create } from 'zustand'
import type { User } from 'firebase/auth'

interface AuthState {
  user: User | null
  ready: boolean
  setUser: (user: User | null) => void
  setReady: (ready: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
}))

interface EditionState {
  editionId: string | null
  editionName: string | null
  setEdition: (id: string, name: string) => void
  clear: () => void
}

export const useEditionStore = create<EditionState>((set) => ({
  editionId: null,
  editionName: null,
  setEdition: (id, name) => set({ editionId: id, editionName: name }),
  clear: () => set({ editionId: null, editionName: null }),
}))
