import { Injectable } from '@nestjs/common';
import { AspSubmissionContext } from '../../asp.types';
import { buildPintAePayload } from '../../pint-ae-payload.builder';
import { buildPintAeXml } from '../../pint-ae-xml.builder';

@Injectable()
export class EvatraRequestMapper {
  buildSubmitBody(context: AspSubmissionContext): {
    requestBody: Record<string, unknown>;
    pintPayload: unknown;
    pintXml: string;
  } {
    const pintPayload = buildPintAePayload(context);
    const pintXml = buildPintAeXml(pintPayload);
    const apiKey = context.runtime.credentials.apiKey?.trim() ?? '';

    return {
      requestBody: {
        apiKey,
        base64Document: Buffer.from(pintXml, 'utf8').toString('base64'),
        invoiceType: 'UAE_PINT',
        businessType: 'B2B',
        invoiceSource: 'ERP',
      },
      pintPayload,
      pintXml,
    };
  }
}
