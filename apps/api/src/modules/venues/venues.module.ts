import { Module } from '@nestjs/common'
import { VenuesController } from './venues.controller'
import { VenuesService } from './venues.service'
import { StorageService } from '../../common/services/storage.service'

@Module({
  controllers: [VenuesController],
  providers: [VenuesService, StorageService],
  exports: [VenuesService],
})
export class VenuesModule {}
