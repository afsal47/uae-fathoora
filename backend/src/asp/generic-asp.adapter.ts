import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import {
  AspProviderAdapter,
  AspSubmissionContext,
  AspSubmissionError,
  AspSubmissionResult,
  ParsedWebhookPayload,
} from './asp.types';
import { buildPintAePayload } from './pint-ae-payload.builder';
import { buildPintAeXml } from './pint-ae-xml.builder';

const WEBHOOK_STATUSES = ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'FAILED', 'CANCELLED'];

type CachedToken = {
  jwt: string;
  expiresAt: number;
};

/**
 * Posts Peppol XML to the tenant ASP URL as Evatra JSON.
 * Logs in with the portal API key and tenant email, then sends the JWT as R-Auth.
 * The XML is Base64-encoded in base64Document. The same portal key goes in apiKey.
 */
@Injectable()
export class GenericAspAdapter implements AspProviderAdapter {
  readonly provider = 'GENERIC';
  private readonly logger = new Logger(GenericAspAdapter.name);
  private readonly tokens = new Map<string, CachedToken>();

  constructor(private readonly secrets: SecretsCryptoService) {}

  async submitInvoice(context: AspSubmissionContext): Promise<AspSubmissionResult> {
    const url = context.tenant.aspBaseUrl?.trim();
    if (!url) {
      throw new Error(
        `Tenant ${context.tenant.code} has no aspBaseUrl for provider ${context.tenant.aspProvider}.`,
      );
    }

    const apiKey = this.secrets.decrypt(context.tenant.aspApiKey)?.trim() ?? '';
    if (!apiKey) {
      throw new Error(
        `Tenant ${context.tenant.code} has no ASP API key. Save the key from the ASP portal on the tenant.`,
      );
    }

    const email = context.tenant.email?.trim() ?? '';
    if (!email) {
      throw new Error(
        `Tenant ${context.tenant.code} has no email. Save the Evatra portal user email on the tenant. It is required for the R-Auth token.`,
      );
    }

    let documentUrl: URL;
    try {
      documentUrl = new URL(url);
    } catch {
      throw new Error(`Tenant ${context.tenant.code} aspBaseUrl is not a valid URL.`);
    }

    const pintPayload = buildPintAePayload(context);
    const pintXml = buildPintAeXml(pintPayload);
    const requestBody = {
      apiKey,
      base64Document: Buffer.from(pintXml, 'utf8').toString('base64'),
      invoiceType: 'UAE_PINT',
      businessType: 'B2B',
      invoiceSource: 'ERP',
    };

    const loginUrl = new URL('/auth/login', documentUrl.origin).toString();
    const cacheKey = `${context.tenant.id}|${documentUrl.origin}`;
    let token = await this.accessToken(cacheKey, loginUrl, apiKey, email, context.tenant.aspProvider, false);

    this.logger.log(
      `Submitting invoice ${context.invoice.invoiceNumber} to ${context.tenant.aspProvider} at ${url}`,
    );

    let posted = await this.postJson(url, requestBody, { 'R-Auth': token.jwt });
    if (posted.response.status === 401 && token.fromCache) {
      this.tokens.delete(cacheKey);
      token = await this.accessToken(cacheKey, loginUrl, apiKey, email, context.tenant.aspProvider, true);
      posted = await this.postJson(url, requestBody, { 'R-Auth': token.jwt });
    }

    const response = posted.response;
    const body = posted.body;

    if (!response.ok) {
      const errorMessage = this.formatHttpError(
        context.tenant.aspProvider,
        url,
        response.status,
        body,
      );

      if (response.status === 422 && body.rejectionReason) {
        return {
          status: 'REJECTED',
          aspMessageId: this.readId(body, ['trackingId', 'uuid', 'aspMessageId']),
          aspReferenceId: this.readId(body, ['trackingId', 'referenceId', 'aspReferenceId']),
          payload: { json: pintPayload, xml: pintXml } as unknown as Record<string, unknown>,
          response: body,
          rejectionReason: String(body.rejectionReason),
        };
      }

      this.logger.error(errorMessage);
      throw new AspSubmissionError(errorMessage, body);
    }

    const status = ((body.status as string) ?? '').toUpperCase();

    return {
      status: status === 'ACCEPTED' || status === 'REJECTED' ? status : 'SUBMITTED',
      aspMessageId: this.readId(body, ['trackingId', 'uuid', 'aspMessageId']),
      aspReferenceId: this.readId(body, ['trackingId', 'referenceId', 'aspReferenceId']),
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
      invoiceId: this.optionalInvoiceId(payload.invoiceId),
      aspReferenceId:
        this.optionalString(payload.aspReferenceId) ??
        this.optionalString(payload.referenceId) ??
        this.optionalString(payload.trackingId),
      aspMessageId:
        this.optionalString(payload.aspMessageId) ??
        this.optionalString(payload.uuid) ??
        this.optionalString(payload.trackingId),
      status: status as ParsedWebhookPayload['status'],
      message: this.optionalString(payload.message) ?? `ASP webhook: ${status}`,
      rejectionReason: this.optionalString(payload.rejectionReason),
      rawPayload: payload,
    };
  }

  private async accessToken(
    cacheKey: string,
    loginUrl: string,
    apiKey: string,
    email: string,
    provider: string,
    forceRefresh: boolean,
  ): Promise<{ jwt: string; fromCache: boolean }> {
    if (!forceRefresh) {
      const cached = this.tokens.get(cacheKey);
      if (cached && cached.expiresAt > Date.now() + 60_000) {
        return { jwt: cached.jwt, fromCache: true };
      }
    }

    this.logger.log(`Requesting ${provider} access token from ${loginUrl}`);
    const posted = await this.postJson(loginUrl, { apiKey, email }, {});
    if (!posted.response.ok) {
      const errorMessage = this.formatHttpError(
        provider,
        loginUrl,
        posted.response.status,
        posted.body,
      );
      this.logger.error(errorMessage);
      throw new AspSubmissionError(errorMessage, posted.body);
    }

    const jwt = this.optionalString(posted.body.jwt);
    if (!jwt) {
      throw new AspSubmissionError(`${provider} login at ${loginUrl} did not return a jwt.`, posted.body);
    }

    const expiresAt = this.parseExpiry(posted.body.expirationDate);
    if (expiresAt > Date.now() + 60_000) {
      this.tokens.set(cacheKey, { jwt, expiresAt });
    }

    return { jwt, fromCache: false };
  }

  private async postJson(
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<{ response: Response; body: Record<string, unknown> }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    return { response, body: await this.readBody(response) };
  }

  private parseExpiry(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value < 1_000_000_000_000 ? value * 1000 : value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  private formatHttpError(
    provider: string,
    url: string,
    status: number,
    body: Record<string, unknown>,
  ): string {
    const headline = `${provider} returned HTTP ${status} from ${url}`;
    const detail = this.describeBody(body);
    return detail ? `${headline}\n${detail}` : headline;
  }

  private describeBody(body: Record<string, unknown>): string {
    const raw = body.raw;
    if (typeof raw === 'string' && raw.trim() && Object.keys(body).length === 1) {
      return raw.trim();
    }
    if (Object.keys(body).length === 0) {
      return '';
    }
    return JSON.stringify(body, null, 2);
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

  private optionalInvoiceId(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      return Number(value.trim());
    }
    return undefined;
  }
}
