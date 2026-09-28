import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  const tenant = {
    id: 'tenant-1',
    code: 'CITY_MARINE',
    isActive: true,
  };

  const integration = {
    id: 'integration-1',
    tenantId: 'tenant-1',
    code: 'IBMS_BROKING',
    isActive: true,
  };

  const partyExtras = {
    address: {
      line1: 'Office 101, Business Bay',
      city: 'Dubai',
      state: 'DXB',
      countryCode: 'AE',
    },
    legalRegistration: {
      tradeLicense: '1045678',
      schemeAgencyName: 'Department of Economic Development',
    },
  };

  const createInvoiceDto = {
    tenantCode: 'CITY_MARINE',
    sourceSystem: 'IBMS_BROKING',
    idempotencyKey: 'idem-1',
    documentType: 'TAX_INVOICE' as const,
    invoiceNumber: 'INV-1',
    sourceDocumentId: 'DOC-1',
    issueDate: '2026-08-18T00:00:00.000Z',
    dueDate: '2026-09-18',
    currencyCode: 'AED',
    paymentMeans: { code: '30', name: 'Credit transfer' },
    seller: {
      name: 'Seller',
      trn: '100123456700003',
      ...partyExtras,
    },
    buyer: {
      name: 'Buyer',
      trn: '100987654300001',
      ...partyExtras,
    },
    lines: [
      {
        description: 'Policy fee',
        quantity: 1,
        unitPrice: 100,
        vatRate: 5,
        vatCategory: 'S',
      },
    ],
  };

  function createService() {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(tenant),
      },
      integration: {
        findUnique: jest.fn().mockResolvedValue(integration),
      },
      invoice: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          invoiceNumber: 'INV-1',
          status: 'QUEUED',
          lines: [],
          events: [],
        }),
      },
    };
    const queueService = {
      enqueueInvoiceSubmission: jest.fn().mockResolvedValue(undefined),
    };

    return {
      service: new InvoicesService(prisma as never, queueService as never),
      prisma,
      queueService,
    };
  }

  it('queues a newly created invoice for submission', async () => {
    const { service, prisma, queueService } = createService();

    const invoice = await service.create(createInvoiceDto);

    expect(prisma.invoice.create).toHaveBeenCalled();
    expect(queueService.enqueueInvoiceSubmission).toHaveBeenCalledWith('invoice-1');
    expect(invoice.status).toBe('QUEUED');
  });

  it('returns the existing invoice for duplicate idempotency keys', async () => {
    const { service, prisma, queueService } = createService();
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 'invoice-existing',
      status: 'SUBMITTED',
      lines: [],
      events: [],
    });

    const invoice = await service.create(createInvoiceDto);

    expect(invoice.id).toBe('invoice-existing');
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(queueService.enqueueInvoiceSubmission).not.toHaveBeenCalled();
  });

  it('accepts non-AED invoices without FX fields', async () => {
    const { service, queueService } = createService();

    const invoice = await service.create({
      ...createInvoiceDto,
      currencyCode: 'USD',
    });

    expect(queueService.enqueueInvoiceSubmission).toHaveBeenCalledWith('invoice-1');
    expect(invoice.status).toBe('QUEUED');
  });

  it('accepts non-AED invoices when FX fields are provided', async () => {
    const { service, queueService } = createService();

    const invoice = await service.create({
      ...createInvoiceDto,
      currencyCode: 'USD',
      taxCurrencyCode: 'AED',
      exchangeRate: 3.6725,
      taxInclusiveAmountInAed: 367.25,
    });

    expect(queueService.enqueueInvoiceSubmission).toHaveBeenCalledWith('invoice-1');
    expect(invoice.status).toBe('QUEUED');
  });

  it('accepts a tax invoice when address and legal registration are omitted', async () => {
    const { service, queueService } = createService();

    const invoice = await service.create({
      ...createInvoiceDto,
      dueDate: undefined,
      paymentMeans: undefined,
      seller: { name: 'Seller' },
      buyer: { name: 'Buyer' },
    });

    expect(queueService.enqueueInvoiceSubmission).toHaveBeenCalledWith('invoice-1');
    expect(invoice.status).toBe('QUEUED');
  });

  it('resolves TAX_INVOICE with all Outside Scope lines to COMMERCIAL_INVOICE', async () => {
    const { service, prisma } = createService();

    await service.create({
      ...createInvoiceDto,
      documentType: 'TAX_INVOICE',
      // commercial: buyer TRN optional after resolution
      buyer: {
        name: 'Buyer',
        ...partyExtras,
      },
      lines: [
        {
          description: 'Disbursement legal fee',
          quantity: 1,
          unitPrice: 500,
          vatRate: 0,
          vatCategory: 'O',
          vatExemptionReason: 'Disbursement out of scope',
        },
      ],
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentType: 'COMMERCIAL_INVOICE',
          taxAmount: expect.anything(),
        }),
      }),
    );
  });
});
