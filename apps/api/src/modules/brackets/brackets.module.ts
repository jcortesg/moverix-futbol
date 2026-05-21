import { Module } from '@nestjs/common'
import { BracketsController } from './brackets.controller'
import { BracketsService } from './brackets.service'
import { StandingsModule } from '../standings/standings.module'

@Module({
  imports: [StandingsModule],
  controllers: [BracketsController],
  providers: [BracketsService],
  exports: [BracketsService],
})
export class BracketsModule {}
