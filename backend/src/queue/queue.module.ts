import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { INVOICE_QUEUE_NAME } from '../invoices/invoice.constants';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'INVOICE_QUEUE_NAME',
      useValue: INVOICE_QUEUE_NAME,
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
