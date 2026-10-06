import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { PlayersAdminService } from './players-admin.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateBanDto, LiftBanDto } from './dto/ban.dto'

@ApiTags('players-admin')
@ApiBearerAuth()
@Controller('players-admin')
export class PlayersAdminController {
  constructor(
    private readonly service: PlayersAdminService,
    private readonly ownership: OwnershipService,
  ) {}

  /** Buscar personas por cédula o nombre en todos los torneos de la organización */
  @Get('search')
  @ApiQuery({ name: 'organizationId', required: true })
  @ApiQuery({ name: 'q', required: true })
  async search(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('q') q: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyOrganization(req.user.uid, organizationId)
    return this.service.search(organizationId, q)
  }

  @Get('bans')
  @ApiQuery({ name: 'organizationId', required: true })
  @ApiQuery({ name: 'includeLifted', required: false })
  async listBans(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('includeLifted') includeLifted: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyOrganization(req.user.uid, organizationId)
    return this.service.listBans(organizationId, includeLifted === 'true')
  }

  @Post('bans')
  async createBan(@Body() dto: CreateBanDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyOrganization(req.user.uid, dto.organizationId)
    return this.service.createBan(dto.organizationId, dto, req.user.uid)
  }

  @Patch('bans/:id/lift')
  async liftBan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LiftBanDto,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyOrganization(req.user.uid, dto.organizationId)
    return this.service.liftBan(id, dto.organizationId, dto.reason)
  }
}
