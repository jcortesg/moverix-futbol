import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export type PlayerPosition =
  | 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'CF' | 'ST'
const POSITIONS: PlayerPosition[] = ['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','CF','ST']

export class CreateRegistrationPlayerDto {
  @ApiProperty()
  @IsUUID()
  registrationId!: string

  @ApiProperty({ example: 'firebase-uid-123', description: 'UID del jugador (o un placeholder si aún no está registrado)' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  playerUid!: string

  @ApiProperty({ example: 'Juan Pérez Gómez' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  playerName!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string

  @ApiProperty({ required: false, example: '1030553463', description: 'Número de documento / cédula' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  docNumber?: string

  @ApiProperty({ required: false, example: '1989-01-21', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  birthDate?: string

  @ApiProperty({ required: false, example: 'Domun Inc' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  employer?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string

  @ApiProperty({ required: false, example: 'Sanitas' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  healthProvider?: string

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  jerseyNumber?: number

  @ApiProperty({ enum: POSITIONS, required: false })
  @IsOptional()
  @IsEnum(POSITIONS)
  position?: PlayerPosition

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isCaptain?: boolean

  @ApiProperty({ required: false, example: 'María Pérez', description: 'Nombre del contacto de emergencia' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string

  @ApiProperty({ required: false, example: '3124035940', description: 'Teléfono del contacto de emergencia' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  emergencyContactPhone?: string
}
