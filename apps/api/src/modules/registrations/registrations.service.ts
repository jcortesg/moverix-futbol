import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { isTeamDelegate } from '../../common/utils/team-delegates'
import { DatabaseService } from '../../db/database.service'
import { editions, registrationPlayers, registrations, teams } from '../../db/schema'
import { isFieldFilled, resolveRequiredFields } from '../mobile/roster-fields'
import { CreateRegistrationDto } from './dto/create-registration.dto'
import { UpdateRegistrationDto } from './dto/update-registration.dto'

@Injectable()
export class RegistrationsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateRegistrationDto, actorUid: string) {
    // Validate edition and team exist
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, dto.editionId))
    if (!edition) throw new NotFoundException(`Edición ${dto.editionId} no encontrada`)

    const [team] = await this.db.select().from(teams).where(eq(teams.id, dto.teamId))
    if (!team) throw new NotFoundException(`Equipo ${dto.teamId} no encontrado`)

    try {
      const [registration] = await this.db
        .insert(registrations)
        .values({
          editionId: dto.editionId,
          teamId: dto.teamId,
          registeredByUid: actorUid,
          seedRank: dto.seedRank,
        })
        .returning()
      return registration
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Este equipo ya está inscrito en esta edición')
      }
      throw err
    }
  }

  async findByEdition(editionId: string) {
    const rows = await this.db
      .select({
        id: registrations.id,
        editionId: registrations.editionId,
        teamId: registrations.teamId,
        groupId: registrations.groupId,
        status: registrations.status,
        seedRank: registrations.seedRank,
        registeredByUid: registrations.registeredByUid,
        paidAt: registrations.paidAt,
        rosterLocked: registrations.rosterLocked,
        approvedAt: registrations.approvedAt,
        createdAt: registrations.createdAt,
        updatedAt: registrations.updatedAt,
        team: {
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
          primaryColor: teams.primaryColor,
          secondaryColor: teams.secondaryColor,
          city: teams.city,
          directorUid: teams.directorUid,
          pendingDelegateEmail: teams.pendingDelegateEmail,
        },
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(eq(registrations.editionId, editionId))

    return this.withRosterSummary(editionId, rows)
  }

  /**
   * Agrega a cada inscripción cuántos jugadores tiene y cuántos cumplen TODOS
   * los campos que exige la edición. Se resuelve con UNA sola consulta para
   * toda la edición (no una por equipo), y con el mismo criterio de
   * `isFieldFilled` que usa la validación del envío de inscripción.
   */
  private async withRosterSummary<T extends { id: string }>(
    editionId: string,
    rows: T[],
  ): Promise<(T & { playersCount: number; playersComplete: number; playersIncomplete: number })[]> {
    if (rows.length === 0) return []

    const [edition] = await this.db
      .select({ requiredPlayerFields: editions.requiredPlayerFields })
      .from(editions)
      .where(eq(editions.id, editionId))
    const required = resolveRequiredFields(edition?.requiredPlayerFields)

    const players = await this.db
      .select()
      .from(registrationPlayers)
      .where(
        and(
          inArray(
            registrationPlayers.registrationId,
            rows.map((r) => r.id),
          ),
          isNull(registrationPlayers.removedAt),
        ),
      )

    const total = new Map<string, number>()
    const complete = new Map<string, number>()
    for (const p of players) {
      const id = p.registrationId
      total.set(id, (total.get(id) ?? 0) + 1)
      const ok = required.every((f) => isFieldFilled(p as Record<string, unknown>, f))
      if (ok) complete.set(id, (complete.get(id) ?? 0) + 1)
    }

    return rows.map((r) => {
      const count = total.get(r.id) ?? 0
      const ok = complete.get(r.id) ?? 0
      return { ...r, playersCount: count, playersComplete: ok, playersIncomplete: count - ok }
    })
  }

  async findMine(teamDirectorUid: string) {
    return this.db
      .select({
        id: registrations.id,
        editionId: registrations.editionId,
        teamId: registrations.teamId,
        status: registrations.status,
        groupId: registrations.groupId,
        createdAt: registrations.createdAt,
        team: {
          id: teams.id,
          name: teams.name,
          logoUrl: teams.logoUrl,
        },
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(eq(teams.directorUid, teamDirectorUid))
  }

  async findOne(id: string) {
    const [reg] = await this.db
      .select({
        id: registrations.id,
        editionId: registrations.editionId,
        teamId: registrations.teamId,
        groupId: registrations.groupId,
        status: registrations.status,
        seedRank: registrations.seedRank,
        registeredByUid: registrations.registeredByUid,
        paidAt: registrations.paidAt,
        rosterLocked: registrations.rosterLocked,
        approvedAt: registrations.approvedAt,
        createdAt: registrations.createdAt,
        updatedAt: registrations.updatedAt,
        team: {
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
          primaryColor: teams.primaryColor,
          secondaryColor: teams.secondaryColor,
          city: teams.city,
          directorUid: teams.directorUid,
          pendingDelegateEmail: teams.pendingDelegateEmail,
        },
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(eq(registrations.id, id))
    if (!reg) throw new NotFoundException(`Inscripción ${id} no encontrada`)
    return reg
  }

  async update(id: string, dto: UpdateRegistrationDto) {
    const current = await this.findOne(id)
    const patch: Record<string, unknown> = { updatedAt: new Date() }

    if (dto.status !== undefined) {
      // Una inscripción en 'draft' aún no fue enviada por el equipo: el
      // organizador puede verla pero no aprobarla hasta que esté en 'pending'.
      if (current.status === 'draft' && dto.status === 'approved') {
        throw new BadRequestException('El equipo aún no ha enviado su inscripción (plantilla incompleta)')
      }
      patch.status = dto.status
      if (dto.status === 'approved' && !current.approvedAt) {
        patch.approvedAt = new Date()
      }
    }
    if (dto.groupId !== undefined) patch.groupId = dto.groupId
    if (dto.rosterLocked !== undefined) patch.rosterLocked = dto.rosterLocked
    if (dto.seedRank !== undefined) patch.seedRank = dto.seedRank
    if (dto.paidAt !== undefined) patch.paidAt = dto.paidAt ? new Date(dto.paidAt) : null

    const [updated] = await this.db
      .update(registrations)
      .set(patch)
      .where(eq(registrations.id, id))
      .returning()
    return updated
  }

  async remove(id: string, actorUid: string) {
    const reg = await this.findOne(id)
    // Only the registrar or the team director can withdraw; status check stays in admin UI
    const [team] = await this.db.select().from(teams).where(eq(teams.id, reg.teamId))
    const isDirector = !!team && (await isTeamDelegate(this.db, team.id, actorUid, team.directorUid))
    const isRegistrar = reg.registeredByUid === actorUid
    if (!isDirector && !isRegistrar) {
      // Admin panel may bypass with its own endpoint; keep this conservative
      throw new NotFoundException(`Inscripción ${id} no encontrada`)
    }
    await this.db.delete(registrations).where(eq(registrations.id, id))
    return { id }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505'
}
