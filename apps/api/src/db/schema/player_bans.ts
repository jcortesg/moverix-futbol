import { pgTable, uuid, varchar, text, timestamp, date, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { organizations } from './organizations'

/**
 * Jugadores vetados por la organización. El veto vive en la cuenta, no en un
 * campeonato: se identifica por cédula porque la mayoría de vetados no tiene
 * cuenta en la app y porque crear una nueva no debe borrar la sanción.
 */
export const playerBans = pgTable(
  'player_bans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    docNumber: varchar('doc_number', { length: 40 }).notNull(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    reason: text('reason').notNull(),
    /** null = indefinido */
    until: date('until'),
    /** Se levanta sin borrar: el historial de sanciones se conserva. */
    liftedAt: timestamp('lifted_at', { withTimezone: true }),
    liftedReason: text('lifted_reason'),
    createdBy: varchar('created_by', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgDocActive: uniqueIndex('player_bans_org_doc_active_unique')
      .on(t.organizationId, t.docNumber)
      .where(sql`lifted_at IS NULL`),
    docIdx: index('player_bans_doc_idx').on(t.docNumber),
  }),
)
