import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Request,
} from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { PaymentsService } from './payments.service'
import { OwnershipService } from '../../common/services/ownership.service'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { UpdatePaymentDto } from './dto/update-payment.dto'

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly ownership: OwnershipService,
  ) {}

  @Post()
  async create(@Body() dto: CreatePaymentDto, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, dto.editionId)
    return this.service.create(dto)
  }

  @Get()
  @ApiQuery({ name: 'editionId', required: true })
  @ApiQuery({ name: 'teamId', required: false })
  async findAll(
    @Query('editionId', ParseUUIDPipe) editionId: string,
    @Query('teamId') teamId: string | undefined,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    if (teamId) return this.service.findByTeam(editionId, teamId)
    return this.service.findByEdition(editionId)
  }

  @Get('summary')
  @ApiQuery({ name: 'editionId', required: true })
  async summary(@Query('editionId', ParseUUIDPipe) editionId: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyEdition(req.user.uid, editionId)
    return this.service.getEditionSummary(editionId)
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyPayment(req.user.uid, id)
    return this.service.findOne(id)
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
    @Request() req: { user: { uid: string } },
  ) {
    await this.ownership.verifyPayment(req.user.uid, id)
    return this.service.update(id, dto, req.user.uid)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { uid: string } }) {
    await this.ownership.verifyPayment(req.user.uid, id)
    return this.service.remove(id)
  }
}
