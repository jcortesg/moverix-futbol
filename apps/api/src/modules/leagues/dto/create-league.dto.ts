import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { SportFormat, Gender } from '@moverix/types'

export class CreateLeagueDto {
  @ApiProperty({ example: 'Liga CASB' })
  @IsString()
  @MinLength(3)
  name: string

  @ApiProperty({ enum: ['F5', 'F8', 'F11'] })
  @IsEnum(['F5', 'F8', 'F11'])
  sportFormat: SportFormat

  @ApiProperty({ enum: ['M', 'F', 'Mixed'] })
  @IsEnum(['M', 'F', 'Mixed'])
  gender: Gender

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string
}
