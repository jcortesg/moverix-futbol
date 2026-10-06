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

export type CupFormat = 'knockout' | 'groups_knockout' | 'league'

export type CupGroupsConfig = {
  groupCount: number
  teamsPerGroup: number
  qualifiersPerGroup: number
  doubleLeg: boolean
}

export type CupConfig = {
  name: string
  from: number
  to: number
  size: number
  format?: CupFormat
  groups?: CupGroupsConfig
  hasThirdPlace?: boolean
  hasCrossover?: boolean
  doubleLeg?: boolean
}

export type CupDistribution = 'reclassification' | 'group_position'

export const CUP_DISTRIBUTION_LABEL: Record<CupDistribution, string> = {
  reclassification: 'Reclasificación general',
  group_position: 'Posición en el grupo',
}

export type PhaseMultiCup = {
  kind: 'multi_cup'
  distribution?: CupDistribution
  cups: CupConfig[]
}

export type PhaseConfig = PhaseGroups | PhaseRoundRobin | PhaseKnockout | PhaseMultiCup

export type PhaseKind = PhaseConfig['kind']

export const PHASE_KIND_LABEL: Record<PhaseKind, string> = {
  groups: 'Grupos',
  round_robin: 'Todos vs Todos',
  knockout: 'Eliminatoria',
  multi_cup: 'Multi-Copa',
}

export type FormatConfig = {
  type?: FormatType
  minutesPerHalf?: number
  hasExtraTime?: boolean
  hasPenalties?: boolean
  registrationOpen?: string
  registrationClose?: string
  phases: PhaseConfig[]
}

/**
 * Normalize legacy formatConfig (phase1/phase2) into phases array.
 * Safe to call on already-normalized data.
 */
export function normalizeFormatConfig(raw: Record<string, unknown> | FormatConfig | undefined): FormatConfig {
  if (!raw) return { phases: [] }
  // Already normalized
  if (Array.isArray((raw as FormatConfig).phases)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { phase1, phase2, ...rest } = raw as FormatConfig & { phase1?: unknown; phase2?: unknown }
    return rest as FormatConfig
  }
  // Legacy: convert phase1/phase2 → phases[]
  const { phase1, phase2, ...rest } = raw as Record<string, unknown>
  const phases: PhaseConfig[] = []
  if (phase1 && typeof phase1 === 'object' && 'kind' in phase1) phases.push(phase1 as PhaseConfig)
  if (phase2 && typeof phase2 === 'object' && 'kind' in phase2) phases.push(phase2 as PhaseConfig)
  return { ...rest, phases } as FormatConfig
}

/** Find the first phase of a given kind */
export function findPhase<K extends PhaseKind>(
  phases: PhaseConfig[],
  kind: K,
): Extract<PhaseConfig, { kind: K }> | undefined {
  return phases.find((p) => p.kind === kind) as Extract<PhaseConfig, { kind: K }> | undefined
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
  minPlayersPerTeam: number | null
  maxPlayersPerTeam: number | null
  requiredPlayerFields: string[]
  registrationFee: number
  prizePool: number
  currency: string
  logoUrl: string | null
  bannerUrl: string | null
  rulesUrl: string | null
  slug: string
  isPublished: boolean
  registrationsOpen: boolean
  /** Cierre GENERAL de nóminas (manda sobre el candado de cada equipo). */
  rostersLocked: boolean
  /** Clave pública del widget embebible; null = desactivado. */
  embedKey: string | null
  publicDescription: string | null
  /** Multas y sanciones de este torneo; null = usa los valores por defecto. */
  fineDefaults: Record<string, unknown> | null
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

export async function getMyOrganizations(): Promise<OrganizationFromApi[]> {
  const { data } = await api.get<OrganizationFromApi[]>('/organizations')
  return data
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

// Campos del jugador que el organizador puede marcar como requeridos en la
// inscripción. Debe coincidir con ROSTER_PLAYER_FIELDS del backend.
export const ROSTER_PLAYER_FIELDS: { key: string; label: string }[] = [
  { key: 'firstName', label: 'Nombre' },
  { key: 'lastName', label: 'Apellido' },
  { key: 'docNumber', label: 'Documento' },
  { key: 'birthDate', label: 'Fecha de nacimiento' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Email' },
  { key: 'employer', label: 'Empresa' },
  { key: 'healthProvider', label: 'EPS' },
  { key: 'jerseyNumber', label: 'Dorsal' },
  { key: 'position', label: 'Posición' },
  { key: 'photoFileUrl', label: 'Foto' },
  { key: 'docFileUrl', label: 'Documento (archivo)' },
  { key: 'emergencyContactName', label: 'Contacto de emergencia (nombre)' },
  { key: 'emergencyContactPhone', label: 'Contacto de emergencia (teléfono)' },
]

export const DEFAULT_REQUIRED_PLAYER_FIELDS = ['firstName', 'lastName', 'docNumber', 'birthDate']

export async function updateEdition(
  id: string,
  dto: Partial<Pick<EditionFromApi, 'name' | 'season' | 'status' | 'maxTeams' | 'minPlayersPerTeam' | 'maxPlayersPerTeam' | 'requiredPlayerFields' | 'registrationFee' | 'prizePool' | 'currency' | 'startDate' | 'endDate' | 'rulesUrl' | 'isPublished' | 'registrationsOpen' | 'rostersLocked' | 'publicDescription' | 'fineDefaults'>>
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

/** Genera (o regenera) la clave del widget. Regenerarla revoca la anterior. */
export async function generateEmbedKey(editionId: string): Promise<{ embedKey: string }> {
  const { data } = await api.post<{ embedKey: string }>(`/editions/${editionId}/embed-key`)
  return data
}

/** Desactiva el widget: la clave deja de responder. */
export async function revokeEmbedKey(editionId: string): Promise<void> {
  await api.delete(`/editions/${editionId}/embed-key`)
}
