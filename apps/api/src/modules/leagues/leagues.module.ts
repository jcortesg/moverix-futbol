import { Module } from '@nestjs/common'
import { LeaguesController } from './leagues.controller'
import { LeaguesService } from './leagues.service'
import { StorageService } from '../../common/services/storage.service'

@Module({
  controllers: [LeaguesController],
  providers: [LeaguesService, StorageService],
  exports: [LeaguesService],
})
export class LeaguesModule {}
