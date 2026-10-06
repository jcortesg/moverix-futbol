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
  docFileUrl: string | null
  photoFileUrl: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  addedAt: string
  /** Baja lógica: si viene con fecha, el jugador está dado de baja. */
  removedAt: string | null
  removedBy: string | null
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
  emergencyContactName?: string
  emergencyContactPhone?: string
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

/** Da de baja al jugador (baja lógica, reversible con restoreRosterPlayer). */
export async function removeRosterPlayer(id: string): Promise<void> {
  await api.delete(`/registration-players/${id}`)
}

/** Reactiva a un jugador dado de baja. */
export async function restoreRosterPlayer(id: string): Promise<RegistrationPlayerFromApi> {
  const { data } = await api.post<RegistrationPlayerFromApi>(`/registration-players/${id}/restore`)
  return data
}

/** Agrega al delegado del equipo a la plantilla como jugador (rol dual). */
export async function addDirectorAsPlayer(registrationId: string): Promise<RegistrationPlayerFromApi> {
  const { data } = await api.post<RegistrationPlayerFromApi>('/registration-players/director', null, {
    params: { registrationId },
  })
  return data
}

// ── Archivos del jugador: cédula (document) y foto (photo) ─────────────────

export type PlayerFileKind = 'document' | 'photo'

export async function uploadPlayerFile(id: string, kind: PlayerFileKind, file: File): Promise<RegistrationPlayerFromApi> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<RegistrationPlayerFromApi>(`/registration-players/${id}/${kind}`, form)
  return data
}

/** Descarga el archivo (autenticado) y devuelve un object URL para previsualizar/abrir. */
export async function fetchPlayerFileUrl(id: string, kind: PlayerFileKind): Promise<string> {
  const { data } = await api.get<Blob>(`/registration-players/${id}/${kind}`, { responseType: 'blob' })
  return URL.createObjectURL(data)
}

export async function removePlayerFile(id: string, kind: PlayerFileKind): Promise<RegistrationPlayerFromApi> {
  const { data } = await api.delete<RegistrationPlayerFromApi>(`/registration-players/${id}/${kind}`)
  return data
}
