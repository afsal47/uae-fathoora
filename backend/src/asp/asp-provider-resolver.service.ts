import { BadRequestException, Injectable } from '@nestjs/common';
import { AspProviderAdapter } from './asp.types';
import { EvatraAdapter } from './providers/evatra/evatra.adapter';
import { MockAspBAdapter } from './providers/mock-asp-b/mock-asp-b.adapter';

/**
 * Selects a registered NestJS adapter by provider code from the ASP connection.
 * Never trust provider codes from untrusted invoice request bodies.
 */
@Injectable()
export class AspProviderResolverService {
  private readonly adapters: Map<string, AspProviderAdapter>;

  constructor(
    private readonly evatraAdapter: EvatraAdapter,
    private readonly mockAspBAdapter: MockAspBAdapter,
  ) {
    this.adapters = new Map<string, AspProviderAdapter>([
      ['EVATRA', this.evatraAdapter],
      ['GENERIC', this.evatraAdapter], // legacy label → EVATRA
      ['MOCK_ASP_B', this.mockAspBAdapter],
    ]);
  }

  resolve(providerCode: string): AspProviderAdapter {
    const code = (providerCode ?? '').trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('ASP provider code is required.');
    }

    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw new BadRequestException(
        `No registered backend adapter for ASP provider "${code}". ` +
          `Activating a provider in ASP Provider Master does not implement its API.`,
      );
    }
    return adapter;
  }

  listRegisteredCodes(): string[] {
    return [...this.adapters.keys()].filter((c) => c !== 'GENERIC');
  }

  isRegistered(providerCode: string): boolean {
    return this.adapters.has((providerCode ?? '').trim().toUpperCase());
  }
}
