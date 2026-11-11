import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm'
import type { DatabaseService } from '../../db/database.service'
import { teamMembers, teams } from '../../db/schema'

type Db = DatabaseService['db']

/**
 * Un equipo puede tener varios delegados:
 *  - el delegado PRINCIPAL: `teams.director_uid` (dueño del equipo; no se puede
 *    remover ni abandonar el equipo), y
 *  - delegados ADICIONALES: miembros con `team_members.role = 'director'`.
 * Todos tienen los mismos permisos de gestión (invitar, nómina, inscribir).
 */
export async function isTeamDelegate(
  db: Db,
  teamId: string,
  uid: string,
  directorUid?: string | null,
): Promise<boolean> {
  if (!uid) return false
  if (directorUid !== undefined && directorUid === uid) return true

  const [row] = await db
    .select({ id: teams.id })
    .from(teams)
    .leftJoin(
      teamMembers,
      and(eq(teamMembers.teamId, teams.id), eq(teamMembers.playerUid, uid), eq(teamMembers.role, 'director')),
    )
    .where(and(eq(teams.id, teamId), or(eq(teams.directorUid, uid), sql`${teamMembers.id} IS NOT NULL`)))
    .limit(1)
  return !!row
}

/** Condición SQL: el uid es delegado (principal o adicional) del equipo `teams.id`. */
export function teamDelegateCondition(uid: string): SQL {
  return or(
    eq(teams.directorUid, uid),
    sql`EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = ${teams.id} AND tm.player_uid = ${uid} AND tm.role = 'director')`,
  ) as SQL
}

/** Ids de los equipos donde el uid es delegado (principal o adicional). */
export async function delegateTeamIds(db: Db, uid: string, teamIds?: string[]): Promise<string[]> {
  if (teamIds && !teamIds.length) return []
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(teamIds ? and(inArray(teams.id, teamIds), teamDelegateCondition(uid)) : teamDelegateCondition(uid))
  return rows.map((r) => r.id)
}
