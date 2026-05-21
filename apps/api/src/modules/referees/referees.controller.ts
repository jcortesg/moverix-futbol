import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { RefereesService } from './referees.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateRefereeDto } from './dto/create-referee.dto'
import { UpdateRefereeDto } from './dto/update-referee.dto'

@ApiTags('referees')
@ApiBearerAuth()
@Controller('referees')
export class RefereesController {
  constructor(
    private readonly service: RefereesService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateRefereeDto, @Request() req: { user: { uid: string } }) {
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
    await this.ownership.verifyReferee(req.user.uid, id)
    return this.service.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRefereeDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyReferee(req.user.uid, id)
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyReferee(req.user.uid, id)
    return this.service.remove(id)
  }
}
