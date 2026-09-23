import { Module } from '@nestjs/common';
import { ClearTaxAdapter } from './cleartax.adapter';
import { MockAspAdapter } from './mock-asp.adapter';
import { AspProviderResolverService } from './asp-provider-resolver.service';

@Module({
  providers: [MockAspAdapter, ClearTaxAdapter, AspProviderResolverService],
  exports: [AspProviderResolverService],
})
export class AspModule {}
