import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { memoryStorage } from 'multer'
import { LeaguesService } from './leagues.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateLeagueDto } from './dto/create-league.dto'
import { UpdateLeagueDto } from './dto/update-league.dto'

@ApiTags('leagues')
@ApiBearerAuth()
@Controller('leagues')
export class LeaguesController {
  constructor(
    private readonly leaguesService: LeaguesService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateLeagueDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyOrganization(req.user.uid, dto.organizationId)
    return this.leaguesService.create(dto)
  }

  @Get()
  @ApiQuery({ name: 'organizationId', required: true, type: String })
  async findAll(@Query('organizationId', ParseUUIDPipe) organizationId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyOrganization(req.user.uid, organizationId)
    return this.leaguesService.findAll(organizationId)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyLeague(req.user.uid, id)
    return this.leaguesService.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeagueDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyLeague(req.user.uid, id)
    return this.leaguesService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyLeague(req.user.uid, id)
    return this.leaguesService.remove(id)
  }

  @Post(':id/logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadLogo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyLeague(req.user.uid, id)
    return this.leaguesService.uploadLogo(id, file)
  }

  @Post(':id/banner')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadBanner(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyLeague(req.user.uid, id)
    return this.leaguesService.uploadBanner(id, file)
  }
}
