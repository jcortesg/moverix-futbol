import { api } from './api'

export type PlayerPosition =
  | 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'CF' | 'ST'

export const PLAYER_POSITIONS: PlayerPosition[] = [
  'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'CF', 'ST',
]

export const PLAYER_POSITION_LABEL: Record<PlayerPosition, string> = {
  GK:  'Arquero',
  CB:  'Defensa central',
  LB:  'Lateral izquierdo',
  RB:  'Lateral derecho',
  CDM: 'Volante defensivo',
  CM:  'Volante central',
  CAM: 'Volante ofensivo',
  LW:  'Extremo izquierdo',
  RW:  'Extremo derecho',
  CF:  'Delantero centro',
  ST:  'Delantero',
}

export type RegistrationPlayerFromApi = {
  id: string
  registrationId: string
  playerUid: string
  playerName: string
  firstName: string | null
  lastName: string | null
  docNumber: string | null
  birthDate: string | null
  employer: string | null
  phone: string | null
  email: string | null
  healthProvider: string | null
  jerseyNumber: number | null
  position: PlayerPosition | null
  isCaptain: boolean
  addedAt: string
}

export type CreateRegistrationPlayerDto = {
  registrationId: string
  playerUid: string
  playerName: string
  firstName?: string
  lastName?: string
  docNumber?: string
  birthDate?: string
  employer?: string
  phone?: string
  email?: string
  healthProvider?: string
  jerseyNumber?: number
  position?: PlayerPosition
  isCaptain?: boolean
}

export type UpdateRegistrationPlayerDto = Partial<
  Omit<CreateRegistrationPlayerDto, 'registrationId' | 'playerUid'>
>

export async function getRosterByRegistration(registrationId: string): Promise<RegistrationPlayerFromApi[]> {
  const { data } = await api.get<RegistrationPlayerFromApi[]>('/registration-players', {
    params: { registrationId },
  })
  return data
}

export async function addRosterPlayer(dto: CreateRegistrationPlayerDto): Promise<RegistrationPlayerFromApi> {
  const { data } = await api.post<RegistrationPlayerFromApi>('/registration-players', dto)
  return data
}

export async function updateRosterPlayer(id: string, dto: UpdateRegistrationPlayerDto): Promise<RegistrationPlayerFromApi> {
  const { data } = await api.patch<RegistrationPlayerFromApi>(`/registration-players/${id}`, dto)
  return data
}

export async function removeRosterPlayer(id: string): Promise<void> {
  await api.delete(`/registration-players/${id}`)
}
