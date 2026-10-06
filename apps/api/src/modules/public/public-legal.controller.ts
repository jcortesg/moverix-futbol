import { Controller, Get, Param, NotFoundException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { eq } from 'drizzle-orm'
import { Public } from '../../common/decorators/public.decorator'
import { DatabaseService } from '../../db/database.service'
import { legalPages } from '../../db/schema'

@Public()
@ApiTags('public')
@Controller('public/legal')
export class PublicLegalController {
  constructor(private readonly database: DatabaseService) {}

  /** Página legal por clave (privacy | terms). Fuente única para app y web. */
  @Get(':key')
  async get(@Param('key') key: string) {
    const [row] = await this.database.db
      .select({ key: legalPages.key, title: legalPages.title, content: legalPages.content, updatedAt: legalPages.updatedAt })
      .from(legalPages)
      .where(eq(legalPages.key, key))
    if (!row) throw new NotFoundException('Página no encontrada')
    return row
  }
}
