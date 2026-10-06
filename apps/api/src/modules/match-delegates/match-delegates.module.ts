import { Module } from '@nestjs/common'
import { MatchDelegatesController } from './match-delegates.controller'
import { MatchDelegatesService } from './match-delegates.service'

@Module({
  controllers: [MatchDelegatesController],
  providers: [MatchDelegatesService],
})
export class MatchDelegatesModule {}
