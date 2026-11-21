import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateIntegrationDto {
  @ApiPropertyOptional({ description: 'Integration display name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Legal entity this source system should invoice under',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  legalEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
