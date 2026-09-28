import { GenericAspAdapter } from './generic-asp.adapter';
import { AspSubmissionContext } from './asp.types';

jest.mock('./pint-ae-payload.builder', () => ({
  buildPintAePayload: jest.fn(() => ({ document: 'pint' })),
}));

jest.mock('./pint-ae-xml.builder', () => ({
  buildPintAeXml: jest.fn(() => '<Invoice>INV-1001</Invoice>'),
}));

describe('GenericAspAdapter', () => {
  const secrets = {
    decrypt: jest.fn((value: string | null) => value),
  };

  const context = {
    tenant: {
      code: 'CITY_MARINE',
      aspProvider: 'SOME_ASP',
      aspBaseUrl: 'https://asp.example/api/v1/invoices',
      aspApiKey: 'tenant-asp-key',
    },
    invoice: { invoiceNumber: 'INV-1001' },
  } as unknown as AspSubmissionContext;

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'SUBMITTED', uuid: 'msg-1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    secrets.decrypt.mockImplementation((value: string | null) => value);
  });

  it('posts XML only to the tenant aspBaseUrl', async () => {
    const adapter = new GenericAspAdapter(secrets as never);
    const result = await adapter.submitInvoice(context);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://asp.example/api/v1/invoices',
      expect.objectContaining({
        method: 'POST',
        body: '<Invoice>INV-1001</Invoice>',
        headers: expect.objectContaining({
          'Content-Type': 'application/xml',
          'x-api-key': 'tenant-asp-key',
          'x-tenant-id': 'CITY_MARINE',
        }),
      }),
    );
    expect(result.status).toBe('SUBMITTED');
    expect(result.aspMessageId).toBe('msg-1');
  });

  it('does not append a path to the saved URL', async () => {
    const adapter = new GenericAspAdapter(secrets as never);
    await adapter.submitInvoice(context);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://asp.example/api/v1/invoices');
    expect(calledUrl.endsWith('/api/v1/invoices/api/v1/invoices')).toBe(false);
  });
});
