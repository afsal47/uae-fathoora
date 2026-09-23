import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@Controller('tenants/:tenantId/integrations')
@UseGuards(AdminAuthGuard)
@ApiSecurity('admin-key')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create integration for a tenant (auto-generates API key + secret)' })
  create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.integrationsService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all integrations for a tenant' })
  findAll(@Param('tenantId') tenantId: string) {
    return this.integrationsService.findAllByTenant(tenantId);
  }

  @Get(':integrationId')
  @ApiOperation({ summary: 'Get one integration' })
  findOne(
    @Param('tenantId') tenantId: string,
    @Param('integrationId') integrationId: string,
  ) {
    return this.integrationsService.findOne(tenantId, integrationId);
  }

  @Patch(':integrationId')
  @ApiOperation({ summary: 'Update integration details' })
  update(
    @Param('tenantId') tenantId: string,
    @Param('integrationId') integrationId: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(tenantId, integrationId, dto);
  }

  @Post(':integrationId/regenerate-keys')
  @ApiOperation({ summary: 'Regenerate API key and secret for an integration' })
  regenerateKeys(
    @Param('tenantId') tenantId: string,
    @Param('integrationId') integrationId: string,
  ) {
    return this.integrationsService.regenerateKeys(tenantId, integrationId);
  }
}
