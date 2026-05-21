import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreateRefereeDto } from './create-referee.dto'

export class UpdateRefereeDto extends PartialType(OmitType(CreateRefereeDto, ['organizationId'] as const)) {}
