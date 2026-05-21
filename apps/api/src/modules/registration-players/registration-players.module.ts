import { Module } from '@nestjs/common'
import { RegistrationPlayersController } from './registration-players.controller'
import { RegistrationPlayersService } from './registration-players.service'

@Module({
  controllers: [RegistrationPlayersController],
  providers: [RegistrationPlayersService],
  exports: [RegistrationPlayersService],
})
export class RegistrationPlayersModule {}
