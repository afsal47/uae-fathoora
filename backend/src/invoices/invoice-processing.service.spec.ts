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

    return {
      service: new InvoiceProcessingService(
        prisma as never,
        queueService as never,
        aspProviderResolver as never,
      ),
      prisma,
      queueService,
      adapter,
      aspProviderResolver,
    };
  }

  it('submits queued invoices and stores provider references', async () => {
    const { service, prisma, adapter } = createService();
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      status: 'QUEUED',
      invoiceNumber: 'INV-1',
      totalAmount: 105,
      currencyCode: 'AED',
      tenant: {
        aspProvider: 'FAKE',
        code: 'CITY_MARINE',
      },
      integration: {
        code: 'IBMS_BROKING',
      },
      lines: [],
    });
    prisma.invoice.update
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        id: 'invoice-1',
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

    const result = await service.processSubmission('invoice-1');

    expect(adapter.submitInvoice).toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('SUBMITTED');
  });

  it('requeues an invoice and enqueues it again', async () => {
    const { service, prisma, queueService } = createService();
    queueService.mode = 'bullmq';
    prisma.invoice.findUnique
      .mockResolvedValueOnce({
        id: 'invoice-1',
        status: 'FAILED',
      })
      .mockResolvedValueOnce({
        id: 'invoice-1',
        status: 'QUEUED',
        lines: [],
        events: [],
      });
    prisma.invoice.update.mockResolvedValue({});

    const invoice = await service.requeueInvoice('invoice-1');

    expect(queueService.enqueueInvoiceSubmission).toHaveBeenCalledWith('invoice-1');
    expect(invoice!.status).toBe('QUEUED');
  });

  it('submits to the ASP before returning a requeued invoice', async () => {
    const { service, prisma, queueService } = createService();
    prisma.invoice.findUnique.mockResolvedValueOnce({
      id: 'invoice-1',
      status: 'FAILED',
    });
    prisma.invoice.update.mockResolvedValue({});
    const submitted = {
      id: 'invoice-1',
      status: 'FAILED',
      lastSubmissionError: 'TESTASP returned HTTP 401 from https://api-stage.evatrauae.com/invoice/send-document-async',
      lines: [],
      events: [],
    };
    jest.spyOn(service, 'processSubmission').mockResolvedValue(submitted as never);

    const invoice = await service.requeueInvoice('invoice-1');

    expect(queueService.enqueueInvoiceSubmission).not.toHaveBeenCalled();
    expect(service.processSubmission).toHaveBeenCalledWith('invoice-1');
    expect(invoice).toBe(submitted);
  });
});
