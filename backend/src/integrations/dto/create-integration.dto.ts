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

  @ApiPropertyOptional({
    description:
      'Legal entity this source system should invoice under. Defaults to the tenant default legal entity when omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  legalEntityId?: string;
}
