import { pgTable, uuid, varchar, timestamp, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { teams } from './teams'

/** Delegado de juego (4to árbitro) asignado a un partido: puede registrar su flujo. */
export const matchDelegates = pgTable(
  'match_delegates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    /** null mientras la invitación esté pendiente (ver pendingEmail). */
    uid: varchar('uid', { length: 128 }),
    /** Correo con el que se invitó a alguien que aún no tiene cuenta. */
    pendingEmail: varchar('pending_email', { length: 160 }),
    /** Nombre que escribió el organizador, solo para mostrarlo mientras tanto. */
    invitedName: varchar('invited_name', { length: 120 }),
    /** referee_1 | referee_2 | referee_3 | fourth | delegate */
    role: varchar('role', { length: 16 }).notNull().default('delegate'),
    assignedByUid: varchar('assigned_by_uid', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    matchUidUnique: uniqueIndex('match_delegates_match_uid_unique').on(t.matchId, t.uid),
    uidIdx: index('match_delegates_uid_idx').on(t.uid),
  }),
)

/** Check-in de asistencia de jugadores por partido (quién se presentó a jugar). */
export const matchAttendance = pgTable(
  'match_attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    playerUid: varchar('player_uid', { length: 128 }).notNull(),
    present: boolean('present').notNull().default(false),
    checkedByUid: varchar('checked_by_uid', { length: 128 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    matchPlayerUnique: uniqueIndex('match_attendance_match_player_unique').on(t.matchId, t.playerUid),
    matchIdx: index('match_attendance_match_idx').on(t.matchId),
  }),
)
