import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreateMatchdayDto } from './create-matchday.dto'

export class UpdateMatchdayDto extends PartialType(OmitType(CreateMatchdayDto, ['editionId'] as const)) {}
