import { ConflictException } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { editions, registrationPlayers, registrations } from '../../db/schema'

/**
 * Tope de jugadores por nómina (editions.max_players_per_team).
 *
 * Antes solo se revisaba al ENVIAR la nómina, así que una nómina ya enviada
 * (o los jugadores que entraban solos con el código) podía pasar del máximo:
 * Alianza Sur llegó a 33 con tope de 31. Ahora se revisa en cada alta.
 *
 * `adding` = cuántos jugadores NUEVOS (activos) va a sumar la operación.
 * Si la edición no tiene tope, no hace nada.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertRosterCapacity(db: any, registrationId: string, adding = 1): Promise<void> {
  if (adding <= 0) return
  const [row] = await db
    .select({ max: editions.maxPlayersPerTeam })
    .from(registrations)
    .innerJoin(editions, eq(editions.id, registrations.editionId))
    .where(eq(registrations.id, registrationId))
  const max: number | null | undefined = row?.max
  if (!max) return

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(registrationPlayers)
    .where(and(eq(registrationPlayers.registrationId, registrationId), isNull(registrationPlayers.removedAt)))

  if (n + adding > max) {
    const libres = Math.max(max - n, 0)
    throw new ConflictException(
      libres === 0
        ? `La nómina ya tiene ${n} jugadores y el máximo del torneo es ${max}. Retira a alguien para agregar otro.`
        : `Solo quedan ${libres} cupos en la nómina (máximo ${max} jugadores).`,
    )
  }
}

/** true si la nómina ya llegó al tope (para no meter a alguien que entra solo con el código). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rosterIsFull(db: any, registrationId: string): Promise<boolean> {
  try {
    await assertRosterCapacity(db, registrationId, 1)
    return false
  } catch (e) {
    if (e instanceof ConflictException) return true
    throw e
  }
}
