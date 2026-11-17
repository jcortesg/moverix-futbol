import { computeFinalPosition, pickMainCup, type BracketSlotLite } from './team-final-position'

/**
 * Cuadro de 8 en la copa 'main' (cuartos = ronda 1, semis = 2, final = 3):
 *   QF: A-B (gana A), C-D (gana C), E-F (gana E), G-H (gana G)
 *   SF: A-C (gana A), E-G (gana G)
 *   F : A-G (gana A)
 */
function bracket8(opts: { thirdPlace?: 'decided' | 'pending'; finalWinner?: string | null } = {}) {
  const slot = (
    id: string,
    round: number,
    home: string | null,
    away: string | null,
    winner: string | null,
    next: string | null,
    cupName = 'main',
  ): BracketSlotLite => ({
    id, cupName, round, homeTeamId: home, awayTeamId: away, winnerId: winner, nextSlotId: next, loserNextSlotId: null,
  })
  const slots: BracketSlotLite[] = [
    slot('qf1', 1, 'A', 'B', 'A', 'sf1'),
    slot('qf2', 1, 'C', 'D', 'C', 'sf1'),
    slot('qf3', 1, 'E', 'F', 'E', 'sf2'),
    slot('qf4', 1, 'G', 'H', 'G', 'sf2'),
    slot('sf1', 2, 'A', 'C', 'A', 'f'),
    slot('sf2', 2, 'E', 'G', 'G', 'f'),
    slot('f', 3, 'A', 'G', opts.finalWinner === undefined ? 'A' : opts.finalWinner, null),
  ]
  if (opts.thirdPlace) {
    slots.find((s) => s.id === 'sf1')!.loserNextSlotId = 'third'
    slots.find((s) => s.id === 'sf2')!.loserNextSlotId = 'third'
    slots.push(slot('third', 1, 'C', 'E', opts.thirdPlace === 'decided' ? 'E' : null, null, '3er puesto'))
  }
  return slots
}

const pos = (slots: BracketSlotLite[], teamId: string, editionStatus = 'finished', registrationStatus?: string) =>
  computeFinalPosition({ slots, teamId, editionStatus, registrationStatus })

describe('computeFinalPosition', () => {
  it('campeón y subcampeón salen de la final', () => {
    const slots = bracket8()
    expect(pos(slots, 'A').finalPosition).toBe('champion')
    expect(pos(slots, 'G').finalPosition).toBe('runner_up')
  })

  it('sin partido por el tercer puesto, los perdedores de semis son "semifinal"', () => {
    const slots = bracket8()
    expect(pos(slots, 'C')).toEqual({ finalPosition: 'semifinal', playsThirdPlace: false })
    expect(pos(slots, 'E')).toEqual({ finalPosition: 'semifinal', playsThirdPlace: false })
  })

  it('con tercer puesto jugado: ganador "third", perdedor "fourth"', () => {
    const slots = bracket8({ thirdPlace: 'decided' })
    expect(pos(slots, 'E')).toEqual({ finalPosition: 'third', playsThirdPlace: true })
    expect(pos(slots, 'C')).toEqual({ finalPosition: 'fourth', playsThirdPlace: true })
    // La llave de tercer puesto no cambia la copa principal ni al campeón.
    expect(pos(slots, 'A').finalPosition).toBe('champion')
  })

  it('tercer puesto sin jugar: los semifinalistas quedan "semifinal"', () => {
    const slots = bracket8({ thirdPlace: 'pending' })
    expect(pos(slots, 'C')).toEqual({ finalPosition: 'semifinal', playsThirdPlace: true })
  })

  it('eliminados en cuartos', () => {
    expect(pos(bracket8(), 'B').finalPosition).toBe('quarterfinal')
    expect(pos(bracket8(), 'H').finalPosition).toBe('quarterfinal')
  })

  it('equipo de la edición que no entró al cuadro → "group"', () => {
    expect(pos(bracket8(), 'Z').finalPosition).toBe('group')
  })

  it('inscripción rechazada o retirada → null', () => {
    expect(pos(bracket8(), 'Z', 'finished', 'withdrawn').finalPosition).toBeNull()
    expect(pos(bracket8(), 'Z', 'finished', 'rejected').finalPosition).toBeNull()
  })

  it('edición sin terminar → null, pero informa si juega tercer puesto', () => {
    expect(pos(bracket8(), 'A', 'active')).toEqual({ finalPosition: null, playsThirdPlace: false })
    expect(pos(bracket8({ thirdPlace: 'pending' }), 'A', 'active')).toEqual({ finalPosition: null, playsThirdPlace: true })
  })

  it('edición sin cuadro (solo liga) → null', () => {
    expect(pos([], 'A')).toEqual({ finalPosition: null, playsThirdPlace: false })
  })

  it('final sin decidir → null para los finalistas', () => {
    const slots = bracket8({ finalWinner: null })
    expect(pos(slots, 'A').finalPosition).toBeNull()
    expect(pos(slots, 'G').finalPosition).toBeNull()
    expect(pos(slots, 'C').finalPosition).toBe('semifinal')
  })

  it('eliminado antes de cuartos (octavos) → null: el contrato no tiene ese valor', () => {
    const slots = bracket8().map((s) => ({ ...s, round: s.round + 1 }))
    slots.push({
      id: 'r16', cupName: 'main', round: 1, homeTeamId: 'A', awayTeamId: 'X', winnerId: 'A', nextSlotId: 'qf1', loserNextSlotId: null,
    })
    expect(pos(slots, 'X').finalPosition).toBeNull()
    expect(pos(slots, 'B').finalPosition).toBe('quarterfinal')
  })

  it('copa de consolación (Plata) desde la 1ª ronda NO es tercer puesto', () => {
    const slots = bracket8()
    for (const id of ['qf1', 'qf2']) slots.find((s) => s.id === id)!.loserNextSlotId = 'plata-f'
    slots.push({
      id: 'plata-f', cupName: 'Plata', round: 1, homeTeamId: 'B', awayTeamId: 'D', winnerId: 'B', nextSlotId: null, loserNextSlotId: null,
    })
    expect(pos(slots, 'C')).toEqual({ finalPosition: 'semifinal', playsThirdPlace: false })
    // Ganar la Plata no es ser campeón de la edición.
    expect(pos(slots, 'B').finalPosition).toBe('quarterfinal')
  })
})

describe('pickMainCup', () => {
  const s = (id: string, cupName: string, createdAt: string, loserNextSlotId: string | null = null): BracketSlotLite => ({
    id, cupName, round: 1, homeTeamId: null, awayTeamId: null, winnerId: null, nextSlotId: null, loserNextSlotId, createdAt,
  })

  it("prefiere 'main' si existe", () => {
    expect(pickMainCup([s('1', 'Copa B', '2026-01-01'), s('2', 'main', '2026-02-01')])).toBe('main')
  })

  it('sin main, la primera copa creada que no sea de consolación', () => {
    expect(
      pickMainCup([
        s('p', 'Plata', '2025-12-01'),
        s('a', 'Copa A', '2026-01-01', 'p'),
        s('b', 'Copa B', '2026-01-02'),
      ]),
    ).toBe('Copa A')
  })

  it('sin llaves → null', () => {
    expect(pickMainCup([])).toBeNull()
  })
})
