import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool
  readonly db: ReturnType<typeof drizzle<typeof schema>>

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL })
    this.db = drizzle(this.pool, { schema })
  }

  async onModuleDestroy() {
    await this.pool.end()
  }
}
