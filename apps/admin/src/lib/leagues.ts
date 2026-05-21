import { api } from './api'

export type LeagueFromApi = {
  id: string
  organizationId: string
  name: string
  slug: string
  sportFormat: 'F5' | 'F8' | 'F11'
  gender: 'M' | 'F' | 'Mixed'
  logoUrl: string | null
  bannerUrl: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export type EditionStatus = 'draft' | 'registration' | 'active' | 'finished'

export type FormatType =
  | 'groups_knockout'       // Fase de grupos → Eliminatoria
  | 'groups_multi_cup'      // Fase de grupos → Múltiples copas
  | 'round_robin_playoffs'  // Todos contra todos → Playoffs
  | 'knockout_only'         // Solo eliminatoria directa
  | 'round_robin_only'      // Solo todos contra todos (liga)

export type PhaseGroups = {
  kind: 'groups'
  groupCount: number
  teamsPerGroup: number
  qualifiersPerGroup: number
  doubleLeg: boolean
}

export type PhaseRoundRobin = {
  kind: 'round_robin'
  doubleLeg: boolean
}

export type PhaseKnockout = {
  kind: 'knockout'
  bracketSize: number
  hasThirdPlace: boolean
  hasRepechage: boolean
}

export type CupConfig = {
  name: string
  from: number
  to: number
  size: number
}

export type PhaseMultiCup = {
  kind: 'multi_cup'
  cups: CupConfig[]
}

export type FormatConfig = {
  type?: FormatType
  minutesPerHalf?: number
  hasExtraTime?: boolean
  hasPenalties?: boolean
  registrationOpen?: string
  registrationClose?: string
  phase1?: PhaseGroups | PhaseRoundRobin
  phase2?: PhaseKnockout | PhaseMultiCup
}

// ─── Tiebreaker rules ─────────────────────────────────────────────────────────

export type TiebreakerCriterion =
  | 'points'        // Puntos
  | 'goalDiff'      // Diferencia de gol
  | 'goalsFor'      // Goles a favor
  | 'goalsAgainst'  // Goles en contra (menos)
  | 'headToHead'    // Resultado directo
  | 'yellowCards'   // Menos amarillas (fair play)
  | 'redCards'      // Menos rojas
  | 'drawLots'      // Sorteo

export const TIEBREAKER_LABEL: Record<TiebreakerCriterion, string> = {
  points:       'Puntos',
  goalDiff:     'Diferencia de gol',
  goalsFor:     'Goles a favor',
  goalsAgainst: 'Goles en contra',
  headToHead:   'Resultado directo',
  yellowCards:  'Menos amarillas',
  redCards:     'Menos rojas',
  drawLots:     'Sorteo',
}

export type TiebreakerRules = {
  winPts: number
  drawPts: number
  lossPts: number
  allowDraw: boolean
  order: TiebreakerCriterion[]
}

export const DEFAULT_TIEBREAKERS: TiebreakerRules = {
  winPts: 3,
  drawPts: 1,
  lossPts: 0,
  allowDraw: true,
  order: ['points', 'goalDiff', 'goalsFor', 'headToHead', 'yellowCards'],
}

export type EditionFromApi = {
  id: string
  leagueId: string
  name: string
  season: string
  status: EditionStatus
  formatConfig: FormatConfig
  tiebreakerRules: TiebreakerRules | null
  maxTeams: number
  registrationFee: number
  prizePool: number
  currency: string
  logoUrl: string | null
  bannerUrl: string | null
  rulesUrl: string | null
  slug: string
  isPublished: boolean
  publicDescription: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}

export type OrganizationFromApi = {
  id: string
  name: string
  slug: string
  city: string | null
  logoUrl: string | null
  ownerUid: string
  createdAt: string
  updatedAt: string
}

export async function getMyOrganization(): Promise<OrganizationFromApi | null> {
  const { data } = await api.get<OrganizationFromApi[]>('/organizations')
  return data[0] ?? null
}

export async function getLeaguesByOrg(organizationId: string): Promise<LeagueFromApi[]> {
  const { data } = await api.get<LeagueFromApi[]>(`/leagues?organizationId=${organizationId}`)
  return data
}

export async function getLeague(id: string): Promise<LeagueFromApi> {
  const { data } = await api.get<LeagueFromApi>(`/leagues/${id}`)
  return data
}

export async function getEditionsByLeague(leagueId: string): Promise<EditionFromApi[]> {
  const { data } = await api.get<EditionFromApi[]>(`/editions?leagueId=${leagueId}`)
  return data
}

export async function updateLeague(
  id: string,
  dto: Partial<Pick<LeagueFromApi, 'name' | 'sportFormat' | 'gender' | 'description'>>,
): Promise<LeagueFromApi> {
  const { data } = await api.patch<LeagueFromApi>(`/leagues/${id}`, dto)
  return data
}

export async function uploadLeagueLogo(id: string, file: File): Promise<LeagueFromApi> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<LeagueFromApi>(`/leagues/${id}/logo`, form)
  return data
}

export async function uploadLeagueBanner(id: string, file: File): Promise<LeagueFromApi> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<LeagueFromApi>(`/leagues/${id}/banner`, form)
  return data
}

export async function getEdition(id: string): Promise<EditionFromApi> {
  const { data } = await api.get<EditionFromApi>(`/editions/${id}`)
  return data
}

export type CreateEditionDto = {
  leagueId: string
  name: string
  season: string
  startDate?: string
  endDate?: string
  maxTeams?: number
  registrationFee?: number
  prizePool?: number
  currency?: string
  rulesUrl?: string
  formatConfig: FormatConfig
  tiebreakerRules?: TiebreakerRules
}

export async function createEdition(dto: CreateEditionDto): Promise<EditionFromApi> {
  const { data } = await api.post<EditionFromApi>('/editions', dto)
  return data
}

export async function updateEdition(
  id: string,
  dto: Partial<Pick<EditionFromApi, 'name' | 'season' | 'status' | 'maxTeams' | 'registrationFee' | 'prizePool' | 'currency' | 'startDate' | 'endDate' | 'rulesUrl' | 'isPublished' | 'publicDescription'>>
    & { formatConfig?: FormatConfig; tiebreakerRules?: TiebreakerRules },
): Promise<EditionFromApi> {
  const { data } = await api.patch<EditionFromApi>(`/editions/${id}`, dto)
  return data
}

export async function uploadEditionLogo(id: string, file: File): Promise<EditionFromApi> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<EditionFromApi>(`/editions/${id}/logo`, form)
  return data
}

export async function uploadEditionBanner(id: string, file: File): Promise<EditionFromApi> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<EditionFromApi>(`/editions/${id}/banner`, form)
  return data
}

export async function updateOrganization(
  id: string,
  dto: Partial<Pick<OrganizationFromApi, 'name' | 'city'>>,
): Promise<OrganizationFromApi> {
  const { data } = await api.patch<OrganizationFromApi>(`/organizations/${id}`, dto)
  return data
}

export async function uploadOrganizationLogo(id: string, file: File): Promise<OrganizationFromApi> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<OrganizationFromApi>(`/organizations/${id}/logo`, form)
  return data
}
