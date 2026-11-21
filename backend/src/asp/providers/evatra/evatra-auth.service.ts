import { Injectable, Logger } from '@nestjs/common';
import { AspRuntimeCredentials, AspSubmissionError } from '../../asp.types';

type CachedToken = {
  jwt: string;
  expiresAt: number;
};

@Injectable()
export class EvatraAuthService {
  private readonly logger = new Logger(EvatraAuthService.name);
  private readonly tokens = new Map<string, CachedToken>();

  cacheKey(runtime: AspRuntimeCredentials): string {
    return `${runtime.connectionId}|${runtime.origin}`;
  }

  clear(runtime: AspRuntimeCredentials) {
    this.tokens.delete(this.cacheKey(runtime));
  }

  async getJwt(
    runtime: AspRuntimeCredentials,
    forceRefresh = false,
  ): Promise<{ jwt: string; fromCache: boolean }> {
    const key = this.cacheKey(runtime);
    if (!forceRefresh) {
      const cached = this.tokens.get(key);
      if (cached && cached.expiresAt > Date.now() + 60_000) {
        return { jwt: cached.jwt, fromCache: true };
      }
    }

    const apiKey = runtime.credentials.apiKey?.trim() ?? '';
    const email = runtime.credentials.email?.trim() ?? '';
    if (!apiKey) {
      throw new AspSubmissionError(
        `EVATRA connection ${runtime.connectionId} has no apiKey credential.`,
      );
    }
    if (!email) {
      throw new AspSubmissionError(
        `EVATRA connection ${runtime.connectionId} has no email credential (required for R-Auth).`,
      );
    }

    const loginUrl = new URL(
      runtime.loginPath || '/auth/login',
      runtime.origin,
    ).toString();

    this.logger.log(`Requesting EVATRA access token from ${loginUrl}`);
    const posted = await this.postJson(loginUrl, { apiKey, email }, {}, runtime.timeoutMs);
    if (!posted.response.ok) {
      throw new AspSubmissionError(
        this.formatHttpError(loginUrl, posted.response.status, posted.body),
        posted.body,
      );
    }

    const jwt = this.optionalString(posted.body.jwt);
    if (!jwt) {
      throw new AspSubmissionError(
        `EVATRA login at ${loginUrl} did not return a jwt.`,
        posted.body,
      );
    }

    const expiresAt = this.parseExpiry(posted.body.expirationDate);
    if (expiresAt > Date.now() + 60_000) {
      this.tokens.set(key, { jwt, expiresAt });
    }

    return { jwt, fromCache: false };
  }

  async authorizedGet(
    runtime: AspRuntimeCredentials,
    url: string,
  ): Promise<{ response: Response; body: Record<string, unknown> }> {
    let token = await this.getJwt(runtime, false);
    let fetched = await this.getJson(url, { 'R-Auth': token.jwt }, runtime.timeoutMs);
    if (fetched.response.status === 401 && token.fromCache) {
      this.clear(runtime);
      token = await this.getJwt(runtime, true);
      fetched = await this.getJson(url, { 'R-Auth': token.jwt }, runtime.timeoutMs);
    }
    return fetched;
  }

  async authorizedPost(
    runtime: AspRuntimeCredentials,
    url: string,
    body: Record<string, unknown>,
  ): Promise<{ response: Response; body: Record<string, unknown> }> {
    let token = await this.getJwt(runtime, false);
    let posted = await this.postJson(url, body, { 'R-Auth': token.jwt }, runtime.timeoutMs);
    if (posted.response.status === 401 && token.fromCache) {
      this.clear(runtime);
      token = await this.getJwt(runtime, true);
      posted = await this.postJson(url, body, { 'R-Auth': token.jwt }, runtime.timeoutMs);
    }
    return posted;
  }

  private async getJson(
    url: string,
    headers: Record<string, string>,
    timeoutMs: number,
  ) {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { response, body: await this.readBody(response) };
  }

  async postJson(
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
    timeoutMs: number,
  ) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { response, body: await this.readBody(response) };
  }

  formatHttpError(
    url: string,
    status: number,
    body: Record<string, unknown>,
  ): string {
    const headline = `EVATRA returned HTTP ${status} from ${url}`;
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

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
