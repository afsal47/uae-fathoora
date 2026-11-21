import {
  AspConnection,
  AspCredential,
  AspProvider,
  AspProviderApiConfig,
  Integration,
  Invoice,
  InvoiceLine,
  LegalEntity,
  Tenant,
} from '@prisma/client';
import { InvoiceStatus } from '../invoices/invoice.constants';
import { CreateInvoiceDto } from '../invoices/dto/create-invoice.dto';
import { NormalizedAspLifecycle } from './status/internal-status';

export type InvoiceWithRelations = Invoice & {
  tenant: Tenant;
  integration: Integration;
  lines: InvoiceLine[];
  legalEntity?: LegalEntity | null;
  aspConnection?:
    | (AspConnection & {
        aspProvider?: AspProvider;
        credentials?: AspCredential[];
      })
    | null;
};

/** Decrypted runtime connection used only inside adapters — never return to API. */
export type AspRuntimeCredentials = {
  connectionId: string;
  tenantId: string;
  legalEntityId: string;
  providerCode: string;
  environment: string;
  origin: string;
  submitUrl: string;
  loginPath: string;
  statusPathTemplate: string;
  retryTddPath: string;
  timeoutMs: number;
  credentials: Record<string, string>;
};

/** Context needed to build PINT AE (no ASP runtime required). */
export type PintBuildContext = {
  tenant: Tenant;
  integration: Integration;
  invoice: InvoiceWithRelations;
  createInvoiceDto?: CreateInvoiceDto;
};

export type AspSubmissionContext = PintBuildContext & {
  runtime: AspRuntimeCredentials;
  legalEntity?: LegalEntity | null;
};

export type AspSubmissionResult = {
  status: Extract<InvoiceStatus, 'SUBMITTED' | 'ACCEPTED' | 'REJECTED'>;
  aspMessageId: string;
  aspReferenceId: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown>;
  rejectionReason?: string;
  normalized?: NormalizedAspLifecycle;
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
  /** Provider invoice UUID used by Peppol TDD retry/withdraw (not trackingId). */
  invoiceId?: string;
  companyId?: string;
  message?: string;
  rejectionReason?: string;
  raw: Record<string, unknown>;
  normalized?: NormalizedAspLifecycle;
};

export type AspRetryResult = {
  ok: boolean;
  message?: string;
  raw: Record<string, unknown>;
};

export type AspConnectionTestResult = {
  ok: boolean;
  message: string;
  raw?: Record<string, unknown>;
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
    runtime: AspRuntimeCredentials,
    trackingId: string,
  ): Promise<AspDocumentStatusResult>;
  retryTddFailed(
    runtime: AspRuntimeCredentials,
    invoiceId: string,
    companyId: string,
  ): Promise<AspRetryResult>;
  testConnection?(
    runtime: AspRuntimeCredentials,
  ): Promise<AspConnectionTestResult>;
}

export type AspConnectionWithProvider = AspConnection & {
  aspProvider: AspProvider;
  credentials: AspCredential[];
  legalEntity?: LegalEntity;
};

export type AspProviderWithConfigs = AspProvider & {
  apiConfigs: AspProviderApiConfig[];
};

export const REGISTERED_ADAPTER_CODES = ['EVATRA', 'GENERIC', 'MOCK_ASP_B'] as const;
export type RegisteredAdapterCode = (typeof REGISTERED_ADAPTER_CODES)[number];
