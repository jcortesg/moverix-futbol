import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { RegistrationPlayersService } from './registration-players.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateRegistrationPlayerDto } from './dto/create-registration-player.dto'
import { UpdateRegistrationPlayerDto } from './dto/update-registration-player.dto'

@ApiTags('registration-players')
@ApiBearerAuth()
@Controller('registration-players')
export class RegistrationPlayersController {
  constructor(
    private readonly service: RegistrationPlayersService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateRegistrationPlayerDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistration(req.user.uid, dto.registrationId)
    return this.service.create(dto)
  }

  @Get()
  @ApiQuery({ name: 'registrationId', required: true })
  async findByRegistration(@Query('registrationId', ParseUUIDPipe) registrationId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistration(req.user.uid, registrationId)
    return this.service.findByRegistration(registrationId)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    return this.service.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRegistrationPlayerDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    return this.service.remove(id)
  }
}
