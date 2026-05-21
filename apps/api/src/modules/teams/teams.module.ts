import { Module } from '@nestjs/common'
import { TeamsController } from './teams.controller'
import { TeamsService } from './teams.service'
import { StorageService } from '../../common/services/storage.service'

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, StorageService],
  exports: [TeamsService],
})
export class TeamsModule {}
