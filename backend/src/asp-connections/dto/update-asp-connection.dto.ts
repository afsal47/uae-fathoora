import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional } from 'class-validator';

export class UpdateAspConnectionDto {
  @ApiPropertyOptional({ enum: ['SANDBOX', 'PRODUCTION'] })
  @IsOptional()
  @IsIn(['SANDBOX', 'PRODUCTION'])
  environment?: 'SANDBOX' | 'PRODUCTION';

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @ApiPropertyOptional({
    description: 'Partial credential updates. Blank values are ignored.',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}
