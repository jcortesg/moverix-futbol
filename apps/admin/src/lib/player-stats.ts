import { api } from './api'

export type PlayerStatFromApi = {
  id: string
  editionId: string
  teamId: string
  playerUid: string
  playerName: string
  matchesPlayed: number
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  minutesPlayed: number
  updatedAt: string
}

export async function getPlayerStatsByEdition(editionId: string): Promise<PlayerStatFromApi[]> {
  const { data } = await api.get<PlayerStatFromApi[]>('/player-stats', { params: { editionId } })
  return data
}

export async function getPlayerStatsByTeam(editionId: string, teamId: string): Promise<PlayerStatFromApi[]> {
  const { data } = await api.get<PlayerStatFromApi[]>('/player-stats', { params: { editionId, teamId } })
  return data
}

export async function getTopScorers(editionId: string, limit = 10): Promise<PlayerStatFromApi[]> {
  const { data } = await api.get<PlayerStatFromApi[]>('/player-stats/top-scorers', { params: { editionId, limit } })
  return data
}

export async function recomputeStats(editionId: string): Promise<{ teamsProcessed: number; matchesProcessed: number }> {
  const { data } = await api.post<{ teamsProcessed: number; matchesProcessed: number }>('/player-stats/recompute', null, { params: { editionId } })
  return data
}
