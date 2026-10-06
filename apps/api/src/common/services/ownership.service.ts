import { Injectable, ForbiddenException } from '@nestjs/common'
import { eq, and } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import {
  organizationMembers,
  leagues,
  editions,
  registrations,
  venues,
  referees,
  matches,
  matchdays,
  groups,
  payments,
  fines,
  matchEvents,
  registrationPlayers,
  bracketSlots,
  teams,
  teamMembers,
  matchDelegates,
} from '../../db/schema'

/**
 * Verifies resource ownership by tracing the chain:
 * user (uid) → organization (ownerUid) → league → edition → child resources
 */
@Injectable()
export class OwnershipService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  /** Verify that the user is a member (owner or admin) of the organization */
  async verifyOrganization(uid: string, organizationId: string): Promise<void> {
    const [member] = await this.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.uid, uid),
        ),
      )
    if (!member) {
      throw new ForbiddenException('No tienes acceso a esta organizacion')
    }
  }

  /** Verify that the user owns the league's organization */
  async verifyLeague(uid: string, leagueId: string): Promise<void> {
    const [league] = await this.db
      .select({ organizationId: leagues.organizationId })
      .from(leagues)
      .where(eq(leagues.id, leagueId))
    if (!league) throw new ForbiddenException('Liga no encontrada')
    await this.verifyOrganization(uid, league.organizationId)
  }

  /** Verify that the user owns the edition's league's organization */
  async verifyEdition(uid: string, editionId: string): Promise<void> {
    const [edition] = await this.db
      .select({ leagueId: editions.leagueId })
      .from(editions)
      .where(eq(editions.id, editionId))
    if (!edition) throw new ForbiddenException('Edicion no encontrada')
    await this.verifyLeague(uid, edition.leagueId)
  }

  /** Verify ownership of a registration via its edition */
  async verifyRegistration(uid: string, registrationId: string): Promise<void> {
    const [reg] = await this.db
      .select({ editionId: registrations.editionId })
      .from(registrations)
      .where(eq(registrations.id, registrationId))
    if (!reg) throw new ForbiddenException('Inscripcion no encontrada')
    await this.verifyEdition(uid, reg.editionId)
  }

  /**
   * Acceso de LECTURA a una inscripción: dueño de la org (organizador) O el
   * director del equipo O un miembro del equipo (para que el DT/jugador del
   * club vea su propia plantilla desde la app móvil).
   */
  async verifyRegistrationReadAccess(uid: string, registrationId: string): Promise<void> {
    const [reg] = await this.db
      .select({ editionId: registrations.editionId, teamId: registrations.teamId })
      .from(registrations)
      .where(eq(registrations.id, registrationId))
    if (!reg) throw new ForbiddenException('Inscripcion no encontrada')

    // 1) Organizador (dueño de la org de la edición)
    try {
      await this.verifyEdition(uid, reg.editionId)
      return
    } catch {
      // sigue con las verificaciones de equipo
    }

    // 2) Director del equipo
    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, reg.teamId))
    if (team?.directorUid === uid) return

    // 3) Miembro del equipo
    const [member] = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, reg.teamId), eq(teamMembers.playerUid, uid)))
    if (member) return

    throw new ForbiddenException('No tienes acceso a esta inscripcion')
  }

  /**
   * ¿El uid es admin de alguna organización dueña de una edición donde el equipo
   * está inscrito? Devuelve boolean (no lanza) — para combinar con la verificación
   * de director del equipo. Permite que el organizador edite equipos de su torneo.
   */
  async isTeamEditionAdmin(uid: string, teamId: string): Promise<boolean> {
    const orgs = await this.db
      .selectDistinct({ organizationId: leagues.organizationId })
      .from(registrations)
      .innerJoin(editions, eq(editions.id, registrations.editionId))
      .innerJoin(leagues, eq(leagues.id, editions.leagueId))
      .where(eq(registrations.teamId, teamId))
    for (const o of orgs) {
      const [member] = await this.db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, o.organizationId),
            eq(organizationMembers.uid, uid),
          ),
        )
      if (member) return true
    }
    return false
  }

  /** Verify ownership of a venue via its organization */
  async verifyVenue(uid: string, venueId: string): Promise<void> {
    const [venue] = await this.db
      .select({ organizationId: venues.organizationId })
      .from(venues)
      .where(eq(venues.id, venueId))
    if (!venue) throw new ForbiddenException('Cancha no encontrada')
    await this.verifyOrganization(uid, venue.organizationId)
  }

  /** Verify ownership of a referee via its organization */
  async verifyReferee(uid: string, refereeId: string): Promise<void> {
    const [referee] = await this.db
      .select({ organizationId: referees.organizationId })
      .from(referees)
      .where(eq(referees.id, refereeId))
    if (!referee) throw new ForbiddenException('Arbitro no encontrado')
    await this.verifyOrganization(uid, referee.organizationId)
  }

  /** Verify ownership of a match via matchday → edition */
  async verifyMatch(uid: string, matchId: string): Promise<void> {
    const [match] = await this.db
      .select({ matchdayId: matches.matchdayId })
      .from(matches)
      .where(eq(matches.id, matchId))
    if (!match) throw new ForbiddenException('Partido no encontrado')
    await this.verifyMatchday(uid, match.matchdayId)
  }

  /**
   * Acceso de ESCRITURA al flujo de un partido: admin de la org (verifyMatch) O
   * delegado de juego asignado a ESE partido (match_delegates). Usado para que un
   * delegado no-admin pueda registrar eventos, iniciar y finalizar su partido.
   *
   * UNA VEZ FINALIZADO el partido, el delegado ya no toca nada: el resultado es
   * oficial y corregirlo es decisión del organizador. El admin de la org sí
   * puede seguir, porque es quien resuelve los reclamos.
   */
  async verifyMatchWriteAccess(uid: string, matchId: string): Promise<void> {
    try {
      await this.verifyMatch(uid, matchId)
      return
    } catch {
      // no es admin de la org; puede ser delegado asignado
    }
    const [delegate] = await this.db
      .select({ id: matchDelegates.id })
      .from(matchDelegates)
      .where(and(eq(matchDelegates.matchId, matchId), eq(matchDelegates.uid, uid)))
    if (!delegate) {
      throw new ForbiddenException('No tienes acceso a este partido')
    }

    const [match] = await this.db
      .select({ status: matches.status })
      .from(matches)
      .where(eq(matches.id, matchId))
    if (match?.status === 'finished') {
      throw new ForbiddenException(
        'El partido ya está finalizado. Solo el organizador puede modificarlo.',
      )
    }
  }

  /** Verify ownership of a matchday via its edition */
  async verifyMatchday(uid: string, matchdayId: string): Promise<void> {
    const [md] = await this.db
      .select({ editionId: matchdays.editionId })
      .from(matchdays)
      .where(eq(matchdays.id, matchdayId))
    if (!md) throw new ForbiddenException('Jornada no encontrada')
    await this.verifyEdition(uid, md.editionId)
  }

  /** Verify ownership of a payment via its edition */
  async verifyPayment(uid: string, paymentId: string): Promise<void> {
    const [payment] = await this.db
      .select({ editionId: payments.editionId })
      .from(payments)
      .where(eq(payments.id, paymentId))
    if (!payment) throw new ForbiddenException('Pago no encontrado')
    await this.verifyEdition(uid, payment.editionId)
  }

  /** Verify ownership of a fine via its edition */
  async verifyFine(uid: string, fineId: string): Promise<void> {
    const [fine] = await this.db
      .select({ editionId: fines.editionId })
      .from(fines)
      .where(eq(fines.id, fineId))
    if (!fine) throw new ForbiddenException('Multa no encontrada')
    await this.verifyEdition(uid, fine.editionId)
  }

  /** Verify ownership of a group via its edition */
  async verifyGroup(uid: string, groupId: string): Promise<void> {
    const [group] = await this.db
      .select({ editionId: groups.editionId })
      .from(groups)
      .where(eq(groups.id, groupId))
    if (!group) throw new ForbiddenException('Grupo no encontrado')
    await this.verifyEdition(uid, group.editionId)
  }

  /** Verify ownership of a match event via its match */
  async verifyMatchEvent(uid: string, eventId: string): Promise<void> {
    const [event] = await this.db
      .select({ matchId: matchEvents.matchId })
      .from(matchEvents)
      .where(eq(matchEvents.id, eventId))
    if (!event) throw new ForbiddenException('Evento no encontrado')
    await this.verifyMatch(uid, event.matchId)
  }

  /** Escritura de un evento: admin de la org O delegado del partido del evento. */
  async verifyMatchEventWriteAccess(uid: string, eventId: string): Promise<void> {
    const [event] = await this.db
      .select({ matchId: matchEvents.matchId })
      .from(matchEvents)
      .where(eq(matchEvents.id, eventId))
    if (!event) throw new ForbiddenException('Evento no encontrado')
    await this.verifyMatchWriteAccess(uid, event.matchId)
  }

  /** Verify ownership of a registration player via its registration */
  async verifyRegistrationPlayer(uid: string, playerId: string): Promise<void> {
    const [player] = await this.db
      .select({ registrationId: registrationPlayers.registrationId })
      .from(registrationPlayers)
      .where(eq(registrationPlayers.id, playerId))
    if (!player) throw new ForbiddenException('Jugador no encontrado')
    await this.verifyRegistration(uid, player.registrationId)
  }

  /** Verify ownership of a bracket slot via its edition */
  async verifyBracketSlot(uid: string, slotId: string): Promise<void> {
    const [slot] = await this.db
      .select({ editionId: bracketSlots.editionId })
      .from(bracketSlots)
      .where(eq(bracketSlots.id, slotId))
    if (!slot) throw new ForbiddenException('Llave no encontrada')
    await this.verifyEdition(uid, slot.editionId)
  }

}
