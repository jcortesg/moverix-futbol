import { Controller, Get, Headers, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { MobileEditionsService } from './mobile-editions.service'
import { MobileTablesService } from './mobile-tables.service'

function isIosClient(platform?: string): boolean {
  return (platform ?? '').toLowerCase() === 'ios'
}

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/editions')
export class MobileEditionsController {
  constructor(
    private readonly service: MobileEditionsService,
    private readonly tablesService: MobileTablesService,
  ) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'registration', 'active', 'finished'] })
  browse(
    @Query('status') status?: string,
    @Headers('x-client-platform') platform?: string,
  ) {
    return this.service.browse(status, isIosClient(platform))
  }

  @Get('mine')
  mine(@Req() req: any, @Headers('x-client-platform') platform?: string) {
    return this.service.mine(req.user.uid, isIosClient(platform))
  }

  @Get(':id/detail')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Headers('x-client-platform') platform?: string,
  ) {
    return this.service.detail(id, req.user.uid, isIosClient(platform))
  }

  /** Tablas listas para pintar (posiciones, reclasificación, valla, goleadores). */
  @Get(':id/tables')
  tables(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-client-platform') platform?: string,
  ) {
    return this.tablesService.tables(id, isIosClient(platform))
  }

  @Get(':id/bracket')
  @ApiQuery({ name: 'cup', required: false })
  bracket(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cup') cup?: string,
    @Headers('x-client-platform') platform?: string,
  ) {
    return this.service.bracket(id, cup || 'main', isIosClient(platform))
  }
}
