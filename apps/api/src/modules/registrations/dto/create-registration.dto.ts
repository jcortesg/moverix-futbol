import { IsInt, IsOptional, IsUUID, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateRegistrationDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string

  @ApiProperty()
  @IsUUID()
  teamId!: string

  @ApiProperty({ required: false, description: 'Ranking para cabezas de serie' })
  @IsOptional()
  @IsInt()
  @Min(1)
  seedRank?: number
}
