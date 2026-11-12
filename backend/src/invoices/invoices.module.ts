import { Module } from '@nestjs/common';
import { AspModule } from '../asp/asp.module';
import { QueueModule } from '../queue/queue.module';
import { AspStatusSyncService } from './asp-status-sync.service';
import { InvoiceProcessingService } from './invoice-processing.service';
import { AdminInvoicesController } from './admin-invoices.controller';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [QueueModule, AspModule],
  controllers: [InvoicesController, AdminInvoicesController],
  providers: [InvoicesService, InvoiceProcessingService, AspStatusSyncService],
})
export class InvoicesModule {}
