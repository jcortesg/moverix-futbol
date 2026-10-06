import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreateMatchDto } from './create-match.dto'

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled' | 'walkover'
const MATCH_STATUSES: MatchStatus[] = ['scheduled', 'live', 'finished', 'postponed', 'cancelled', 'walkover']

export class UpdateMatchDto extends PartialType(OmitType(CreateMatchDto, ['matchdayId'] as const)) {
  /**
   * Mover el partido a otra jornada. Los goles y tarjetas cuelgan del partido,
   * no de la jornada, así que reasignar no toca ningún evento. El service valida
   * que la jornada destino sea de la misma edición y que ningún equipo quede con
   * dos partidos en ella.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  matchdayId?: string

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
