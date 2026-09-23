import { Global, Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { AdminAuthGuard } from './admin-auth.guard';
import { SecretsCryptoService } from './secrets-crypto.service';

@Global()
@Module({
  providers: [ApiKeyGuard, AdminAuthGuard, SecretsCryptoService],
  exports: [ApiKeyGuard, AdminAuthGuard, SecretsCryptoService],
})
export class AuthModule {}
