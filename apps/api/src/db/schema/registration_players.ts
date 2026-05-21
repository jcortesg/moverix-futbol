import { pgTable, uuid, varchar, integer, boolean, timestamp, date, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { registrations } from './registrations'
import { playerPositionEnum } from './player_profiles'

export const registrationPlayers = pgTable(
  'registration_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    registrationId: uuid('registration_id')
      .notNull()
      .references(() => registrations.id, { onDelete: 'cascade' }),
    playerUid: varchar('player_uid', { length: 128 }).notNull(),
    playerName: varchar('player_name', { length: 160 }).notNull(),
    firstName: varchar('first_name', { length: 80 }),
    lastName: varchar('last_name', { length: 80 }),
    docNumber: varchar('doc_number', { length: 40 }),
    birthDate: date('birth_date'),
    employer: varchar('employer', { length: 120 }),
    phone: varchar('phone', { length: 40 }),
    email: varchar('email', { length: 160 }),
    healthProvider: varchar('health_provider', { length: 80 }),
    jerseyNumber: integer('jersey_number'),
    position: playerPositionEnum('position'),
    isCaptain: boolean('is_captain').notNull().default(false),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    registrationPlayerUnique: uniqueIndex('registration_players_reg_uid_unique').on(t.registrationId, t.playerUid),
    registrationEmailUnique: uniqueIndex('registration_players_reg_email_unique')
      .on(t.registrationId, t.email)
      .where(sql`${t.email} IS NOT NULL`),
    registrationDocUnique: uniqueIndex('registration_players_reg_doc_unique')
      .on(t.registrationId, t.docNumber)
      .where(sql`${t.docNumber} IS NOT NULL`),
  }),
)
