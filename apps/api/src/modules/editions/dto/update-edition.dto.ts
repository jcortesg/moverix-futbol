import { PartialType } from '@nestjs/mapped-types'
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { CreateEditionDto } from './create-edition.dto'

export type EditionStatus = 'draft' | 'registration' | 'active' | 'finished'
const EDITION_STATUSES: EditionStatus[] = ['draft', 'registration', 'active', 'finished']

export class UpdateEditionDto extends PartialType(CreateEditionDto) {
  @ApiProperty({ enum: EDITION_STATUSES, required: false })
  @IsOptional()
  @IsEnum(EDITION_STATUSES)
  status?: EditionStatus

  @ApiProperty({ description: 'Estado actual del bracket (JSONB)', required: false })
  @IsOptional()
  @IsObject()
  bracketState?: object

  @ApiProperty({ description: 'Criterios de desempate (JSONB)', required: false })
  @IsOptional()
  @IsObject()
  tiebreakerRules?: object

  @ApiProperty({ description: 'Publicar pagina publica del torneo', required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean

  @ApiProperty({ description: 'Inscripciones abiertas/cerradas (independiente del status)', required: false })
  @IsOptional()
  @IsBoolean()
  registrationsOpen?: boolean

  @ApiProperty({
    description: 'Cierre GENERAL de nominas: bloquea la edicion de plantillas de TODOS los equipos',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  rostersLocked?: boolean

  @ApiProperty({ description: 'Descripcion publica del torneo (max 2000 chars)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  publicDescription?: string

  @ApiProperty({
    description:
      'Multas y sanciones de este torneo. Claves opcionales: redCard, yellowAccumulation, ' +
      'yellowsForAccumulation, redCardMatchesBanned, yellowAccumulationMatchesBanned, ' +
      'redCardSanction, yellowAccumulationSanction. Lo que falte usa el valor por defecto.',
    required: false,
  })
  @IsOptional()
  @IsObject()
  fineDefaults?: Record<string, unknown>
}
