import { Module } from '@nestjs/common'
import { PlayersAdminController } from './players-admin.controller'
import { PlayersAdminService } from './players-admin.service'

@Module({
  controllers: [PlayersAdminController],
  providers: [PlayersAdminService],
  exports: [PlayersAdminService],
})
export class PlayersAdminModule {}
