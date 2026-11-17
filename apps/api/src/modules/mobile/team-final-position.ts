/**
 * Hasta dónde llegó un equipo en una edición, leído del cuadro eliminatorio
 * (bracket_slots). Función pura: no toca la BD, para poder probarla aislada.
 *
 * Modelo real del cuadro (ver brackets.service.ts):
 *  - round 1 = primera ronda; la final es la llave de la ronda más alta y sin
 *    next_slot_id. El ganador de cada llave sube por next_slot_id.
 *  - loser_next_slot_id manda al PERDEDOR a otra copa. Se usa para dos cosas:
 *    la copa de consolación ("Plata": bajan los perdedores de la 1ª ronda) y el
 *    partido por el tercer puesto (bajan los perdedores de las semifinales a una
 *    copa de una sola llave). Por eso "hay tercer puesto" NO es "existe algún
 *    loser_next_slot_id", sino: las semifinales de la copa principal envían a sus
 *    perdedores a una llave final (sin next_slot_id). Si no, los perdedores de
 *    semifinal quedan 'semifinal' y nunca se devuelve 'third'/'fourth' (regla de
 *    producto: no todos los torneos juegan tercer puesto).
 *
 * Copa principal (supuesto): la de cup_name 'main' si existe. Si no existe
 * (p. ej. groups_multi_cup con Copa A / Copa B), la primera copa creada que no
 * sea de consolación (ninguna de sus llaves recibe perdedores), a igualdad por
 * nombre. Solo esa copa cuenta para la posición final: ganar la Copa B o la
 * Plata no es ser campeón de la edición.
 *
 * Eliminados antes de cuartos (octavos, 16avos…): el contrato no tiene valor
 * para esas rondas, así que se devuelve null en vez de un dato falso.
 */

export type FinalPosition =
  | 'champion'
  | 'runner_up'
  | 'third'
  | 'fourth'
  | 'semifinal'
  | 'quarterfinal'
  | 'group'
  | null

export interface BracketSlotLite {
  id: string
  cupName: string
  round: number
  homeTeamId: string | null
  awayTeamId: string | null
  winnerId: string | null
  nextSlotId: string | null
  loserNextSlotId: string | null
  createdAt?: Date | string | null
}

export interface FinalPositionInput {
  /** Todas las llaves de la edición (todas las copas). */
  slots: BracketSlotLite[]
  teamId: string
  editionStatus: string
  /** Estado de la inscripción del equipo; rechazada/retirada → null. */
  registrationStatus?: string | null
}

export interface FinalPositionResult {
  finalPosition: FinalPosition
  playsThirdPlace: boolean
}

const NOT_IN_EDITION = new Set(['rejected', 'withdrawn', 'draft'])

function time(v: Date | string | null | undefined): number {
  if (!v) return Number.MAX_SAFE_INTEGER
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
}

/** Copa que define al campeón de la edición. null si no hay cuadro. */
export function pickMainCup(slots: BracketSlotLite[]): string | null {
  if (slots.length === 0) return null
  if (slots.some((s) => s.cupName === 'main')) return 'main'

  const loserTargets = new Set(slots.map((s) => s.loserNextSlotId).filter(Boolean) as string[])
  const cups = new Map<string, { first: number; consolation: boolean }>()
  for (const s of slots) {
    const c = cups.get(s.cupName) ?? { first: Number.MAX_SAFE_INTEGER, consolation: false }
    c.first = Math.min(c.first, time(s.createdAt))
    if (loserTargets.has(s.id)) c.consolation = true
    cups.set(s.cupName, c)
  }
  const ranked = [...cups.entries()]
    .filter(([, c]) => !c.consolation)
    .sort((a, b) => a[1].first - b[1].first || a[0].localeCompare(b[0]))
  return ranked[0]?.[0] ?? null
}

function involves(s: BracketSlotLite, teamId: string) {
  return s.homeTeamId === teamId || s.awayTeamId === teamId
}

/** Llave del partido por el tercer puesto, o null si la edición no lo juega. */
export function findThirdPlaceSlot(slots: BracketSlotLite[], mainCup: string): BracketSlotLite | null {
  const main = slots.filter((s) => s.cupName === mainCup)
  if (main.length === 0) return null
  const finalRound = Math.max(...main.map((s) => s.round))
  if (finalRound < 2) return null
  const semis = main.filter((s) => s.round === finalRound - 1)
  const targetIds = new Set(semis.map((s) => s.loserNextSlotId).filter(Boolean) as string[])
  if (targetIds.size !== 1) return null
  const [targetId] = [...targetIds]
  const target = slots.find((s) => s.id === targetId)
  // Debe ser un partido único (sin llave siguiente), no otro cuadro completo.
  return target && !target.nextSlotId ? target : null
}

export function computeFinalPosition(input: FinalPositionInput): FinalPositionResult {
  const { slots, teamId, editionStatus, registrationStatus } = input
  const mainCup = pickMainCup(slots)
  const thirdSlot = mainCup ? findThirdPlaceSlot(slots, mainCup) : null
  const playsThirdPlace = thirdSlot !== null

  if (editionStatus !== 'finished' || !mainCup) return { finalPosition: null, playsThirdPlace }
  if (registrationStatus && NOT_IN_EDITION.has(registrationStatus)) {
    return { finalPosition: null, playsThirdPlace }
  }

  const main = slots.filter((s) => s.cupName === mainCup)
  const finalRound = Math.max(...main.map((s) => s.round))
  const mine = main.filter((s) => involves(s, teamId))
  if (mine.length === 0) return { finalPosition: 'group', playsThirdPlace }

  // La llave más alta a la que llegó el equipo.
  const last = mine.reduce((a, b) => (b.round > a.round ? b : a))
  if (!last.winnerId) return { finalPosition: null, playsThirdPlace } // sin decidir

  const isFinal = last.round === finalRound && !last.nextSlotId
  if (isFinal) {
    return { finalPosition: last.winnerId === teamId ? 'champion' : 'runner_up', playsThirdPlace }
  }
  // Ganó su llave más alta pero no aparece en la siguiente: dato incompleto.
  if (last.winnerId === teamId) return { finalPosition: null, playsThirdPlace }

  const distance = finalRound - last.round
  if (distance === 1) {
    if (thirdSlot && involves(thirdSlot, teamId) && thirdSlot.winnerId) {
      return { finalPosition: thirdSlot.winnerId === teamId ? 'third' : 'fourth', playsThirdPlace }
    }
    return { finalPosition: 'semifinal', playsThirdPlace }
  }
  if (distance === 2) return { finalPosition: 'quarterfinal', playsThirdPlace }
  return { finalPosition: null, playsThirdPlace }
}
