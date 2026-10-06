import { api } from './api'

export type MatchDelegate = {
  id: string
  /** null mientras la invitación por correo siga pendiente. */
  uid: string | null
  /** referee_1 | referee_2 | referee_3 | fourth | delegate */
  role: string
  pendingEmail: string | null
  invitedName: string | null
  createdAt: string
  fullName: string | null
  username: string | null
  avatarUrl: string | null
}

/** Delegado que este organizador ya usó antes. */
export type SavedDelegate = {
  uid: string | null
  email: string | null
  name: string
  avatarUrl: string | null
  pending: boolean
}

export type UserSearchResult = {
  uid: string
  username: string
  fullName: string
  avatarUrl: string | null
}

export async function getMatchDelegates(matchId: string): Promise<MatchDelegate[]> {
  const { data } = await api.get<MatchDelegate[]>('/match-delegates', { params: { matchId } })
  return data
}

export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const { data } = await api.get<UserSearchResult[]>('/match-delegates/search-users', { params: { q } })
  return data
}

export async function assignDelegate(
  matchId: string, uid: string, role = 'delegate',
): Promise<void> {
  await api.post('/match-delegates', { matchId, uid, role })
}

/** Invita por correo: si aún no tiene cuenta, queda pendiente hasta que se registre. */
export async function inviteDelegate(
  matchId: string, email: string, name?: string, role = 'delegate',
): Promise<void> {
  await api.post('/match-delegates', { matchId, email, name, role })
}

/** Personal de la organización habilitado como delegado (creado en Árbitros). */
export type StaffMember = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  role: string
  photoUrl: string | null
}

export async function getDelegateStaff(matchId: string): Promise<StaffMember[]> {
  const { data } = await api.get<StaffMember[]>('/match-delegates/staff', {
    params: { matchId },
  })
  return data
}

export async function getMyDelegates(): Promise<SavedDelegate[]> {
  const { data } = await api.get<SavedDelegate[]>('/match-delegates/mine')
  return data
}

export async function removeDelegate(id: string): Promise<void> {
  await api.delete(`/match-delegates/${id}`)
}

/** Puestos de la terna arbitral. */
export const DELEGATE_ROLES = [
  { value: 'referee_1', label: 'Árbitro central', short: 'ÁRB 1' },
  { value: 'referee_2', label: 'Asistente 1', short: 'ÁRB 2' },
  { value: 'referee_3', label: 'Asistente 2', short: 'ÁRB 3' },
  { value: 'fourth', label: 'Cuarto árbitro', short: 'ÁRB 4' },
  { value: 'delegate', label: 'Delegado', short: 'DELEG.' },
] as const

export function roleLabel(role: string): string {
  return DELEGATE_ROLES.find((r) => r.value === role)?.short ?? 'DELEG.'
}
