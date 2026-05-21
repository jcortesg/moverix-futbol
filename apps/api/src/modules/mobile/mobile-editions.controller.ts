import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { MobileEditionsService } from './mobile-editions.service'

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/editions')
export class MobileEditionsController {
  constructor(private readonly service: MobileEditionsService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'registration', 'active', 'finished'] })
  browse(@Query('status') status?: string) {
    return this.service.browse(status)
  }

  @Get('mine')
  mine(@Req() req: any) {
    return this.service.mine(req.user.uid)
  }

  @Get(':id/detail')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id)
  }
}
