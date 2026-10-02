import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Integration, Invoice, InvoiceLine, Prisma, Tenant } from '@prisma/client';
import {
  buildPintAePayload,
  toPeppolInvoiceNumber,
} from '../asp/pint-ae-payload.builder';
import { buildPintAeXml } from '../asp/pint-ae-xml.builder';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  PRECEDING_REF_REQUIRED_TYPES,
  isZeroChargedVatCategory,
  resolveDocumentTypeFromTaxMix,
} from './document-type.constants';
import {
  extractStoredSubmissionXml,
  parseAspPassthrough,
  wrapAspPassthrough,
} from './asp-payload.storage';
import { EVENT_TYPE, INVOICE_STATUS } from './invoice.constants';

type TenantIntegration = {
  tenant: Tenant;
  integration: Integration;
};

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto) {
    createInvoiceDto = this.normalizeCreditNoteFields(createInvoiceDto);

    const { tenant, integration } = await this.getTenantIntegration(
      createInvoiceDto.tenantCode,
      createInvoiceDto.sourceSystem,
    );

    createInvoiceDto = await this.resolvePrecedingHubInvoice(
      tenant.id,
      createInvoiceDto,
    );

    const existing = await this.prisma.invoice.findUnique({
      where: {
        tenantId_integrationId_idempotencyKey: {
          tenantId: tenant.id,
          integrationId: integration.id,
          idempotencyKey: createInvoiceDto.idempotencyKey,
        },
      },
      include: {
        lines: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (existing) {
      return existing;
    }

    const computedLines = createInvoiceDto.lines.map((line, index) => {
      const cat = line.vatCategory.toUpperCase();
      const vatRate =
        cat === 'AE' && line.vatRate === 0 ? 5 : line.vatRate;
      // Source systems send tax-inclusive unit prices.
      const grossAmount = this.round(line.quantity * line.unitPrice);
      let netAmount: number;
      let taxAmount: number;
      let totalAmount: number;

      // AE/E/O: no VAT charged on the invoice document (buyer accounts for AE)
      if (isZeroChargedVatCategory(cat) || vatRate === 0) {
        netAmount = grossAmount;
        taxAmount = 0;
        totalAmount = grossAmount;
      } else {
        netAmount = this.round(grossAmount / (1 + vatRate / 100));
        taxAmount = this.round(grossAmount - netAmount);
        totalAmount = grossAmount;
      }

      // Persist Peppol net unit price (BT-146), derived from the inclusive input.
      const netUnitPrice = this.round(netAmount / line.quantity);

      return {
        lineNumber: index + 1,
        description: line.description,
        quantity: new Prisma.Decimal(line.quantity),
        unitPrice: new Prisma.Decimal(netUnitPrice),
        netAmount: new Prisma.Decimal(netAmount),
        vatRate: new Prisma.Decimal(vatRate),
        vatCategory: line.vatCategory,
        taxAmount: new Prisma.Decimal(taxAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
      };
    });

    const subtotalAmount = this.round(
      computedLines.reduce((sum, line) => sum + Number(line.netAmount), 0),
    );
    const taxAmount = this.round(
      computedLines.reduce((sum, line) => sum + Number(line.taxAmount), 0),
    );
    const totalAmount = this.round(subtotalAmount + taxAmount);

    const resolvedDocumentType = resolveDocumentTypeFromTaxMix(
      createInvoiceDto.documentType,
      createInvoiceDto.lines.map((l) => l.vatCategory),
    );
    const dtoForValidation =
      resolvedDocumentType === createInvoiceDto.documentType
        ? createInvoiceDto
        : { ...createInvoiceDto, documentType: resolvedDocumentType };

    const typeChangeNote =
      resolvedDocumentType !== createInvoiceDto.documentType
        ? ` Document type resolved from ${createInvoiceDto.documentType} to ${resolvedDocumentType} based on line VAT mix.`
        : '';

    // IBMS document / credit-note number → dedicated column; hub Peppol ID is sequential.
    const sourceSystemCreditNoteId =
      createInvoiceDto.sourceSystemCreditNoteId?.trim() ||
      createInvoiceDto.invoiceNumber?.trim() ||
      undefined;
    const hubInvoiceNumber = await this.allocateHubInvoiceNumber(tenant.id);

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        integrationId: integration.id,
        sourceSystem: createInvoiceDto.sourceSystem,
        sourceDocumentId: createInvoiceDto.sourceDocumentId,
        idempotencyKey: createInvoiceDto.idempotencyKey,
        invoiceNumber: hubInvoiceNumber,
        sourceSystemCreditNoteId,
        documentType: resolvedDocumentType,
        status: INVOICE_STATUS.QUEUED,
        issueDate: new Date(createInvoiceDto.issueDate),
        currencyCode: createInvoiceDto.currencyCode ?? 'AED',
        sellerName: createInvoiceDto.seller.name,
        sellerTrn: createInvoiceDto.seller.trn,
        sellerAddressLine1: createInvoiceDto.seller.address?.line1,
        sellerAddressLine2: createInvoiceDto.seller.address?.line2,
        sellerCity: createInvoiceDto.seller.address?.city,
        sellerState: createInvoiceDto.seller.address?.state,
        sellerPostalCode: createInvoiceDto.seller.address?.postalCode,
        sellerCountryCode: createInvoiceDto.seller.address?.countryCode ?? 'AE',
        buyerName: createInvoiceDto.buyer.name,
        buyerTrn: createInvoiceDto.buyer.trn,
        buyerAddressLine1: createInvoiceDto.buyer.address?.line1,
        buyerAddressLine2: createInvoiceDto.buyer.address?.line2,
        buyerCity: createInvoiceDto.buyer.address?.city,
        buyerState: createInvoiceDto.buyer.address?.state,
        buyerPostalCode: createInvoiceDto.buyer.address?.postalCode,
        buyerCountryCode: createInvoiceDto.buyer.address?.countryCode ?? 'AE',
        subtotalAmount: new Prisma.Decimal(subtotalAmount),
        taxAmount: new Prisma.Decimal(taxAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
        notes: createInvoiceDto.notes,
        aspPayload: wrapAspPassthrough(
          this.extractPassthroughFields(dtoForValidation),
        ),
        lines: {
          create: computedLines,
        },
        events: {
          create: [
            {
              type: EVENT_TYPE.INVOICE_CREATED,
              toStatus: INVOICE_STATUS.DRAFT,
              message: `Invoice payload accepted from source integration.${typeChangeNote}`,
            },
            {
              type: EVENT_TYPE.VALIDATION_PASSED,
              fromStatus: INVOICE_STATUS.DRAFT,
              toStatus: INVOICE_STATUS.QUEUED,
              message: 'Basic validation passed and invoice queued.',
            },
            {
              type: EVENT_TYPE.SUBMISSION_QUEUED,
              toStatus: INVOICE_STATUS.QUEUED,
              message: 'Invoice enqueued for ASP submission.',
            },
          ],
        },
      },
      include: {
        lines: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.queueService.enqueueInvoiceSubmission(invoice.id);

    return invoice;
  }

  async findAll(sourceDocumentId?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: sourceDocumentId ? { sourceDocumentId } : undefined,
      include: {
        lines: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((invoice) => this.withSourcePayload(invoice));
  }

  async findOne(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} was not found.`);
    }

    return this.withSourcePayload(invoice);
  }

  async getStatus(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        submissionAttempts: true,
        submittedAt: true,
        acceptedAt: true,
        rejectedAt: true,
        cancelledAt: true,
        lastSubmissionAt: true,
        lastSubmissionError: true,
        aspMessageId: true,
        aspReferenceId: true,
        rejectionReason: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} was not found.`);
    }

    return invoice;
  }

  async findAllForIntegration(integrationId: string, sourceDocumentId?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        integrationId,
        ...(sourceDocumentId ? { sourceDocumentId } : {}),
      },
      include: {
        lines: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((invoice) => this.withSourcePayload(invoice));
  }

  async findOneForIntegration(integrationId: string, id: number) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, integrationId },
      include: {
        lines: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} was not found.`);
    }

    return this.withSourcePayload(invoice);
  }

  async getXmlForIntegration(integrationId: string, id: number): Promise<string> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, integrationId },
      include: {
        tenant: true,
        integration: true,
        lines: { orderBy: { lineNumber: 'asc' } },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} was not found.`);
    }

    const storedXml = extractStoredSubmissionXml(invoice.aspPayload);
    if (storedXml) {
      return storedXml;
    }

    return this.buildPintAeXmlForInvoice(invoice);
  }

  private buildPintAeXmlForInvoice(
    invoice: Invoice & {
      tenant: Tenant;
      integration: Integration;
      lines: InvoiceLine[];
    },
  ): string {
    const passthrough = parseAspPassthrough(invoice.aspPayload);
    const createInvoiceDto = this.buildCreateInvoiceDtoFromPassthrough(
      invoice,
      passthrough,
    );

    const pintPayload = buildPintAePayload({
      tenant: invoice.tenant,
      integration: invoice.integration,
      invoice,
      createInvoiceDto,
    });

    return buildPintAeXml(pintPayload);
  }

  private buildCreateInvoiceDtoFromPassthrough(
    invoice: Invoice,
    passthrough: Record<string, unknown> | null,
  ): CreateInvoiceDto | undefined {
    if (!passthrough) {
      return undefined;
    }

    return {
      ...passthrough,
      seller: {
        name: invoice.sellerName,
        ...(passthrough.seller as object),
      },
      buyer: {
        name: invoice.buyerName,
        ...(passthrough.buyer as object),
      },
    } as CreateInvoiceDto;
  }

  async getStatusForIntegration(integrationId: string, id: number) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, integrationId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        submissionAttempts: true,
        submittedAt: true,
        acceptedAt: true,
        rejectedAt: true,
        cancelledAt: true,
        lastSubmissionAt: true,
        lastSubmissionError: true,
        aspMessageId: true,
        aspReferenceId: true,
        rejectionReason: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} was not found.`);
    }

    return invoice;
  }

  private async getTenantIntegration(
    tenantCode: string,
    sourceSystem: string,
  ): Promise<TenantIntegration> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException(`Active tenant ${tenantCode} was not found.`);
    }

    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: sourceSystem,
        },
      },
    });

    if (!integration || !integration.isActive) {
      throw new NotFoundException(
        `Active integration ${sourceSystem} was not found for tenant ${tenantCode}.`,
      );
    }

    return { tenant, integration };
  }

  /**
   * Expose source-system pass-through as a structured object for API/UI consumers.
   * Omits raw aspPayload (can include large ASP submission XML).
   */
  private withSourcePayload<T extends { aspPayload?: string | null }>(invoice: T) {
    const { aspPayload, ...rest } = invoice;
    return {
      ...rest,
      sourcePayload: parseAspPassthrough(aspPayload) ?? null,
    };
  }

  /**
   * Atomically allocate the next hub Peppol invoice number for a tenant (inv-1, inv-2, …).
   */
  private async allocateHubInvoiceNumber(tenantId: string): Promise<string> {
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { invoiceSequence: { increment: 1 } },
      select: { invoiceSequence: true },
    });
    return toPeppolInvoiceNumber(String(updated.invoiceSequence));
  }

  /**
   * Map IBMS aliases (againstCreditNoteId / againstDCNoteId / reasonCode)
   * onto canonical fields. precedingInvoiceRef.id is resolved later via hub lookup.
   */
  private normalizeCreditNoteFields(dto: CreateInvoiceDto): CreateInvoiceDto {
    const againstDCNoteId =
      dto.againstCreditNoteId?.trim() ||
      dto.againstDCNoteId?.trim() ||
      dto.precedingInvoiceRef?.id?.trim() ||
      undefined;
    const creditNoteReasonCode =
      dto.creditNoteReasonCode?.trim() || dto.reasonCode?.trim() || undefined;

    return {
      ...dto,
      againstCreditNoteId: againstDCNoteId,
      againstDCNoteId,
      reasonCode: creditNoteReasonCode,
      creditNoteReasonCode,
    };
  }

  /**
   * IBMS sends againstCreditNoteId as the source-system number of an existing hub
   * invoice. Look it up and set precedingInvoiceRef.id to that invoice's hub Peppol
   * invoiceNumber (inv-N) for BillingReference in XML.
   */
  private async resolvePrecedingHubInvoice(
    tenantId: string,
    dto: CreateInvoiceDto,
  ): Promise<CreateInvoiceDto> {
    const againstId =
      dto.againstCreditNoteId?.trim() ||
      dto.againstDCNoteId?.trim() ||
      dto.precedingInvoiceRef?.id?.trim() ||
      undefined;

    const requiresPreceding = (
      PRECEDING_REF_REQUIRED_TYPES as readonly string[]
    ).includes(dto.documentType);

    if (!againstId) {
      if (requiresPreceding) {
        throw new BadRequestException(
          'Credit/debit notes require againstCreditNoteId (or againstDCNoteId / precedingInvoiceRef.id) referencing an existing hub invoice.',
        );
      }
      return dto;
    }

    const peppolAgainstId = toPeppolInvoiceNumber(againstId);
    const preceding = await this.prisma.invoice.findFirst({
      where: {
        tenantId,
        OR: [
          { sourceSystemCreditNoteId: againstId },
          { invoiceNumber: againstId },
          { invoiceNumber: peppolAgainstId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        invoiceNumber: true,
        issueDate: true,
      },
    });

    if (!preceding) {
      throw new BadRequestException(
        `No hub invoice found for againstCreditNoteId="${againstId}". Submit the original invoice first.`,
      );
    }

    const issueDate =
      dto.precedingInvoiceRef?.issueDate ||
      preceding.issueDate.toISOString().slice(0, 10);

    return {
      ...dto,
      againstCreditNoteId: againstId,
      againstDCNoteId: againstId,
      precedingInvoiceRef: {
        id: preceding.invoiceNumber,
        issueDate,
      },
    };
  }

  private extractPassthroughFields(dto: CreateInvoiceDto): Record<string, unknown> {
    return {
      taxPointDate: dto.taxPointDate,
      dueDate: dto.dueDate,
      taxCurrencyCode: dto.taxCurrencyCode,
      accountingCost: dto.accountingCost,
      contractReference: dto.contractReference,
      paymentMeans: dto.paymentMeans,
      paymentTerms: dto.paymentTerms,
      delivery: dto.delivery,
      invoicePeriod: dto.invoicePeriod,
      precedingInvoiceRef: dto.precedingInvoiceRef,
      againstDCNoteId: dto.againstDCNoteId,
      againstCreditNoteId: dto.againstCreditNoteId ?? dto.againstDCNoteId,
      sourceSystemCreditNoteId:
        dto.sourceSystemCreditNoteId?.trim() || dto.invoiceNumber?.trim(),
      creditNoteReasonCode: dto.creditNoteReasonCode,
      reasonCode: dto.reasonCode ?? dto.creditNoteReasonCode,
      orderReference: dto.orderReference,
      allowanceCharges: dto.allowanceCharges,
      transactionFlags: dto.transactionFlags,
      profileExecutionId: dto.profileExecutionId,
      principalTrn: dto.principalTrn,
      exchangeRate: dto.exchangeRate,
      taxInclusiveAmountInAed: dto.taxInclusiveAmountInAed,
      references: dto.references,
      seller: {
        endpointId: dto.seller.endpointId,
        endpointScheme: dto.seller.endpointScheme,
        legalRegistration: dto.seller.legalRegistration,
        contact: dto.seller.contact,
        addressLine3: dto.seller.address?.line3,
      },
      buyer: {
        endpointId: dto.buyer.endpointId,
        endpointScheme: dto.buyer.endpointScheme,
        legalRegistration: dto.buyer.legalRegistration,
        contact: dto.buyer.contact,
        addressLine3: dto.buyer.address?.line3,
      },
      lines: dto.lines.map((l) => ({
        unitCode: l.unitCode,
        itemDescription: l.itemDescription,
        vatExemptionReason: l.vatExemptionReason,
        vatExemptionReasonCode: l.vatExemptionReasonCode,
        rcmNatureCode: l.rcmNatureCode,
        classificationId: l.classificationId,
        classificationScheme: l.classificationScheme,
        accountingCost: l.accountingCost,
        orderLineReferenceId: l.orderLineReferenceId,
        invoicePeriod: l.invoicePeriod,
        allowanceCharges: l.allowanceCharges,
      })),
    };
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }
}
