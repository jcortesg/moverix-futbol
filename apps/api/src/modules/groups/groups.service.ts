import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { editions, groups, registrations } from '../../db/schema'
import { CreateGroupDto } from './dto/create-group.dto'
import { UpdateGroupDto } from './dto/update-group.dto'

type FormatConfigShape = {
  phase1?: { kind?: string; groupCount?: number; teamsPerGroup?: number }
}

@Injectable()
export class GroupsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateGroupDto) {
    const [group] = await this.db.insert(groups).values(dto).returning()
    return group
  }

  async findByEdition(editionId: string) {
    return this.db
      .select()
      .from(groups)
      .where(eq(groups.editionId, editionId))
      .orderBy(asc(groups.order), asc(groups.code))
  }

  async findOne(id: string) {
    const [group] = await this.db.select().from(groups).where(eq(groups.id, id))
    if (!group) throw new NotFoundException(`Grupo ${id} no encontrado`)
    return group
  }

  async update(id: string, dto: UpdateGroupDto) {
    await this.findOne(id)
    const [updated] = await this.db
      .update(groups)
      .set(dto)
      .where(eq(groups.id, id))
      .returning()
    return updated
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(groups).where(eq(groups.id, id))
    return { id }
  }

  async generate(editionId: string) {
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, editionId))
    if (!edition) throw new NotFoundException(`Edición ${editionId} no encontrada`)

    const cfg = (edition.formatConfig ?? {}) as FormatConfigShape
    const phase1 = cfg.phase1
    if (!phase1 || phase1.kind !== 'groups' || !phase1.groupCount) {
      throw new BadRequestException(
        'La edición no está configurada con fase de grupos. Ajusta el formato primero.',
      )
    }

    const existing = await this.db.select().from(groups).where(eq(groups.editionId, editionId))
    if (existing.length > 0) {
      throw new BadRequestException(
        'Ya existen grupos en esta edición. Elimínalos primero o crea grupos manualmente.',
      )
    }

    const count = Math.min(Math.max(phase1.groupCount, 1), 26)
    const teamsPerGroup = phase1.teamsPerGroup ?? null

    const rows = Array.from({ length: count }, (_, i) => {
      const code = String.fromCharCode(65 + i) // A..Z
      return {
        editionId,
        name: `Grupo ${code}`,
        code,
        phase: 'groups',
        maxTeams: teamsPerGroup,
        order: i,
      }
    })
    return this.db.insert(groups).values(rows).returning()
  }

  /**
   * Distribute approved registrations across existing groups, balanced.
   * - mode='all' redistributes every approved registration
   * - mode='unassigned' only assigns those currently without a group
   * Seeds (registrations with seedRank) are placed first, one per group as long
   * as groups remain. The rest are shuffled.
   */
  async draw(editionId: string, mode: 'all' | 'unassigned' = 'all') {
    const groupRows = await this.db
      .select()
      .from(groups)
      .where(eq(groups.editionId, editionId))
      .orderBy(asc(groups.order), asc(groups.code))

    if (groupRows.length === 0) {
      throw new BadRequestException('No hay grupos creados para esta edición.')
    }

    const allApproved = await this.db
      .select()
      .from(registrations)
      .where(and(
        eq(registrations.editionId, editionId),
        eq(registrations.status, 'approved'),
      ))

    if (allApproved.length === 0) {
      throw new BadRequestException('No hay equipos aprobados para sortear.')
    }

    const target = mode === 'unassigned'
      ? allApproved.filter((r) => r.groupId === null)
      : allApproved

    if (target.length === 0) {
      throw new BadRequestException('Todos los equipos aprobados ya están asignados a un grupo.')
    }

    // Split seeds vs rest
    const seeds = target
      .filter((r) => r.seedRank != null)
      .sort((a, b) => (a.seedRank ?? 0) - (b.seedRank ?? 0))
    const rest = shuffle(target.filter((r) => r.seedRank == null))

    // Round-robin assignment, group by group, picking from seeds first then rest
    const assignments: { id: string; groupId: string }[] = []
    const queue = [...seeds, ...rest]
    let i = 0
    while (queue.length > 0) {
      const reg = queue.shift()!
      const group = groupRows[i % groupRows.length]
      assignments.push({ id: reg.id, groupId: group.id })
      i++
    }

    // Apply
    for (const a of assignments) {
      await this.db
        .update(registrations)
        .set({ groupId: a.groupId, updatedAt: new Date() })
        .where(eq(registrations.id, a.id))
    }

    return { assigned: assignments.length, groups: groupRows.length }
  }
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
