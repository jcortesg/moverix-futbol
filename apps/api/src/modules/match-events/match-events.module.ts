import { Module } from '@nestjs/common'
import { MatchEventsController } from './match-events.controller'
import { MatchEventsService } from './match-events.service'
import { PlayerStatsModule } from '../player-stats/player-stats.module'
import { SocialModule } from '../social/social.module'

@Module({
  imports: [PlayerStatsModule, SocialModule],
  controllers: [MatchEventsController],
  providers: [MatchEventsService],
  exports: [MatchEventsService],
})
export class MatchEventsModule {}
