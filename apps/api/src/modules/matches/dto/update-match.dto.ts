import { IsEnum, IsInt, IsOptional, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreateMatchDto } from './create-match.dto'

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'walkover'
const MATCH_STATUSES: MatchStatus[] = ['scheduled', 'live', 'finished', 'postponed', 'cancelled', 'walkover']

export class UpdateMatchDto extends PartialType(OmitType(CreateMatchDto, ['matchdayId'] as const)) {
  @ApiProperty({ enum: MATCH_STATUSES, required: false })
  @IsOptional()
  @IsEnum(MATCH_STATUSES)
  status?: MatchStatus

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  homeScore?: number

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  awayScore?: number

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  homePenalties?: number

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  awayPenalties?: number
}
