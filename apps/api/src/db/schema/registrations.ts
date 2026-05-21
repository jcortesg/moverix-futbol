import { pgTable, uuid, varchar, integer, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core'
import { editions } from './editions'
import { teams } from './teams'
import { groups } from './groups'

export const registrationStatusEnum = pgEnum('registration_status', [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
])

export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionId: uuid('edition_id')
      .notNull()
      .references(() => editions.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    status: registrationStatusEnum('status').notNull().default('pending'),
    registeredByUid: varchar('registered_by_uid', { length: 128 }),
    seedRank: integer('seed_rank'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    editionTeamUnique: uniqueIndex('registrations_edition_team_unique').on(t.editionId, t.teamId),
  }),
)
