import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Worker } from 'bullmq';
import { Integration, Invoice } from '@prisma/client';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import {
  WEBHOOK_DELIVERY_JOB,
  WEBHOOK_QUEUE_NAME,
} from '../invoices/invoice.constants';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

export type WebhookEvent =
  | 'invoice.submitted'
  | 'invoice.accepted'
  | 'invoice.rejected'
  | 'invoice.failed'
  | 'invoice.cancelled';

@Injectable()
export class OutboundWebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboundWebhookService.name);
  private worker?: Worker<{ deliveryId: string }>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly secrets: SecretsCryptoService,
  ) {}

  onModuleInit() {
    if (this.queueService.mode === 'inline') {
      this.queueService.setWebhookInlineProcessor(async ({ deliveryId }) => {
        await this.deliverWithRetries(deliveryId);
      });
      return;
    }

    const connection = this.queueService.getConnection();
    if (!connection) {
      return;
    }

    this.worker = new Worker(
      WEBHOOK_QUEUE_NAME,
      async (job) => {
        if (job.name !== WEBHOOK_DELIVERY_JOB) {
          return;
        }
        await this.deliverOnce(job.data.deliveryId);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.warn(
        `Webhook job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });
  }

  async notify(
    integration: Integration,
    invoice: Invoice,
    event: WebhookEvent,
  ) {
    if (!integration.webhookUrl) {
      return;
    }

    const payload = {
      event,
      eventId: `${invoice.id}:${event}:${Date.now()}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      sourceSystemCreditNoteId: invoice.sourceSystemCreditNoteId,
      status: invoice.status,
      aspMessageId: invoice.aspMessageId,
      aspReferenceId: invoice.aspReferenceId,
      rejectionReason: invoice.rejectionReason,
      timestamp: new Date().toISOString(),
    };

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        integrationId: integration.id,
        invoiceId: invoice.id,
        event,
        payload: JSON.stringify(payload),
        status: 'PENDING',
      },
    });

    await this.queueService.enqueueWebhookDelivery(delivery.id);
  }

  /** Inline mode: retry a few times with backoff in-process. */
  private async deliverWithRetries(deliveryId: string) {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.deliverOnce(deliveryId);
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          const message =
            error instanceof Error ? error.message : 'Webhook delivery failed';
          this.logger.warn(
            `Webhook delivery ${deliveryId} exhausted retries: ${message}`,
          );
          return;
        }
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      }
    }
  }

  async deliverOnce(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery || delivery.status === 'SUCCESS') {
      return;
    }

    const integration = await this.prisma.integration.findUnique({
      where: { id: delivery.integrationId },
    });

    if (!integration?.webhookUrl) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'FAILED',
          lastError: 'Integration webhook URL missing',
          attempts: { increment: 1 },
        },
      });
      return;
    }

    const body = delivery.payload;
    const timestamp = Date.now().toString();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-timestamp': timestamp,
    };

    const webhookSecret = this.secrets.decrypt(integration.webhookSecret);
    if (webhookSecret) {
      const signature = createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
      headers['x-signature'] = signature;
    }

    try {
      const response = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'SUCCESS',
          responseCode: response.status,
          attempts: { increment: 1 },
          lastError: null,
        },
      });

      this.logger.log(
        `Webhook ${delivery.event} delivered to ${integration.webhookUrl} — ${response.status}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown webhook error';

      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'FAILED',
          lastError: message,
          attempts: { increment: 1 },
        },
      });

      this.logger.warn(
        `Webhook ${delivery.event} to ${integration.webhookUrl} failed: ${message}`,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
