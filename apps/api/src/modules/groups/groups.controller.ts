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
import { GroupsService } from './groups.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateGroupDto } from './dto/create-group.dto'
import { UpdateGroupDto } from './dto/update-group.dto'
import { IsEnum, IsOptional, IsUUID } from 'class-validator'

class GenerateGroupsDto {
  @IsUUID()
  editionId!: string
}

class DrawGroupsDto {
  @IsUUID()
  editionId!: string

  @IsOptional()
  @IsEnum(['all', 'unassigned'])
  mode?: 'all' | 'unassigned'
}

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreateGroupDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, dto.editionId)
    return this.groupsService.create(dto)
  }

  @Post('generate')
  async generate(@Body() dto: GenerateGroupsDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, dto.editionId)
    return this.groupsService.generate(dto.editionId)
  }

  @Post('draw')
  async draw(@Body() dto: DrawGroupsDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, dto.editionId)
    return this.groupsService.draw(dto.editionId, dto.mode ?? 'all')
  }

  @Get()
  @ApiQuery({ name: 'editionId', required: true })
  async findAll(@Query('editionId', ParseUUIDPipe) editionId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.groupsService.findByEdition(editionId)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyGroup(req.user.uid, id)
    return this.groupsService.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyGroup(req.user.uid, id)
    return this.groupsService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyGroup(req.user.uid, id)
    return this.groupsService.remove(id)
  }
}
