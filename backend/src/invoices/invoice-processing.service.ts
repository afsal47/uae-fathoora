import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { Worker } from 'bullmq';
import { AspConnectionResolverService } from '../asp/asp-connection-resolver.service';
import { AspProviderResolverService } from '../asp/asp-provider-resolver.service';
import {
  AspRuntimeCredentials,
  AspSubmissionError,
  AspProviderAdapter,
} from '../asp/asp.types';
import { HUB_PROCESSING_STATUS } from '../asp/status/internal-status';
import { PrismaService } from '../prisma/prisma.service';
import { QueueJobPayload, QueueService } from '../queue/queue.service';
import {
  EVENT_TYPE,
  INVOICE_QUEUE_NAME,
  INVOICE_STATUS,
  INVOICE_SUBMISSION_JOB,
  InvoiceStatus,
} from './invoice.constants';
import {
  isDocumentUuid,
  resolveDocumentUuid,
} from '../asp/pint-ae-payload.builder';
import {
  mergeFieldsIntoAspPassthrough,
  mergeSubmissionIntoAspPayload,
  parseAspPassthrough,
} from './asp-payload.storage';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoiceProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InvoiceProcessingService.name);
  private worker?: Worker<QueueJobPayload>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly aspProviderResolver: AspProviderResolverService,
    private readonly aspConnectionResolver: AspConnectionResolverService,
  ) {}

  onModuleInit() {
    if (this.queueService.mode === 'inline') {
      this.queueService.setInlineProcessor(async (payload) => {
        await this.processSubmission(payload.invoiceId, payload);
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

        await this.processSubmission(job.data.invoiceId, job.data);
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

  async processSubmission(invoiceId: number, job?: QueueJobPayload) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        tenant: true,
        integration: true,
        lines: true,
        legalEntity: true,
        aspConnection: {
          include: { aspProvider: true, credentials: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
    }

    // Revalidate ownership from queue payload when present (tenant isolation).
    if (job?.tenantId && job.tenantId !== invoice.tenantId) {
      throw new BadRequestException(
        `Queue job tenant mismatch for invoice ${invoiceId}.`,
      );
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
        hubProcessingStatus: HUB_PROCESSING_STATUS.QUEUED,
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

    // Hoisted so a failed submit still persists any newly minted BTAE-07 UUID.
    let aspPayload = invoice.aspPayload;
    let passthroughDto: CreateInvoiceDto | undefined;

    try {
      const { provider, runtime, connectionId, legalEntityId } =
        await this.resolveAdapterForInvoice(invoice);

      if (aspPayload) {
        try {
          const passthrough = parseAspPassthrough(aspPayload);
          if (passthrough) {
            // BTAE-07: ensure a durable UUID exists before XML build / retry
            const documentUuid = resolveDocumentUuid(
              isDocumentUuid(passthrough.documentUuid)
                ? String(passthrough.documentUuid)
                : undefined,
            );
            if (passthrough.documentUuid !== documentUuid) {
              aspPayload = mergeFieldsIntoAspPassthrough(aspPayload, {
                documentUuid,
              });
            }

            passthroughDto = {
              ...passthrough,
              documentUuid,
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

      if (!passthroughDto?.documentUuid) {
        const documentUuid = resolveDocumentUuid(passthroughDto?.documentUuid);
        aspPayload = mergeFieldsIntoAspPassthrough(aspPayload, { documentUuid });
        passthroughDto = {
          ...(passthroughDto ?? {}),
          documentUuid,
        } as CreateInvoiceDto;
      }

      const result = await provider.submitInvoice({
        tenant: invoice.tenant,
        integration: invoice.integration,
        invoice,
        runtime,
        createInvoiceDto: passthroughDto,
      });
      const statusData = this.buildStatusUpdate(result.status, result.rejectionReason);
      const normalized = result.normalized;

      const updated = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: result.status,
          legalEntityId: legalEntityId || invoice.legalEntityId,
          aspConnectionId: connectionId.startsWith('legacy:')
            ? invoice.aspConnectionId
            : connectionId,
          aspMessageId: result.aspMessageId,
          aspReferenceId: result.aspReferenceId,
          hubProcessingStatus:
            normalized?.hubProcessingStatus ?? HUB_PROCESSING_STATUS.QUEUED,
          aspSubmissionStatus: normalized?.aspSubmissionStatus ?? null,
          peppolDeliveryStatus: normalized?.peppolDeliveryStatus ?? null,
          taxReportingStatus: normalized?.taxReportingStatus ?? null,
          providerStatusRaw: normalized?.providerStatusRaw ?? null,
          providerResponseCode: normalized?.providerResponseCode ?? null,
          providerErrorMessage: normalized?.providerErrorMessage ?? null,
          // Keep source pass-through (incl. documentUuid); attach submission
          aspPayload: mergeSubmissionIntoAspPayload(
            aspPayload,
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
              message: `Invoice submitted to ASP provider ${runtime.providerCode}.`,
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

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown ASP submission failure.';
      const aspResponse =
        error instanceof AspSubmissionError && error.responseBody
          ? JSON.stringify(error.responseBody)
          : null;

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: INVOICE_STATUS.FAILED,
          aspSubmissionStatus: 'FAILED',
          lastSubmissionError: message.slice(0, 2000),
          providerErrorMessage: message.slice(0, 2000),
          aspResponse,
          // Persist minted documentUuid so retries reuse the same cbc:UUID
          ...(aspPayload && aspPayload !== invoice.aspPayload
            ? { aspPayload }
            : {}),
          events: {
            create: {
              type: EVENT_TYPE.SUBMISSION_FAILED,
              fromStatus: INVOICE_STATUS.SUBMITTING,
              toStatus: INVOICE_STATUS.FAILED,
              message: message.slice(0, 1000),
            },
          },
        },
      });

      throw error;
    }
  }

  async requeueInvoice(invoiceId: number) {
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

    const jobPayload: QueueJobPayload = {
      invoiceId,
      tenantId: invoice.tenantId,
      legalEntityId: invoice.legalEntityId,
      aspConnectionId: invoice.aspConnectionId,
    };

    if (this.queueService.mode === 'inline') {
      try {
        return await this.processSubmission(invoiceId, jobPayload);
      } catch {
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
    }

    await this.queueService.enqueueInvoiceSubmission(jobPayload);

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

  /**
   * Poll the invoice tenant's ASP document-status endpoint and reconcile hub status.
   * When ASP status is unchanged, returns the current hub invoice without writing a new event.
   */
  async syncAspStatus(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        tenant: true,
        integration: true,
        lines: true,
        legalEntity: true,
        aspConnection: {
          include: { aspProvider: true, credentials: true },
        },
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
    }

    const trackingId = this.resolveTrackingId(invoice);
    if (!trackingId) {
      throw new BadRequestException(
        `Invoice ${invoiceId} has no ASP trackingId. Submit or retry first.`,
      );
    }

    const { provider, runtime } = await this.resolveAdapterForInvoice(invoice);

    try {
      const result = await provider.getDocumentStatus(runtime, trackingId);
      const nextMessageId = result.trackingId || invoice.aspMessageId;
      const nextReferenceId = result.trackingId || invoice.aspReferenceId;
      const nextRejection = result.rejectionReason ?? null;
      const aspInvoiceId =
        result.invoiceId ||
        this.readAspInvoiceId(JSON.stringify(result.raw)) ||
        this.readAspInvoiceId(invoice.aspResponse) ||
        this.readDocumentUuid(invoice.aspPayload);
      const companyId =
        result.companyId ||
        this.readAspCompanyId(JSON.stringify(result.raw)) ||
        this.readAspCompanyId(invoice.aspResponse);
      const enrichedAspResponse = {
        ...result.raw,
        ...(companyId ? { companyId } : {}),
        ...(aspInvoiceId ? { invoiceId: aspInvoiceId } : {}),
        trackingId: result.trackingId || trackingId,
      };
      const enrichedAspResponseJson = JSON.stringify(enrichedAspResponse);
      const hadCompanyId = Boolean(this.readAspCompanyId(invoice.aspResponse));
      const hadInvoiceId = Boolean(this.readAspInvoiceId(invoice.aspResponse));
      const idsNewlyLearned =
        (Boolean(companyId) && !hadCompanyId) ||
        (Boolean(aspInvoiceId) && !hadInvoiceId);
      const statusChanged = invoice.status !== result.status;
      const metaChanged =
        (invoice.aspMessageId || null) !== (nextMessageId || null) ||
        (invoice.aspReferenceId || null) !== (nextReferenceId || null) ||
        (invoice.rejectionReason || null) !== nextRejection;

      // Polling should not spam events when ASP status/meta is unchanged.
      // Still quietly store newly discovered companyId/invoiceId for retry.
      if (!statusChanged && !metaChanged) {
        if (idsNewlyLearned) {
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: { aspResponse: enrichedAspResponseJson },
          });
        }
        return invoice;
      }

      const statusData = this.buildStatusUpdate(result.status, result.rejectionReason);
      const normalized = result.normalized;

      const updated = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: result.status,
          aspMessageId: nextMessageId,
          aspReferenceId: nextReferenceId,
          acceptedAt: statusData.acceptedAt,
          rejectedAt: statusData.rejectedAt,
          cancelledAt: statusData.cancelledAt,
          rejectionReason: nextRejection,
          lastSubmissionError: null,
          aspSubmissionStatus: normalized?.aspSubmissionStatus ?? undefined,
          peppolDeliveryStatus: normalized?.peppolDeliveryStatus ?? undefined,
          taxReportingStatus: normalized?.taxReportingStatus ?? undefined,
          providerStatusRaw: normalized?.providerStatusRaw ?? undefined,
          providerErrorMessage: normalized?.providerErrorMessage ?? undefined,
          aspResponse: enrichedAspResponseJson,
          events: {
            create: {
              type: EVENT_TYPE.ASP_STATUS_SYNCED,
              fromStatus: invoice.status,
              toStatus: result.status,
              message:
                result.message ??
                `Polled ASP document status for trackingId ${trackingId}.`,
              payload: enrichedAspResponseJson,
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

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown ASP status sync failure.';
      const aspResponse =
        error instanceof AspSubmissionError && error.responseBody
          ? JSON.stringify(error.responseBody)
          : null;

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          lastSubmissionError: message.slice(0, 2000),
          ...(aspResponse ? { aspResponse } : {}),
          events: {
            create: {
              type: EVENT_TYPE.ASP_STATUS_SYNCED,
              fromStatus: invoice.status,
              toStatus: invoice.status,
              message: message.slice(0, 1000),
            },
          },
        },
      });

      throw error;
    }
  }

  /**
   * ASP retry: Peppol TDD retry for this invoice
   * (ASP POST /peppol/tdd/retry-failed). Requires ASP invoiceId + companyId.
   */
  async retryAsp(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        tenant: true,
        legalEntity: true,
        aspConnection: {
          include: { aspProvider: true, credentials: true },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { payload: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
    }

    const trackingId = this.resolveTrackingId(invoice);
    if (!trackingId) {
      throw new BadRequestException(
        `Invoice ${invoiceId} has no ASP trackingId. Submit the invoice to ASP first.`,
      );
    }

    const { provider, runtime } = await this.resolveAdapterForInvoice(invoice);

    let companyId =
      this.readAspCompanyId(invoice.aspResponse) ||
      invoice.events.map((event) => this.readAspCompanyId(event.payload)).find(Boolean) ||
      '';
    let aspInvoiceId =
      this.readAspInvoiceId(invoice.aspResponse) ||
      invoice.events.map((event) => this.readAspInvoiceId(event.payload)).find(Boolean) ||
      this.readDocumentUuid(invoice.aspPayload) ||
      '';

    // Recover companyId / invoiceId from ASP document-status when aspResponse lost them.
    if (!companyId || !aspInvoiceId) {
      try {
        const status = await provider.getDocumentStatus(runtime, trackingId);
        companyId =
          companyId ||
          status.companyId ||
          this.readAspCompanyId(JSON.stringify(status.raw)) ||
          '';
        aspInvoiceId =
          aspInvoiceId ||
          status.invoiceId ||
          this.readAspInvoiceId(JSON.stringify(status.raw)) ||
          this.readDocumentUuid(invoice.aspPayload) ||
          '';
        if (companyId || aspInvoiceId) {
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              aspResponse: JSON.stringify({
                ...status.raw,
                ...(companyId ? { companyId } : {}),
                ...(aspInvoiceId ? { invoiceId: aspInvoiceId } : {}),
                trackingId,
              }),
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Could not recover ASP ids via document-status for invoice ${invoiceId}: ${message}`,
        );
      }
    }

    if (!companyId) {
      throw new BadRequestException(
        `Invoice ${invoiceId} has no ASP companyId. Refresh status from ASP first, then retry.`,
      );
    }

    if (!aspInvoiceId) {
      throw new BadRequestException(
        `Invoice ${invoiceId} has no ASP invoiceId. Refresh status from ASP first, then retry.`,
      );
    }

    try {
      const retry = await provider.retryTddFailed(
        runtime,
        aspInvoiceId,
        companyId,
      );

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          lastSubmissionError: null,
          aspResponse: JSON.stringify({
            ...((retry.raw && typeof retry.raw === 'object' ? retry.raw : {}) as object),
            companyId,
            invoiceId: aspInvoiceId,
            trackingId,
          }),
          events: {
            create: {
              type: EVENT_TYPE.ASP_RETRY_REQUESTED,
              fromStatus: invoice.status,
              toStatus: invoice.status,
              message:
                retry.message ??
                `Requested ASP TDD retry for invoiceId ${aspInvoiceId}.`,
              payload: JSON.stringify({
                ...retry.raw,
                companyId,
                invoiceId: aspInvoiceId,
                trackingId,
              }),
            },
          },
        },
      });

      return this.syncAspStatus(invoiceId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown ASP retry failure.';
      const aspErrorBody =
        error instanceof AspSubmissionError && error.responseBody
          ? error.responseBody
          : null;

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          lastSubmissionError: message.slice(0, 2000),
          // Keep ASP ids available for the next retry attempt.
          aspResponse: JSON.stringify({
            ...(aspErrorBody ?? {}),
            companyId,
            invoiceId: aspInvoiceId,
            trackingId,
          }),
          events: {
            create: {
              type: EVENT_TYPE.ASP_RETRY_REQUESTED,
              fromStatus: invoice.status,
              toStatus: invoice.status,
              message: message.slice(0, 1000),
              payload: aspErrorBody ? JSON.stringify(aspErrorBody) : null,
            },
          },
        },
      });

      if (error instanceof AspSubmissionError) {
        const aspMessage =
          this.readAspErrorMessage(error.responseBody) || error.message;
        throw new BadGatewayException({
          statusCode: 502,
          message: aspMessage,
          error: 'Bad Gateway',
          details: error.responseBody ?? null,
        });
      }

      throw error;
    }
  }

  /**
   * Resolve adapter from the invoice's ASP connection (preferred) or legacy tenant fields.
   * Provider code is never taken from the invoice request body.
   */
  private async resolveAdapterForInvoice(invoice: {
    id: number;
    tenantId: string;
    legalEntityId?: string | null;
    aspConnectionId?: string | null;
    tenant: Invoice extends never ? never : import('@prisma/client').Tenant;
    aspConnection?:
      | (import('@prisma/client').AspConnection & {
          aspProvider: import('@prisma/client').AspProvider;
          credentials: import('@prisma/client').AspCredential[];
        })
      | null;
  }): Promise<{
    provider: AspProviderAdapter;
    runtime: AspRuntimeCredentials;
    connectionId: string;
    legalEntityId: string;
  }> {
    let legalEntityId = invoice.legalEntityId ?? '';
    if (!legalEntityId) {
      legalEntityId = await this.aspConnectionResolver.resolveDefaultLegalEntityId(
        invoice.tenantId,
      );
    }

    try {
      const connection =
        invoice.aspConnection &&
        invoice.aspConnection.tenantId === invoice.tenantId
          ? invoice.aspConnection
          : await this.aspConnectionResolver.resolveForLegalEntity({
              tenantId: invoice.tenantId,
              legalEntityId,
              connectionId: invoice.aspConnectionId,
            });

      if (connection.tenantId !== invoice.tenantId) {
        throw new BadRequestException(
          `ASP connection does not belong to invoice tenant ${invoice.tenantId}.`,
        );
      }

      const runtime = await this.aspConnectionResolver.toRuntimeWithApiConfig(
        connection,
        invoice.tenant,
      );
      const provider = this.aspProviderResolver.resolve(runtime.providerCode);
      return {
        provider,
        runtime,
        connectionId: connection.id,
        legalEntityId: connection.legalEntityId,
      };
    } catch (error) {
      // Opt-in only. Prefer AspConnection; do not silently use tenant.asp* in production.
      if (
        process.env.ENABLE_LEGACY_TENANT_ASP === 'true' &&
        invoice.tenant.aspBaseUrl?.trim()
      ) {
        const runtime = this.aspConnectionResolver.legacyTenantRuntime(
          invoice.tenant,
        );
        runtime.legalEntityId = legalEntityId;
        const provider = this.aspProviderResolver.resolve(runtime.providerCode);
        this.logger.warn(
          `Invoice ${invoice.id} using legacy tenant ASP fields; migrate to AspConnection.`,
        );
        return {
          provider,
          runtime,
          connectionId: runtime.connectionId,
          legalEntityId,
        };
      }
      throw error;
    }
  }

  private resolveTrackingId(invoice: Pick<Invoice, 'aspMessageId' | 'aspReferenceId'>) {
    return invoice.aspMessageId?.trim() || invoice.aspReferenceId?.trim() || '';
  }

  /** ASP company id returned on document-status / submit responses. */
  private readAspCompanyId(raw?: string | null): string {
    if (!raw?.trim()) return '';
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const value = parsed.companyId ?? parsed.company_id ?? parsed.compId;
      return typeof value === 'string' ? value.trim() : '';
    } catch {
      return '';
    }
  }

  /**
   * ASP invoice UUID for Peppol TDD retry (not Hub id / trackingId).
   * Evatra document-status stores it as documentId; retry API calls it invoiceId.
   */
  private readAspInvoiceId(raw?: string | null): string {
    if (!raw?.trim()) return '';
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const direct =
        parsed.invoiceId ??
        parsed.invoice_id ??
        parsed.invalidInvoiceId ??
        parsed.invalid_invoice_id ??
        parsed.documentId ??
        parsed.document_id;
      if (typeof direct === 'string' && isDocumentUuid(direct)) {
        return direct.trim();
      }
      for (const nestedKey of ['invoice', 'document', 'tdd', 'data']) {
        const nested = parsed[nestedKey];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          const row = nested as Record<string, unknown>;
          const value =
            row.invoiceId ??
            row.invoice_id ??
            row.invalidInvoiceId ??
            row.documentId ??
            row.document_id ??
            row.id;
          if (typeof value === 'string' && isDocumentUuid(value)) {
            return value.trim();
          }
        }
      }
      return '';
    } catch {
      return '';
    }
  }

  /** Hub-minted PINT cbc:UUID from aspPayload; usable when ASP mirrors it as invoiceId. */
  private readDocumentUuid(aspPayload?: string | null): string {
    const passthrough = parseAspPassthrough(aspPayload);
    const value = passthrough?.documentUuid;
    return isDocumentUuid(value) ? String(value).trim() : '';
  }

  private readAspErrorMessage(body?: Record<string, unknown> | null): string {
    if (!body) return '';
    const value =
      body.errorMessage ?? body.message ?? body.errorTitle ?? body.error;
    return typeof value === 'string' ? value.trim() : '';
  }

  async onModuleDestroy() {
    await this.worker?.close();
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
      status === INVOICE_STATUS.COMPLETED ||
      status === INVOICE_STATUS.REJECTED
    ) {
      update.submittedAt = now;
    }

    if (
      status === INVOICE_STATUS.ACCEPTED ||
      status === INVOICE_STATUS.COMPLETED
    ) {
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
