import { Injectable } from '@nestjs/common';
import { AspSubmissionResult } from '../../asp.types';
import {
  ASP_SUBMISSION_STATUS,
  HUB_PROCESSING_STATUS,
  NormalizedAspLifecycle,
  PEPPOL_DELIVERY_STATUS,
  TAX_REPORTING_STATUS,
} from '../../status/internal-status';

@Injectable()
export class EvatraResponseMapper {
  mapSubmitResponse(
    body: Record<string, unknown>,
    httpStatus: number,
    payload: Record<string, unknown>,
  ): AspSubmissionResult {
    const aspMessageId = this.readId(body, ['trackingId', 'uuid', 'aspMessageId']);
    const aspReferenceId = this.readId(body, [
      'trackingId',
      'referenceId',
      'aspReferenceId',
    ]);
    const statusRaw = ((body.status as string) ?? '').toUpperCase();
    const hubStatus =
      statusRaw === 'ACCEPTED' || statusRaw === 'REJECTED' ? statusRaw : 'SUBMITTED';

    if (httpStatus === 422 && body.rejectionReason) {
      return {
        status: 'REJECTED',
        aspMessageId,
        aspReferenceId,
        payload,
        response: body,
        rejectionReason: String(body.rejectionReason),
        normalized: this.normalizeSubmit('REJECTED', body, String(httpStatus)),
      };
    }

    return {
      status: hubStatus as AspSubmissionResult['status'],
      aspMessageId,
      aspReferenceId,
      payload,
      response: body,
      rejectionReason:
        statusRaw === 'REJECTED' && body.rejectionReason
          ? String(body.rejectionReason)
          : undefined,
      normalized: this.normalizeSubmit(hubStatus, body, String(httpStatus)),
    };
  }

  normalizeSubmit(
    hubStatus: string,
    body: Record<string, unknown>,
    providerResponseCode?: string,
  ): NormalizedAspLifecycle {
    const aspSubmissionStatus =
      hubStatus === 'ACCEPTED'
        ? ASP_SUBMISSION_STATUS.ACCEPTED
        : hubStatus === 'REJECTED'
          ? ASP_SUBMISSION_STATUS.REJECTED
          : ASP_SUBMISSION_STATUS.PENDING;

    return {
      hubStatus,
      hubProcessingStatus: HUB_PROCESSING_STATUS.QUEUED,
      aspSubmissionStatus,
      // HTTP/API acceptance is NOT Peppol delivery or tax reporting success.
      peppolDeliveryStatus: PEPPOL_DELIVERY_STATUS.PENDING,
      taxReportingStatus: TAX_REPORTING_STATUS.PENDING,
      providerStatusRaw: this.optionalString(body.status) ?? hubStatus,
      providerResponseCode: providerResponseCode ?? null,
      providerErrorMessage:
        this.optionalString(body.rejectionReason) ??
        this.optionalString(body.message) ??
        null,
      eventTimestamp: new Date(),
    };
  }

  readId(body: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
