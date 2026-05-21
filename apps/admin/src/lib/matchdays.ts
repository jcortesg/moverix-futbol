import { api } from './api'

export type MatchdayFromApi = {
  id: string
  editionId: string
  number: number
  name: string | null
  phase: string
  scheduledDate: string | null
  createdAt: string
}

export type CreateMatchdayDto = {
  editionId: string
  number: number
  name?: string
  phase?: string
  scheduledDate?: string
}

export type UpdateMatchdayDto = Partial<Omit<CreateMatchdayDto, 'editionId'>>

export async function getMatchdays(editionId: string): Promise<MatchdayFromApi[]> {
  const { data } = await api.get<MatchdayFromApi[]>('/matchdays', { params: { editionId } })
  return data
}

export async function createMatchday(dto: CreateMatchdayDto): Promise<MatchdayFromApi> {
  const { data } = await api.post<MatchdayFromApi>('/matchdays', dto)
  return data
}

export async function updateMatchday(id: string, dto: UpdateMatchdayDto): Promise<MatchdayFromApi> {
  const { data } = await api.patch<MatchdayFromApi>(`/matchdays/${id}`, dto)
  return data
}

export async function deleteMatchday(id: string): Promise<void> {
  await api.delete(`/matchdays/${id}`)
}
