import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { teams } from './teams'
import { teamRoleEnum } from './team_members'

/**
 * Exjugadores de un equipo: quien estuvo en team_members y ya no está.
 *
 * Es una tabla aparte (y no un "status" en team_members) porque muchas
 * consultas leen team_members como "miembros actuales"; cambiarle la semántica
 * es arriesgado. Se escribe en la misma transacción que borra la fila de
 * team_members (removeMember / leaveTeam) y se borra cuando la persona vuelve
 * a entrar al equipo (reactivación). Una fila por (equipo, jugador): si se va
 * otra vez, se actualizan left_at y reason. Ver 0043_team_former_members.sql
 */
export const teamFormerMembers = pgTable(
  'team_former_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    playerUid: varchar('player_uid', { length: 128 }).notNull(),
    playerName: varchar('player_name', { length: 160 }).notNull(),
    role: teamRoleEnum('role').notNull().default('player'),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    leftAt: timestamp('left_at', { withTimezone: true }).notNull().defaultNow(),
    /** 'removed' = lo sacó un delegado · 'left' = se fue él mismo. */
    reason: varchar('reason', { length: 10 }).$type<'removed' | 'left'>().notNull(),
    removedBy: varchar('removed_by', { length: 128 }),
  },
  (t) => ({
    teamPlayerUnique: uniqueIndex('team_former_members_team_player_unique').on(t.teamId, t.playerUid),
    playerIdx: index('team_former_members_player_idx').on(t.playerUid),
  }),
)
