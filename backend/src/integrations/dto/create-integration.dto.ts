import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateIntegrationDto {
  @ApiProperty({ example: 'IBMS_BROKING', description: 'Unique code within the tenant' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @ApiProperty({ example: 'IBMS Broking System' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ default: 'API_KEY_HMAC' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  authType?: string;

  @ApiPropertyOptional({ description: 'Webhook URL to notify source system on invoice status changes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookUrl?: string;

  @ApiPropertyOptional({ description: 'Secret for signing outbound webhook payloads' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookSecret?: string;

  @ApiPropertyOptional({ description: 'Comma-separated allowed IP ranges' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allowedIpRanges?: string;
}
