import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { IsString, IsUUID } from 'class-validator'
import { MatchEventsService } from './match-events.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateMatchEventDto } from './dto/create-match-event.dto'
import { UpdateMatchEventDto } from './dto/update-match-event.dto'

class SetMvpDto {
  @IsUUID()
  matchId!: string

  @IsUUID()
  teamId!: string

  @IsString()
  playerUid!: string

  @IsString()
  playerName!: string
}

@ApiTags('match-events')
@ApiBearerAuth()
@Controller('match-events')
export class MatchEventsController {
  constructor(
    private readonly service: MatchEventsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateMatchEventDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatch(req.user.uid, dto.matchId)
    return this.service.create(dto)
  }

  @Get()
  @ApiQuery({ name: 'matchId', required: true })
  async findAll(@Query('matchId', ParseUUIDPipe) matchId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatch(req.user.uid, matchId)
    return this.service.findByMatch(matchId)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatchEvent(req.user.uid, id)
    return this.service.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMatchEventDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatchEvent(req.user.uid, id)
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatchEvent(req.user.uid, id)
    return this.service.remove(id)
  }

  @Post('mvp')
  async setMvp(@Body() dto: SetMvpDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatch(req.user.uid, dto.matchId)
    return this.service.setMvp(dto.matchId, dto.teamId, dto.playerUid, dto.playerName)
  }

  @Delete('mvp/:matchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearMvp(@Param('matchId', ParseUUIDPipe) matchId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatch(req.user.uid, matchId)
    return this.service.clearMvp(matchId)
  }
}
