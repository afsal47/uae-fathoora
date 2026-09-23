import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { OutboundWebhookService } from './outbound-webhook.service';

@Module({
  imports: [QueueModule],
  providers: [OutboundWebhookService],
  exports: [OutboundWebhookService],
})
export class WebhooksModule {}
