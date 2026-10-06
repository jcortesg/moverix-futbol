import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../db/database.module'
import { StorageService } from '../../common/services/storage.service'
import { SocialModule } from '../social/social.module'
import { BracketsModule } from '../brackets/brackets.module'
import { StandingsModule } from '../standings/standings.module'
import { MobileEditionsController } from './mobile-editions.controller'
import { MobileEditionsService } from './mobile-editions.service'
import { MobileTablesService } from './mobile-tables.service'
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
import { MobileReactionsService } from './mobile-reactions.service'
import { MobileCommentsService } from './mobile-comments.service'
import { MobileNotificationsController } from './mobile-notifications.controller'
import { NotificationsModule } from './notifications.module'
import { MobileRefereeController } from './mobile-referee.controller'
import { MobileRefereeService } from './mobile-referee.service'

@Module({
  imports: [DatabaseModule, SocialModule, NotificationsModule, BracketsModule, StandingsModule],
  controllers: [MobileEditionsController, MobileTeamsController, MobilePlayersController, MobileMatchesController, MobileSearchController, MobileFeedController, MobileNotificationsController, MobileRefereeController],
  providers: [MobileEditionsService, MobileTablesService,MobileTeamsService, MobilePlayersService, MobileMatchesService, MobileSearchService, StorageService, MobileFeedService, MobileReactionsService, MobileCommentsService, MobileRefereeService],
})
export class MobileModule {}
