import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateGroupDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string

  @ApiProperty({ example: 'Grupo A' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string

  @ApiProperty({ example: 'A' })
  @IsString()
  @MinLength(1)
  @MaxLength(5)
  code!: string

  @ApiProperty({ required: false, default: 'groups' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phase?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxTeams?: number

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number
}
