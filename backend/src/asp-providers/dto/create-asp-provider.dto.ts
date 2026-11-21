import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAspProviderDto {
  @ApiProperty({ example: 'EVATRA' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'EVATRA' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
