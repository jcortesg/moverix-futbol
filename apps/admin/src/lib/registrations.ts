import { api } from './api'
import type { TeamFromApi } from './teams'

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export type RegistrationFromApi = {
  id: string
  editionId: string
  teamId: string
  groupId: string | null
  status: RegistrationStatus
  seedRank: number | null
  registeredByUid: string | null
  paidAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  team: Pick<TeamFromApi, 'id' | 'name' | 'shortName' | 'logoUrl' | 'primaryColor' | 'secondaryColor' | 'city' | 'directorUid'>
}

export type CreateRegistrationDto = {
  editionId: string
  teamId: string
  seedRank?: number
}

export type UpdateRegistrationDto = {
  status?: RegistrationStatus
  groupId?: string | null
  seedRank?: number
}

export async function createRegistration(dto: CreateRegistrationDto): Promise<RegistrationFromApi> {
  const { data } = await api.post<RegistrationFromApi>('/registrations', dto)
  return data
}

export async function getRegistrationsByEdition(editionId: string): Promise<RegistrationFromApi[]> {
  const { data } = await api.get<RegistrationFromApi[]>('/registrations', { params: { editionId } })
  return data
}

export async function getRegistration(id: string): Promise<RegistrationFromApi> {
  const { data } = await api.get<RegistrationFromApi>(`/registrations/${id}`)
  return data
}

export async function updateRegistration(id: string, dto: UpdateRegistrationDto): Promise<RegistrationFromApi> {
  const { data } = await api.patch<RegistrationFromApi>(`/registrations/${id}`, dto)
  return data
}

export async function deleteRegistration(id: string): Promise<void> {
  await api.delete(`/registrations/${id}`)
}

// Marking a payment as verified from the admin side. Uses the registration
// update endpoint to store `paidAt`. Backend accepts it as part of the patch.
export async function markRegistrationPaid(id: string): Promise<RegistrationFromApi> {
  const { data } = await api.patch<RegistrationFromApi>(`/registrations/${id}`, { paidAt: new Date().toISOString() })
  return data
}

/* ── My registrations (for public flows) ───────────────── */

export type MyRegistration = {
  id: string
  editionId: string
  teamId: string
  status: RegistrationStatus
  groupId: string | null
  createdAt: string
  team: { id: string; name: string; logoUrl: string | null }
}

export async function getMyRegistrations(): Promise<MyRegistration[]> {
  const { data } = await api.get<MyRegistration[]>('/registrations/mine')
  return data
}

/* ── Registration players (roster) ─────────────────────── */

export type RegistrationPlayer = {
  id: string
  registrationId: string
  playerUid: string
  playerName: string
  firstName: string | null
  lastName: string | null
  docNumber: string | null
  phone: string | null
  email: string | null
  position: string | null
  jerseyNumber: number | null
  addedAt: string
}

export type CreateRegistrationPlayerDto = {
  registrationId: string
  playerUid: string
  playerName: string
  firstName?: string
  lastName?: string
  docNumber?: string
  phone?: string
  email?: string
  position?: string
  jerseyNumber?: number
}

export async function getRegistrationPlayers(registrationId: string): Promise<RegistrationPlayer[]> {
  const { data } = await api.get<RegistrationPlayer[]>('/registration-players', { params: { registrationId } })
  return data
}

export async function createRegistrationPlayer(dto: CreateRegistrationPlayerDto): Promise<RegistrationPlayer> {
  const { data } = await api.post<RegistrationPlayer>('/registration-players', dto)
  return data
}
