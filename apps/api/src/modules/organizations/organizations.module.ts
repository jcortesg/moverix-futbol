import { Module } from '@nestjs/common'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'
import { StorageService } from '../../common/services/storage.service'

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, StorageService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
