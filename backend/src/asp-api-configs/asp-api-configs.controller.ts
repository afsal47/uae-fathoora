import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AspApiConfigsService } from './asp-api-configs.service';
import { UpsertAspApiConfigDto } from './dto/upsert-asp-api-config.dto';

@ApiTags('asp-api-configs')
@ApiSecurity('admin-key')
@UseGuards(AdminAuthGuard)
@Controller('asp-providers/:providerId/api-configs')
export class AspApiConfigsController {
  constructor(private readonly service: AspApiConfigsService) {}

  @Get()
  list(@Param('providerId') providerId: string) {
    return this.service.listForProvider(providerId);
  }

  @Put()
  upsert(
    @Param('providerId') providerId: string,
    @Body() dto: UpsertAspApiConfigDto,
  ) {
    return this.service.upsert(providerId, dto);
  }
}
