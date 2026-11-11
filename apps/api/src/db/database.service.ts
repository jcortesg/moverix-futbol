import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/node-postgres'
import { DatabaseError, Pool, type PoolClient } from 'pg'
import * as schema from './schema'
import { currentActor } from '../common/context/actor-context'

type TrackedClient = PoolClient & { __actorKey?: string }

/**
 * Deja en la conexión quién hace la petición (app.actor_uid / app.actor_email)
 * para que los triggers del log de cambios lo registren. Solo emite el SET
 * cuando el actor de la conexión cambia, así la mayoría de consultas no pagan
 * un viaje extra. Sin usuario se deja vacío para no heredar el de otra petición.
 */
async function syncActor(client: TrackedClient) {
  const actor = currentActor()
  const uid = actor?.uid ?? ''
  const email = actor?.email ?? ''
  const key = `${uid}|${email}`
  if (client.__actorKey === key) return
  await client.query(
    "SELECT set_config('app.actor_uid', $1, false), set_config('app.actor_email', $2, false)",
    [uid, email],
  )
  client.__actorKey = key
}

export function instrumentPool(pool: Pool): Pool {
  const rawConnect = pool.connect.bind(pool) as () => Promise<PoolClient>
  const rawQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown

  // Transacciones de Drizzle: pool.connect() → BEGIN … COMMIT en ese cliente.
  pool.connect = (async (...args: unknown[]) => {
    if (typeof args[0] === 'function') return (rawConnect as (...a: unknown[]) => unknown)(...args)
    const client = (await rawConnect()) as TrackedClient
    try {
      await syncActor(client)
    } catch (err) {
      client.release(err as Error)
      throw err
    }
    return client
  }) as Pool['connect']

  // Consultas sueltas: igual que pool.query (connect → query → release) pero
  // con el actor puesto en el mismo cliente.
  pool.query = (async (...args: unknown[]) => {
    if (typeof args[args.length - 1] === 'function') return rawQuery(...args)
    const client = (await rawConnect()) as TrackedClient
    try {
      await syncActor(client)
      const result = await (client.query as (...a: unknown[]) => Promise<unknown>)(...args)
      client.release()
      return result
    } catch (err) {
      // Error de SQL: la conexión sigue sana. Otro error: se descarta.
      client.release(err instanceof DatabaseError ? undefined : (err as Error))
      throw err
    }
  }) as Pool['query']

  return pool
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool
  readonly db: ReturnType<typeof drizzle<typeof schema>>

  constructor() {
    this.pool = instrumentPool(new Pool({ connectionString: process.env.DATABASE_URL }))
    this.db = drizzle(this.pool, { schema })
  }

  async onModuleDestroy() {
    await this.pool.end()
  }
}
