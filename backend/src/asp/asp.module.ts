import { Module } from '@nestjs/common';
import { GenericAspAdapter } from './generic-asp.adapter';
import { AspProviderResolverService } from './asp-provider-resolver.service';

@Module({
  providers: [GenericAspAdapter, AspProviderResolverService],
  exports: [AspProviderResolverService],
})
export class AspModule {}
