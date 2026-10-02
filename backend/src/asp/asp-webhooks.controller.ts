import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoiceProcessingService } from '../invoices/invoice-processing.service';

@ApiTags('ASP Webhooks')
@Controller('asp/webhooks')
export class AspWebhooksController {
  constructor(
    private readonly invoiceProcessingService: InvoiceProcessingService,
  ) {}

  @Post(':provider')
  @ApiOperation({ summary: 'Receive ASP webhook callbacks' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tenantCode: { type: 'string', example: 'CITY_MARINE' },
        invoiceId: { type: 'integer', example: 1 },
        aspReferenceId: { type: 'string' },
        aspMessageId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'FAILED', 'CANCELLED'],
        },
        message: { type: 'string' },
        rejectionReason: { type: 'string' },
      },
      required: ['tenantCode', 'status'],
    },
  })
  receiveWebhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    return this.invoiceProcessingService.handleWebhook(provider, headers, body);
  }
}
