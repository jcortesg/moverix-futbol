import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Request, UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger'
import { VenuesService } from './venues.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateVenueDto } from './dto/create-venue.dto'
import { UpdateVenueDto } from './dto/update-venue.dto'

@ApiTags('venues')
@ApiBearerAuth()
@Controller('venues')
export class VenuesController {
  constructor(
    private readonly service: VenuesService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateVenueDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyOrganization(req.user.uid, dto.organizationId)
    return this.service.create(dto)
  }

  @Get()
  @ApiQuery({ name: 'organizationId', required: true })
  async findAll(@Query('organizationId', ParseUUIDPipe) organizationId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyOrganization(req.user.uid, organizationId)
    return this.service.findAll(organizationId)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyVenue(req.user.uid, id)
    return this.service.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVenueDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyVenue(req.user.uid, id)
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyVenue(req.user.uid, id)
    return this.service.remove(id)
  }

  @Post(':id/photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyVenue(req.user.uid, id)
    return this.service.uploadPhoto(id, file)
  }
}
