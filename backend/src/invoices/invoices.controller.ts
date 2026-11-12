import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Integration, Tenant } from '@prisma/client';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceStatusResponseDto } from './dto/invoice-status-response.dto';
import { ASP_REFRESHABLE_STATUSES } from './invoice.constants';
import { InvoiceProcessingService } from './invoice-processing.service';
import { InvoicesService } from './invoices.service';

type AuthedRequest = {
  tenant: Tenant;
  integration: Integration;
};

type StatusSnapshot = Awaited<
  ReturnType<InvoicesService['getStatusForIntegration']>
>;

const ASP_REFRESHABLE_STATUS_SET = new Set<string>(ASP_REFRESHABLE_STATUSES);

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
@ApiHeader({ name: 'x-api-key', required: true, description: 'Integration API key' })
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

  @Get('status')
  @ApiOperation({
    summary: 'Track invoice status (source system polling)',
    description:
      'Use this API from IBMS to refresh Hub invoice / ASP status. ' +
      'When the invoice has an ASP tracking id and is still in progress, Hub polls that company ASP, ' +
      'updates local status automatically, then returns the refreshed payload. ' +
      'Pass hubInvoiceId (preferred), or sourceDocumentId / sourceSystemDCNoteId. ' +
      'Map response.status into the IBMS Status column and aspReferenceId into ASP reference.',
  })
  @ApiQuery({
    name: 'hubInvoiceId',
    required: false,
    type: Number,
    description: 'Hub invoice id returned by POST /v1/invoices (e.g. 50)',
    example: 50,
  })
  @ApiQuery({
    name: 'sourceDocumentId',
    required: false,
    description: 'Source document id sent at create',
    example: '100245',
  })
  @ApiQuery({
    name: 'sourceSystemDCNoteId',
    required: false,
    description: 'IBMS DCNote / source document number',
    example: '119',
  })
  @ApiOkResponse({
    description: 'Current Hub + ASP status for the matched invoice',
    type: InvoiceStatusResponseDto,
  })
  async trackStatus(
    @Req() req: AuthedRequest,
    @Query('hubInvoiceId') hubInvoiceId?: string,
    @Query('sourceDocumentId') sourceDocumentId?: string,
    @Query('sourceSystemDCNoteId') sourceSystemDCNoteId?: string,
  ) {
    const parsedId =
      hubInvoiceId !== undefined && hubInvoiceId !== ''
        ? Number(hubInvoiceId)
        : undefined;
    const current = await this.invoicesService.trackStatusForIntegration(
      req.integration.id,
      {
        hubInvoiceId:
          parsedId !== undefined && Number.isFinite(parsedId)
            ? parsedId
            : undefined,
        sourceDocumentId,
        sourceSystemDCNoteId,
      },
    );
    return this.refreshHubStatusFromAsp(req.integration.id, current);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one invoice by numeric hub id' })
  findOne(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.invoicesService.findOneForIntegration(req.integration.id, id);
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Get invoice processing status by Hub id',
    description:
      'Same payload as GET /v1/invoices/status?hubInvoiceId=:id. Prefer for simple polling when IBMS already stored the Hub id. ' +
      'Also polls ASP and updates Hub when a tracking id exists and status is still in progress.',
  })
  @ApiOkResponse({
    description: 'Current Hub + ASP status',
    type: InvoiceStatusResponseDto,
  })
  async getStatus(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const current = await this.invoicesService.getStatusForIntegration(
      req.integration.id,
      id,
    );
    return this.refreshHubStatusFromAsp(req.integration.id, current);
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Get Peppol PINT-AE XML for an invoice' })
  @ApiProduces('application/xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  getXml(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.invoicesService.getXmlForIntegration(req.integration.id, id);
  }

  @Post(':id/sync-status')
  @ApiOperation({
    summary: 'Poll the invoice tenant ASP for document status and update the hub',
  })
  async syncStatus(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.invoicesService.findOneForIntegration(req.integration.id, id);
    return this.invoiceProcessingService.syncAspStatus(id);
  }

  @Post(':id/asp-retry')
  @ApiOperation({
    summary: 'Retry ASP Peppol TDD for this invoice trackingId',
  })
  async aspRetry(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.invoicesService.findOneForIntegration(req.integration.id, id);
    return this.invoiceProcessingService.retryAsp(id);
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

  /**
   * On IBMS status refresh: poll company ASP and persist any newer status on Hub,
   * then return the refreshed status payload. Falls back to last known Hub status
   * if ASP is unreachable.
   */
  private async refreshHubStatusFromAsp(
    integrationId: string,
    invoice: StatusSnapshot,
  ): Promise<StatusSnapshot> {
    const trackingId =
      invoice.aspMessageId?.trim() || invoice.aspReferenceId?.trim() || '';
    if (!trackingId || !ASP_REFRESHABLE_STATUS_SET.has(invoice.status)) {
      return invoice;
    }

    try {
      await this.invoiceProcessingService.syncAspStatus(invoice.id);
    } catch {
      return invoice;
    }

    return this.invoicesService.getStatusForIntegration(integrationId, invoice.id);
  }
}
