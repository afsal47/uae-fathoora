import { Injectable } from '@nestjs/common';
import { ClearTaxAdapter } from './cleartax.adapter';
import { GenericAspAdapter } from './generic-asp.adapter';
import { MockAspAdapter } from './mock-asp.adapter';
import { AspProviderAdapter } from './asp.types';

@Injectable()
export class AspProviderResolverService {
  private readonly providers: Map<string, AspProviderAdapter>;

  constructor(
    private readonly mockAspAdapter: MockAspAdapter,
    private readonly clearTaxAdapter: ClearTaxAdapter,
    private readonly genericAspAdapter: GenericAspAdapter,
  ) {
    this.providers = new Map<string, AspProviderAdapter>([
      ['FAKE', mockAspAdapter],
      ['MOCK', mockAspAdapter],
      ['CLEARTAX', clearTaxAdapter],
    ]);
  }

  resolve(provider: string) {
    return this.providers.get(provider.toUpperCase()) ?? this.genericAspAdapter;
  }
}
