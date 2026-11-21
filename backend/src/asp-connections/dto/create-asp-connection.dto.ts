import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAspConnectionDto {
  @ApiProperty()
  @IsString()
  legalEntityId!: string;

  @ApiProperty()
  @IsString()
  aspProviderId!: string;

  @ApiProperty({ enum: ['SANDBOX', 'PRODUCTION'] })
  @IsIn(['SANDBOX', 'PRODUCTION'])
  environment!: 'SANDBOX' | 'PRODUCTION';

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'], default: 'INACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @ApiPropertyOptional({
    description:
      'Credential map, e.g. { "apiKey": "...", "email": "..." }. Never returned in responses.',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}
