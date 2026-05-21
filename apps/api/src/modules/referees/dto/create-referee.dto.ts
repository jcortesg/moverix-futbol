import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateRefereeDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string

  @ApiProperty({ example: 'Carlos Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  licenseNumber?: string

  @ApiProperty({ required: false, description: 'UID del usuario si está registrado' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  uid?: string
}
