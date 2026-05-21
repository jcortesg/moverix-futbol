import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { MobileMatchesService } from './mobile-matches.service'

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/matches')
export class MobileMatchesController {
  constructor(private readonly service: MobileMatchesService) {}

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id)
  }
}
