import { Module } from '@nestjs/common';
import { AspModule } from '../asp/asp.module';
import { AspWebhooksController } from '../asp/asp-webhooks.controller';
import { QueueModule } from '../queue/queue.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { InvoiceProcessingService } from './invoice-processing.service';
import { AdminInvoicesController } from './admin-invoices.controller';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [QueueModule, AspModule, WebhooksModule],
  controllers: [InvoicesController, AspWebhooksController, AdminInvoicesController],
  providers: [InvoicesService, InvoiceProcessingService],
})
export class InvoicesModule {}
