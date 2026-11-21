import { AspProviderResolverService } from './asp-provider-resolver.service';
import { EvatraAuthService } from './providers/evatra/evatra-auth.service';
import { EvatraRequestMapper } from './providers/evatra/evatra-request.mapper';
import { EvatraResponseMapper } from './providers/evatra/evatra-response.mapper';
import { EvatraStatusMapper } from './providers/evatra/evatra-status.mapper';
import { EvatraAdapter } from './providers/evatra/evatra.adapter';
import { MockAspBAdapter } from './providers/mock-asp-b/mock-asp-b.adapter';
import { AspSubmissionContext } from './asp.types';

jest.mock('./pint-ae-payload.builder', () => ({
  buildPintAePayload: jest.fn(() => ({ document: 'pint' })),
}));

jest.mock('./pint-ae-xml.builder', () => ({
  buildPintAeXml: jest.fn(() => '<Invoice/>'),
}));

/**
 * Mandatory multi-ASP scenarios (unit level):
 * - Same resolver / common hub path
 * - Tenant A → EVATRA, Tenant B → MOCK_ASP_B
 * - Independent adapters
 * - Same internal status model fields
 */
describe('Multi-ASP routing (common hub API)', () => {
  const previousMockFlag = process.env.MOCK_ASP_B_ENABLED;

  beforeAll(() => {
    process.env.MOCK_ASP_B_ENABLED = 'true';
  });

  afterAll(() => {
    if (previousMockFlag === undefined) {
      delete process.env.MOCK_ASP_B_ENABLED;
    } else {
      process.env.MOCK_ASP_B_ENABLED = previousMockFlag;
    }
  });

  function buildResolver() {
    const evatra = new EvatraAdapter(
      new EvatraAuthService(),
      new EvatraRequestMapper(),
      new EvatraResponseMapper(),
      new EvatraStatusMapper(),
    );
    const mockB = new MockAspBAdapter();
    return {
      resolver: new AspProviderResolverService(evatra, mockB),
      evatra,
      mockB,
    };
  }

  function context(
    providerCode: string,
    tenantId: string,
    invoiceId: number,
  ): AspSubmissionContext {
    return {
      tenant: { id: tenantId, code: tenantId } as never,
      integration: { id: `int-${tenantId}` } as never,
      invoice: {
        id: invoiceId,
        invoiceNumber: `inv-${invoiceId}`,
        sellerName: 'S',
        buyerName: 'B',
      } as never,
      runtime: {
        connectionId: `conn-${tenantId}`,
        tenantId,
        legalEntityId: `le-${tenantId}`,
        providerCode,
        environment: 'SANDBOX',
        origin: 'https://asp.example',
        submitUrl: 'https://asp.example/submit',
        loginPath: '/auth/login',
        statusPathTemplate: '/invoice/document-status/{trackingId}',
        retryTddPath: '/peppol/tdd/retry-failed',
        timeoutMs: 30_000,
        credentials: {
          apiKey: `key-${tenantId}`,
          email: `${tenantId}@example.com`,
        },
      },
    };
  }

  it('routes Tenant A to EVATRA and Tenant B to MOCK_ASP_B via the same resolver', async () => {
    const { resolver, evatra, mockB } = buildResolver();
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).endsWith('/auth/login')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              jwt: 'jwt-a',
              expirationDate: '2099-01-01T00:00:00.000Z',
            }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ status: 'SUBMITTED', trackingId: 'trk-a' }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapterA = resolver.resolve('EVATRA');
    const adapterB = resolver.resolve('MOCK_ASP_B');
    expect(adapterA).toBe(evatra);
    expect(adapterB).toBe(mockB);

    const resultA = await adapterA.submitInvoice(context('EVATRA', 'tenant-a', 1));
    const resultB = await adapterB.submitInvoice(
      context('MOCK_ASP_B', 'tenant-b', 2),
    );

    expect(resultA.aspMessageId).toBe('trk-a');
    expect(resultB.aspMessageId).toContain('mock-b-2');
    expect(resultA.normalized?.aspSubmissionStatus).toBeDefined();
    expect(resultB.normalized?.aspSubmissionStatus).toBeDefined();
    expect(resultA.normalized?.peppolDeliveryStatus).toBe('PENDING');
    expect(resultB.normalized?.peppolDeliveryStatus).toBe('PENDING');
  });

  it('keeps provider A auth credentials independent from provider B', async () => {
    const { resolver } = buildResolver();
    const bodies: unknown[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/auth/login')) {
        bodies.push(JSON.parse(String(init?.body)));
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              jwt: 'jwt',
              expirationDate: '2099-01-01T00:00:00.000Z',
            }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'SUBMITTED', uuid: 'x' }),
      };
    }) as unknown as typeof fetch;

    await resolver.resolve('EVATRA').submitInvoice(context('EVATRA', 'tenant-a', 10));
    expect(bodies[0]).toEqual({
      apiKey: 'key-tenant-a',
      email: 'tenant-a@example.com',
    });
  });
});
