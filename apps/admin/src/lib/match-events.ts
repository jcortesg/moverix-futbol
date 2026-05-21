import { api } from './api'

export type EventType =
  | 'goal' | 'own_goal' | 'yellow_card' | 'red_card'
  | 'substitution' | 'penalty_scored' | 'penalty_missed' | 'mvp'

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  goal:            'Gol',
  own_goal:        'Autogol',
  yellow_card:     'Amarilla',
  red_card:        'Roja',
  substitution:    'Sustitución',
  penalty_scored:  'Penal anotado',
  penalty_missed:  'Penal fallado',
  mvp:             'MVP',
}

export type MatchEventFromApi = {
  id: string
  matchId: string
  teamId: string
  eventType: EventType
  minute: number | null
  playerUid: string | null
  playerName: string | null
  assistPlayerUid: string | null
  assistPlayerName: string | null
  createdAt: string
}

export type CreateMatchEventDto = {
  matchId: string
  teamId: string
  eventType: EventType
  minute?: number
  playerUid?: string
  playerName?: string
  assistPlayerUid?: string
  assistPlayerName?: string
}

export type UpdateMatchEventDto = Partial<Omit<CreateMatchEventDto, 'matchId'>>

export async function getEventsByMatch(matchId: string): Promise<MatchEventFromApi[]> {
  const { data } = await api.get<MatchEventFromApi[]>('/match-events', { params: { matchId } })
  return data
}

export async function createMatchEvent(dto: CreateMatchEventDto): Promise<MatchEventFromApi> {
  const { data } = await api.post<MatchEventFromApi>('/match-events', dto)
  return data
}

export async function updateMatchEvent(id: string, dto: UpdateMatchEventDto): Promise<MatchEventFromApi> {
  const { data } = await api.patch<MatchEventFromApi>(`/match-events/${id}`, dto)
  return data
}

export async function deleteMatchEvent(id: string): Promise<void> {
  await api.delete(`/match-events/${id}`)
}

export async function setMvp(matchId: string, teamId: string, playerUid: string, playerName: string): Promise<MatchEventFromApi> {
  const { data } = await api.post<MatchEventFromApi>('/match-events/mvp', { matchId, teamId, playerUid, playerName })
  return data
}

export async function clearMvp(matchId: string): Promise<void> {
  await api.delete(`/match-events/mvp/${matchId}`)
}
