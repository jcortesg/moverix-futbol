import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../db/database.module'
import { PublicEditionsController } from './public-editions.controller'
import { PublicEditionsService } from './public-editions.service'
import { PublicTeamsController } from './public-teams.controller'
import { PublicTeamsService } from './public-teams.service'
import { PublicLegalController } from './public-legal.controller'
import { StorageService } from '../../common/services/storage.service'
import { PublicEmbedController } from './public-embed.controller'
import { StandingsModule } from '../standings/standings.module'
import { PlayerStatsModule } from '../player-stats/player-stats.module'

@Module({
  imports: [DatabaseModule, StandingsModule, PlayerStatsModule],
  controllers: [PublicEditionsController, PublicTeamsController, PublicLegalController, PublicEmbedController],
  providers: [PublicEditionsService, PublicTeamsService, StorageService],
})
export class PublicModule {}
