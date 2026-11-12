import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { INVOICE_SUBMISSION_JOB } from '../invoices/invoice.constants';

type QueueJobPayload = {
  invoiceId: number;
};

type InlineProcessor = (payload: QueueJobPayload) => Promise<void>;

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queueMode: 'bullmq' | 'inline';
  private readonly connection?: Redis;
  private readonly queue?: Queue<QueueJobPayload>;
  private inlineProcessor?: InlineProcessor;

  constructor(
    private readonly configService: ConfigService,
    @Inject('INVOICE_QUEUE_NAME') private readonly queueName: string,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPort = Number(this.configService.get<string>('REDIS_PORT') ?? 6379);
    const queueMode = (this.configService.get<string>('QUEUE_MODE') ?? 'bullmq')
      .trim()
      .toLowerCase();

    if (queueMode === 'inline') {
      this.queueMode = 'inline';
      this.logger.warn('QUEUE_MODE=inline — jobs run in-process (dev only).');
      return;
    }

    if (!redisUrl && !redisHost) {
      this.queueMode = 'inline';
      this.logger.warn(
        'Redis not configured. Falling back to inline queue mode.',
      );
      return;
    }

    this.queueMode = 'bullmq';
    this.connection = redisUrl
      ? new IORedis(redisUrl, { maxRetriesPerRequest: null })
      : new IORedis({
          host: redisHost,
          port: redisPort,
          maxRetriesPerRequest: null,
        });

    this.queue = new Queue<QueueJobPayload>(this.queueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    this.logger.log(`BullMQ queues ready (Redis ${redisHost ?? redisUrl}).`);
  }

  get mode() {
    return this.queueMode;
  }

  setInlineProcessor(processor: InlineProcessor) {
    this.inlineProcessor = processor;
  }

  async enqueueInvoiceSubmission(invoiceId: number) {
    const payload = { invoiceId };

    if (this.queueMode === 'inline') {
      if (!this.inlineProcessor) {
        throw new Error('Inline queue processor is not registered.');
      }

      setImmediate(() => {
        void this.inlineProcessor?.(payload).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Inline invoice job failed: ${message}`);
        });
      });
      return;
    }

    await this.queue?.add(INVOICE_SUBMISSION_JOB, payload, {
      jobId: `invoice-${invoiceId}`,
    });
  }

  getConnection() {
    return this.connection;
  }

  async onModuleDestroy() {
    await this.queue?.close();
    await this.connection?.quit();
  }
}
