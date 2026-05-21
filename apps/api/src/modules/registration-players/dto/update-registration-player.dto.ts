import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreateRegistrationPlayerDto } from './create-registration-player.dto'

export class UpdateRegistrationPlayerDto extends PartialType(
  OmitType(CreateRegistrationPlayerDto, ['registrationId', 'playerUid'] as const),
) {}
