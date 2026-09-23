import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { Worker } from 'bullmq';
import { AspProviderResolverService } from '../asp/asp-provider-resolver.service';
import { ParsedWebhookPayload } from '../asp/asp.types';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { OutboundWebhookService, WebhookEvent } from '../webhooks/outbound-webhook.service';
import {
  EVENT_TYPE,
  INVOICE_QUEUE_NAME,
  INVOICE_STATUS,
  INVOICE_SUBMISSION_JOB,
  InvoiceStatus,
} from './invoice.constants';
import {
  mergeSubmissionIntoAspPayload,
  parseAspPassthrough,
} from './asp-payload.storage';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoiceProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvoiceProcessingService.name);
  private worker?: Worker<{ invoiceId: string }>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly aspProviderResolver: AspProviderResolverService,
    private readonly outboundWebhook: OutboundWebhookService,
    private readonly secrets: SecretsCryptoService,
  ) {}

  onModuleInit() {
    if (this.queueService.mode === 'inline') {
      this.queueService.setInlineProcessor(async ({ invoiceId }) => {
        await this.processSubmission(invoiceId);
      });
      return;
    }

    const connection = this.queueService.getConnection();
    if (!connection) {
      return;
    }

    this.worker = new Worker(
      INVOICE_QUEUE_NAME,
      async (job) => {
        if (job.name !== INVOICE_SUBMISSION_JOB) {
          return;
        }

        await this.processSubmission(job.data.invoiceId);
      },
      {
        connection,
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Invoice job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });
  }

  async processSubmission(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        tenant: true,
        integration: true,
        lines: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
    }

    if (
      invoice.status !== INVOICE_STATUS.QUEUED &&
      invoice.status !== INVOICE_STATUS.FAILED
    ) {
      return invoice;
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: INVOICE_STATUS.SUBMITTING,
        submissionAttempts: { increment: 1 },
        lastSubmissionAt: new Date(),
        lastSubmissionError: null,
        events: {
          create: {
            type: EVENT_TYPE.SUBMISSION_STARTED,
            fromStatus: invoice.status,
            toStatus: INVOICE_STATUS.SUBMITTING,
            message: 'Invoice submission started.',
          },
        },
      },
    });

    try {
      const provider = this.aspProviderResolver.resolve(invoice.tenant.aspProvider);

      let passthroughDto: CreateInvoiceDto | undefined;
      if (invoice.aspPayload) {
        try {
          const passthrough = parseAspPassthrough(invoice.aspPayload);
          if (passthrough) {
            passthroughDto = {
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
        } catch {
          /* ignore parse errors for legacy records */
        }
      }

      const result = await provider.submitInvoice({
        tenant: invoice.tenant,
        integration: invoice.integration,
        invoice,
        createInvoiceDto: passthroughDto,
      });
      const statusData = this.buildStatusUpdate(result.status, result.rejectionReason);

      const updated = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: result.status,
          aspMessageId: result.aspMessageId,
          aspReferenceId: result.aspReferenceId,
          // Keep source pass-through; attach submission under lastSubmission
          aspPayload: mergeSubmissionIntoAspPayload(
            invoice.aspPayload,
            result.payload,
          ),
          aspResponse: JSON.stringify(result.response),
          submittedAt: statusData.submittedAt,
          acceptedAt: statusData.acceptedAt,
          rejectedAt: statusData.rejectedAt,
          rejectionReason: result.rejectionReason ?? null,
          lastSubmissionError: null,
          events: {
            create: {
              type: EVENT_TYPE.SUBMISSION_SUCCEEDED,
              fromStatus: INVOICE_STATUS.SUBMITTING,
              toStatus: result.status,
              message: `Invoice submitted to ASP provider ${invoice.tenant.aspProvider}.`,
            },
          },
        },
        include: {
          lines: true,
          events: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      void this.outboundWebhook.notify(
        invoice.integration,
        updated,
        `invoice.${result.status.toLowerCase()}` as WebhookEvent,
      );

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown ASP submission failure.';

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: INVOICE_STATUS.FAILED,
          lastSubmissionError: message,
          events: {
            create: {
              type: EVENT_TYPE.SUBMISSION_FAILED,
              fromStatus: INVOICE_STATUS.SUBMITTING,
              toStatus: INVOICE_STATUS.FAILED,
              message,
            },
          },
        },
      });

      throw error;
    }
  }

  async requeueInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: INVOICE_STATUS.QUEUED,
        lastSubmissionError: null,
        events: {
          create: {
            type: EVENT_TYPE.REQUEUE_REQUESTED,
            fromStatus: invoice.status,
            toStatus: INVOICE_STATUS.QUEUED,
            message: 'Invoice requeued for ASP submission.',
          },
        },
      },
    });

    await this.queueService.enqueueInvoiceSubmission(invoiceId);

    return this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async handleWebhook(
    providerName: string,
    headers: Record<string, string | string[] | undefined>,
    payload: Record<string, unknown>,
  ) {
    const provider = this.aspProviderResolver.resolve(providerName);
    const webhook = await provider.parseWebhook(payload);
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        code: webhook.tenantCode,
        aspProvider: providerName.toUpperCase(),
        isActive: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(
        `Active tenant ${webhook.tenantCode} was not found for provider ${providerName}.`,
      );
    }

    this.assertWebhookToken(tenant.aspWebhookToken, headers);

    const invoice = await this.findInvoiceForWebhook(tenant.id, webhook);
    const integration = await this.prisma.integration.findFirst({
      where: { id: invoice.integrationId },
    });
    const statusData = this.buildStatusUpdate(webhook.status, webhook.rejectionReason);

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: webhook.status,
        acceptedAt: statusData.acceptedAt,
        rejectedAt: statusData.rejectedAt,
        cancelledAt: statusData.cancelledAt,
        rejectionReason: webhook.rejectionReason ?? null,
        aspResponse: JSON.stringify(webhook.rawPayload),
        events: {
          create: [
            {
              type: EVENT_TYPE.WEBHOOK_RECEIVED,
              fromStatus: invoice.status,
              toStatus: invoice.status,
              message: webhook.message,
              payload: JSON.stringify(webhook.rawPayload),
            },
            {
              type: EVENT_TYPE.STATUS_RECONCILED,
              fromStatus: invoice.status,
              toStatus: webhook.status,
              message: `Webhook reconciled invoice status to ${webhook.status}.`,
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

    if (integration) {
      void this.outboundWebhook.notify(
        integration,
        updated,
        `invoice.${webhook.status.toLowerCase()}` as WebhookEvent,
      );
    }

    return updated;
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async findInvoiceForWebhook(
    tenantId: string,
    webhook: ParsedWebhookPayload,
  ): Promise<Invoice> {
    if (webhook.invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          id: webhook.invoiceId,
          tenantId,
        },
      });

      if (invoice) {
        return invoice;
      }
    }

    if (webhook.aspReferenceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          aspReferenceId: webhook.aspReferenceId,
        },
      });

      if (invoice) {
        return invoice;
      }
    }

    if (webhook.aspMessageId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          aspMessageId: webhook.aspMessageId,
        },
      });

      if (invoice) {
        return invoice;
      }
    }

    throw new NotFoundException('Webhook did not include a known invoice identifier.');
  }

  private assertWebhookToken(
    expectedToken: string | null,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const plainExpected = this.secrets.decrypt(expectedToken);
    if (!plainExpected) {
      return;
    }

    const headerToken = headers['x-webhook-token'];
    const value = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (value !== plainExpected) {
      throw new UnauthorizedException('Webhook token is invalid.');
    }
  }

  private buildStatusUpdate(status: InvoiceStatus, rejectionReason?: string | null) {
    const now = new Date();
    const update: {
      submittedAt?: Date;
      acceptedAt?: Date;
      rejectedAt?: Date;
      cancelledAt?: Date;
    } = {};

    if (
      status === INVOICE_STATUS.SUBMITTED ||
      status === INVOICE_STATUS.ACCEPTED ||
      status === INVOICE_STATUS.REJECTED
    ) {
      update.submittedAt = now;
    }

    if (status === INVOICE_STATUS.ACCEPTED) {
      update.acceptedAt = now;
    }

    if (status === INVOICE_STATUS.REJECTED || rejectionReason) {
      update.rejectedAt = now;
    }

    if (status === INVOICE_STATUS.CANCELLED) {
      update.cancelledAt = now;
    }

    return update;
  }
}
