import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_API_KEY')?.trim();
    if (!expected) {
      throw new UnauthorizedException(
        'ADMIN_API_KEY is not configured on the server.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = this.extractAdminKey(request);

    if (!provided || !this.keysMatch(provided, expected)) {
      throw new UnauthorizedException('Invalid or missing admin credentials.');
    }

    return true;
  }

  private extractAdminKey(request: Request): string | undefined {
    const headerKey = request.headers['x-admin-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }

    const auth = request.headers.authorization;
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7).trim();
      return token || undefined;
    }

    return undefined;
  }

  private keysMatch(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      return false;
    }
    return timingSafeEqual(aBuf, bBuf);
  }
}
