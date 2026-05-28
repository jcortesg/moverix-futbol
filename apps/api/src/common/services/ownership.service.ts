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
