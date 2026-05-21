import { IsEnum, IsOptional, IsString, IsUUID, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { SportFormat, Gender } from '@moverix/types'

export class CreateLeagueDto {
  @ApiProperty({ example: 'a1b2c3d4-...', description: 'ID de la organización' })
  @IsUUID()
  organizationId!: string

  @ApiProperty({ example: 'Liga CASB' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: 'liga-casb', description: 'URL-friendly slug' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  slug!: string

  @ApiProperty({ enum: ['F5', 'F8', 'F11'] })
  @IsEnum(['F5', 'F8', 'F11'])
  sportFormat!: SportFormat

  @ApiProperty({ enum: ['M', 'F', 'Mixed'] })
  @IsEnum(['M', 'F', 'Mixed'])
  gender!: Gender

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}
