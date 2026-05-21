import { IsEnum, IsOptional } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { PartialType, OmitType } from '@nestjs/mapped-types'
import { CreatePaymentDto } from './create-payment.dto'

export type PaymentStatus = 'pending' | 'verified' | 'rejected'
const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'verified', 'rejected']

export class UpdatePaymentDto extends PartialType(OmitType(CreatePaymentDto, ['editionId', 'teamId'] as const)) {
  @ApiProperty({ enum: PAYMENT_STATUSES, required: false })
  @IsOptional()
  @IsEnum(PAYMENT_STATUSES)
  status?: PaymentStatus
}
