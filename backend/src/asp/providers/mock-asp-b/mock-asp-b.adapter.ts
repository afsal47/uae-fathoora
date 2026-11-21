import { Injectable, Logger } from '@nestjs/common';
import {
  AspConnectionTestResult,
  AspDocumentStatusResult,
  AspProviderAdapter,
  AspRetryResult,
  AspRuntimeCredentials,
  AspSubmissionContext,
  AspSubmissionError,
  AspSubmissionResult,
} from '../../asp.types';
import { buildPintAePayload } from '../../pint-ae-payload.builder';
import { buildPintAeXml } from '../../pint-ae-xml.builder';
import {
  ASP_SUBMISSION_STATUS,
  HUB_PROCESSING_STATUS,
  PEPPOL_DELIVERY_STATUS,
  TAX_REPORTING_STATUS,
} from '../../status/internal-status';

/**
 * SCAFFOLD / TEST FIXTURE ONLY.
 * Not a real ASP integration. Do not use in production invoice processing
 * unless explicitly enabled for isolated multi-ASP routing tests.
 *
 * When real ASP B documentation and credentials exist, replace this with a
 * dedicated adapter — do not invent an API contract here.
 */
@Injectable()
export class MockAspBAdapter implements AspProviderAdapter {
  readonly provider = 'MOCK_ASP_B';
  private readonly logger = new Logger(MockAspBAdapter.name);
  private readonly statuses = new Map<string, AspDocumentStatusResult['status']>();

  async submitInvoice(context: AspSubmissionContext): Promise<AspSubmissionResult> {
    if (process.env.MOCK_ASP_B_ENABLED !== 'true') {
      throw new AspSubmissionError(
        'MOCK_ASP_B is a scaffold only. Set MOCK_ASP_B_ENABLED=true for test fixtures, or implement a real ASP adapter with official documentation.',
      );
    }

    const pintPayload = buildPintAePayload(context);
    const pintXml = buildPintAeXml(pintPayload);
    const trackingId = `mock-b-${context.invoice.id}-${Date.now()}`;
    this.statuses.set(trackingId, 'SUBMITTED');

    this.logger.warn(
      `MOCK_ASP_B scaffold accepted invoice ${context.invoice.invoiceNumber} (test fixture).`,
    );

    return {
      status: 'SUBMITTED',
      aspMessageId: trackingId,
      aspReferenceId: trackingId,
      payload: { json: pintPayload, xml: pintXml } as unknown as Record<string, unknown>,
      response: {
        provider: 'MOCK_ASP_B',
        scaffold: true,
        status: 'SUBMITTED',
        trackingId,
      },
      normalized: {
        hubStatus: 'SUBMITTED',
        hubProcessingStatus: HUB_PROCESSING_STATUS.QUEUED,
        aspSubmissionStatus: ASP_SUBMISSION_STATUS.PENDING,
        peppolDeliveryStatus: PEPPOL_DELIVERY_STATUS.PENDING,
        taxReportingStatus: TAX_REPORTING_STATUS.PENDING,
        providerStatusRaw: 'SUBMITTED',
        providerResponseCode: '200',
        eventTimestamp: new Date(),
      },
    };
  }

  async getDocumentStatus(
    _runtime: AspRuntimeCredentials,
    trackingId: string,
  ): Promise<AspDocumentStatusResult> {
    if (process.env.MOCK_ASP_B_ENABLED !== 'true') {
      throw new AspSubmissionError(
        'MOCK_ASP_B is a scaffold only. Set MOCK_ASP_B_ENABLED=true for test fixtures.',
      );
    }

    const status = this.statuses.get(trackingId) ?? 'SUBMITTED';
    return {
      status,
      trackingId,
      message: 'MOCK_ASP_B scaffold status',
      raw: { provider: 'MOCK_ASP_B', scaffold: true, status, trackingId },
      normalized: {
        hubStatus: status,
        aspSubmissionStatus:
          status === 'ACCEPTED' || status === 'COMPLETED'
            ? ASP_SUBMISSION_STATUS.ACCEPTED
            : ASP_SUBMISSION_STATUS.PENDING,
        peppolDeliveryStatus: PEPPOL_DELIVERY_STATUS.PENDING,
        taxReportingStatus: TAX_REPORTING_STATUS.PENDING,
        providerStatusRaw: status,
        eventTimestamp: new Date(),
      },
    };
  }

  async retryTddFailed(
    _runtime: AspRuntimeCredentials,
    _invoiceId: string,
    _companyId: string,
  ): Promise<AspRetryResult> {
    throw new AspSubmissionError(
      'MOCK_ASP_B scaffold does not implement Peppol TDD retry.',
    );
  }

  async testConnection(
    _runtime: AspRuntimeCredentials,
  ): Promise<AspConnectionTestResult> {
    if (process.env.MOCK_ASP_B_ENABLED !== 'true') {
      return {
        ok: false,
        message:
          'MOCK_ASP_B is scaffold only — not a working ASP integration.',
      };
    }
    return { ok: true, message: 'MOCK_ASP_B test fixture is enabled.' };
  }
}
