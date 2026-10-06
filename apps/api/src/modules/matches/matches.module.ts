import { Module } from '@nestjs/common'
import { MatchesController } from './matches.controller'
import { MatchesService } from './matches.service'
import { BracketsModule } from '../brackets/brackets.module'
import { PlayerStatsModule } from '../player-stats/player-stats.module'
import { SocialModule } from '../social/social.module'
import { NotificationsModule } from '../mobile/notifications.module'

@Module({
  imports: [BracketsModule, PlayerStatsModule, SocialModule, NotificationsModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
