import { pgTable, uuid, varchar, integer, boolean, timestamp, date, text, uniqueIndex } from 'drizzle-orm/pg-core'
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
    // Claves de almacenamiento privadas (no URLs públicas).
    docFileUrl: text('doc_file_url'),
    photoFileUrl: text('photo_file_url'),
    emergencyContactName: varchar('emergency_contact_name', { length: 120 }),
    emergencyContactPhone: varchar('emergency_contact_phone', { length: 40 }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    // Baja logica: la fila nunca se borra, se marca. Conserva documento, foto y
    // dorsal, y mantiene al jugador ligado a sus goles del torneo.
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedBy: varchar('removed_by', { length: 128 }),
    // Código/enlace personal para que el jugador reclame una ficha creada por el
    // delegado sin cuenta (player_uid 'manual:'). Único en toda la plataforma.
    inviteCode: varchar('invite_code', { length: 8 }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (t) => ({
    registrationPlayerUnique: uniqueIndex('registration_players_reg_uid_unique').on(t.registrationId, t.playerUid),
    registrationEmailUnique: uniqueIndex('registration_players_reg_email_unique')
      .on(t.registrationId, t.email)
      .where(sql`${t.email} IS NOT NULL AND ${t.removedAt} IS NULL`),
    inviteCodeUnique: uniqueIndex('registration_players_invite_code_unique')
      .on(t.inviteCode)
      .where(sql`${t.inviteCode} IS NOT NULL`),
    registrationDocUnique: uniqueIndex('registration_players_reg_doc_unique')
      .on(t.registrationId, t.docNumber)
      .where(sql`${t.docNumber} IS NOT NULL AND ${t.removedAt} IS NULL`),
  }),
)
