import {
  ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class GenerateManualDto {
  @ApiProperty({ description: 'Edición del torneo' })
  @IsUUID()
  editionId!: string

  @ApiPropertyOptional({ description: 'Copa a la que pertenece el cuadro (por defecto "main")' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cupName?: string

  @ApiProperty({
    description:
      'Cruces en el orden del cuadro: [[idLocal, idVisitante], ...]. Los ganadores ' +
      'de los cruces 1 y 2 se enfrentan en la ronda siguiente, los de 3 y 4, etc.',
    example: [['uuid-local', 'uuid-visitante']],
  })
  @IsArray()
  @ArrayMinSize(1)
  matchups!: [string, string][]
}

export class GenerateConsolationDto {
  @ApiProperty({ description: 'Edición del torneo' })
  @IsUUID()
  editionId!: string

  @ApiProperty({ description: 'Nombre de la copa nueva, ej. "plata"' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  cupName!: string

  @ApiPropertyOptional({ description: 'Copa de la que salen los perdedores (por defecto "main")' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sourceCup?: string

  @ApiPropertyOptional({ description: 'Ronda de origen (por defecto 1, los 16avos)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceRound?: number
}

export class GenerateBracketDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string

  @ApiProperty({ required: false, default: 'main', description: 'Nombre de la copa (para multi_cup)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cupName?: string

}
