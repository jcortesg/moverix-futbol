import { IsBoolean, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateMatchDto {
  @ApiProperty()
  @IsUUID()
  matchdayId!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  groupId?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  homeTeamId?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  awayTeamId?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  venueId?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  refereeId?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isNeutral?: boolean

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  round?: string
}
