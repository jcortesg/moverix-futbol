import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { editions } from './editions'

export const matchdays = pgTable('matchdays', {
  id: uuid('id').primaryKey().defaultRandom(),
  editionId: uuid('edition_id')
    .notNull()
    .references(() => editions.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  name: varchar('name', { length: 80 }),
  phase: varchar('phase', { length: 30 }).notNull().default('groups'),
  scheduledDate: timestamp('scheduled_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
