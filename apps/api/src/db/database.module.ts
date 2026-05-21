import { Global, Module } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { OwnershipService } from '../common/services/ownership.service'

@Global()
@Module({
  providers: [DatabaseService, OwnershipService],
  exports: [DatabaseService, OwnershipService],
})
export class DatabaseModule {}
