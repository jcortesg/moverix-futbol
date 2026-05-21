import { Injectable, NotFoundException } from '@nestjs/common'
import { asc, eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { referees } from '../../db/schema'
import { CreateRefereeDto } from './dto/create-referee.dto'
import { UpdateRefereeDto } from './dto/update-referee.dto'

@Injectable()
export class RefereesService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateRefereeDto) {
    const [row] = await this.db.insert(referees).values(dto).returning()
    return row
  }

  async findAll(organizationId: string) {
    return this.db
      .select()
      .from(referees)
      .where(eq(referees.organizationId, organizationId))
      .orderBy(asc(referees.fullName))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(referees).where(eq(referees.id, id))
    if (!row) throw new NotFoundException(`Árbitro ${id} no encontrado`)
    return row
  }

  async update(id: string, dto: UpdateRefereeDto) {
    await this.findOne(id)
    const [updated] = await this.db
      .update(referees)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(referees.id, id))
      .returning()
    return updated
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(referees).where(eq(referees.id, id))
    return { id }
  }
}
