/**
 * Geometría del cuadro de llaves.
 *
 * El cuadro se arma siguiendo nextSlotId, no la posición del slot: con byes la
 * primera ronda es un repechaje con menos llaves que una ronda completa, y ahí
 * la relación padre/hijo ya no es 2i / 2i+1.
 */
import type { BracketSlotFromApi } from './brackets'

export const CARD_W = 208
export const ROW_H = 40
export const META_H = 34
export const CARD_H = ROW_H * 2 + META_H
export const GAP = 22
export const STEP = CARD_H + GAP
export const CHANNEL = 48
export const COL_W = CARD_W + CHANNEL
export const HEADER_H = 44

export type BracketLayout = {
  rounds: number[]
  childrenOf: Map<string, BracketSlotFromApi[]>
  center: Map<string, number>
  width: number
  height: number
}

/** Lo mínimo que necesita el layout: así el test no arma slots completos. */
type LayoutInput = Pick<BracketSlotFromApi, 'id' | 'round' | 'slot' | 'nextSlotId'>

/**
 * Posiciona cada llave verticalmente: se centra sobre sus hijos y, si no tiene
 * (entró por bye), toma el siguiente hueco libre de su ronda.
 */
export function buildLayout<T extends LayoutInput>(slots: T[]): BracketLayout {
  const byRound = new Map<number, T[]>()
  const childrenOf = new Map<string, T[]>()

  for (const s of slots) {
    const list = byRound.get(s.round)
    if (list) list.push(s)
    else byRound.set(s.round, [s])

    if (s.nextSlotId) {
      const kids = childrenOf.get(s.nextSlotId)
      if (kids) kids.push(s)
      else childrenOf.set(s.nextSlotId, [s])
    }
  }

  const rounds = [...byRound.keys()].sort((a, b) => a - b)
  const center = new Map<string, number>()

  for (const r of rounds) {
    const list = (byRound.get(r) ?? []).sort((a, b) => a.slot - b.slot)
    let nextFree = STEP / 2
    for (const sl of list) {
      const kidCenters = (childrenOf.get(sl.id) ?? [])
        .map((k) => center.get(k.id))
        .filter((n): n is number => n !== undefined)

      let c = kidCenters.length
        ? (Math.min(...kidCenters) + Math.max(...kidCenters)) / 2
        : nextFree
      if (c < nextFree) c = nextFree

      center.set(sl.id, c)
      nextFree = c + STEP
    }
  }

  const centers = [...center.values()]
  const maxCenter = centers.length ? Math.max(...centers) : STEP / 2

  return {
    rounds,
    childrenOf: childrenOf as unknown as Map<string, BracketSlotFromApi[]>,
    center,
    width: rounds.length * COL_W - CHANNEL,
    height: HEADER_H + maxCenter + CARD_H / 2,
  }
}
