import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { LeaguesService } from './leagues.service'
import { CreateLeagueDto } from './dto/create-league.dto'
import { UpdateLeagueDto } from './dto/update-league.dto'

@ApiTags('leagues')
@ApiBearerAuth()
@Controller('leagues')
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Post()
  create(@Body() dto: CreateLeagueDto) {
    return this.leaguesService.create(dto)
  }

  @Get()
  findAll() {
    return this.leaguesService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leaguesService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeagueDto) {
    return this.leaguesService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leaguesService.remove(id)
  }
}
