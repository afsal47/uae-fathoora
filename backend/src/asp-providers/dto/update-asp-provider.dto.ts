import { PartialType } from '@nestjs/swagger';
import { CreateAspProviderDto } from './create-asp-provider.dto';

export class UpdateAspProviderDto extends PartialType(CreateAspProviderDto) {}
