import { Controller, Get, Post, Query, Request } from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { PlayerStatsService } from './player-stats.service'
import { OwnershipService } from '../../common/services/ownership.service'

@ApiTags('player-stats')
@ApiBearerAuth()
@Controller('player-stats')
export class PlayerStatsController {
  constructor(
    private readonly playerStatsService: PlayerStatsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Get()
  @ApiQuery({ name: 'editionId', required: true })
  @ApiQuery({ name: 'teamId', required: false })
  async getByEdition(
    @Query('editionId') editionId: string,
    @Query('teamId') teamId: string | undefined,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    if (teamId) {
      return this.playerStatsService.getByTeam(editionId, teamId)
    }
    return this.playerStatsService.getByEdition(editionId)
  }

  @Get('top-scorers')
  @ApiQuery({ name: 'editionId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async getTopScorers(
    @Query('editionId') editionId: string,
    @Query('limit') limit: string | undefined,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.playerStatsService.getTopScorers(editionId, limit ? parseInt(limit) : 10)
  }

  @Post('recompute')
  @ApiQuery({ name: 'editionId', required: true })
  async recomputeAll(
    @Query('editionId') editionId: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.playerStatsService.recomputeAll(editionId)
  }
}
