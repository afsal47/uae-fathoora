import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ description: 'Unique tenant code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @ApiProperty({ description: 'Registered company name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Tax Registration Number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  trn?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ description: 'Contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Address line 1' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'State or emirate' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  postalCode?: string;

  @ApiPropertyOptional({ default: 'AE' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @ApiProperty({
    description:
      'Access Point provider name for this tenant. Invoices are posted to aspBaseUrl under this name.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  aspProvider!: string;

  @ApiPropertyOptional({ description: 'ASP API base URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  aspBaseUrl?: string;

  @ApiPropertyOptional({ description: 'ASP API key' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  aspApiKey?: string;

  @ApiPropertyOptional({ description: 'Token ASP sends in webhook header for verification' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  aspWebhookToken?: string;
}
