import { PgDialect } from 'drizzle-orm/pg-core'
import { isTeamDelegate, teamDelegateCondition } from './team-delegates'

function makeDb(rows: unknown[]) {
  const chain: any = {
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  }
  for (const m of ['select', 'from', 'leftJoin', 'where', 'limit']) chain[m] = jest.fn().mockReturnValue(chain)
  return chain
}

describe('isTeamDelegate', () => {
  it('el delegado principal pasa sin consultar la BD', async () => {
    const db = makeDb([])
    await expect(isTeamDelegate(db, 'team-1', 'uid-1', 'uid-1')).resolves.toBe(true)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('un delegado adicional (team_members.role = director) pasa', async () => {
    const db = makeDb([{ id: 'team-1' }])
    await expect(isTeamDelegate(db, 'team-1', 'uid-2', 'uid-1')).resolves.toBe(true)
    expect(db.leftJoin).toHaveBeenCalled()
  })

  it('un jugador común no pasa', async () => {
    const db = makeDb([])
    await expect(isTeamDelegate(db, 'team-1', 'uid-3', 'uid-1')).resolves.toBe(false)
  })

  it('uid vacío nunca es delegado', async () => {
    const db = makeDb([{ id: 'team-1' }])
    await expect(isTeamDelegate(db, 'team-1', '', '')).resolves.toBe(false)
  })
})

describe('teamDelegateCondition', () => {
  it('incluye director_uid y los miembros con rol director', () => {
    const { sql, params } = new PgDialect().sqlToQuery(teamDelegateCondition('uid-9'))
    expect(sql).toContain('"director_uid" = $1')
    expect(sql).toContain("tm.role = 'director'")
    expect(params).toEqual(['uid-9', 'uid-9'])
  })
})
