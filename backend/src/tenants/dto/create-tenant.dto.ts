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
  @ApiProperty({ example: 'CITY_MARINE', description: 'Unique tenant code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @ApiProperty({ example: 'City Marine Insurance LLC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: '100123456700003', description: 'Tax Registration Number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  trn?: string;

  @ApiPropertyOptional({ example: 'accounts@citymarine.ae' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ example: '+971-4-1234567' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'Office 101, Business Bay Tower' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: '12345' })
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

  @ApiPropertyOptional({
    default: 'FAKE',
    description:
      'Selected ASP for this tenant only. FAKE/MOCK stay local. CLEARTAX uses the ClearTax API. Any other name posts XML to aspBaseUrl.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  aspProvider?: string;

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
