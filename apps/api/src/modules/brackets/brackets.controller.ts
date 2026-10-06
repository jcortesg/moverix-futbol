import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { BracketsService } from './brackets.service'
import { OwnershipService } from '../../common/services/ownership.service'
import {
  GenerateBracketDto, GenerateConsolationDto, GenerateManualDto,
} from './dto/generate-bracket.dto'

@ApiTags('brackets')
@ApiBearerAuth()
@Controller('brackets')
export class BracketsController {
  constructor(
    private readonly service: BracketsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post('generate')
  async generate(@Body() dto: GenerateBracketDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, dto.editionId)
    return this.service.generate(dto.editionId, dto.cupName)
  }

  /** Cuadro sorteado fuera del sistema: los equipos se cargan uno por uno. */
  @Post('generate-manual')
  async generateManual(
    @Body() dto: GenerateManualDto,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, dto.editionId)
    return this.service.generateManual(dto.editionId, dto.cupName ?? 'main', dto.matchups)
  }

  /** Copa que se llena con los perdedores de otra, no con la tabla de grupos. */
  @Post('generate-consolation')
  async generateConsolation(
    @Body() dto: GenerateConsolationDto,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, dto.editionId)
    return this.service.generateConsolation(
      dto.editionId,
      dto.cupName,
      dto.sourceCup ?? 'main',
      dto.sourceRound ?? 1,
    )
  }

  @Get()
  @ApiQuery({ name: 'editionId', required: true })
  @ApiQuery({ name: 'cupName', required: false })
  async findByEdition(
    @Query('editionId') editionId: string,
    @Query('cupName') cupName: string | undefined,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.service.getByEdition(editionId, cupName || 'main')
  }

  @Get('cups')
  @ApiQuery({ name: 'editionId', required: true })
  async getCups(
    @Query('editionId') editionId: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.service.getCups(editionId)
  }

  @Delete('reset')
  @HttpCode(HttpStatus.OK)
  @ApiQuery({ name: 'editionId', required: true })
  @ApiQuery({ name: 'cupName', required: false })
  async reset(
    @Query('editionId') editionId: string,
    @Query('cupName') cupName: string | undefined,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.service.reset(editionId, cupName || 'main')
  }

  @Post(':slotId/advance')
  async advanceWinner(
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body('winnerId', ParseUUIDPipe) winnerId: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyBracketSlot(req.user.uid, slotId)
    return this.service.advanceWinner(slotId, winnerId)
  }
}
