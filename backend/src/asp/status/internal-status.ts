/** Provider-independent internal lifecycle stages. */

export const HUB_PROCESSING_STATUS = {
  RECEIVED: 'RECEIVED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  QUEUED: 'QUEUED',
} as const;

export const ASP_SUBMISSION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
} as const;

export const PEPPOL_DELIVERY_STATUS = {
  PENDING: 'PENDING',
  DELIVERED: 'DELIVERED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
} as const;

export const TAX_REPORTING_STATUS = {
  PENDING: 'PENDING',
  REPORTED: 'REPORTED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
} as const;

export type HubProcessingStatus =
  (typeof HUB_PROCESSING_STATUS)[keyof typeof HUB_PROCESSING_STATUS];
export type AspSubmissionStatus =
  (typeof ASP_SUBMISSION_STATUS)[keyof typeof ASP_SUBMISSION_STATUS];
export type PeppolDeliveryStatus =
  (typeof PEPPOL_DELIVERY_STATUS)[keyof typeof PEPPOL_DELIVERY_STATUS];
export type TaxReportingStatus =
  (typeof TAX_REPORTING_STATUS)[keyof typeof TAX_REPORTING_STATUS];

export type NormalizedAspLifecycle = {
  /** Backward-compatible hub invoice.status */
  hubStatus: string;
  hubProcessingStatus?: HubProcessingStatus | null;
  aspSubmissionStatus?: AspSubmissionStatus | null;
  peppolDeliveryStatus?: PeppolDeliveryStatus | null;
  taxReportingStatus?: TaxReportingStatus | null;
  providerStatusRaw?: string | null;
  providerResponseCode?: string | null;
  providerErrorMessage?: string | null;
  eventTimestamp?: Date;
};
