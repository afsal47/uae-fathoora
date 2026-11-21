import { BadRequestException } from '@nestjs/common';
import { AspProviderResolverService } from './asp-provider-resolver.service';
import { EvatraAdapter } from './providers/evatra/evatra.adapter';
import { MockAspBAdapter } from './providers/mock-asp-b/mock-asp-b.adapter';

describe('AspProviderResolverService', () => {
  const evatra = { provider: 'EVATRA' } as EvatraAdapter;
  const mockB = { provider: 'MOCK_ASP_B' } as MockAspBAdapter;
  const resolver = new AspProviderResolverService(evatra, mockB);

  it('selects Evatra for EVATRA and legacy GENERIC', () => {
    expect(resolver.resolve('EVATRA')).toBe(evatra);
    expect(resolver.resolve('generic')).toBe(evatra);
  });

  it('selects Mock ASP B independently', () => {
    expect(resolver.resolve('MOCK_ASP_B')).toBe(mockB);
  });

  it('rejects unregistered provider codes', () => {
    expect(() => resolver.resolve('UNKNOWN_ASP')).toThrow(BadRequestException);
  });

  it('does not invent adapters for inactive DB-only providers', () => {
    expect(resolver.isRegistered('SOME_FUTURE_ASP')).toBe(false);
  });
});
