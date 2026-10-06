import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { MatchesService } from './matches.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateMatchDto } from './dto/create-match.dto'
import { UpdateMatchDto } from './dto/update-match.dto'
import { FinalizeMatchDto } from './dto/finalize-match.dto'
import { GenerateFixtureDto } from './dto/generate-fixture.dto'

@ApiTags('matches')
@ApiBearerAuth()
@Controller('matches')
export class MatchesController {
  constructor(
    private readonly service: MatchesService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateMatchDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatchday(req.user.uid, dto.matchdayId)
    return this.service.create(dto)
  }

  @Get()
  @ApiQuery({ name: 'matchdayId', required: false })
  @ApiQuery({ name: 'editionId', required: false })
  async findAll(
    @Query('matchdayId') matchdayId: string | undefined,
    @Query('editionId') editionId: string | undefined,
    @Request() req: { user: { uid: string } },
  ) {
    if (matchdayId) {
      await this.ownership.verifyMatchday(req.user.uid, matchdayId)
      return this.service.findByMatchday(matchdayId)
    }
    if (editionId) {
      await this.ownership.verifyEdition(req.user.uid, editionId)
      return this.service.findByEdition(editionId)
    }
    return []
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatch(req.user.uid, id)
    return this.service.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMatchDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatchWriteAccess(req.user.uid, id)
    return this.service.update(id, dto)
  }

  @Patch(':id/finalize')
  async finalize(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FinalizeMatchDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatchWriteAccess(req.user.uid, id)
    return this.service.finalize(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatch(req.user.uid, id)
    return this.service.remove(id)
  }

  @Post('generate-fixture')
  async generateFixture(@Body() dto: GenerateFixtureDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, dto.editionId)
    return this.service.generateFixture(dto)
  }
}
