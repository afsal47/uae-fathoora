import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import {
  AspDocumentStatusResult,
  AspProviderAdapter,
  AspRetryResult,
  AspSubmissionContext,
  AspSubmissionError,
  AspSubmissionResult,
} from './asp.types';
import { buildPintAePayload } from './pint-ae-payload.builder';
import { buildPintAeXml } from './pint-ae-xml.builder';

type CachedToken = {
  jwt: string;
  expiresAt: number;
};

type AspConnection = {
  origin: string;
  apiKey: string;
  email: string;
  provider: string;
  tenantId: string;
  tenantCode: string;
};

/**
 * Posts Peppol XML to the tenant ASP URL as Evatra JSON.
 * Logs in with the portal API key and tenant email, then sends the JWT as R-Auth.
 * Status and Peppol retry URLs are derived from the tenant aspBaseUrl origin.
 */
@Injectable()
export class GenericAspAdapter implements AspProviderAdapter {
  readonly provider = 'GENERIC';
  private readonly logger = new Logger(GenericAspAdapter.name);
  private readonly tokens = new Map<string, CachedToken>();

  constructor(private readonly secrets: SecretsCryptoService) {}

  async submitInvoice(context: AspSubmissionContext): Promise<AspSubmissionResult> {
    const connection = this.resolveConnection(context.tenant);
    const submitUrl = context.tenant.aspBaseUrl!.trim();

    const pintPayload = buildPintAePayload(context);
    const pintXml = buildPintAeXml(pintPayload);
    const requestBody = {
      apiKey: connection.apiKey,
      base64Document: Buffer.from(pintXml, 'utf8').toString('base64'),
      invoiceType: 'UAE_PINT',
      businessType: 'B2B',
      invoiceSource: 'ERP',
    };

    this.logger.log(
      `Submitting invoice ${context.invoice.invoiceNumber} to ${connection.provider} at ${submitUrl}`,
    );

    const posted = await this.authorizedPost(connection, submitUrl, requestBody);
    const response = posted.response;
    const body = posted.body;

    if (!response.ok) {
      const errorMessage = this.formatHttpError(
        connection.provider,
        submitUrl,
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

  async getDocumentStatus(
    tenant: Tenant,
    trackingId: string,
  ): Promise<AspDocumentStatusResult> {
    const connection = this.resolveConnection(tenant);
    const id = trackingId.trim();
    if (!id) {
      throw new BadRequestException('trackingId is required to poll ASP document status.');
    }

    const statusUrl = new URL(
      `/invoice/document-status/${encodeURIComponent(id)}`,
      connection.origin,
    ).toString();

    this.logger.log(
      `Polling ${connection.provider} document status for ${id} at ${statusUrl}`,
    );

    const fetched = await this.authorizedGet(connection, statusUrl);
    if (!fetched.response.ok) {
      const errorMessage = this.formatHttpError(
        connection.provider,
        statusUrl,
        fetched.response.status,
        fetched.body,
      );
      this.logger.error(errorMessage);
      throw new AspSubmissionError(errorMessage, fetched.body);
    }

    const mapped = this.mapAspDocumentStatus(fetched.body);
    return {
      status: mapped.status,
      trackingId:
        this.readId(fetched.body, ['trackingId', 'uuid', 'aspMessageId']) || id,
      invoiceId: this.readAspInvoiceId(fetched.body),
      companyId: this.readId(fetched.body, ['companyId', 'company_id', 'compId']),
      message:
        mapped.message ??
        this.optionalString(fetched.body.message) ??
        this.optionalString(fetched.body.status),
      rejectionReason: mapped.rejectionReason,
      raw: fetched.body,
    };
  }

  async retryTddFailed(
    tenant: Tenant,
    invoiceId: string,
    companyId: string,
  ): Promise<AspRetryResult> {
    const connection = this.resolveConnection(tenant);
    const aspInvoiceId = invoiceId.trim();
    if (!aspInvoiceId) {
      throw new BadRequestException(
        'invoiceId is required to retry a failed TDD (ASP invoice UUID from document-status).',
      );
    }
    const aspCompanyId = companyId.trim();
    if (!aspCompanyId) {
      throw new BadRequestException(
        'companyId is required to retry a failed TDD (ASP company id from document-status).',
      );
    }

    // Evatra expects companyId + invoiceId as query params (not trackingId).
    // JSON-only body still returns: Parameter 'companyId' is required.
    const retryUrl = new URL('/peppol/tdd/retry-failed', connection.origin);
    retryUrl.searchParams.set('companyId', aspCompanyId);
    retryUrl.searchParams.set('invoiceId', aspInvoiceId);
    const retryUrlText = retryUrl.toString();
    this.logger.log(
      `Retrying ${connection.provider} TDD for invoiceId=${aspInvoiceId} (companyId=${aspCompanyId}) at ${retryUrlText}`,
    );

    const posted = await this.authorizedPost(connection, retryUrlText, {
      invoiceId: aspInvoiceId,
      companyId: aspCompanyId,
    });
    if (!posted.response.ok) {
      const errorMessage = this.formatHttpError(
        connection.provider,
        retryUrlText,
        posted.response.status,
        posted.body,
      );
      this.logger.error(errorMessage);
      throw new AspSubmissionError(errorMessage, posted.body);
    }

    return {
      ok: true,
      message:
        this.optionalString(posted.body.message) ??
        `TDD retry accepted for invoiceId ${aspInvoiceId}.`,
      raw: posted.body,
    };
  }

  private resolveConnection(tenant: Tenant): AspConnection {
    const url = tenant.aspBaseUrl?.trim();
    if (!url) {
      throw new Error(
        `Tenant ${tenant.code} has no aspBaseUrl for provider ${tenant.aspProvider}.`,
      );
    }

    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      throw new Error(`Tenant ${tenant.code} aspBaseUrl is not a valid URL.`);
    }

    const apiKey = this.secrets.decrypt(tenant.aspApiKey)?.trim() ?? '';
    if (!apiKey) {
      throw new Error(
        `Tenant ${tenant.code} has no ASP API key. Save the key from the ASP portal on the tenant.`,
      );
    }

    const email = tenant.email?.trim() ?? '';
    if (!email) {
      throw new Error(
        `Tenant ${tenant.code} has no email. Save the Evatra portal user email on the tenant. It is required for the R-Auth token.`,
      );
    }

    return {
      origin,
      apiKey,
      email,
      provider: tenant.aspProvider,
      tenantId: tenant.id,
      tenantCode: tenant.code,
    };
  }

  private async authorizedGet(
    connection: AspConnection,
    url: string,
  ): Promise<{ response: Response; body: Record<string, unknown> }> {
    const cacheKey = `${connection.tenantId}|${connection.origin}`;
    let token = await this.accessToken(
      cacheKey,
      new URL('/auth/login', connection.origin).toString(),
      connection.apiKey,
      connection.email,
      connection.provider,
      false,
    );

    let fetched = await this.getJson(url, { 'R-Auth': token.jwt });
    if (fetched.response.status === 401 && token.fromCache) {
      this.tokens.delete(cacheKey);
      token = await this.accessToken(
        cacheKey,
        new URL('/auth/login', connection.origin).toString(),
        connection.apiKey,
        connection.email,
        connection.provider,
        true,
      );
      fetched = await this.getJson(url, { 'R-Auth': token.jwt });
    }

    return fetched;
  }

  private async authorizedPost(
    connection: AspConnection,
    url: string,
    body: Record<string, unknown>,
  ): Promise<{ response: Response; body: Record<string, unknown> }> {
    const cacheKey = `${connection.tenantId}|${connection.origin}`;
    let token = await this.accessToken(
      cacheKey,
      new URL('/auth/login', connection.origin).toString(),
      connection.apiKey,
      connection.email,
      connection.provider,
      false,
    );

    let posted = await this.postJson(url, body, { 'R-Auth': token.jwt });
    if (posted.response.status === 401 && token.fromCache) {
      this.tokens.delete(cacheKey);
      token = await this.accessToken(
        cacheKey,
        new URL('/auth/login', connection.origin).toString(),
        connection.apiKey,
        connection.email,
        connection.provider,
        true,
      );
      posted = await this.postJson(url, body, { 'R-Auth': token.jwt });
    }

    return posted;
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

  private async getJson(
    url: string,
    headers: Record<string, string>,
  ): Promise<{ response: Response; body: Record<string, unknown> }> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      signal: AbortSignal.timeout(30_000),
    });
    return { response, body: await this.readBody(response) };
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

  /**
   * Evatra document-status uses values like PENDING / COMPLETED / FAILED.
   * Hub keeps COMPLETED as its own status (matches ASP Swagger), distinct from ACCEPTED.
   */
  private mapAspDocumentStatus(body: Record<string, unknown>): {
    status: AspDocumentStatusResult['status'];
    message?: string;
    rejectionReason?: string;
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
      this.optionalString(body.rejectionReason) ??
      errorsText ??
      invoiceError;
    const detailMessage =
      this.optionalString(body.message) ??
      `ASP status ${rawStatus}` + (sendingResult ? ` (${sendingResult})` : '');

    if (
      rawStatus === 'FAILED' ||
      rawStatus === 'ERROR' ||
      errorType === 'VALIDATION_FAILED' ||
      sendingResult === 'FAILED' ||
      sendingResult === 'NACK' ||
      sendingResult === 'REJECTED'
    ) {
      return {
        status: 'FAILED',
        message: rejectionReason ?? detailMessage,
        rejectionReason,
      };
    }

    if (rawStatus === 'REJECTED') {
      return {
        status: 'REJECTED',
        message: rejectionReason ?? 'ASP rejected the document.',
        rejectionReason,
      };
    }

    if (rawStatus === 'CANCELLED' || rawStatus === 'CANCELED') {
      return { status: 'CANCELLED', message: detailMessage };
    }

    if (rawStatus === 'COMPLETED' || rawStatus === 'COMPLETE') {
      return { status: 'COMPLETED', message: detailMessage };
    }

    if (
      rawStatus === 'ACCEPTED' ||
      rawStatus === 'SUCCESS' ||
      rawStatus === 'SUCCEEDED' ||
      sendingResult === 'ACK' ||
      sendingResult === 'ACCEPTED' ||
      sendingResult === 'DELIVERED'
    ) {
      return { status: 'ACCEPTED', message: detailMessage };
    }

    // PENDING, PROCESSING, IN_PROGRESS, QUEUED, ACKNOWLEDGING-only, etc.
    return { status: 'SUBMITTED', message: detailMessage };
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

  /**
   * Evatra Peppol retry expects invoiceId / invalidInvoiceId.
   * document-status returns the same UUID as documentId (not trackingId).
   */
  private readAspInvoiceId(body: Record<string, unknown>): string {
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

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
