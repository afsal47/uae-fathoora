import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateLegalEntityDto } from './create-legal-entity.dto';

export class UpdateLegalEntityDto extends PartialType(
  OmitType(CreateLegalEntityDto, ['code'] as const),
) {}
