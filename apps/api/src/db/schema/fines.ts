import { pgTable, uuid, varchar, integer, text, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core'
import { editions } from './editions'
import { teams } from './teams'
import { matches } from './matches'

export const fineStatusEnum = pgEnum('fine_status', ['pending', 'paid', 'waived'])

export const fineConceptEnum = pgEnum('fine_concept', [
  'yellow_card',                // amarilla suelta
  'yellow_card_accumulation',   // 3 amarillas acumuladas
  'red_card',                   // expulsión directa
  'walkover',                   // no presentación
  'late_arrival',               // llegada tardía
  'misconduct',                 // mala conducta del jugador
  'team_misconduct',            // mala conducta del equipo
  'other',
])

export const fines = pgTable('fines', {
  id: uuid('id').primaryKey().defaultRandom(),
  editionId: uuid('edition_id')
    .notNull()
    .references(() => editions.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  matchId: uuid('match_id').references(() => matches.id, { onDelete: 'set null' }),
  playerUid: varchar('player_uid', { length: 128 }),
  playerName: varchar('player_name', { length: 120 }),
  concept: fineConceptEnum('concept').notNull().default('other'),
  reason: text('reason').notNull(),
  amount: integer('amount').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('COP'),
  status: fineStatusEnum('status').notNull().default('pending'),
  sanction: varchar('sanction', { length: 80 }),
  matchesBanned: integer('matches_banned').notNull().default(0),
  appealed: boolean('appealed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
