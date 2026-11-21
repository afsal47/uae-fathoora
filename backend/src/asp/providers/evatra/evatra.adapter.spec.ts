import { EvatraAdapter } from './evatra.adapter';
import { EvatraAuthService } from './evatra-auth.service';
import { EvatraRequestMapper } from './evatra-request.mapper';
import { EvatraResponseMapper } from './evatra-response.mapper';
import { EvatraStatusMapper } from './evatra-status.mapper';
import { AspSubmissionContext, AspSubmissionError } from '../../asp.types';

jest.mock('../../pint-ae-payload.builder', () => ({
  buildPintAePayload: jest.fn(() => ({ document: 'pint' })),
}));

jest.mock('../../pint-ae-xml.builder', () => ({
  buildPintAeXml: jest.fn(() => '<Invoice>INV-1001</Invoice>'),
}));

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('EvatraAdapter', () => {
  const context = {
    tenant: {
      id: 'tenant-1',
      code: 'CITY_MARINE',
    },
    invoice: { invoiceNumber: 'INV-1001', id: 1 },
    runtime: {
      connectionId: 'conn-1',
      tenantId: 'tenant-1',
      legalEntityId: 'le-1',
      providerCode: 'EVATRA',
      environment: 'PRODUCTION',
      origin: 'https://asp.example',
      submitUrl: 'https://asp.example/api/v1/invoices',
      loginPath: '/auth/login',
      statusPathTemplate: '/invoice/document-status/{trackingId}',
      retryTddPath: '/peppol/tdd/retry-failed',
      timeoutMs: 30_000,
      credentials: {
        apiKey: 'tenant-asp-key',
        email: 'user@example.com',
      },
    },
  } as unknown as AspSubmissionContext;

  const loginBody = {
    jwt: 'jwt-1',
    expirationDate: '2099-01-01T00:00:00.000Z',
  };

  let fetchMock: jest.Mock;
  let adapter: EvatraAdapter;

  beforeEach(() => {
    fetchMock = jest.fn(async (url: string) => {
      if (String(url).endsWith('/auth/login')) {
        return jsonResponse(200, loginBody);
      }
      return jsonResponse(200, { status: 'SUBMITTED', uuid: 'msg-1' });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    adapter = new EvatraAdapter(
      new EvatraAuthService(),
      new EvatraRequestMapper(),
      new EvatraResponseMapper(),
      new EvatraStatusMapper(),
    );
  });

  it('logs in, then posts the Peppol XML as base64 with the R-Auth token', async () => {
    const result = await adapter.submitInvoice(context);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(loginUrl).toBe('https://asp.example/auth/login');
    expect(loginInit.method).toBe('POST');
    expect(JSON.parse(String(loginInit.body))).toEqual({
      apiKey: 'tenant-asp-key',
      email: 'user@example.com',
    });

    const [calledUrl, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(calledUrl).toBe('https://asp.example/api/v1/invoices');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'R-Auth': 'jwt-1',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      apiKey: 'tenant-asp-key',
      base64Document: Buffer.from('<Invoice>INV-1001</Invoice>', 'utf8').toString(
        'base64',
      ),
      invoiceType: 'UAE_PINT',
      businessType: 'B2B',
      invoiceSource: 'ERP',
    });
    expect(result.status).toBe('SUBMITTED');
    expect(result.aspMessageId).toBe('msg-1');
    expect(result.normalized?.peppolDeliveryStatus).toBe('PENDING');
  });

  it('reuses a cached token for the next invoice', async () => {
    await adapter.submitInvoice(context);
    await adapter.submitInvoice(context);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('https://asp.example/auth/login');
    expect(fetchMock.mock.calls[1][0]).toBe('https://asp.example/api/v1/invoices');
    expect(fetchMock.mock.calls[2][0]).toBe('https://asp.example/api/v1/invoices');
  });

  it('stores the Evatra trackingId as the ASP reference', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/auth/login')) {
        return jsonResponse(200, loginBody);
      }
      return jsonResponse(200, {
        status: 'SUBMITTED',
        trackingId: 'trk-9',
      });
    });

    const result = await adapter.submitInvoice(context);
    expect(result.aspReferenceId).toBe('trk-9');
  });

  it('does not invent success when login fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'denied' }));
    await expect(adapter.submitInvoice(context)).rejects.toBeInstanceOf(
      AspSubmissionError,
    );
  });
});
