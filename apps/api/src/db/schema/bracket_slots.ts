import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { editions } from './editions'
import { matches } from './matches'
import { teams } from './teams'

export const bracketSlots = pgTable('bracket_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  editionId: uuid('edition_id')
    .notNull()
    .references(() => editions.id, { onDelete: 'cascade' }),
  cupName: varchar('cup_name', { length: 40 }).notNull().default('main'),
  round: integer('round').notNull(),
  slot: integer('slot').notNull(),
  matchId: uuid('match_id').references(() => matches.id, { onDelete: 'set null' }),
  homeTeamId: uuid('home_team_id').references(() => teams.id, { onDelete: 'set null' }),
  awayTeamId: uuid('away_team_id').references(() => teams.id, { onDelete: 'set null' }),
  winnerId: uuid('winner_id').references(() => teams.id, { onDelete: 'set null' }),
  nextSlotId: uuid('next_slot_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
