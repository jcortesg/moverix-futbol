import { pgTable, uuid, varchar, integer, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { matches } from './matches'
import { teams } from './teams'

export const eventTypeEnum = pgEnum('event_type', [
  'goal',
  'own_goal',
  'yellow_card',
  'red_card',
  'substitution',
  'penalty_scored',
  'penalty_missed',
  'mvp',
])

export const matchEvents = pgTable(
  'match_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    eventType: eventTypeEnum('event_type').notNull(),
    minute: integer('minute'),
    playerUid: varchar('player_uid', { length: 128 }),
    playerName: varchar('player_name', { length: 120 }),
    assistPlayerUid: varchar('assist_player_uid', { length: 128 }),
    assistPlayerName: varchar('assist_player_name', { length: 120 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    oneMvpPerMatch: uniqueIndex('match_events_one_mvp_per_match')
      .on(t.matchId)
      .where(sql`${t.eventType} = 'mvp'`),
  }),
)
