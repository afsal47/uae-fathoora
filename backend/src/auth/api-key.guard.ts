import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SecretsCryptoService } from './secrets-crypto.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly secrets: SecretsCryptoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const apiKey = this.extractHeader(request, 'x-api-key');
    const signature = this.extractHeader(request, 'x-signature');
    const timestamp = this.extractHeader(request, 'x-timestamp');

    if (!apiKey) {
      throw new UnauthorizedException('Missing x-api-key header.');
    }

    const integration = await this.prisma.integration.findFirst({
      where: { apiKey, isActive: true },
      include: { tenant: true },
    });

    if (!integration || !integration.tenant.isActive) {
      throw new UnauthorizedException('Invalid API key or inactive tenant.');
    }

    const hmacRequired =
      this.config.get<string>('HMAC_REQUIRED') !== 'false' &&
      integration.authType.toUpperCase().includes('HMAC');

    if (hmacRequired) {
      if (!signature || !timestamp) {
        throw new UnauthorizedException(
          'HMAC required: provide x-signature and x-timestamp headers.',
        );
      }
    }

    if (hmacRequired && signature && timestamp) {
      const apiSecret = this.secrets.decrypt(integration.apiSecret) ?? '';
      this.verifyHmac(apiSecret, timestamp, request.body, signature);
    }

    (request as any).tenant = integration.tenant;
    (request as any).integration = {
      ...integration,
      apiSecret: this.secrets.decrypt(integration.apiSecret) ?? integration.apiSecret,
      webhookSecret:
        this.secrets.decrypt(integration.webhookSecret) ?? integration.webhookSecret,
    };

    return true;
  }

  private extractHeader(request: Request, name: string): string | undefined {
    const value = request.headers[name];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private verifyHmac(
    secret: string,
    timestamp: string,
    body: unknown,
    signature: string,
  ) {
    const age = Math.abs(Date.now() - Number(timestamp));
    if (isNaN(age) || age > 5 * 60 * 1000) {
      throw new UnauthorizedException('Request timestamp is too old or invalid.');
    }

    const payload = `${timestamp}.${JSON.stringify(body ?? {})}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expBuffer = Buffer.from(expected, 'hex');

    if (sigBuffer.length !== expBuffer.length || !timingSafeEqual(sigBuffer, expBuffer)) {
      throw new UnauthorizedException('Invalid HMAC signature.');
    }
  }
}
