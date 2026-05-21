import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export type FineConcept =
  | 'yellow_card' | 'yellow_card_accumulation' | 'red_card'
  | 'walkover' | 'late_arrival' | 'misconduct' | 'team_misconduct' | 'other'

const FINE_CONCEPTS: FineConcept[] = [
  'yellow_card', 'yellow_card_accumulation', 'red_card',
  'walkover', 'late_arrival', 'misconduct', 'team_misconduct', 'other',
]

export class CreateFineDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string

  @ApiProperty()
  @IsUUID()
  teamId!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  matchId?: string

  @ApiProperty({ required: false, description: 'UID del jugador (si la multa es individual)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  playerUid?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  playerName?: string

  @ApiProperty({ enum: FINE_CONCEPTS, default: 'other' })
  @IsOptional()
  @IsEnum(FINE_CONCEPTS)
  concept?: FineConcept

  @ApiProperty({ example: 'Acumulación de tarjetas amarillas' })
  @IsString()
  @MinLength(2)
  reason!: string

  @ApiProperty({ example: 50000, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number

  @ApiProperty({ required: false, default: 'COP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string

  @ApiProperty({ required: false, example: 'Suspensión 1 partido' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sanction?: string

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  matchesBanned?: number

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  appealed?: boolean
}
