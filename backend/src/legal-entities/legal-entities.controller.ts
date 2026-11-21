import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto';
import { LegalEntitiesService } from './legal-entities.service';

@ApiTags('legal-entities')
@ApiSecurity('admin-key')
@UseGuards(AdminAuthGuard)
@Controller('tenants/:tenantId/legal-entities')
export class LegalEntitiesController {
  constructor(private readonly service: LegalEntitiesService) {}

  @Post()
  create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateLegalEntityDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  findAll(@Param('tenantId') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLegalEntityDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }
}
