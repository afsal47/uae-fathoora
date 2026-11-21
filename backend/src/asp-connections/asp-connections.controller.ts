import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AspConnectionsService } from './asp-connections.service';
import { CreateAspConnectionDto } from './dto/create-asp-connection.dto';
import { UpdateAspConnectionDto } from './dto/update-asp-connection.dto';

@ApiTags('asp-connections')
@ApiSecurity('admin-key')
@UseGuards(AdminAuthGuard)
@Controller('tenants/:tenantId/asp-connections')
export class AspConnectionsController {
  constructor(private readonly service: AspConnectionsService) {}

  @Post()
  create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateAspConnectionDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  findAll(
    @Param('tenantId') tenantId: string,
    @Query('legalEntityId') legalEntityId?: string,
  ) {
    return this.service.findAll(tenantId, legalEntityId);
  }

  @Get(':id')
  findOne(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAspConnectionDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Post(':id/test')
  test(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.service.testConnection(tenantId, id);
  }
}
