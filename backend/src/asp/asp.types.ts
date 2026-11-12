import { Integration, Invoice, InvoiceLine, Tenant } from '@prisma/client';
import { InvoiceStatus } from '../invoices/invoice.constants';
import { CreateInvoiceDto } from '../invoices/dto/create-invoice.dto';

export type InvoiceWithRelations = Invoice & {
  tenant: Tenant;
  integration: Integration;
  lines: InvoiceLine[];
};

export type AspSubmissionContext = {
  tenant: Tenant;
  integration: Integration;
  invoice: InvoiceWithRelations;
  createInvoiceDto?: CreateInvoiceDto;
};

export type AspSubmissionResult = {
  status: Extract<InvoiceStatus, 'SUBMITTED' | 'ACCEPTED' | 'REJECTED'>;
  aspMessageId: string;
  aspReferenceId: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown>;
  rejectionReason?: string;
};

export type AspDocumentStatusResult = {
  status: Extract<
    InvoiceStatus,
    | 'SUBMITTED'
    | 'ACCEPTED'
    | 'COMPLETED'
    | 'REJECTED'
    | 'FAILED'
    | 'CANCELLED'
  >;
  trackingId?: string;
  /** Evatra invoice UUID used by Peppol TDD retry/withdraw (not trackingId). */
  invoiceId?: string;
  companyId?: string;
  message?: string;
  rejectionReason?: string;
  raw: Record<string, unknown>;
};

export type AspRetryResult = {
  ok: boolean;
  message?: string;
  raw: Record<string, unknown>;
};

export class AspSubmissionError extends Error {
  constructor(
    message: string,
    readonly responseBody?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AspSubmissionError';
  }
}

export interface AspProviderAdapter {
  readonly provider: string;
  submitInvoice(context: AspSubmissionContext): Promise<AspSubmissionResult>;
  getDocumentStatus(
    tenant: Tenant,
    trackingId: string,
  ): Promise<AspDocumentStatusResult>;
  retryTddFailed(
    tenant: Tenant,
    invoiceId: string,
    companyId: string,
  ): Promise<AspRetryResult>;
}
