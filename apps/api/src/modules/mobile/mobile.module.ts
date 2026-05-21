import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../db/database.module'
import { StorageService } from '../../common/services/storage.service'
import { MobileEditionsController } from './mobile-editions.controller'
import { MobileEditionsService } from './mobile-editions.service'
import { MobileTeamsController } from './mobile-teams.controller'
import { MobileTeamsService } from './mobile-teams.service'
import { MobilePlayersController } from './mobile-players.controller'
import { MobilePlayersService } from './mobile-players.service'
import { MobileMatchesController } from './mobile-matches.controller'
import { MobileMatchesService } from './mobile-matches.service'
import { MobileSearchController } from './mobile-search.controller'
import { MobileSearchService } from './mobile-search.service'
import { MobileFeedController } from './mobile-feed.controller'
import { MobileFeedService } from './mobile-feed.service'

@Module({
  imports: [DatabaseModule],
  controllers: [MobileEditionsController, MobileTeamsController, MobilePlayersController, MobileMatchesController, MobileSearchController, MobileFeedController],
  providers: [MobileEditionsService, MobileTeamsService, MobilePlayersService, MobileMatchesService, MobileSearchService, StorageService, MobileFeedService],
})
export class MobileModule {}
