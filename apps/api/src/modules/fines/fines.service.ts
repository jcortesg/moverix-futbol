import { Injectable, NotFoundException } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { fines, payments, teams } from '../../db/schema'
import { CreateFineDto } from './dto/create-fine.dto'
import { UpdateFineDto } from './dto/update-fine.dto'

@Injectable()
export class FinesService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreateFineDto) {
    const [row] = await this.db.insert(fines).values(dto).returning()
    return row
  }

  async findByEdition(editionId: string) {
    const rows = await this.db
      .select({
        fine: fines,
        team: {
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
          primaryColor: teams.primaryColor,
        },
      })
      .from(fines)
      .innerJoin(teams, eq(teams.id, fines.teamId))
      .where(eq(fines.editionId, editionId))
      .orderBy(desc(fines.createdAt))
    return rows.map((r) => ({ ...r.fine, team: r.team }))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(fines).where(eq(fines.id, id))
    if (!row) throw new NotFoundException(`Multa ${id} no encontrada`)
    return row
  }

  async update(id: string, dto: UpdateFineDto) {
    const current = await this.findOne(id)
    const [updated] = await this.db
      .update(fines)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(fines.id, id))
      .returning()

    // When a fine becomes 'paid', create a corresponding payment record (verified)
    if (dto.status === 'paid' && current.status !== 'paid') {
      try {
        await this.db.insert(payments).values({
          editionId: current.editionId,
          teamId: current.teamId,
          fineId: current.id,
          type: 'fine',
          amount: current.amount,
          currency: current.currency,
          status: 'verified',
          verifiedAt: new Date(),
        })
      } catch {
        // best-effort; user can still create payment manually
      }
    }

    return updated
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(fines).where(eq(fines.id, id))
    return { id }
  }
}
