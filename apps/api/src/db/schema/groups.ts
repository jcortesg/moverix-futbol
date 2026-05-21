import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { editions } from './editions'

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  editionId: uuid('edition_id')
    .notNull()
    .references(() => editions.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 40 }).notNull(),
  code: varchar('code', { length: 5 }).notNull(),
  phase: varchar('phase', { length: 20 }).notNull().default('groups'),
  maxTeams: integer('max_teams'),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
