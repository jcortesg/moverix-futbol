import { pgTable, uuid, varchar, boolean, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core'
import { teams } from './teams'

export const teamRoleEnum = pgEnum('team_role', ['director', 'player'])

export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    playerUid: varchar('player_uid', { length: 128 }).notNull(),
    playerName: varchar('player_name', { length: 160 }).notNull(),
    role: teamRoleEnum('role').notNull().default('player'),
    // Rol dual: un director puede además figurar como jugador.
    isPlayer: boolean('is_player').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('team_members_team_player_unique').on(t.teamId, t.playerUid)],
)
