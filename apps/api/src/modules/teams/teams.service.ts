import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { eq, ilike, or } from 'drizzle-orm'
import { isTeamDelegate } from '../../common/utils/team-delegates'
import * as admin from 'firebase-admin'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { teams } from '../../db/schema'
import { CreateTeamDto } from './dto/create-team.dto'
import { UpdateTeamDto } from './dto/update-team.dto'

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 18)
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}_${suffix}`
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 7; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

@Injectable()
export class TeamsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
    private readonly ownership: OwnershipService,
  ) {}

  private get db() {
    return this.database.db
  }

  /** Genera un código de acceso único en toda la plataforma. */
  private async generateUniqueAccessCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateAccessCode()
      const [exists] = await this.db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.accessCode, code))
      if (!exists) return code
    }
    throw new ConflictException('No se pudo generar un código único, intenta de nuevo')
  }

  /**
   * Resuelve el director a partir de un email opcional. Si el email tiene cuenta,
   * ese uid es el director. Si no tiene cuenta, el director queda en `fallbackUid`
   * (el admin, provisional) y el email se guarda como delegado pendiente; al
   * registrarse esa persona, la app le asigna el equipo (claimPendingDelegateTeams).
   */
  private async resolveDirector(
    directorEmail: string | undefined,
    fallbackUid: string,
  ): Promise<{ directorUid: string; pendingDelegateEmail: string | null }> {
    if (!directorEmail) return { directorUid: fallbackUid, pendingDelegateEmail: null }
    try {
      const user = await admin.auth().getUserByEmail(directorEmail)
      return { directorUid: user.uid, pendingDelegateEmail: null }
    } catch {
      return { directorUid: fallbackUid, pendingDelegateEmail: directorEmail }
    }
  }

  async create(dto: CreateTeamDto, actorUid: string) {
    const { directorUid, pendingDelegateEmail } = await this.resolveDirector(dto.directorEmail, actorUid)
    const [team] = await this.db
      .insert(teams)
      .values({
        directorUid,
        pendingDelegateEmail,
        name: dto.name,
        shortName: dto.shortName,
        slug: generateSlug(dto.name),
        accessCode: await this.generateUniqueAccessCode(),
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        city: dto.city,
      })
      .returning()
    return team
  }

  async findMine(directorUid: string) {
    return this.db.select().from(teams).where(eq(teams.directorUid, directorUid))
  }

  async search(query: string) {
    const q = query.trim()
    if (q.length < 2) return []
    const pattern = `%${q}%`
    return this.db
      .select()
      .from(teams)
      .where(or(ilike(teams.name, pattern), ilike(teams.shortName, pattern)))
      .limit(20)
  }

  async findOne(id: string) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, id))
    if (!team) throw new NotFoundException(`Equipo ${id} no encontrado`)
    return team
  }

  async update(id: string, dto: UpdateTeamDto, actorUid: string) {
    const team = await this.findOne(id)
    // Autorizado: el director del equipo O el organizador (admin de la org del torneo
    // donde el equipo está inscrito). Así el dueño del torneo también edita nombres/logos.
    // Delegados adicionales también editan nombre/logo, pero no cambian al principal.
    const isPrincipal = team.directorUid === actorUid
    const isAdmin = !isPrincipal && (await this.ownership.isTeamEditionAdmin(actorUid, id))
    if (!isPrincipal && !isAdmin) {
      const isDelegate = await isTeamDelegate(this.db, id, actorUid, team.directorUid)
      if (!isDelegate) {
        throw new ForbiddenException('Sólo un delegado del equipo o el organizador pueden editarlo')
      }
      if (dto.directorEmail !== undefined) {
        throw new ForbiddenException('Sólo el delegado principal o el organizador pueden cambiar el delegado')
      }
    }
    const { directorEmail, ...rest } = dto
    const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() }
    // Cambiar el delegado por email: cuenta existente → director real; sin cuenta →
    // queda pendiente (el director actual se conserva como provisional).
    if (directorEmail !== undefined) {
      const resolved = await this.resolveDirector(directorEmail, team.directorUid)
      patch.directorUid = resolved.directorUid
      patch.pendingDelegateEmail = resolved.pendingDelegateEmail
    }
    const [updated] = await this.db
      .update(teams)
      .set(patch)
      .where(eq(teams.id, id))
      .returning()
    return updated
  }

  async remove(id: string, actorUid: string) {
    const team = await this.findOne(id)
    if (team.directorUid !== actorUid) {
      throw new ForbiddenException('Sólo el director del equipo puede eliminarlo')
    }
    await this.db.delete(teams).where(eq(teams.id, id))
    return { id }
  }

  async uploadLogo(id: string, file: Express.Multer.File) {
    // Admin backoffice users are trusted (auth guard already verified them).
    // The director check stays only on update/delete to protect editable fields.
    const team = await this.findOne(id)
    if (team.logoUrl) await this.storage.deleteFile(team.logoUrl)
    const logoUrl = await this.storage.uploadLogo(`teams/${id}`, file)
    const [updated] = await this.db
      .update(teams)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning()
    return updated
  }
}
