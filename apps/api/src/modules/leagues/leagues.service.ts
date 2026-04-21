import { Injectable, NotFoundException } from '@nestjs/common'
import { CreateLeagueDto } from './dto/create-league.dto'
import { UpdateLeagueDto } from './dto/update-league.dto'

@Injectable()
export class LeaguesService {
  // TODO: inyectar cliente PostgreSQL (pg / Drizzle / Prisma)

  async create(dto: CreateLeagueDto) {
    // INSERT INTO leagues ...
    return { id: 'uuid', ...dto }
  }

  async findAll() {
    // SELECT * FROM leagues WHERE org_id = :orgId
    return []
  }

  async findOne(id: string) {
    // SELECT * FROM leagues WHERE id = :id
    const league = null
    if (!league) throw new NotFoundException(`Liga ${id} no encontrada`)
    return league
  }

  async update(id: string, dto: UpdateLeagueDto) {
    // UPDATE leagues SET ... WHERE id = :id
    return { id, ...dto }
  }

  async remove(id: string) {
    // DELETE FROM leagues WHERE id = :id
    return { id }
  }
}
