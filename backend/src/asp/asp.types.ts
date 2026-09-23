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

export type ParsedWebhookPayload = {
  tenantCode: string;
  invoiceId?: string;
  aspReferenceId?: string;
  aspMessageId?: string;
  status: Extract<
    InvoiceStatus,
    'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'FAILED' | 'CANCELLED'
  >;
  message: string;
  rejectionReason?: string;
  rawPayload: Record<string, unknown>;
};

export interface AspProviderAdapter {
  readonly provider: string;
  submitInvoice(context: AspSubmissionContext): Promise<AspSubmissionResult>;
  parseWebhook(payload: Record<string, unknown>): Promise<ParsedWebhookPayload>;
}
