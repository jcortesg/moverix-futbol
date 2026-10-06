import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateBanDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string

  @ApiProperty({ description: 'Cédula; se guardan solo los dígitos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  docNumber!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string

  @ApiProperty({ description: 'Motivo del veto; queda en el historial' })
  @IsString()
  @IsNotEmpty()
  reason!: string

  @ApiProperty({ required: false, description: 'Vigente hasta; vacío = indefinido' })
  @IsOptional()
  @IsDateString()
  until?: string | null
}

export class LiftBanDto {
  @ApiProperty()
  @IsUUID()
  organizationId!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string
}
