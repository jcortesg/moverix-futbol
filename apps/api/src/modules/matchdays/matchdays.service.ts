import { Injectable, NotFoundException } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { matchdays } from '../../db/schema'
import { CreateMatchdayDto } from './dto/create-matchday.dto'
import { UpdateMatchdayDto } from './dto/update-matchday.dto'

@Injectable()
export class MatchdaysService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateMatchdayDto) {
    const [row] = await this.db.insert(matchdays).values({
      editionId: dto.editionId,
      number: dto.number,
      name: dto.name ?? `Jornada ${dto.number}`,
      phase: dto.phase ?? 'groups',
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
    }).returning()
    return row
  }

  async findByEdition(editionId: string) {
    return this.db
      .select()
      .from(matchdays)
      .where(eq(matchdays.editionId, editionId))
      .orderBy(asc(matchdays.number))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(matchdays).where(eq(matchdays.id, id))
    if (!row) throw new NotFoundException(`Jornada ${id} no encontrada`)
    return row
  }

  async update(id: string, dto: UpdateMatchdayDto) {
    await this.findOne(id)
    const { scheduledDate, ...rest } = dto
    const [updated] = await this.db
      .update(matchdays)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({
        ...(rest as any),
        ...(scheduledDate !== undefined && {
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        }),
      })
      .where(eq(matchdays.id, id))
      .returning()
    return updated
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(matchdays).where(eq(matchdays.id, id))
    return { id }
  }
}
