import { InvoiceProcessingService } from './invoice-processing.service';

describe('InvoiceProcessingService', () => {
  function createService() {
    const prisma = {
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
      },
      integration: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'integration-1',
          code: 'IBMS_BROKING',
        }),
      },
    };
    const queueService: {
      mode: 'inline' | 'bullmq';
      getConnection: jest.Mock;
      setInlineProcessor: jest.Mock;
      enqueueInvoiceSubmission: jest.Mock;
    } = {
      mode: 'inline',
      getConnection: jest.fn(),
      setInlineProcessor: jest.fn(),
      enqueueInvoiceSubmission: jest.fn().mockResolvedValue(undefined),
    };
    const adapter = {
      submitInvoice: jest.fn(),
    };
    const aspProviderResolver = {
      resolve: jest.fn().mockReturnValue(adapter),
    };
    const aspConnectionResolver = {
      resolveForLegalEntity: jest.fn().mockResolvedValue({
        id: 'conn-1',
        tenantId: 'tenant-1',
        legalEntityId: 'le-1',
        aspProvider: { code: 'EVATRA', status: 'ACTIVE' },
        credentials: [],
        environment: 'PRODUCTION',
      }),
      toRuntimeWithApiConfig: jest.fn().mockResolvedValue({
        connectionId: 'conn-1',
        tenantId: 'tenant-1',
        legalEntityId: 'le-1',
        providerCode: 'EVATRA',
        environment: 'PRODUCTION',
        origin: 'https://asp.example',
        submitUrl: 'https://asp.example/submit',
        loginPath: '/auth/login',
        statusPathTemplate: '/invoice/document-status/{trackingId}',
        retryTddPath: '/peppol/tdd/retry-failed',
        timeoutMs: 30000,
        credentials: { apiKey: 'k', email: 'e@x.com' },
      }),
      resolveDefaultLegalEntityId: jest.fn().mockResolvedValue('le-1'),
      legacyTenantRuntime: jest.fn(),
    };

    return {
      service: new InvoiceProcessingService(
        prisma as never,
        queueService as never,
        aspProviderResolver as never,
        aspConnectionResolver as never,
      ),
      prisma,
      queueService,
      adapter,
      aspProviderResolver,
      aspConnectionResolver,
    };
  }

  it('submits queued invoices and stores provider references', async () => {
    const { service, prisma, adapter } = createService();
    prisma.invoice.findUnique.mockResolvedValue({
      id: 1,
      tenantId: 'tenant-1',
      legalEntityId: 'le-1',
      aspConnectionId: 'conn-1',
      status: 'QUEUED',
      invoiceNumber: 'INV-1',
      totalAmount: 105,
      currencyCode: 'AED',
      tenant: {
        id: 'tenant-1',
        aspProvider: 'EVATRA',
        code: 'CITY_MARINE',
      },
      integration: {
        code: 'IBMS_BROKING',
      },
      lines: [],
      aspConnection: {
        id: 'conn-1',
        tenantId: 'tenant-1',
        legalEntityId: 'le-1',
        aspProvider: { code: 'EVATRA', status: 'ACTIVE' },
        credentials: [],
      },
    });
    prisma.invoice.update
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        id: 1,
        status: 'SUBMITTED',
        aspMessageId: 'msg-1',
      });
    adapter.submitInvoice.mockResolvedValue({
      status: 'SUBMITTED',
      aspMessageId: 'msg-1',
      aspReferenceId: 'ref-1',
      payload: { invoiceNumber: 'INV-1' },
      response: { accepted: true },
    });

    const result = await service.processSubmission(1);

    expect(adapter.submitInvoice).toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('SUBMITTED');
  });

  it('rejects queue jobs when tenantId does not match invoice ownership', async () => {
    const { service, prisma } = createService();
    prisma.invoice.findUnique.mockResolvedValue({
      id: 1,
      tenantId: 'tenant-a',
      status: 'QUEUED',
      tenant: { id: 'tenant-a' },
      integration: {},
      lines: [],
    });

    await expect(
      service.processSubmission(1, {
        invoiceId: 1,
        tenantId: 'tenant-b',
      }),
    ).rejects.toThrow(/tenant mismatch/i);
  });

  it('requeues an invoice and enqueues it again', async () => {
    const { service, prisma, queueService } = createService();
    queueService.mode = 'bullmq';
    prisma.invoice.findUnique
      .mockResolvedValueOnce({
        id: 1,
        tenantId: 'tenant-1',
        legalEntityId: 'le-1',
        aspConnectionId: 'conn-1',
        status: 'FAILED',
      })
      .mockResolvedValueOnce({
        id: 1,
        status: 'QUEUED',
        lines: [],
        events: [],
      });
    prisma.invoice.update.mockResolvedValue({});

    const invoice = await service.requeueInvoice(1);

    expect(queueService.enqueueInvoiceSubmission).toHaveBeenCalledWith({
      invoiceId: 1,
      tenantId: 'tenant-1',
      legalEntityId: 'le-1',
      aspConnectionId: 'conn-1',
    });
    expect(invoice!.status).toBe('QUEUED');
  });

  it('submits to the ASP before returning a requeued invoice', async () => {
    const { service, prisma, queueService } = createService();
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 1,
      tenantId: 'tenant-1',
      legalEntityId: null,
      aspConnectionId: null,
      status: 'FAILED',
    });
    prisma.invoice.update.mockResolvedValue({});
    const submitted = {
      id: 1,
      status: 'FAILED',
      lastSubmissionError:
        'EVATRA returned HTTP 401 from https://api-stage.evatrauae.com/invoice/send-document-async',
      lines: [],
      events: [],
    };
    jest.spyOn(service, 'processSubmission').mockResolvedValue(submitted as never);

    const invoice = await service.requeueInvoice(1);

    expect(queueService.enqueueInvoiceSubmission).not.toHaveBeenCalled();
    expect(service.processSubmission).toHaveBeenCalledWith(1, {
      invoiceId: 1,
      tenantId: 'tenant-1',
      legalEntityId: null,
      aspConnectionId: null,
    });
    expect(invoice).toBe(submitted);
  });
});
