import { IsInt, IsOptional, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class FinalizeMatchDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  homeScore!: number

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  awayScore!: number

  @ApiProperty({ required: false, description: 'Penales del local si aplican' })
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
