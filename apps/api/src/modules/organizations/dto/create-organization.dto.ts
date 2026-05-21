import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Club Atlético San Bernardo' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string

@ApiProperty({ example: 'Bogotá', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  @ApiProperty({ example: 'CO', default: 'CO', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string
}
