import { GenericAspAdapter } from './generic-asp.adapter';
import { AspSubmissionContext, AspSubmissionError } from './asp.types';

jest.mock('./pint-ae-payload.builder', () => ({
  buildPintAePayload: jest.fn(() => ({ document: 'pint' })),
}));

jest.mock('./pint-ae-xml.builder', () => ({
  buildPintAeXml: jest.fn(() => '<Invoice>INV-1001</Invoice>'),
}));

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('GenericAspAdapter', () => {
  const secrets = {
    decrypt: jest.fn((value: string | null) => value),
  };

  const context = {
    tenant: {
      id: 'tenant-1',
      code: 'CITY_MARINE',
      email: 'user@example.com',
      aspProvider: 'SOME_ASP',
      aspBaseUrl: 'https://asp.example/api/v1/invoices',
      aspApiKey: 'tenant-asp-key',
    },
    invoice: { invoiceNumber: 'INV-1001' },
  } as unknown as AspSubmissionContext;

  const loginBody = {
    jwt: 'jwt-1',
    expirationDate: '2099-01-01T00:00:00.000Z',
  };

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async (url: string) => {
      if (String(url).endsWith('/auth/login')) {
        return jsonResponse(200, loginBody);
      }
      return jsonResponse(200, { status: 'SUBMITTED', uuid: 'msg-1' });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    secrets.decrypt.mockImplementation((value: string | null) => value);
  });

  it('logs in, then posts the Peppol XML as base64 with the R-Auth token', async () => {
    const adapter = new GenericAspAdapter(secrets as never);
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
      base64Document: Buffer.from('<Invoice>INV-1001</Invoice>', 'utf8').toString('base64'),
      invoiceType: 'UAE_PINT',
      businessType: 'B2B',
      invoiceSource: 'ERP',
    });
    expect(result.status).toBe('SUBMITTED');
    expect(result.aspMessageId).toBe('msg-1');
  });

  it('reuses a cached token for the next invoice', async () => {
    const adapter = new GenericAspAdapter(secrets as never);
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
      return jsonResponse(200, { status: 'PENDING', trackingId: 'track-29' });
    });
    const adapter = new GenericAspAdapter(secrets as never);
    const result = await adapter.submitInvoice(context);

    expect(result.status).toBe('SUBMITTED');
    expect(result.aspMessageId).toBe('track-29');
    expect(result.aspReferenceId).toBe('track-29');
  });

  it('keeps the ASP URL and response body when the document call is rejected', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/auth/login')) {
        return jsonResponse(200, loginBody);
      }
      return jsonResponse(401, { error: 'Unauthorized', message: 'Invalid apiKey' });
    });
    const adapter = new GenericAspAdapter(secrets as never);

    await expect(adapter.submitInvoice(context)).rejects.toBeInstanceOf(AspSubmissionError);
    await expect(adapter.submitInvoice(context)).rejects.toThrow(
      [
        'SOME_ASP returned HTTP 401 from https://asp.example/api/v1/invoices',
        JSON.stringify({ error: 'Unauthorized', message: 'Invalid apiKey' }, null, 2),
      ].join('\n'),
    );
  });

  it('reports the login URL when Evatra rejects the API key', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/auth/login')) {
        return jsonResponse(401, { error: 'Unauthorized' });
      }
      return jsonResponse(200, { status: 'SUBMITTED' });
    });
    const adapter = new GenericAspAdapter(secrets as never);

    await expect(adapter.submitInvoice(context)).rejects.toThrow(
      'SOME_ASP returned HTTP 401 from https://asp.example/auth/login',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not call Evatra when the tenant email is missing', async () => {
    const adapter = new GenericAspAdapter(secrets as never);
    const missingEmail = {
      ...context,
      tenant: { ...context.tenant, email: '  ' },
    } as AspSubmissionContext;

    await expect(adapter.submitInvoice(missingEmail)).rejects.toThrow(
      'Tenant CITY_MARINE has no email.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not append a path to the saved URL', async () => {
    const adapter = new GenericAspAdapter(secrets as never);
    await adapter.submitInvoice(context);

    const calledUrl = fetchMock.mock.calls[1][0] as string;
    expect(calledUrl).toBe('https://asp.example/api/v1/invoices');
    expect(calledUrl.endsWith('/api/v1/invoices/api/v1/invoices')).toBe(false);
  });
});
