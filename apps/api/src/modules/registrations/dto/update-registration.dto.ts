import { IsEnum, IsInt, IsISO8601, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'
const STATUSES: RegistrationStatus[] = ['pending', 'approved', 'rejected', 'withdrawn']

export class UpdateRegistrationDto {
  @ApiProperty({ enum: STATUSES, required: false })
  @IsOptional()
  @IsEnum(STATUSES)
  status?: RegistrationStatus

  @ApiProperty({ required: false, nullable: true, description: 'Asignar grupo (null para desasignar)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  groupId?: string | null

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  seedRank?: number

  @ApiProperty({ required: false, nullable: true, description: 'Marcar pago (null para limpiar)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  paidAt?: string | null
}
