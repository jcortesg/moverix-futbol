import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Request, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { Response } from 'express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger'
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
    // Lectura: organizador, DT del equipo o miembro del equipo (la app móvil
    // lee la plantilla desde aquí; un DT no es dueño de la org).
    await this.ownership.verifyRegistrationReadAccess(req.user.uid, registrationId)
    return this.service.findByRegistration(registrationId)
  }

  /** Agrega al delegado del equipo a la plantilla como jugador (rol dual). */
  @Post('director')
  async addDirectorAsPlayer(
    @Query('registrationId', ParseUUIDPipe) registrationId: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyRegistration(req.user.uid, registrationId)
    return this.service.addDirectorAsPlayer(registrationId)
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
    return this.service.remove(id, req.user.uid)
  }

  /** Reactiva a un jugador dado de baja. */
  @Post(':id/restore')
  async restore(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    return this.service.restore(id)
  }

  // ── Archivos del jugador: cédula y foto (sensibles: solo dueño/organizador) ─

  @Post(':id/document')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    return this.service.uploadFile(id, 'document', file)
  }

  @Get(':id/document')
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { uid: string } },
    @Res() res: Response,
  ) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    await this.streamFile(id, 'document', res)
  }

  @Delete(':id/document')
  async removeDocument(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    return this.service.removeFile(id, 'document')
  }

  @Post(':id/photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    return this.service.uploadFile(id, 'photo', file)
  }

  @Get(':id/photo')
  async getPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { uid: string } },
    @Res() res: Response,
  ) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    await this.streamFile(id, 'photo', res)
  }

  @Delete(':id/photo')
  async removePhoto(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyRegistrationPlayer(req.user.uid, id)
    return this.service.removeFile(id, 'photo')
  }

  private async streamFile(id: string, kind: 'document' | 'photo', res: Response) {
    const { buffer, contentType } = await this.service.getFile(id, kind)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(buffer)
  }
}
