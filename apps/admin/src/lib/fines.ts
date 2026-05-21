import { api } from './api'
import type { PaymentTeamSummary } from './payments'

export type FineStatus = 'pending' | 'paid' | 'waived'

export type FineFromApi = {
  id: string
  editionId: string
  teamId: string
  matchId: string | null
  playerUid: string | null
  playerName: string | null
  reason: string
  amount: number
  currency: string
  status: FineStatus
  sanction: string | null
  matchesBanned: number
  appealed: boolean
  createdAt: string
  updatedAt: string
  team?: PaymentTeamSummary
}

export type CreateFineDto = {
  editionId: string
  teamId: string
  matchId?: string
  playerUid?: string
  playerName?: string
  reason: string
  amount?: number
  currency?: string
  sanction?: string
  matchesBanned?: number
  appealed?: boolean
}

export type UpdateFineDto = Partial<Omit<CreateFineDto, 'editionId' | 'teamId'>> & {
  status?: FineStatus
}

export async function getFinesByEdition(editionId: string): Promise<FineFromApi[]> {
  const { data } = await api.get<FineFromApi[]>('/fines', { params: { editionId } })
  return data
}

export async function createFine(dto: CreateFineDto): Promise<FineFromApi> {
  const { data } = await api.post<FineFromApi>('/fines', dto)
  return data
}

export async function updateFine(id: string, dto: UpdateFineDto): Promise<FineFromApi> {
  const { data } = await api.patch<FineFromApi>(`/fines/${id}`, dto)
  return data
}

export async function deleteFine(id: string): Promise<void> {
  await api.delete(`/fines/${id}`)
}
