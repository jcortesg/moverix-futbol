import { IsBoolean, IsOptional, IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class GenerateFixtureDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string

  @ApiProperty({ required: false, default: false, description: 'Borra el fixture existente y regenera' })
  @IsOptional()
  @IsBoolean()
  force?: boolean
}
