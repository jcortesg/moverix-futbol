import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { editions } from './editions'
import { teams } from './teams'

export const playerStats = pgTable('player_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  editionId: uuid('edition_id')
    .notNull()
    .references(() => editions.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  playerUid: varchar('player_uid', { length: 128 }).notNull(),
  playerName: varchar('player_name', { length: 120 }).notNull(),
  matchesPlayed: integer('matches_played').notNull().default(0),
  goals: integer('goals').notNull().default(0),
  assists: integer('assists').notNull().default(0),
  yellowCards: integer('yellow_cards').notNull().default(0),
  redCards: integer('red_cards').notNull().default(0),
  minutesPlayed: integer('minutes_played').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
