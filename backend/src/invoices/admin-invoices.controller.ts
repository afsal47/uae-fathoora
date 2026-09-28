import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { InvoicesService } from './invoices.service';

@ApiTags('Admin - Invoices')
@Controller('admin/invoices')
@UseGuards(AdminAuthGuard)
@ApiSecurity('admin-key')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
export class AdminInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all invoices (admin)' })
  @ApiQuery({ name: 'sourceDocumentId', required: false })
  findAll(@Query('sourceDocumentId') sourceDocumentId?: string) {
    return this.invoicesService.findAll(sourceDocumentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID (admin)' })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }
// ,,
  @Get(':id/status')
  @ApiOperation({ summary: 'Get invoice status (admin)' })
  getStatus(@Param('id') id: string) {
    return this.invoicesService.getStatus(id);
  }
}
