import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateTeamDto {
  @ApiProperty({ example: 'Real Barrio FC' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @ApiProperty({ required: false, example: 'RBFC' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  shortName?: string

  @ApiProperty({ required: false, example: '#16a34a' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor debe ser hex #rrggbb' })
  primaryColor?: string

  @ApiProperty({ required: false, example: '#ffffff' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondaryColor debe ser hex #rrggbb' })
  secondaryColor?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  @ApiProperty({ required: false, description: 'Email del delegado/DT. Si está vacío, el creador queda como delegado.' })
  @IsOptional()
  @IsEmail()
  directorEmail?: string
}
