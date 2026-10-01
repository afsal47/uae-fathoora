import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import {
  AspProviderAdapter,
  AspSubmissionContext,
  AspSubmissionResult,
  ParsedWebhookPayload,
} from './asp.types';
import { buildPintAePayload } from './pint-ae-payload.builder';
import { buildPintAeXml } from './pint-ae-xml.builder';

const WEBHOOK_STATUSES = ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'FAILED', 'CANCELLED'];

/**
 * Posts Peppol XML to the single ASP URL stored on the tenant.
 * Used when aspProvider is not FAKE, MOCK, or CLEARTAX.
 */
@Injectable()
export class GenericAspAdapter implements AspProviderAdapter {
  readonly provider = 'GENERIC';
  private readonly logger = new Logger(GenericAspAdapter.name);

  constructor(private readonly secrets: SecretsCryptoService) {}

  async submitInvoice(context: AspSubmissionContext): Promise<AspSubmissionResult> {
    const url = context.tenant.aspBaseUrl?.trim();
    if (!url) {
      throw new Error(
        `Tenant ${context.tenant.code} has no aspBaseUrl for provider ${context.tenant.aspProvider}.`,
      );
    }

    const apiKey = this.secrets.decrypt(context.tenant.aspApiKey) ?? '';
    const pintPayload = buildPintAePayload(context);
    const pintXml = buildPintAeXml(pintPayload);

    this.logger.log(
      `Submitting invoice ${context.invoice.invoiceNumber} to ${context.tenant.aspProvider} at ${url}`,
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/xml',
      'x-tenant-id': context.tenant.code,
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: pintXml,
      signal: AbortSignal.timeout(30_000),
    });

    const body = await this.readBody(response);

    if (!response.ok) {
      const errorMessage =
        (typeof body.message === 'string' && body.message) ||
        `${context.tenant.aspProvider} returned HTTP ${response.status}`;

      if (response.status === 422 && body.rejectionReason) {
        return {
          status: 'REJECTED',
          aspMessageId: this.readId(body, ['uuid', 'aspMessageId']),
          aspReferenceId: this.readId(body, ['referenceId', 'aspReferenceId']),
          payload: { json: pintPayload, xml: pintXml } as unknown as Record<string, unknown>,
          response: body,
          rejectionReason: String(body.rejectionReason),
        };
      }

      throw new Error(errorMessage);
    }

    const status = ((body.status as string) ?? '').toUpperCase();

    return {
      status: status === 'ACCEPTED' || status === 'REJECTED' ? status : 'SUBMITTED',
      aspMessageId: this.readId(body, ['uuid', 'aspMessageId']),
      aspReferenceId: this.readId(body, ['referenceId', 'aspReferenceId']),
      payload: { json: pintPayload, xml: pintXml } as unknown as Record<string, unknown>,
      response: body,
      rejectionReason:
        status === 'REJECTED' && body.rejectionReason
          ? String(body.rejectionReason)
          : undefined,
    };
  }

  async parseWebhook(payload: Record<string, unknown>): Promise<ParsedWebhookPayload> {
    const status = ((payload.status as string) ?? '').toUpperCase();
    if (!WEBHOOK_STATUSES.includes(status)) {
      throw new BadRequestException(`Unsupported webhook status ${status}.`);
    }

    const tenantCode = (payload.tenantCode as string) ?? (payload.tenantId as string) ?? '';
    if (!tenantCode.trim()) {
      throw new BadRequestException('Webhook field tenantCode is required.');
    }

    return {
      tenantCode: tenantCode.trim(),
      invoiceId: this.optionalString(payload.invoiceId),
      aspReferenceId:
        this.optionalString(payload.aspReferenceId) ?? this.optionalString(payload.referenceId),
      aspMessageId: this.optionalString(payload.aspMessageId) ?? this.optionalString(payload.uuid),
      status: status as ParsedWebhookPayload['status'],
      message: this.optionalString(payload.message) ?? `ASP webhook: ${status}`,
      rejectionReason: this.optionalString(payload.rejectionReason),
      rawPayload: payload,
    };
  }

  private async readBody(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text();
    if (!text.trim()) {
      return {};
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { raw: text };
    } catch {
      return { raw: text };
    }
  }

  private readId(body: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
