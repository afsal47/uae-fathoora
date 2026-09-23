import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import {
  AspProviderAdapter,
  AspSubmissionContext,
  AspSubmissionResult,
  ParsedWebhookPayload,
} from './asp.types';
import { buildPintAePayload } from './pint-ae-payload.builder';
import { buildPintAeXml } from './pint-ae-xml.builder';

@Injectable()
export class ClearTaxAdapter implements AspProviderAdapter {
  readonly provider = 'CLEARTAX';
  private readonly logger = new Logger(ClearTaxAdapter.name);

  constructor(
    private readonly config: ConfigService,
    private readonly secrets: SecretsCryptoService,
  ) {}

  async submitInvoice(context: AspSubmissionContext): Promise<AspSubmissionResult> {
    const baseUrl =
      context.tenant.aspBaseUrl ??
      this.config.get<string>('CLEARTAX_BASE_URL') ??
      'http://localhost:3100';
    const apiKey =
      this.secrets.decrypt(context.tenant.aspApiKey) ??
      this.config.get<string>('CLEARTAX_API_KEY') ??
      'sandbox-key';

    const pintPayload = buildPintAePayload(context);
    const pintXml = buildPintAeXml(pintPayload);

    this.logger.log(
      `Submitting invoice ${context.invoice.invoiceNumber} to ClearTax at ${baseUrl} (UBL 2.1 XML)`,
    );

    const response = await fetch(`${baseUrl}/api/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'x-cleartax-auth-token': apiKey,
        'x-tenant-id': context.tenant.code,
      },
      body: pintXml,
      signal: AbortSignal.timeout(30_000),
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const errorMessage =
        (body.message as string) ?? `ClearTax returned HTTP ${response.status}`;

      if (response.status === 422 && body.rejectionReason) {
        return {
          status: 'REJECTED',
          aspMessageId: (body.uuid as string) ?? '',
          aspReferenceId: (body.referenceId as string) ?? '',
          payload: { json: pintPayload, xml: pintXml } as unknown as Record<string, unknown>,
          response: body,
          rejectionReason: body.rejectionReason as string,
        };
      }

      throw new Error(errorMessage);
    }

    return {
      status: ((body.status as string) === 'ACCEPTED' ? 'ACCEPTED' : 'SUBMITTED'),
      aspMessageId: (body.uuid as string) ?? '',
      aspReferenceId: (body.referenceId as string) ?? '',
      payload: { json: pintPayload, xml: pintXml } as unknown as Record<string, unknown>,
      response: body,
    };
  }

  async parseWebhook(payload: Record<string, unknown>): Promise<ParsedWebhookPayload> {
    const status = ((payload.status as string) ?? '').toUpperCase();

    if (!['SUBMITTED', 'ACCEPTED', 'REJECTED', 'FAILED', 'CANCELLED'].includes(status)) {
      throw new Error(`Unsupported ClearTax webhook status: ${status}`);
    }

    return {
      tenantCode: (payload.tenantId as string) ?? (payload.tenantCode as string) ?? '',
      invoiceId: payload.invoiceId as string | undefined,
      aspReferenceId: payload.referenceId as string | undefined,
      aspMessageId: payload.uuid as string | undefined,
      status: status as ParsedWebhookPayload['status'],
      message:
        (payload.message as string) ?? `ClearTax webhook: ${status}`,
      rejectionReason: payload.rejectionReason as string | undefined,
      rawPayload: payload,
    };
  }
}
