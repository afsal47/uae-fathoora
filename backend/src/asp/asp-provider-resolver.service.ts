import { Injectable, NotFoundException } from '@nestjs/common';
import { ClearTaxAdapter } from './cleartax.adapter';
import { MockAspAdapter } from './mock-asp.adapter';
import { AspProviderAdapter } from './asp.types';

@Injectable()
export class AspProviderResolverService {
  private readonly providers: Map<string, AspProviderAdapter>;

  constructor(
    private readonly mockAspAdapter: MockAspAdapter,
    private readonly clearTaxAdapter: ClearTaxAdapter,
  ) {
    this.providers = new Map<string, AspProviderAdapter>([
      ['FAKE', mockAspAdapter],
      ['MOCK', mockAspAdapter],
      ['CLEARTAX', clearTaxAdapter],
    ]);
  }

  resolve(provider: string) {
    const adapter = this.providers.get(provider.toUpperCase());

    if (!adapter) {
      throw new NotFoundException(`ASP provider ${provider} is not supported.`);
    }

    return adapter;
  }
}
