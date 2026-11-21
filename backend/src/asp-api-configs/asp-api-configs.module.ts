import { Module } from '@nestjs/common';
import { AspApiConfigsController } from './asp-api-configs.controller';
import { AspApiConfigsService } from './asp-api-configs.service';

@Module({
  controllers: [AspApiConfigsController],
  providers: [AspApiConfigsService],
  exports: [AspApiConfigsService],
})
export class AspApiConfigsModule {}
