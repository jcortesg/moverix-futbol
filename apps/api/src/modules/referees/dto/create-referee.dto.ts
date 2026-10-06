import { IsOptional, IsString, IsUUID, MaxLength, MinLength, IsEmail, IsIn } from 'class-validator'
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

  @ApiProperty({ required: false, description: 'Correo para vincular su cuenta y poder dirigir partidos' })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ required: false, enum: ['referee', 'delegate', 'both'], default: 'referee' })
  @IsOptional()
  @IsIn(['referee', 'delegate', 'both'])
  role?: 'referee' | 'delegate' | 'both'

  @ApiProperty({ required: false, description: 'UID del usuario si está registrado' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  uid?: string
}
