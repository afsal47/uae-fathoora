import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateIntegrationDto {
  @ApiProperty({ description: 'Unique code within the tenant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @ApiProperty({ description: 'Integration display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ default: 'API_KEY_HMAC' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  authType?: string;

  @ApiPropertyOptional({ description: 'Comma-separated allowed IP ranges' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allowedIpRanges?: string;
}
