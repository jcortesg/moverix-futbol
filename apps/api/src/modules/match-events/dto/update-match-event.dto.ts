import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreateMatchEventDto } from './create-match-event.dto'

export class UpdateMatchEventDto extends PartialType(
  OmitType(CreateMatchEventDto, ['matchId'] as const),
) {}
