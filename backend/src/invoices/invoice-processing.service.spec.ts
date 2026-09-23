import { UnauthorizedException } from '@nestjs/common';
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
    const queueService = {
      mode: 'inline',
      getConnection: jest.fn(),
      setInlineProcessor: jest.fn(),
      enqueueInvoiceSubmission: jest.fn().mockResolvedValue(undefined),
    };
    const adapter = {
      submitInvoice: jest.fn(),
      parseWebhook: jest.fn(),
    };
    const aspProviderResolver = {
      resolve: jest.fn().mockReturnValue(adapter),
    };

    const outboundWebhook = {
      enqueueStatusWebhook: jest.fn().mockResolvedValue(undefined),
      notify: jest.fn().mockResolvedValue(undefined),
    };
    const secrets = {
      decrypt: jest.fn((value: string) => value),
      encrypt: jest.fn((value: string) => value),
    };

    return {
      service: new InvoiceProcessingService(
        prisma as never,
        queueService as never,
        aspProviderResolver as never,
        outboundWebhook as never,
        secrets as never,
      ),
      prisma,
      queueService,
      adapter,
      aspProviderResolver,
      outboundWebhook,
      secrets,
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

  it('applies webhook status updates when the token matches', async () => {
    const { service, prisma, adapter } = createService();
    adapter.parseWebhook.mockResolvedValue({
      tenantCode: 'CITY_MARINE',
      invoiceId: 'invoice-1',
      status: 'ACCEPTED',
      message: 'Accepted by ASP',
      rawPayload: { status: 'ACCEPTED' },
    });
    prisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-1',
      aspWebhookToken: 'secret-token',
    });
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'invoice-1',
      status: 'SUBMITTED',
    });
    prisma.invoice.update.mockResolvedValue({
      id: 'invoice-1',
      status: 'ACCEPTED',
      lines: [],
      events: [],
    });

    const result = await service.handleWebhook(
      'FAKE',
      { 'x-webhook-token': 'secret-token' },
      { status: 'ACCEPTED' },
    );

    expect(result.status).toBe('ACCEPTED');
  });

  it('rejects webhooks with an invalid token', async () => {
    const { service, prisma, adapter } = createService();
    adapter.parseWebhook.mockResolvedValue({
      tenantCode: 'CITY_MARINE',
      invoiceId: 'invoice-1',
      status: 'REJECTED',
      message: 'Rejected by ASP',
      rawPayload: { status: 'REJECTED' },
    });
    prisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-1',
      aspWebhookToken: 'secret-token',
    });

    await expect(
      service.handleWebhook('FAKE', { 'x-webhook-token': 'bad-token' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
