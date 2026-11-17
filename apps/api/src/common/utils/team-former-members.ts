import { and, eq, sql } from 'drizzle-orm'
import type { DatabaseService } from '../../db/database.service'
import { teamFormerMembers, teamMembers } from '../../db/schema'

type Db = DatabaseService['db']
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type DbOrTx = Db | Tx

export type FormerMemberReason = 'removed' | 'left'

/**
 * Saca a alguien del equipo dejando rastro en team_former_members, en una sola
 * transacción: borra su fila de team_members y la copia como exjugador. Si ya
 * se había ido antes (y volvió), se actualiza esa misma fila.
 * Devuelve false si no era miembro (no escribe nada).
 */
export async function retireTeamMember(
  db: Db,
  teamId: string,
  playerUid: string,
  reason: FormerMemberReason,
  removedBy: string | null,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [gone] = await tx
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.playerUid, playerUid)))
      .returning({
        playerName: teamMembers.playerName,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
    if (!gone) return false

    await tx
      .insert(teamFormerMembers)
      .values({
        teamId,
        playerUid,
        playerName: gone.playerName,
        role: gone.role,
        joinedAt: gone.joinedAt,
        reason,
        removedBy: reason === 'removed' ? removedBy : null,
      })
      .onConflictDoUpdate({
        target: [teamFormerMembers.teamId, teamFormerMembers.playerUid],
        set: {
          playerName: gone.playerName,
          role: gone.role,
          joinedAt: gone.joinedAt,
          leftAt: sql`now()`,
          reason,
          removedBy: reason === 'removed' ? removedBy : null,
        },
      })
    return true
  })
}

/**
 * Reactivación: quien vuelve a entrar al equipo deja de ser exjugador. Se llama
 * en todos los caminos que insertan en team_members (unirse con código, reclamar
 * ficha, inscribirlo en una nómina…). Idempotente y barato (índice único).
 */
export async function reactivateFormerMember(db: DbOrTx, teamId: string, playerUid: string) {
  await db
    .delete(teamFormerMembers)
    .where(and(eq(teamFormerMembers.teamId, teamId), eq(teamFormerMembers.playerUid, playerUid)))
}
