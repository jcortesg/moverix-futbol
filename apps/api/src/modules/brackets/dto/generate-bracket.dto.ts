import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class GenerateBracketDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string

  @ApiProperty({ required: false, default: 'main', description: 'Nombre de la copa (para multi_cup)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cupName?: string
}
