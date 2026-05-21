import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { MatchdaysService } from './matchdays.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateMatchdayDto } from './dto/create-matchday.dto'
import { UpdateMatchdayDto } from './dto/update-matchday.dto'

@ApiTags('matchdays')
@ApiBearerAuth()
@Controller('matchdays')
export class MatchdaysController {
  constructor(
    private readonly service: MatchdaysService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateMatchdayDto, @Request() req: { user: { uid: string } }) {
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
    await this.ownership.verifyMatchday(req.user.uid, id)
    return this.service.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMatchdayDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatchday(req.user.uid, id)
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyMatchday(req.user.uid, id)
    return this.service.remove(id)
  }
}
