// ─── Enums ───────────────────────────────────────────────────────────────────

export type SportFormat = 'F5' | 'F8' | 'F11'
export type Gender = 'M' | 'F' | 'Mixed'
export type EditionStatus = 'draft' | 'registration' | 'active' | 'finished'
export type TournamentPhase = 'groups' | 'round_robin' | 'none'
export type BracketType = 'knockout' | 'multi_cup' | 'round_robin' | 'double_elimination' | 'none'
export type BracketRound = 'octavos' | 'cuartos' | 'semis' | 'final'
export type MatchStatus = 'scheduled' | 'in_progress' | 'finished'
export type MatchdayStatus = 'scheduled' | 'in_progress' | 'completed'
export type RegistrationStatus = 'pending' | 'approved' | 'rejected'
export type PaymentStatus = 'paid' | 'partial' | 'unpaid'
export type PaymentConcept = 'inscription' | 'deposit' | 'balance' | 'fine' | 'wo'
export type FineConcept = 'yellow_card' | 'red_card' | 'no_show' | 'wo'
export type UserRole = 'super_admin' | 'org_admin' | 'delegado' | 'jugador' | 'fan'

// ─── Tournament Format Config (JSONB) ────────────────────────────────────────

export type CupDistribution = 'reclassification' | 'group_position'
export type CupFormat = 'knockout' | 'groups_knockout'

export interface CupGroupsConfig {
  groupCount: number
  teamsPerGroup: number
  qualifiersPerGroup: number
  doubleLeg: boolean
}

export interface CupConfig {
  name: string       // "Copa A"
  from: number       // reclassification: global rank pos | group_position: pos within group
  to: number
  size: number       // bracket size (power of 2)
  format?: CupFormat
  groups?: CupGroupsConfig
  // Legacy fields (deprecated)
  fromRank?: number
  toRank?: number
  bracketSize?: number
}

export interface Phase1Config {
  kind: TournamentPhase
  groupCount?: number
  teamsPerGroup?: number
  qualifiersPerGroup?: number
  doubleLeg?: boolean
}

export interface Phase2Config {
  kind: BracketType
  bracketSize?: 4 | 8 | 16 | 32
  hasThirdPlace?: boolean
  hasRepechage?: boolean
  distribution?: CupDistribution
  cups?: CupConfig[]
  doubleLeg?: boolean
}

export type PhaseConfig = Phase1Config | Phase2Config

export interface FormatConfig {
  type: string
  phases: PhaseConfig[]
  /** @deprecated Use phases array instead */
  phase1?: Phase1Config
  /** @deprecated Use phases array instead */
  phase2?: Phase2Config
  tiebreakerRules?: TiebreakerRule[]
}

export type TiebreakerRule =
  | 'points'
  | 'goal_difference'
  | 'goals_for'
  | 'head_to_head'
  | 'goals_away'
  | 'fair_play'

// ─── Domain Entities ──────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  logoUrl?: string
  createdAt: string
}

export interface League {
  id: string
  orgId: string
  name: string
  sportFormat: SportFormat
  gender: Gender
  description?: string
  logoUrl?: string
  createdAt: string
}

export interface Edition {
  id: string
  leagueId: string
  name: string
  season: string
  startDate: string
  endDate: string
  status: EditionStatus
  formatConfig: FormatConfig
  inscriptionFee: number
  winnerTeamId?: string
  createdAt: string
}

export interface Team {
  id: string
  orgId: string
  name: string
  logoUrl?: string
  homeVenueId?: string
  createdAt: string
}

export interface Registration {
  id: string
  teamId: string
  editionId: string
  groupId?: string
  status: RegistrationStatus
  delegateName: string
  delegatePhone: string
  createdAt: string
}

export interface Group {
  id: string
  editionId: string
  name: string
  order: number
}

export interface Venue {
  id: string
  orgId: string
  name: string
  address?: string
  fieldsCount: number
}

export interface Referee {
  id: string
  orgId: string
  fullName: string
  phone?: string
}

export interface Matchday {
  id: string
  editionId: string
  number: number
  date: string
  status: MatchdayStatus
}

export interface Match {
  id: string
  editionId: string
  matchdayId: string
  groupId?: string
  homeTeamId: string
  awayTeamId: string
  homeScore?: number
  awayScore?: number
  venueId?: string
  fieldNumber?: number
  refereeId?: string
  scheduledTime: string
  status: MatchStatus
  isWalkover: boolean
}

export interface BracketSlot {
  pos: number
  homeTeamId?: string
  awayTeamId?: string
  matchId?: string
  winnerId?: string
}

export interface BracketRoundSlots {
  [round: string]: BracketSlot[]
}

export interface BracketState {
  [cup: string]: BracketRoundSlots
}

export interface Payment {
  id: string
  registrationId: string
  concept: PaymentConcept
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  paymentDate?: string
  status: PaymentStatus
  notes?: string
}

export interface Fine {
  id: string
  teamId: string
  editionId: string
  matchId?: string
  concept: FineConcept
  amount: number
  status: 'pending' | 'paid'
  paymentId?: string
}

// ─── Social / App ─────────────────────────────────────────────────────────────

export interface PlayerProfile {
  id: string
  userId: string
  fullName: string
  avatarUrl?: string
  position?: string
  dominantFoot?: 'left' | 'right' | 'both'
  birthDate?: string
  nationality?: string
  bio?: string
  createdAt: string
}

export interface PlayerStats {
  playerId: string
  editionId: string
  matches: number
  goals: number
  assists: number
  yellowCards: number
  redCards: number
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiError {
  statusCode: number
  message: string
  error?: string
}
