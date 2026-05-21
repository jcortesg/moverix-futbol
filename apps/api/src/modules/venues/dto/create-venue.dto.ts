import { IsInt, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateVenueDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string

  @ApiProperty({ example: 'Polideportivo CASB' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsLatitude()
  lat?: number

  @ApiProperty({ required: false })
  @IsOptional()
  @IsLongitude()
  lng?: number

  @ApiProperty({ required: false, default: 1, description: 'Canchas / partidos simultáneos' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  pitchCount?: number
}
