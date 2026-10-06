import { api } from './api'

export type TeamFromApi = {
  id: string
  directorUid: string
  name: string
  shortName: string | null
  slug: string
  accessCode: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  city: string | null
  pendingDelegateEmail: string | null
  createdAt: string
  updatedAt: string
}

export type CreateTeamDto = {
  name: string
  shortName?: string
  primaryColor?: string
  secondaryColor?: string
  city?: string
  directorEmail?: string
}

export type UpdateTeamDto = Partial<CreateTeamDto>

export async function createTeam(dto: CreateTeamDto): Promise<TeamFromApi> {
  const { data } = await api.post<TeamFromApi>('/teams', dto)
  return data
}

export async function getMyTeams(): Promise<TeamFromApi[]> {
  const { data } = await api.get<TeamFromApi[]>('/teams/mine')
  return data
}

export async function searchTeams(query: string): Promise<TeamFromApi[]> {
  if (query.trim().length < 2) return []
  const { data } = await api.get<TeamFromApi[]>('/teams/search', { params: { q: query } })
  return data
}

export async function getTeam(id: string): Promise<TeamFromApi> {
  const { data } = await api.get<TeamFromApi>(`/teams/${id}`)
  return data
}

export async function updateTeam(id: string, dto: UpdateTeamDto): Promise<TeamFromApi> {
  const { data } = await api.patch<TeamFromApi>(`/teams/${id}`, dto)
  return data
}

export async function deleteTeam(id: string): Promise<void> {
  await api.delete(`/teams/${id}`)
}

export async function uploadTeamLogo(id: string, file: File): Promise<TeamFromApi> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<TeamFromApi>(`/teams/${id}/logo`, form)
  return data
}
