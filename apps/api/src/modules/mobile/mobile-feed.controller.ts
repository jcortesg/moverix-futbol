import { Controller, Get, Query, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { MobileFeedService } from './mobile-feed.service'

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/feed')
export class MobileFeedController {
  constructor(private readonly service: MobileFeedService) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFeed(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.getFeed(req.user.uid, limit ? parseInt(limit) : 30)
  }
}
