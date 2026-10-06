import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { IsEmail, IsIn, IsOptional, IsString, IsUUID } from 'class-validator'
import { MatchDelegatesService } from './match-delegates.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { NotFoundException } from '@nestjs/common'

class AssignDelegateDto {
  @IsUUID()
  matchId!: string

  /** uid del delegado si ya tiene cuenta. */
  @IsOptional()
  @IsString()
  uid?: string

  /** Correo, para invitar a alguien que todavia no se ha registrado. */
  @IsOptional()
  @IsEmail()
  email?: string

  /** Nombre a mostrar mientras la invitacion sigue pendiente. */
  @IsOptional()
  @IsString()
  name?: string

  /** Puesto en la terna: referee_1|referee_2|referee_3|fourth|delegate */
  @IsOptional()
  @IsIn(['referee_1', 'referee_2', 'referee_3', 'fourth', 'delegate'])
  role?: string
}

@ApiTags('match-delegates')
@ApiBearerAuth()
@Controller('match-delegates')
export class MatchDelegatesController {
  constructor(
    private readonly service: MatchDelegatesService,
    private readonly ownership: OwnershipService,
  ) {}

  /** Delegados de un partido (admin de la org) */
  @Get()
  @ApiQuery({ name: 'matchId', required: true })
  async findAll(@Query('matchId', ParseUUIDPipe) matchId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatch(req.user.uid, matchId)
    return this.service.findByMatch(matchId)
  }

  /** Buscar usuarios para asignar como delegado */
  @Get('search-users')
  @ApiQuery({ name: 'q', required: true })
  searchUsers(@Query('q') q: string) {
    return this.service.searchUsers(q ?? '')
  }

  /** Asignar delegado a un partido (admin de la org) */
  /** Personal de la organización habilitado como delegado (creado en Árbitros). */
  @Get('staff')
  @ApiQuery({ name: 'matchId', required: true })
  async staff(
    @Query('matchId', ParseUUIDPipe) matchId: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyMatch(req.user.uid, matchId)
    return this.service.staffForMatch(matchId)
  }

  /** Delegados que este organizador ya usó antes (para reasignar rápido). */
  @Get('mine')
  myDelegates(@Request() req: { user: { uid: string } }) {
    return this.service.myDelegates(req.user.uid)
  }

  @Post()
  async assign(@Body() dto: AssignDelegateDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatch(req.user.uid, dto.matchId)
    return this.service.assign(dto, req.user.uid)
  }

  /** Quitar delegado (admin de la org del partido) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    const matchId = await this.service.matchIdOf(id)
    if (!matchId) throw new NotFoundException('Delegado no encontrado')
    await this.ownership.verifyMatch(req.user.uid, matchId)
    return this.service.remove(id)
  }
}
