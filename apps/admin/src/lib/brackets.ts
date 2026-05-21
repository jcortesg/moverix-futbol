import { api } from './api'

export type BracketSlotFromApi = {
  id: string
  editionId: string
  cupName: string
  round: number
  slot: number
  matchId: string | null
  homeTeamId: string | null
  awayTeamId: string | null
  winnerId: string | null
  nextSlotId: string | null
  homeTeamName?: string | null
  awayTeamName?: string | null
  homeTeamLogoUrl?: string | null
  awayTeamLogoUrl?: string | null
  homeScore?: number | null
  awayScore?: number | null
  homePenalties?: number | null
  awayPenalties?: number | null
  matchStatus?: string | null
  createdAt: string
  updatedAt: string
}

export type GenerateResult = {
  cupName: string
  bracketSize: number
  rounds: number
  slotsCreated: number
  matchesCreated: number
  matchdayId: string
}

export async function generateBracket(editionId: string, cupName?: string): Promise<GenerateResult> {
  const { data } = await api.post<GenerateResult>('/brackets/generate', { editionId, cupName })
  return data
}

export async function getBracket(editionId: string, cupName = 'main'): Promise<BracketSlotFromApi[]> {
  const { data } = await api.get<BracketSlotFromApi[]>('/brackets', { params: { editionId, cupName } })
  return data
}

export async function getBracketCups(editionId: string): Promise<string[]> {
  const { data } = await api.get<string[]>('/brackets/cups', { params: { editionId } })
  return data
}

export async function resetBracket(editionId: string, cupName = 'main'): Promise<{ deleted: number }> {
  const { data } = await api.delete<{ deleted: number }>('/brackets/reset', { params: { editionId, cupName } })
  return data
}
