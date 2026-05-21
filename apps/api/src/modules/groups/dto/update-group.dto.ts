import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreateGroupDto } from './create-group.dto'

export class UpdateGroupDto extends PartialType(OmitType(CreateGroupDto, ['editionId'] as const)) {}
