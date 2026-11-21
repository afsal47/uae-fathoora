import { Module } from '@nestjs/common';
import { AspModule } from '../asp/asp.module';
import { AspProvidersController } from './asp-providers.controller';
import { AspProvidersService } from './asp-providers.service';

@Module({
  imports: [AspModule],
  controllers: [AspProvidersController],
  providers: [AspProvidersService],
  exports: [AspProvidersService],
})
export class AspProvidersModule {}
