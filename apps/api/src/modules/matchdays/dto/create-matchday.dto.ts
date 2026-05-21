import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateMatchdayDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  number!: number

  @ApiProperty({ required: false, example: 'Jornada 1' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string

  @ApiProperty({ required: false, default: 'groups' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phase?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  scheduledDate?: string
}
