import { api } from './api'

export type PlayerSearchRow = {
  registrationPlayerId: string
  playerUid: string
  playerName: string
  firstName: string | null
  lastName: string | null
  docNumber: string | null
  email: string | null
  phone: string | null
  jerseyNumber: number | null
  removedAt: string | null
  active: boolean
  teamId: string
  teamName: string
  teamLogoUrl: string | null
  editionId: string
  editionName: string
  registrationId: string
  ban: PlayerBan | null
}

export type PlayerBan = {
  id: string
  organizationId: string
  docNumber: string
  fullName: string
  reason: string
  until: string | null
  liftedAt: string | null
  liftedReason: string | null
  createdBy: string | null
  createdAt: string
  inRosters?: { teamName: string; editionName: string }[]
}

export async function searchPlayers(organizationId: string, q: string): Promise<PlayerSearchRow[]> {
  const { data } = await api.get<PlayerSearchRow[]>('/players-admin/search', {
    params: { organizationId, q },
  })
  return data
}

export async function getBans(organizationId: string, includeLifted = false): Promise<PlayerBan[]> {
  const { data } = await api.get<PlayerBan[]>('/players-admin/bans', {
    params: { organizationId, includeLifted },
  })
  return data
}

export async function createBan(dto: {
  organizationId: string
  docNumber: string
  fullName: string
  reason: string
  until?: string | null
}): Promise<PlayerBan> {
  const { data } = await api.post<PlayerBan>('/players-admin/bans', dto)
  return data
}

export async function liftBan(id: string, organizationId: string, reason?: string): Promise<PlayerBan> {
  const { data } = await api.patch<PlayerBan>(`/players-admin/bans/${id}/lift`, {
    organizationId,
    reason,
  })
  return data
}
