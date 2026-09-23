import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Integration, Invoice, InvoiceLine, Prisma, Tenant } from '@prisma/client';
import { buildPintAePayload } from '../asp/pint-ae-payload.builder';
import { buildPintAeXml } from '../asp/pint-ae-xml.builder';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  CREDIT_NOTE_DOCUMENT_TYPES,
  PRECEDING_REF_REQUIRED_TYPES,
  buildProfileExecutionId,
  isSelfBilledDocument,
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
    const { tenant, integration } = await this.getTenantIntegration(
      createInvoiceDto.tenantCode,
      createInvoiceDto.sourceSystem,
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
      const netAmount = this.round(line.quantity * line.unitPrice);
      const cat = line.vatCategory.toUpperCase();
      // AE/E/O: no VAT charged on the invoice document (buyer accounts for AE)
      const taxAmount = isZeroChargedVatCategory(cat)
        ? 0
        : this.round((netAmount * line.vatRate) / 100);
      const totalAmount = this.round(netAmount + taxAmount);

      return {
        lineNumber: index + 1,
        description: line.description,
        quantity: new Prisma.Decimal(line.quantity),
        unitPrice: new Prisma.Decimal(line.unitPrice),
        netAmount: new Prisma.Decimal(netAmount),
        vatRate: new Prisma.Decimal(
          cat === 'AE' && line.vatRate === 0 ? 5 : line.vatRate,
        ),
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

    this.validateInvoice(dtoForValidation, subtotalAmount, taxAmount, totalAmount);

    const typeChangeNote =
      resolvedDocumentType !== createInvoiceDto.documentType
        ? ` Document type resolved from ${createInvoiceDto.documentType} to ${resolvedDocumentType} based on line VAT mix.`
        : '';

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        integrationId: integration.id,
        sourceSystem: createInvoiceDto.sourceSystem,
        sourceDocumentId: createInvoiceDto.sourceDocumentId,
        idempotencyKey: createInvoiceDto.idempotencyKey,
        invoiceNumber: createInvoiceDto.invoiceNumber,
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
    return this.prisma.invoice.findMany({
      where: sourceDocumentId ? { sourceDocumentId } : undefined,
      include: {
        lines: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
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

    return invoice;
  }

  async getStatus(id: string) {
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
    return this.prisma.invoice.findMany({
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
  }

  async findOneForIntegration(integrationId: string, id: string) {
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

    return invoice;
  }

  async getXmlForIntegration(integrationId: string, id: string): Promise<string> {
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

  async getStatusForIntegration(integrationId: string, id: string) {
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

  private readonly VALID_VAT_CATEGORIES = ['S', 'Z', 'E', 'AE', 'O', 'K', 'G', 'L', 'M'];
  private readonly EXEMPTION_REQUIRED_CATEGORIES = ['E', 'AE', 'O', 'K', 'G'];
  private readonly ZERO_RATE_CATEGORIES = ['E', 'O', 'K', 'G'];
  private readonly PAYMENT_MEANS_REQUIRED_TYPES = [
    'TAX_INVOICE',
    'SELF_BILLED_TAX_INVOICE',
    'COMMERCIAL_INVOICE',
    'DEBIT_NOTE',
  ] as const;
  private readonly BUYER_TRN_OPTIONAL_TYPES = [
    'COMMERCIAL_INVOICE',
    'COMMERCIAL_CREDIT_NOTE',
  ] as const;

  private validateInvoice(
    createInvoiceDto: CreateInvoiceDto,
    subtotalAmount: number,
    taxAmount: number,
    totalAmount: number,
  ) {
    if (!createInvoiceDto.seller.name || !createInvoiceDto.buyer.name) {
      throw new BadRequestException('Seller and buyer names are required.');
    }

    this.assertPartyAddress(createInvoiceDto.seller, 'seller');
    this.assertPartyAddress(createInvoiceDto.buyer, 'buyer');
    this.assertLegalRegistration(createInvoiceDto.seller, 'seller');
    this.assertLegalRegistration(createInvoiceDto.buyer, 'buyer');

    if (!createInvoiceDto.seller.trn?.trim()) {
      throw new BadRequestException(
        'seller.trn is required (Evatra BT-29 Seller Identifier).',
      );
    }

    const buyerTrnOptional = (
      this.BUYER_TRN_OPTIONAL_TYPES as readonly string[]
    ).includes(createInvoiceDto.documentType);
    if (!buyerTrnOptional && !createInvoiceDto.buyer.trn?.trim()) {
      throw new BadRequestException(
        'buyer.trn is required for this document type (Evatra BT-46).',
      );
    }

    if (
      (this.PAYMENT_MEANS_REQUIRED_TYPES as readonly string[]).includes(
        createInvoiceDto.documentType,
      ) &&
      !createInvoiceDto.paymentMeans?.code
    ) {
      throw new BadRequestException(
        `${createInvoiceDto.documentType} requires paymentMeans.code (Evatra IBT-081).`,
      );
    }

    if (totalAmount > 0 && !createInvoiceDto.dueDate) {
      throw new BadRequestException(
        'dueDate is required when payable amount is greater than zero (Evatra BT-9).',
      );
    }

    if (isSelfBilledDocument(createInvoiceDto.documentType)) {
      const profileExecutionId = buildProfileExecutionId(
        createInvoiceDto.transactionFlags,
        createInvoiceDto.profileExecutionId,
      );
      if (profileExecutionId !== '00000000') {
        throw new BadRequestException(
          'Self-billed documents require ProfileExecutionID 00000000 (Evatra BTAE-02).',
        );
      }
    }

    const currency = createInvoiceDto.currencyCode ?? 'AED';
    const taxCurrency = createInvoiceDto.taxCurrencyCode ?? 'AED';

    if (currency !== 'AED') {
      if (taxCurrency !== 'AED') {
        throw new BadRequestException(
          'taxCurrencyCode must be AED when invoice currencyCode is not AED.',
        );
      }
      if (createInvoiceDto.exchangeRate == null || createInvoiceDto.exchangeRate <= 0) {
        throw new BadRequestException(
          'exchangeRate (UAE Central Bank rate) is required when currencyCode is not AED.',
        );
      }
      if (createInvoiceDto.taxInclusiveAmountInAed == null) {
        throw new BadRequestException(
          'taxInclusiveAmountInAed (aedtotal-incl-vat) is required when currencyCode is not AED.',
        );
      }
    }

    if ((createInvoiceDto.seller.address?.countryCode ?? 'AE') !== 'AE') {
      throw new BadRequestException(
        'Only AE country code is supported for seller in this MVP.',
      );
    }

    if (subtotalAmount < 0 || taxAmount < 0 || totalAmount <= 0) {
      throw new BadRequestException('Invoice totals must be greater than zero.');
    }

    for (const line of createInvoiceDto.lines) {
      const cat = line.vatCategory.toUpperCase();
      if (!this.VALID_VAT_CATEGORIES.includes(cat)) {
        throw new BadRequestException(
          `Invalid VAT category '${line.vatCategory}'. Allowed: ${this.VALID_VAT_CATEGORIES.join(', ')}`,
        );
      }

      if (cat === 'S' && ![0, 5].includes(line.vatRate)) {
        throw new BadRequestException(
          `Standard (S) VAT rate must be 0 or 5, got ${line.vatRate}.`,
        );
      }

      // AE reverse charge: statutory rate 5% (or 0) but tax is not charged on the invoice
      if (cat === 'AE' && ![0, 5].includes(line.vatRate)) {
        throw new BadRequestException(
          `Reverse charge (AE) VAT rate must be 0 or 5, got ${line.vatRate}.`,
        );
      }

      if (this.ZERO_RATE_CATEGORIES.includes(cat) && line.vatRate !== 0) {
        throw new BadRequestException(
          `VAT category '${cat}' must have vatRate 0, got ${line.vatRate}.`,
        );
      }

      if (
        this.EXEMPTION_REQUIRED_CATEGORIES.includes(cat) &&
        !line.vatExemptionReason
      ) {
        throw new BadRequestException(
          `VAT category '${cat}' requires vatExemptionReason.`,
        );
      }

      if (cat === 'AE' && !line.rcmNatureCode?.trim()) {
        throw new BadRequestException(
          "VAT category 'AE' requires rcmNatureCode (Evatra BTAE-09).",
        );
      }
    }

    if (
      (PRECEDING_REF_REQUIRED_TYPES as readonly string[]).includes(
        createInvoiceDto.documentType,
      ) &&
      !createInvoiceDto.precedingInvoiceRef
    ) {
      throw new BadRequestException(
        `${createInvoiceDto.documentType} requires precedingInvoiceRef (original invoice number).`,
      );
    }

    if (
      (CREDIT_NOTE_DOCUMENT_TYPES as readonly string[]).includes(
        createInvoiceDto.documentType,
      ) &&
      !createInvoiceDto.creditNoteReasonCode
    ) {
      throw new BadRequestException(
        `${createInvoiceDto.documentType} requires creditNoteReasonCode (e.g. DL8.61.1.A).`,
      );
    }

    const isAgent =
      createInvoiceDto.transactionFlags?.disclosedAgentBilling === true ||
      createInvoiceDto.profileExecutionId?.[5] === '1';
    if (isAgent && !createInvoiceDto.principalTrn) {
      throw new BadRequestException(
        'principalTrn is required when disclosed agent billing is used.',
      );
    }
  }

  private assertPartyAddress(
    party: CreateInvoiceDto['seller'],
    label: 'seller' | 'buyer',
  ) {
    const a = party.address;
    if (!a?.line1?.trim() || !a.city?.trim() || !a.state?.trim() || !a.countryCode?.trim()) {
      throw new BadRequestException(
        `${label}.address must include line1, city, state (emirate), and countryCode (Evatra address fields).`,
      );
    }
  }

  private assertLegalRegistration(
    party: CreateInvoiceDto['seller'],
    label: 'seller' | 'buyer',
  ) {
    const lr = party.legalRegistration;
    const id =
      lr?.tradeLicense?.trim() ||
      lr?.emiratesId?.trim() ||
      lr?.passport?.trim() ||
      lr?.commercialRegistration?.trim();

    if (!id) {
      throw new BadRequestException(
        `${label}.legalRegistration requires one of tradeLicense, emiratesId, passport, or commercialRegistration (Evatra BT-30/BT-41).`,
      );
    }

    if (!lr?.schemeAgencyName?.trim()) {
      throw new BadRequestException(
        `${label}.legalRegistration.schemeAgencyName is required (Evatra BTAE-12).`,
      );
    }
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
      creditNoteReasonCode: dto.creditNoteReasonCode,
      orderReference: dto.orderReference,
      allowanceCharges: dto.allowanceCharges,
      transactionFlags: dto.transactionFlags,
      profileExecutionId: dto.profileExecutionId,
      principalTrn: dto.principalTrn,
      exchangeRate: dto.exchangeRate,
      taxInclusiveAmountInAed: dto.taxInclusiveAmountInAed,
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
