import { Module } from '@nestjs/common';
import { AspConnectionResolverService } from './asp-connection-resolver.service';
import { AspProviderResolverService } from './asp-provider-resolver.service';
import { EvatraAuthService } from './providers/evatra/evatra-auth.service';
import { EvatraRequestMapper } from './providers/evatra/evatra-request.mapper';
import { EvatraResponseMapper } from './providers/evatra/evatra-response.mapper';
import { EvatraStatusMapper } from './providers/evatra/evatra-status.mapper';
import { EvatraAdapter } from './providers/evatra/evatra.adapter';
import { MockAspBAdapter } from './providers/mock-asp-b/mock-asp-b.adapter';

@Module({
  providers: [
    EvatraAuthService,
    EvatraRequestMapper,
    EvatraResponseMapper,
    EvatraStatusMapper,
    EvatraAdapter,
    MockAspBAdapter,
    AspProviderResolverService,
    AspConnectionResolverService,
  ],
  exports: [
    AspProviderResolverService,
    AspConnectionResolverService,
    EvatraAdapter,
    MockAspBAdapter,
  ],
})
export class AspModule {}
