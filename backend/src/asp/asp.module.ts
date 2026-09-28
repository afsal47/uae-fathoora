import { Module } from '@nestjs/common';
import { ClearTaxAdapter } from './cleartax.adapter';
import { GenericAspAdapter } from './generic-asp.adapter';
import { MockAspAdapter } from './mock-asp.adapter';
import { AspProviderResolverService } from './asp-provider-resolver.service';

@Module({
  providers: [MockAspAdapter, ClearTaxAdapter, GenericAspAdapter, AspProviderResolverService],
  exports: [AspProviderResolverService],
})
export class AspModule {}
