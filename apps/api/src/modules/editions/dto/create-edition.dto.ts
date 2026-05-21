import {
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateEditionDto {
  @ApiProperty()
  @IsUUID()
  leagueId!: string

  @ApiProperty({ example: '2025 - I' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: '2025-I' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  season!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  startDate?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  endDate?: string

  @ApiProperty({ required: false, default: 16 })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxTeams?: number

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  registrationFee?: number

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  prizePool?: number

  @ApiProperty({ required: false, default: 'COP' })
  @IsOptional()
  @IsString()
  currency?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  rulesUrl?: string

  @ApiProperty({ description: 'Configuración del formato (JSON)' })
  @IsObject()
  formatConfig!: object

  @ApiProperty({ required: false, description: 'Criterios de desempate (JSON)' })
  @IsOptional()
  @IsObject()
  tiebreakerRules?: object
}
