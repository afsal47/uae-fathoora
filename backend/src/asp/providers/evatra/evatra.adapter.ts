import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AspConnectionTestResult,
  AspDocumentStatusResult,
  AspProviderAdapter,
  AspRetryResult,
  AspRuntimeCredentials,
  AspSubmissionContext,
  AspSubmissionError,
  AspSubmissionResult,
} from '../../asp.types';
import { EvatraAuthService } from './evatra-auth.service';
import { EvatraRequestMapper } from './evatra-request.mapper';
import { EvatraResponseMapper } from './evatra-response.mapper';
import { EvatraStatusMapper } from './evatra-status.mapper';

/**
 * EVATRA ASP integration.
 * Provider-specific URLs, R-Auth, JSON fields and status parsing stay here.
 */
@Injectable()
export class EvatraAdapter implements AspProviderAdapter {
  readonly provider = 'EVATRA';
  private readonly logger = new Logger(EvatraAdapter.name);

  constructor(
    private readonly auth: EvatraAuthService,
    private readonly requestMapper: EvatraRequestMapper,
    private readonly responseMapper: EvatraResponseMapper,
    private readonly statusMapper: EvatraStatusMapper,
  ) {}

  async submitInvoice(context: AspSubmissionContext): Promise<AspSubmissionResult> {
    const runtime = context.runtime;
    const submitUrl = runtime.submitUrl;
    const built = this.requestMapper.buildSubmitBody(context);

    this.logger.log(
      `Submitting invoice ${context.invoice.invoiceNumber} to EVATRA at ${submitUrl}`,
    );

    const posted = await this.auth.authorizedPost(
      runtime,
      submitUrl,
      built.requestBody,
    );
    const response = posted.response;
    const body = posted.body;
    const payload = {
      json: built.pintPayload,
      xml: built.pintXml,
    } as unknown as Record<string, unknown>;

    if (!response.ok) {
      const errorMessage = this.auth.formatHttpError(
        submitUrl,
        response.status,
        body,
      );

      if (response.status === 422 && body.rejectionReason) {
        return this.responseMapper.mapSubmitResponse(
          body,
          response.status,
          payload,
        );
      }

      this.logger.error(errorMessage);
      throw new AspSubmissionError(errorMessage, body);
    }

    return this.responseMapper.mapSubmitResponse(
      body,
      response.status,
      payload,
    );
  }

  async getDocumentStatus(
    runtime: AspRuntimeCredentials,
    trackingId: string,
  ): Promise<AspDocumentStatusResult> {
    const id = trackingId.trim();
    if (!id) {
      throw new BadRequestException('trackingId is required to poll ASP document status.');
    }

    const template =
      runtime.statusPathTemplate || '/invoice/document-status/{trackingId}';
    const path = template.includes('{trackingId}')
      ? template.replace('{trackingId}', encodeURIComponent(id))
      : `${template.replace(/\/$/, '')}/${encodeURIComponent(id)}`;
    const statusUrl = new URL(path, runtime.origin).toString();

    this.logger.log(`Polling EVATRA document status for ${id} at ${statusUrl}`);

    const fetched = await this.auth.authorizedGet(runtime, statusUrl);
    if (!fetched.response.ok) {
      const errorMessage = this.auth.formatHttpError(
        statusUrl,
        fetched.response.status,
        fetched.body,
      );
      this.logger.error(errorMessage);
      throw new AspSubmissionError(errorMessage, fetched.body);
    }

    const mapped = this.statusMapper.mapDocumentStatus(fetched.body);
    return {
      status: mapped.status,
      trackingId:
        this.responseMapper.readId(fetched.body, [
          'trackingId',
          'uuid',
          'aspMessageId',
        ]) || id,
      invoiceId: this.statusMapper.readAspInvoiceId(fetched.body),
      companyId: this.responseMapper.readId(fetched.body, [
        'companyId',
        'company_id',
        'compId',
      ]),
      message:
        mapped.message ??
        this.responseMapper.optionalString(fetched.body.message) ??
        this.responseMapper.optionalString(fetched.body.status),
      rejectionReason: mapped.rejectionReason,
      raw: fetched.body,
      normalized: mapped.normalized,
    };
  }

  async retryTddFailed(
    runtime: AspRuntimeCredentials,
    invoiceId: string,
    companyId: string,
  ): Promise<AspRetryResult> {
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

    const retryPath = runtime.retryTddPath || '/peppol/tdd/retry-failed';
    const retryUrl = new URL(retryPath, runtime.origin);
    retryUrl.searchParams.set('companyId', aspCompanyId);
    retryUrl.searchParams.set('invoiceId', aspInvoiceId);
    const retryUrlText = retryUrl.toString();
    this.logger.log(
      `Retrying EVATRA TDD for invoiceId=${aspInvoiceId} (companyId=${aspCompanyId}) at ${retryUrlText}`,
    );

    const posted = await this.auth.authorizedPost(runtime, retryUrlText, {
      invoiceId: aspInvoiceId,
      companyId: aspCompanyId,
    });
    if (!posted.response.ok) {
      const errorMessage = this.auth.formatHttpError(
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
        this.responseMapper.optionalString(posted.body.message) ??
        `TDD retry accepted for invoiceId ${aspInvoiceId}.`,
      raw: posted.body,
    };
  }

  async testConnection(
    runtime: AspRuntimeCredentials,
  ): Promise<AspConnectionTestResult> {
    try {
      await this.auth.getJwt(runtime, true);
      return {
        ok: true,
        message: 'EVATRA login succeeded (R-Auth token obtained).',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message,
        raw:
          error instanceof AspSubmissionError ? error.responseBody : undefined,
      };
    }
  }
}
