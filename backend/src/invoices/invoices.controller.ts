import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiProduces, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Integration, Tenant } from '@prisma/client';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceProcessingService } from './invoice-processing.service';
import { InvoicesService } from './invoices.service';

type AuthedRequest = {
  tenant: Tenant;
  integration: Integration;
};

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Integration API key' })
@ApiHeader({
  name: 'x-signature',
  required: false,
  description: 'HMAC-SHA256 signature (optional while HMAC_REQUIRED=false)',
})
@ApiHeader({
  name: 'x-timestamp',
  required: false,
  description: 'Unix timestamp in ms (optional while HMAC_REQUIRED=false)',
})
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoiceProcessingService: InvoiceProcessingService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create or return an idempotent invoice' })
  create(@Req() req: AuthedRequest, @Body() createInvoiceDto: CreateInvoiceDto) {
    this.assertBodyMatchesAuth(req, createInvoiceDto);
    return this.invoicesService.create(createInvoiceDto);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices for the authenticated integration' })
  @ApiQuery({
    name: 'sourceDocumentId',
    required: false,
    description: 'Filter by source document id',
  })
  findAll(
    @Req() req: AuthedRequest,
    @Query('sourceDocumentId') sourceDocumentId?: string,
  ) {
    return this.invoicesService.findAllForIntegration(
      req.integration.id,
      sourceDocumentId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one invoice by id' })
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.invoicesService.findOneForIntegration(req.integration.id, id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get invoice processing status' })
  getStatus(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.invoicesService.getStatusForIntegration(req.integration.id, id);
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Get Peppol PINT-AE XML for an invoice' })
  @ApiProduces('application/xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  getXml(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.invoicesService.getXmlForIntegration(req.integration.id, id);
  }

  @Post(':id/requeue')
  @ApiOperation({ summary: 'Requeue a failed invoice for ASP submission' })
  async requeue(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.invoicesService.findOneForIntegration(req.integration.id, id);
    return this.invoiceProcessingService.requeueInvoice(id);
  }

  private assertBodyMatchesAuth(req: AuthedRequest, dto: CreateInvoiceDto) {
    if (dto.tenantCode.toUpperCase() !== req.tenant.code.toUpperCase()) {
      throw new ForbiddenException(
        'tenantCode does not match the authenticated API key tenant.',
      );
    }
    if (dto.sourceSystem.toUpperCase() !== req.integration.code.toUpperCase()) {
      throw new ForbiddenException(
        'sourceSystem does not match the authenticated integration.',
      );
    }
  }
}
