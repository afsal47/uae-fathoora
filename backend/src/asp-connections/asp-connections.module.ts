import { Module } from '@nestjs/common';
import { AspModule } from '../asp/asp.module';
import { AspConnectionsController } from './asp-connections.controller';
import { AspConnectionsService } from './asp-connections.service';

@Module({
  imports: [AspModule],
  controllers: [AspConnectionsController],
  providers: [AspConnectionsService],
  exports: [AspConnectionsService],
})
export class AspConnectionsModule {}
