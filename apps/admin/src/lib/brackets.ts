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
  /** Copa de consolación: a dónde baja el que pierde. null = queda eliminado. */
  loserNextSlotId?: string | null
  homeTeamName?: string | null
  awayTeamName?: string | null
  homeTeamLogoUrl?: string | null
  awayTeamLogoUrl?: string | null
  homeScore?: number | null
  awayScore?: number | null
  homePenalties?: number | null
  awayPenalties?: number | null
  matchStatus?: string | null
  scheduledAt?: string | null
  venueName?: string | null
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

export type ConsolationResult = {
  cupName: string
  sourceCup: string
  sourceRound: number
  bracketSize: number
  rounds: number
  slotsCreated: number
  linkedSlots: number
  /** Llaves de origen ya jugadas cuyo perdedor se bajó de una vez. */
  backfilled: number
  /** Byes en la ronda de origen: no producen perdedor y dejan huecos. */
  byesInSource: number
}

/**
 * Crea una copa que se llena con los PERDEDORES de una ronda de otra copa.
 * Distinto de generateBracket, que parte de los clasificados de la tabla.
 */
export async function generateConsolationBracket(
  editionId: string,
  cupName: string,
  sourceCup = 'main',
  sourceRound = 1,
): Promise<ConsolationResult> {
  const { data } = await api.post<ConsolationResult>('/brackets/generate-consolation', {
    editionId, cupName, sourceCup, sourceRound,
  })
  return data
}

export async function getBracket(editionId: string, cupName = 'main'): Promise<BracketSlotFromApi[]> {
  const { data } = await api.get<BracketSlotFromApi[]>('/brackets', { params: { editionId, cupName } })
  return data
}

/** Copas de la edición: la principal primero y las demás por fecha de creación. */
export async function getBracketCups(editionId: string): Promise<string[]> {
  const { data } = await api.get<string[]>('/brackets/cups', { params: { editionId } })
  return data
}

/**
 * Nombre visible de la copa según su orden: Copa A, Copa B, … Internamente la
 * consolación se llama como se escribió al crearla ("plata"), pero el
 * organizador la anuncia como Copa B. Misma regla que cupLabels en la API.
 */
export function cupLabel(cups: string[], cup: string): string {
  return `Copa ${String.fromCharCode(65 + Math.max(0, cups.indexOf(cup)))}`
}

export async function resetBracket(editionId: string, cupName = 'main'): Promise<{ deleted: number }> {
  const { data } = await api.delete<{ deleted: number }>('/brackets/reset', { params: { editionId, cupName } })
  return data
}
