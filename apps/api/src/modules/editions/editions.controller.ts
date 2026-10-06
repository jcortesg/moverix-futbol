import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiTags, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { EditionsService } from './editions.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateEditionDto } from './dto/create-edition.dto'
import { UpdateEditionDto } from './dto/update-edition.dto'

@ApiTags('editions')
@ApiBearerAuth()
@Controller('editions')
export class EditionsController {
  constructor(
    private readonly editionsService: EditionsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateEditionDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyLeague(req.user.uid, dto.leagueId)
    return this.editionsService.create(dto)
  }

  @Get()
  @ApiQuery({ name: 'leagueId', required: true, type: String })
  async findAll(@Query('leagueId', ParseUUIDPipe) leagueId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyLeague(req.user.uid, leagueId)
    return this.editionsService.findAll(leagueId)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, id)
    return this.editionsService.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEditionDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, id)
    return this.editionsService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, id)
    return this.editionsService.remove(id)
  }

  /**
   * Genera (o regenera) la clave del widget embebible. Regenerarla REVOCA los
   * widgets ya publicados con la clave anterior.
   */
  @Post(':id/embed-key')
  async generateEmbedKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, id)
    return this.editionsService.generateEmbedKey(id)
  }

  /** Desactiva el widget: la clave deja de responder. */
  @Delete(':id/embed-key')
  async revokeEmbedKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, id)
    return this.editionsService.revokeEmbedKey(id)
  }

  @Post(':id/logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadLogo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, id)
    return this.editionsService.uploadLogo(id, file)
  }

  @Post(':id/banner')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadBanner(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, id)
    return this.editionsService.uploadBanner(id, file)
  }
}
