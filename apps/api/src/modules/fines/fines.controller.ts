import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { FinesService } from './fines.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateFineDto } from './dto/create-fine.dto'
import { UpdateFineDto } from './dto/update-fine.dto'

@ApiTags('fines')
@ApiBearerAuth()
@Controller('fines')
export class FinesController {
  constructor(
    private readonly service: FinesService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateFineDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, dto.editionId)
    return this.service.create(dto)
  }

  @Get()
  @ApiQuery({ name: 'editionId', required: true })
  async findAll(@Query('editionId', ParseUUIDPipe) editionId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.service.findByEdition(editionId)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyFine(req.user.uid, id)
    return this.service.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFineDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyFine(req.user.uid, id)
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyFine(req.user.uid, id)
    return this.service.remove(id)
  }
}
