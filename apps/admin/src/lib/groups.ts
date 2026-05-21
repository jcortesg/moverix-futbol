import { api } from './api'

export type GroupFromApi = {
  id: string
  editionId: string
  name: string
  code: string
  phase: string
  maxTeams: number | null
  order: number
  createdAt: string
}

export type CreateGroupDto = {
  editionId: string
  name: string
  code: string
  phase?: string
  maxTeams?: number
  order?: number
}

export type UpdateGroupDto = Partial<Omit<CreateGroupDto, 'editionId'>>

export async function createGroup(dto: CreateGroupDto): Promise<GroupFromApi> {
  const { data } = await api.post<GroupFromApi>('/groups', dto)
  return data
}

export async function getGroupsByEdition(editionId: string): Promise<GroupFromApi[]> {
  const { data } = await api.get<GroupFromApi[]>('/groups', { params: { editionId } })
  return data
}

export async function updateGroup(id: string, dto: UpdateGroupDto): Promise<GroupFromApi> {
  const { data } = await api.patch<GroupFromApi>(`/groups/${id}`, dto)
  return data
}

export async function deleteGroup(id: string): Promise<void> {
  await api.delete(`/groups/${id}`)
}

export async function generateGroups(editionId: string): Promise<GroupFromApi[]> {
  const { data } = await api.post<GroupFromApi[]>('/groups/generate', { editionId })
  return data
}

export async function drawGroups(
  editionId: string,
  mode: 'all' | 'unassigned' = 'all',
): Promise<{ assigned: number; groups: number }> {
  const { data } = await api.post<{ assigned: number; groups: number }>('/groups/draw', { editionId, mode })
  return data
}
