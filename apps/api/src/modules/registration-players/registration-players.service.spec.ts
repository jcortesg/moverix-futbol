import { Test, TestingModule } from '@nestjs/testing'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { RegistrationPlayersService } from './registration-players.service'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'

const REG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

/** Mock fluido tipo Drizzle: cada método devuelve la cadena y es "thenable". */
function makeChain(value: unknown): any {
  const chain: any = {
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(value).then(resolve, reject),
  }
  for (const m of ['select', 'from', 'where', 'orderBy']) chain[m] = jest.fn().mockReturnValue(chain)
  return chain
}

const dialect = new PgDialect()
const whereSql = (chain: any): string => dialect.sqlToQuery(chain.where.mock.calls[0][0] as SQL).sql

describe('RegistrationPlayersService.findByRegistration', () => {
  let service: RegistrationPlayersService
  let chain: ReturnType<typeof makeChain>

  beforeEach(async () => {
    chain = makeChain([])
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationPlayersService,
        { provide: DatabaseService, useValue: { db: chain } },
        { provide: StorageService, useValue: {} },
      ],
    }).compile()
    service = module.get(RegistrationPlayersService)
  })

  it('por defecto excluye a los jugadores dados de baja (la app móvil no filtra)', async () => {
    await service.findByRegistration(REG_ID)
    const sql = whereSql(chain)
    expect(sql).toContain('"registration_id" = $1')
    expect(sql).toContain('"removed_at" is null')
  })

  it('con includeRemoved devuelve también los retirados (panel admin)', async () => {
    await service.findByRegistration(REG_ID, true)
    const sql = whereSql(chain)
    expect(sql).toContain('"registration_id" = $1')
    expect(sql).not.toContain('removed_at')
  })
})
