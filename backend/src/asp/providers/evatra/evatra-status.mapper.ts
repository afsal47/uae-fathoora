import { Injectable } from '@nestjs/common';
import { AspDocumentStatusResult } from '../../asp.types';
import {
  ASP_SUBMISSION_STATUS,
  NormalizedAspLifecycle,
  PEPPOL_DELIVERY_STATUS,
  TAX_REPORTING_STATUS,
} from '../../status/internal-status';

@Injectable()
export class EvatraStatusMapper {
  mapDocumentStatus(body: Record<string, unknown>): {
    status: AspDocumentStatusResult['status'];
    message?: string;
    rejectionReason?: string;
    normalized: NormalizedAspLifecycle;
  } {
    const rawStatus = (
      this.optionalString(body.status) ??
      this.optionalString(body.documentStatus) ??
      this.optionalString(body.processingStatus) ??
      'PENDING'
    ).toUpperCase();
    const sendingResult = (this.optionalString(body.sendingResult) ?? '').toUpperCase();
    const errorType = (this.optionalString(body.errorType) ?? '').toUpperCase();
    const errorsText = this.formatAspErrors(body.errors);
    const invoiceError = this.optionalString(body.invoiceErrorMessage);
    const rejectionReason =
      this.optionalString(body.rejectionReason) ?? errorsText ?? invoiceError;
    const detailMessage =
      this.optionalString(body.message) ??
      `ASP status ${rawStatus}` + (sendingResult ? ` (${sendingResult})` : '');

    let status: AspDocumentStatusResult['status'] = 'SUBMITTED';
    let aspSubmission: (typeof ASP_SUBMISSION_STATUS)[keyof typeof ASP_SUBMISSION_STATUS] =
      ASP_SUBMISSION_STATUS.PENDING;
    let peppol: (typeof PEPPOL_DELIVERY_STATUS)[keyof typeof PEPPOL_DELIVERY_STATUS] =
      PEPPOL_DELIVERY_STATUS.PENDING;
    const tax: (typeof TAX_REPORTING_STATUS)[keyof typeof TAX_REPORTING_STATUS] =
      TAX_REPORTING_STATUS.PENDING;

    if (
      rawStatus === 'FAILED' ||
      rawStatus === 'ERROR' ||
      errorType === 'VALIDATION_FAILED' ||
      sendingResult === 'FAILED' ||
      sendingResult === 'NACK' ||
      sendingResult === 'REJECTED'
    ) {
      status = 'FAILED';
      aspSubmission = ASP_SUBMISSION_STATUS.FAILED;
      if (sendingResult === 'NACK' || sendingResult === 'REJECTED' || sendingResult === 'FAILED') {
        peppol = PEPPOL_DELIVERY_STATUS.FAILED;
      }
    } else if (rawStatus === 'REJECTED') {
      status = 'REJECTED';
      aspSubmission = ASP_SUBMISSION_STATUS.REJECTED;
    } else if (rawStatus === 'CANCELLED' || rawStatus === 'CANCELED') {
      status = 'CANCELLED';
    } else if (rawStatus === 'COMPLETED' || rawStatus === 'COMPLETE') {
      // COMPLETED at ASP ≠ automatic tax reported; keep tax pending unless explicit.
      status = 'COMPLETED';
      aspSubmission = ASP_SUBMISSION_STATUS.ACCEPTED;
      if (sendingResult === 'ACK' || sendingResult === 'DELIVERED' || !sendingResult) {
        peppol = PEPPOL_DELIVERY_STATUS.DELIVERED;
      }
    } else if (
      rawStatus === 'ACCEPTED' ||
      rawStatus === 'SUCCESS' ||
      rawStatus === 'SUCCEEDED' ||
      sendingResult === 'ACK' ||
      sendingResult === 'ACCEPTED' ||
      sendingResult === 'DELIVERED'
    ) {
      status = 'ACCEPTED';
      aspSubmission = ASP_SUBMISSION_STATUS.ACCEPTED;
      if (sendingResult === 'DELIVERED') {
        peppol = PEPPOL_DELIVERY_STATUS.DELIVERED;
      }
    }

    return {
      status,
      message: rejectionReason ?? detailMessage,
      rejectionReason,
      normalized: {
        hubStatus: status,
        aspSubmissionStatus: aspSubmission,
        peppolDeliveryStatus: peppol,
        taxReportingStatus: tax,
        providerStatusRaw: rawStatus,
        providerErrorMessage: rejectionReason ?? null,
        eventTimestamp: new Date(),
      },
    };
  }

  readAspInvoiceId(body: Record<string, unknown>): string {
    const direct = this.readId(body, [
      'invoiceId',
      'invoice_id',
      'invalidInvoiceId',
      'invalid_invoice_id',
      'documentId',
      'document_id',
    ]);
    if (direct) return direct;

    for (const nestedKey of ['invoice', 'document', 'tdd', 'data']) {
      const nested = body[nestedKey];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const fromNested = this.readId(nested as Record<string, unknown>, [
          'invoiceId',
          'invoice_id',
          'invalidInvoiceId',
          'documentId',
          'document_id',
          'id',
        ]);
        if (fromNested) return fromNested;
      }
    }
    return '';
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

  private formatAspErrors(errors: unknown): string | undefined {
    if (typeof errors === 'string' && errors.trim()) {
      return errors.trim();
    }
    if (!Array.isArray(errors) || errors.length === 0) {
      return undefined;
    }

    const parts = errors
      .map((item) => {
        if (typeof item === 'string' && item.trim()) {
          return item.trim();
        }
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const row = item as Record<string, unknown>;
          const code = this.optionalString(row.code);
          const message = this.optionalString(row.message);
          if (code && message) return `${code}: ${message}`;
          return message ?? code;
        }
        return undefined;
      })
      .filter((part): part is string => Boolean(part));

    return parts.length > 0 ? parts.join('\n') : undefined;
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
