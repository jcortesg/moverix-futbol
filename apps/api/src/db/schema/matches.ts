import { pgTable, uuid, varchar, integer, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core'
import { matchdays } from './matchdays'
import { teams } from './teams'
import { venues } from './venues'
import { referees } from './referees'
import { groups } from './groups'

export const matchStatusEnum = pgEnum('match_status', [
  'scheduled',
  'live',
  'finished',
  'postponed',
  'cancelled',
  'walkover',
])

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchdayId: uuid('matchday_id')
    .notNull()
    .references(() => matchdays.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
  homeTeamId: uuid('home_team_id').references(() => teams.id, { onDelete: 'set null' }),
  awayTeamId: uuid('away_team_id').references(() => teams.id, { onDelete: 'set null' }),
  venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'set null' }),
  refereeId: uuid('referee_id').references(() => referees.id, { onDelete: 'set null' }),
  status: matchStatusEnum('status').notNull().default('scheduled'),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  homePenalties: integer('home_penalties'),
  awayPenalties: integer('away_penalties'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  isNeutral: boolean('is_neutral').notNull().default(false),
  round: varchar('round', { length: 40 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
