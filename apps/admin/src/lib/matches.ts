import { api } from './api'

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'walkover'

export type MatchFromApi = {
  id: string
  matchdayId: string
  groupId: string | null
  homeTeamId: string | null
  awayTeamId: string | null
  venueId: string | null
  refereeId: string | null
  status: MatchStatus
  homeScore: number | null
  awayScore: number | null
  homePenalties: number | null
  awayPenalties: number | null
  scheduledAt: string | null
  startedAt: string | null
  finishedAt: string | null
  isNeutral: boolean
  round: string | null
  createdAt: string
  updatedAt: string
  matchdayNumber?: number
}

export type CreateMatchDto = {
  matchdayId: string
  groupId?: string
  homeTeamId?: string
  awayTeamId?: string
  venueId?: string
  refereeId?: string
  scheduledAt?: string
  isNeutral?: boolean
  round?: string
}

export type UpdateMatchDto = Partial<Omit<CreateMatchDto, 'matchdayId'>> & {
  /** Mover el partido a otra jornada. Conserva sus eventos. */
  matchdayId?: string
  status?: MatchStatus
  homeScore?: number
  awayScore?: number
  homePenalties?: number
  awayPenalties?: number
}

export type FinalizeMatchDto = {
  homeScore: number
  awayScore: number
  homePenalties?: number
  awayPenalties?: number
}

export type GenerateFixtureResult = {
  matchdays: number
  matches: number
  groups: number
}

export async function getMatchesByEdition(editionId: string): Promise<MatchFromApi[]> {
  const { data } = await api.get<MatchFromApi[]>('/matches', { params: { editionId } })
  return data
}

export async function getMatchesByMatchday(matchdayId: string): Promise<MatchFromApi[]> {
  const { data } = await api.get<MatchFromApi[]>('/matches', { params: { matchdayId } })
  return data
}

export async function getMatch(id: string): Promise<MatchFromApi> {
  const { data } = await api.get<MatchFromApi>(`/matches/${id}`)
  return data
}

export async function createMatch(dto: CreateMatchDto): Promise<MatchFromApi> {
  const { data } = await api.post<MatchFromApi>('/matches', dto)
  return data
}

export async function updateMatch(id: string, dto: UpdateMatchDto): Promise<MatchFromApi> {
  const { data } = await api.patch<MatchFromApi>(`/matches/${id}`, dto)
  return data
}

export async function deleteMatch(id: string): Promise<void> {
  await api.delete(`/matches/${id}`)
}

export async function finalizeMatch(id: string, dto: FinalizeMatchDto): Promise<MatchFromApi> {
  const { data } = await api.patch<MatchFromApi>(`/matches/${id}/finalize`, dto)
  return data
}

export async function generateFixture(editionId: string, force = false): Promise<GenerateFixtureResult> {
  const { data } = await api.post<GenerateFixtureResult>('/matches/generate-fixture', { editionId, force })
  return data
}
