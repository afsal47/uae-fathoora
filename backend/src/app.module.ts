import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { InvoicesModule } from './invoices/invoices.module';
import { TenantsModule } from './tenants/tenants.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AspProvidersModule } from './asp-providers/asp-providers.module';
import { AspApiConfigsModule } from './asp-api-configs/asp-api-configs.module';
import { AspConnectionsModule } from './asp-connections/asp-connections.module';
import { LegalEntitiesModule } from './legal-entities/legal-entities.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    InvoicesModule,
    TenantsModule,
    IntegrationsModule,
    AspProvidersModule,
    AspApiConfigsModule,
    AspConnectionsModule,
    LegalEntitiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
