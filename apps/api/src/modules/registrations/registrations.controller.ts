import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { RegistrationsService } from './registrations.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateRegistrationDto } from './dto/create-registration.dto'
import { UpdateRegistrationDto } from './dto/update-registration.dto'

@ApiTags('registrations')
@ApiBearerAuth()
@Controller('registrations')
export class RegistrationsController {
  constructor(
    private readonly registrationsService: RegistrationsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  create(@Body() dto: CreateRegistrationDto, @Request() req: { user: { uid: string } }) {
    return this.registrationsService.create(dto, req.user.uid)
  }

  @Get()
  @ApiQuery({ name: 'editionId', required: true })
  async findByEdition(@Query('editionId', ParseUUIDPipe) editionId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.registrationsService.findByEdition(editionId)
  }

  @Get('mine')
  findMine(@Request() req: { user: { uid: string } }) {
    return this.registrationsService.findMine(req.user.uid)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistration(req.user.uid, id)
    return this.registrationsService.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRegistrationDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistration(req.user.uid, id)
    return this.registrationsService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    return this.registrationsService.remove(id, req.user.uid)
  }
}
