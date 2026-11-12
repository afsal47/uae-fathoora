import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ASP_REFRESHABLE_STATUSES } from './invoice.constants';
import { InvoiceProcessingService } from './invoice-processing.service';

/**
 * Periodically polls ASP for in-progress invoices and reconciles Hub status.
 * Enabled by default; disable with ASP_STATUS_SYNC_ENABLED=false.
 */
@Injectable()
export class AspStatusSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AspStatusSyncService.name);
  private interval?: NodeJS.Timeout;
  private bootTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly invoiceProcessing: InvoiceProcessingService,
  ) {}

  onModuleInit() {
    const enabled =
      (this.config.get<string>('ASP_STATUS_SYNC_ENABLED') ?? 'true')
        .trim()
        .toLowerCase() !== 'false';

    if (!enabled) {
      this.logger.log('ASP status sync poller disabled (ASP_STATUS_SYNC_ENABLED=false).');
      return;
    }

    const intervalMs = this.readPositiveInt(
      'ASP_STATUS_SYNC_INTERVAL_MS',
      3_600_000,
    );

    this.logger.log(
      `ASP status sync poller started (every ${intervalMs}ms).`,
    );

    // First pass shortly after boot so Hub catches up without waiting a full interval.
    this.bootTimer = setTimeout(() => {
      void this.tick();
      this.interval = setInterval(() => void this.tick(), intervalMs);
    }, Math.min(5_000, intervalMs));
  }

  onModuleDestroy() {
    if (this.bootTimer) {
      clearTimeout(this.bootTimer);
      this.bootTimer = undefined;
    }
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  async tick() {
    if (this.running) {
      return;
    }
    this.running = true;

    try {
      const batchSize = this.readPositiveInt('ASP_STATUS_SYNC_BATCH_SIZE', 50);
      const invoices = await this.prisma.invoice.findMany({
        where: {
          status: { in: [...ASP_REFRESHABLE_STATUSES] },
          OR: [
            { aspMessageId: { not: null } },
            { aspReferenceId: { not: null } },
          ],
        },
        select: { id: true, aspMessageId: true, aspReferenceId: true },
        orderBy: { updatedAt: 'asc' },
        take: batchSize,
      });

      const candidates = invoices.filter(
        (row) =>
          Boolean(row.aspMessageId?.trim()) || Boolean(row.aspReferenceId?.trim()),
      );

      if (candidates.length === 0) {
        return;
      }

      this.logger.debug(
        `ASP status sync: polling ${candidates.length} invoice(s).`,
      );

      let updated = 0;
      let failed = 0;

      for (const row of candidates) {
        try {
          const before = await this.prisma.invoice.findUnique({
            where: { id: row.id },
            select: { status: true },
          });
          const after = await this.invoiceProcessing.syncAspStatus(row.id);
          if (before && before.status !== after.status) {
            updated += 1;
            this.logger.log(
              `Invoice ${row.id}: ${before.status} → ${after.status}`,
            );
          }
        } catch (error) {
          failed += 1;
          const message =
            error instanceof Error ? error.message : 'Unknown sync failure';
          this.logger.warn(`Invoice ${row.id} ASP sync failed: ${message}`);
        }
      }

      if (updated > 0 || failed > 0) {
        this.logger.log(
          `ASP status sync finished: ${updated} updated, ${failed} failed, ${candidates.length} polled.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown poller failure';
      this.logger.error(`ASP status sync tick failed: ${message}`);
    } finally {
      this.running = false;
    }
  }

  private readPositiveInt(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
