import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export type EventType =
  | 'goal' | 'own_goal' | 'yellow_card' | 'red_card'
  | 'substitution' | 'penalty_scored' | 'penalty_missed' | 'mvp'
const EVENT_TYPES: EventType[] = [
  'goal', 'own_goal', 'yellow_card', 'red_card',
  'substitution', 'penalty_scored', 'penalty_missed', 'mvp',
]

export class CreateMatchEventDto {
  @ApiProperty()
  @IsUUID()
  matchId!: string

  @ApiProperty()
  @IsUUID()
  teamId!: string

  @ApiProperty({ enum: EVENT_TYPES })
  @IsEnum(EVENT_TYPES)
  eventType!: EventType

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  minute?: number

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  playerUid?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  playerName?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  assistPlayerUid?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  assistPlayerName?: string
}
