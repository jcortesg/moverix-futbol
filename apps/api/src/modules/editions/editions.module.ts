import { Module } from '@nestjs/common'
import { EditionsController } from './editions.controller'
import { EditionsService } from './editions.service'
import { DatabaseModule } from '../../db/database.module'
import { StorageService } from '../../common/services/storage.service'

@Module({
  imports: [DatabaseModule],
  controllers: [EditionsController],
  providers: [EditionsService, StorageService],
  exports: [EditionsService],
})
export class EditionsModule {}
