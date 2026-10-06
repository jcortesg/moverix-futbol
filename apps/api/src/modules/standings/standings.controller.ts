import { Controller, Get, ParseUUIDPipe, Query, Request } from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { StandingsService } from './standings.service'
import { OwnershipService } from '../../common/services/ownership.service'

@ApiTags('standings')
@ApiBearerAuth()
@Controller('standings')
export class StandingsController {
  constructor(
    private readonly service: StandingsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get()
  @ApiQuery({ name: 'editionId', required: true })
  async getForEdition(@Query('editionId', ParseUUIDPipe) editionId: string) {
    // La tabla de posiciones es información pública del campeonato: cualquier
    // usuario autenticado (delegados/jugadores en la app, no solo el organizador)
    // puede consultarla. Por eso no se aplica verifyEdition aquí.
    return this.service.getForEdition(editionId)
  }

  @Get('least-conceded')
  @ApiQuery({ name: 'editionId', required: true })
  async getLeastConceded(@Query('editionId', ParseUUIDPipe) editionId: string) {
    // Pública igual que la tabla: la ven jugadores y delegados en la app.
    return this.service.getLeastConceded(editionId)
  }

  @Get('qualifiers')
  @ApiQuery({ name: 'editionId', required: true })
  async getQualifiers(@Query('editionId', ParseUUIDPipe) editionId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.service.getQualifiers(editionId)
  }
}
