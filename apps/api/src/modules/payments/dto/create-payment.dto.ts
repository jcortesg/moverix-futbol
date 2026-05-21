import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export type PaymentType = 'registration' | 'fine' | 'other'
const PAYMENT_TYPES: PaymentType[] = ['registration', 'fine', 'other']

export class CreatePaymentDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string

  @ApiProperty()
  @IsUUID()
  teamId!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  registrationId?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  fineId?: string

  @ApiProperty({ enum: PAYMENT_TYPES, default: 'registration' })
  @IsOptional()
  @IsEnum(PAYMENT_TYPES)
  type?: PaymentType

  @ApiProperty({ example: 50000 })
  @IsInt()
  @Min(0)
  amount!: number

  @ApiProperty({ required: false, default: 'COP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  receiptUrl?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string
}
