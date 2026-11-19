import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'
import { reactivateFormerMember } from '../../common/utils/team-former-members'
import { assertRosterCapacity } from '../../common/utils/roster-capacity'
import { playerProfiles, registrationPlayers, registrations, teams, teamMembers } from '../../db/schema'
import { CreateRegistrationPlayerDto } from './dto/create-registration-player.dto'
import { UpdateRegistrationPlayerDto } from './dto/update-registration-player.dto'

const ALLOWED_DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

// Tipos de archivo adjuntables a un jugador y su columna en BD.
const FILE_KINDS = {
  document: { column: 'docFileUrl', label: 'doc', mimes: ALLOWED_DOC_MIME },
  photo: { column: 'photoFileUrl', label: 'photo', mimes: ALLOWED_IMAGE_MIME },
} as const
type FileKind = keyof typeof FILE_KINDS

@Injectable()
export class RegistrationPlayersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateRegistrationPlayerDto) {
    await assertRosterCapacity(this.db, dto.registrationId)
    try {
      // Si el jugador ya estuvo en esta plantilla y fue dado de baja, se revive
      // esa fila en vez de crear una nueva: si no, la persona aparecería a la vez
      // en la lista activa y en "dados de baja", con dos historiales distintos.
      const removed = await this.findRemovedMatch(dto)
      if (removed) {
        const [revived] = await this.db
          .update(registrationPlayers)
          .set({ ...dto, removedAt: null, removedBy: null })
          .where(eq(registrationPlayers.id, removed.id))
          .returning()

        await this.ensureTeamMember(dto.registrationId, dto.playerUid, dto.playerName)
        return revived
      }

      const [row] = await this.db.insert(registrationPlayers).values(dto).returning()

      // Auto-sync: ensure player exists in team_members (global roster)
      await this.ensureTeamMember(dto.registrationId, dto.playerUid, dto.playerName)

      return row
    } catch (err) {
      throw mapUniqueViolation(err, dto.email, dto.docNumber)
    }
  }

  /**
   * Busca una fila dada de baja en la misma inscripción que corresponda a esta
   * persona. La cédula manda; el correo solo se usa si no viene cédula, porque
   * varios jugadores comparten el correo del delegado.
   */
  private async findRemovedMatch(dto: CreateRegistrationPlayerDto) {
    const match = dto.docNumber
      ? eq(registrationPlayers.docNumber, dto.docNumber)
      : dto.email
        ? eq(registrationPlayers.email, dto.email)
        : null

    if (!match) return null

    const [row] = await this.db
      .select({ id: registrationPlayers.id })
      .from(registrationPlayers)
      .where(
        and(
          eq(registrationPlayers.registrationId, dto.registrationId),
          isNotNull(registrationPlayers.removedAt),
          match,
        ),
      )
      .limit(1)

    return row ?? null
  }

  /** Upsert team_members entry when a player is added to a championship roster */
  private async ensureTeamMember(registrationId: string, playerUid: string, playerName: string) {
    try {
      const [reg] = await this.db
        .select({ teamId: registrations.teamId })
        .from(registrations)
        .where(eq(registrations.id, registrationId))

      if (!reg) return

      await this.db
        .insert(teamMembers)
        .values({ teamId: reg.teamId, playerUid, playerName, role: 'player', isPlayer: true })
        .onConflictDoUpdate({
          // Si ya existe (p.ej. el director), conserva su rol pero marca que también juega.
          target: [teamMembers.teamId, teamMembers.playerUid],
          set: { isPlayer: true },
        })
      await reactivateFormerMember(this.db, reg.teamId, playerUid)
    } catch {
      // best-effort — don't fail the registration if sync fails
    }
  }

  /**
   * Agrega al delegado (director del equipo) a la plantilla como un jugador más.
   * Usa el uid real del director, por lo que su fila en team_members queda con
   * rol 'director' + is_player=true (rol dual). Idempotente.
   */
  async addDirectorAsPlayer(registrationId: string) {
    const [reg] = await this.db
      .select({ teamId: registrations.teamId })
      .from(registrations)
      .where(eq(registrations.id, registrationId))
    if (!reg) throw new NotFoundException('Inscripción no encontrada')

    const [team] = await this.db
      .select({ directorUid: teams.directorUid })
      .from(teams)
      .where(eq(teams.id, reg.teamId))
    if (!team) throw new NotFoundException('Equipo no encontrado')

    // ¿Ya está en la plantilla? Devuélvelo (idempotente)
    const [existing] = await this.db
      .select()
      .from(registrationPlayers)
      .where(and(
        eq(registrationPlayers.registrationId, registrationId),
        eq(registrationPlayers.playerUid, team.directorUid),
      ))
    if (existing) return existing

    // Nombre del delegado: perfil → fila director existente → genérico
    const [profile] = await this.db
      .select({ fullName: playerProfiles.fullName })
      .from(playerProfiles)
      .where(eq(playerProfiles.uid, team.directorUid))
    const [directorRow] = await this.db
      .select({ playerName: teamMembers.playerName })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, reg.teamId), eq(teamMembers.playerUid, team.directorUid)))

    const playerName = profile?.fullName ?? directorRow?.playerName ?? 'Delegado'
    const [firstName, ...rest] = playerName.trim().split(/\s+/)
    const lastName = rest.join(' ') || undefined

    return this.create({
      registrationId,
      playerUid: team.directorUid,
      playerName,
      firstName,
      lastName,
    })
  }

  /**
   * Plantilla de una inscripción. Por defecto solo los ACTIVOS: la app móvil no
   * filtra las bajas lógicas y mostraba a los retirados como si siguieran en la
   * nómina. El panel admin pide `includeRemoved` para listar y restaurar retirados.
   */
  async findByRegistration(registrationId: string, includeRemoved = false) {
    return this.db
      .select()
      .from(registrationPlayers)
      .where(
        includeRemoved
          ? eq(registrationPlayers.registrationId, registrationId)
          : and(eq(registrationPlayers.registrationId, registrationId), isNull(registrationPlayers.removedAt)),
      )
      .orderBy(asc(registrationPlayers.jerseyNumber), asc(registrationPlayers.playerName))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(registrationPlayers).where(eq(registrationPlayers.id, id))
    if (!row) throw new NotFoundException(`Jugador ${id} no encontrado`)
    return row
  }

  async update(id: string, dto: UpdateRegistrationPlayerDto) {
    await this.findOne(id)
    try {
      const [updated] = await this.db
        .update(registrationPlayers)
        .set(dto)
        .where(eq(registrationPlayers.id, id))
        .returning()
      return updated
    } catch (err) {
      throw mapUniqueViolation(err, dto.email, dto.docNumber)
    }
  }

  /**
   * Baja LOGICA. No se borra la fila ni los archivos: el jugador conserva sus
   * datos de inscripcion y sigue ligado a los goles que anoto en el torneo.
   * Reversible con restore().
   */
  async remove(id: string, actorUid?: string) {
    await this.findOne(id)
    await this.db
      .update(registrationPlayers)
      .set({ removedAt: new Date(), removedBy: actorUid ?? null })
      .where(eq(registrationPlayers.id, id))
    return { id }
  }

  /** Reactiva a un jugador dado de baja. */
  async restore(id: string) {
    const current = await this.findOne(id)
    if (current.removedAt) await assertRosterCapacity(this.db, current.registrationId)
    const [updated] = await this.db
      .update(registrationPlayers)
      .set({ removedAt: null, removedBy: null })
      .where(eq(registrationPlayers.id, id))
      .returning()
    return updated
  }

  // ── Archivos privados del jugador (cédula, foto) ──────────────────────────

  async uploadFile(id: string, kind: FileKind, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido')
    const spec = FILE_KINDS[kind]
    if (!spec.mimes.includes(file.mimetype)) {
      throw new BadRequestException(
        kind === 'photo'
          ? 'Formato no permitido. Usa JPG, PNG, WEBP o HEIC.'
          : 'Formato no permitido. Usa PDF, JPG, PNG, WEBP o HEIC.',
      )
    }
    const player = await this.findOne(id)
    const previous = player[spec.column]

    const key = await this.storage.uploadPrivateDocument(`registration-players/${id}`, file, spec.label)
    if (previous && previous !== key) await this.storage.deletePrivate(previous)

    const [updated] = await this.db
      .update(registrationPlayers)
      .set({ [spec.column]: key })
      .where(eq(registrationPlayers.id, id))
      .returning()
    return updated
  }

  async getFile(id: string, kind: FileKind): Promise<{ buffer: Buffer; contentType: string }> {
    const player = await this.findOne(id)
    const key = player[FILE_KINDS[kind].column]
    if (!key) throw new NotFoundException('Este jugador no tiene el archivo adjunto')
    return this.storage.streamPrivate(key)
  }

  async removeFile(id: string, kind: FileKind) {
    const spec = FILE_KINDS[kind]
    const player = await this.findOne(id)
    const key = player[spec.column]
    if (key) await this.storage.deletePrivate(key)
    const [updated] = await this.db
      .update(registrationPlayers)
      .set({ [spec.column]: null })
      .where(eq(registrationPlayers.id, id))
      .returning()
    return updated
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505'
}

function mapUniqueViolation(err: unknown, email?: string, doc?: string): Error {
  if (!isUniqueViolation(err)) return err as Error
  const constraint = (err as { constraint?: string }).constraint ?? ''
  if (constraint.includes('email')) {
    return new ConflictException(`Ya hay un jugador con el email "${email}" en este equipo`)
  }
  if (constraint.includes('doc')) {
    return new ConflictException(`Ya hay un jugador con la cédula "${doc}" en este equipo`)
  }
  return new ConflictException('Este jugador ya está en la plantilla de este equipo')
}
