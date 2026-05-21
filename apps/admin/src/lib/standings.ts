import { api } from './api'

export type StandingRow = {
  position: number
  teamId: string
  teamName: string
  teamShortName: string | null
  teamLogoUrl: string | null
  teamPrimaryColor: string | null
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  yellowCards: number
  redCards: number
}

export type StandingGroup = {
  groupId: string | null
  groupName: string
  groupCode: string | null
  qualifiersPerGroup: number | null
  rows: StandingRow[]
}

export async function getStandingsByEdition(editionId: string): Promise<StandingGroup[]> {
  const { data } = await api.get<StandingGroup[]>('/standings', { params: { editionId } })
  return data
}

export type QualifierType =
  | 'groups_knockout'
  | 'groups_multi_cup'
  | 'round_robin_playoffs'
  | 'none'

export type Qualifier = {
  teamId: string
  teamName: string
  teamShortName: string | null
  teamLogoUrl: string | null
  teamPrimaryColor: string | null
  groupId: string | null
  groupCode: string | null
  groupPosition: number
  seed: number
  destination: string
  destinationLabel: string
}

export type QualifiersResult = {
  type: QualifierType
  bracketSize: number | null
  qualifiers: Qualifier[]
  totalSlots: number
  reason?: string
}

export async function getQualifiersByEdition(editionId: string): Promise<QualifiersResult> {
  const { data } = await api.get<QualifiersResult>('/standings/qualifiers', { params: { editionId } })
  return data
}
