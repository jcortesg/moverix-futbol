import { IsEnum, IsOptional } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreateFineDto } from './create-fine.dto'

export type FineStatus = 'pending' | 'paid' | 'waived'
const FINE_STATUSES: FineStatus[] = ['pending', 'paid', 'waived']

export class UpdateFineDto extends PartialType(OmitType(CreateFineDto, ['editionId', 'teamId'] as const)) {
  @ApiProperty({ enum: FINE_STATUSES, required: false })
  @IsOptional()
  @IsEnum(FINE_STATUSES)
  status?: FineStatus
}
