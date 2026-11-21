import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({ description: 'Registered company name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Tax Registration Number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  trn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ description: 'Activate or deactivate tenant' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
