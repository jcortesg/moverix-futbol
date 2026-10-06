import { Module } from '@nestjs/common'
import { RegistrationPlayersController } from './registration-players.controller'
import { RegistrationPlayersService } from './registration-players.service'
import { StorageService } from '../../common/services/storage.service'

@Module({
  controllers: [RegistrationPlayersController],
  providers: [RegistrationPlayersService, StorageService],
  exports: [RegistrationPlayersService],
})
export class RegistrationPlayersModule {}
