import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AspProviderAdapter, AspSubmissionContext, ParsedWebhookPayload } from './asp.types';

@Injectable()
export class MockAspAdapter implements AspProviderAdapter {
  readonly provider = 'FAKE';

  async submitInvoice(context: AspSubmissionContext) {
    const aspMessageId = `msg_${randomUUID()}`;
    const aspReferenceId = `ref_${context.invoice.invoiceNumber}`;

    return {
      status: 'SUBMITTED' as const,
      aspMessageId,
      aspReferenceId,
      payload: {
        tenantCode: context.tenant.code,
        integrationCode: context.integration.code,
        invoiceId: context.invoice.id,
        invoiceNumber: context.invoice.invoiceNumber,
        totalAmount: Number(context.invoice.totalAmount),
        currencyCode: context.invoice.currencyCode,
        lines: context.invoice.lines.map((line) => ({
          lineNumber: line.lineNumber,
          description: line.description,
          quantity: Number(line.quantity),
          totalAmount: Number(line.totalAmount),
          vatRate: Number(line.vatRate),
        })),
      },
      response: {
        provider: this.provider,
        acknowledgedAt: new Date().toISOString(),
        status: 'SUBMITTED',
        aspMessageId,
        aspReferenceId,
      },
    };
  }

  async parseWebhook(payload: Record<string, unknown>): Promise<ParsedWebhookPayload> {
    const tenantCode = this.readString(payload.tenantCode, 'tenantCode');
    const status = this.readString(payload.status, 'status').toUpperCase();

    if (!['SUBMITTED', 'ACCEPTED', 'REJECTED', 'FAILED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException(`Unsupported webhook status ${status}.`);
    }

    return {
      tenantCode,
      invoiceId: this.readOptionalInvoiceId(payload.invoiceId),
      aspReferenceId: this.readOptionalString(payload.aspReferenceId),
      aspMessageId: this.readOptionalString(payload.aspMessageId),
      status: status as ParsedWebhookPayload['status'],
      message:
        this.readOptionalString(payload.message) ??
        `Mock ASP webhook received with status ${status}.`,
      rejectionReason: this.readOptionalString(payload.rejectionReason),
      rawPayload: payload,
    };
  }

  private readString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`Webhook field ${field} is required.`);
    }

    return value.trim();
  }

  private readOptionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private readOptionalInvoiceId(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      return Number(value.trim());
    }
    return undefined;
  }
}
