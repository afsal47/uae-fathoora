import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { InvoiceProcessingService } from './invoice-processing.service';
import { InvoicesService } from './invoices.service';

@ApiTags('Admin - Invoices')
@Controller('admin/invoices')
@UseGuards(AdminAuthGuard)
@ApiSecurity('admin-key')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
export class AdminInvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoiceProcessingService: InvoiceProcessingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all invoices (admin)' })
  @ApiQuery({ name: 'sourceDocumentId', required: false })
  findAll(@Query('sourceDocumentId') sourceDocumentId?: string) {
    return this.invoicesService.findAll(sourceDocumentId);
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Get Peppol PINT-AE XML for an invoice (admin)' })
  @ApiProduces('application/xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  getXml(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.getXml(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by numeric hub id (admin)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.findOne(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get invoice status (admin)' })
  getStatus(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.getStatus(id);
  }

  @Post(':id/requeue')
  @ApiOperation({ summary: 'Requeue a failed invoice for ASP submission' })
  requeue(@Param('id', ParseIntPipe) id: number) {
    return this.invoiceProcessingService.requeueInvoice(id);
  }
}
