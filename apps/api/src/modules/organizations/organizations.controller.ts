import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { memoryStorage } from 'multer'
import { OrganizationsService } from './organizations.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreateOrganizationDto } from './dto/create-organization.dto'
import { UpdateOrganizationDto } from './dto/update-organization.dto'

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto, @Request() req: { user: { uid: string } }) {
    return this.organizationsService.create(dto, req.user.uid)
  }

  @Get()
  findAll(@Request() req: { user: { uid: string } }) {
    return this.organizationsService.findAll(req.user.uid)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyOrganization(req.user.uid, id)
    return this.organizationsService.findOne(id)
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrganizationDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyOrganization(req.user.uid, id)
    return this.organizationsService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyOrganization(req.user.uid, id)
    return this.organizationsService.remove(id)
  }

  /** List members of an organization */
  @Get(':id/members')
  async getMembers(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyOrganization(req.user.uid, id)
    return this.organizationsService.getMembers(id)
  }

  /** Add a member to the organization (by Firebase UID) */
  @Post(':id/members')
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { uid: string; role?: string },
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyOrganization(req.user.uid, id)
    return this.organizationsService.addMember(id, dto.uid, dto.role || 'admin')
  }

  /** Remove a member from the organization */
  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyOrganization(req.user.uid, id)
    return this.organizationsService.removeMember(id, memberId)
  }

  @Post(':id/logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyOrganization(req.user.uid, id)
    return this.organizationsService.uploadLogo(id, file)
  }
}
