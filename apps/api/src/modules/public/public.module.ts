import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../db/database.module'
import { PublicEditionsController } from './public-editions.controller'
import { PublicEditionsService } from './public-editions.service'
import { PublicTeamsController } from './public-teams.controller'
import { PublicTeamsService } from './public-teams.service'

@Module({
  imports: [DatabaseModule],
  controllers: [PublicEditionsController, PublicTeamsController],
  providers: [PublicEditionsService, PublicTeamsService],
})
export class PublicModule {}
