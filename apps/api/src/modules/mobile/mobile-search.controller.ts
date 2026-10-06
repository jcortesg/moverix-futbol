import { Controller, Get, Headers, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { MobileSearchService } from './mobile-search.service'

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/search')
export class MobileSearchController {
  constructor(private readonly service: MobileSearchService) {}

  @Get()
  search(@Query('q') q: string, @Headers('x-client-platform') platform?: string) {
    return this.service.search(q ?? '', (platform ?? '').toLowerCase() === 'ios')
  }
}
