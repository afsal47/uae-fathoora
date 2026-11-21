import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAspApiConfigDto } from './dto/upsert-asp-api-config.dto';

@Injectable()
export class AspApiConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProvider(aspProviderId: string) {
    await this.ensureProvider(aspProviderId);
    return this.prisma.aspProviderApiConfig.findMany({
      where: { aspProviderId },
      orderBy: { environment: 'asc' },
    });
  }

  async upsert(aspProviderId: string, dto: UpsertAspApiConfigDto) {
    await this.ensureProvider(aspProviderId);
    const existing = await this.prisma.aspProviderApiConfig.findUnique({
      where: {
        aspProviderId_environment: {
          aspProviderId,
          environment: dto.environment,
        },
      },
    });

    const data = {
      baseUrl: dto.baseUrl,
      loginPath: dto.loginPath,
      invoiceSubmitPath: dto.invoiceSubmitPath,
      statusPath: dto.statusPath,
      timeoutMs: dto.timeoutMs ?? 30_000,
      isActive: dto.isActive ?? true,
    };

    return existing
      ? this.prisma.aspProviderApiConfig.update({
          where: { id: existing.id },
          data,
        })
      : this.prisma.aspProviderApiConfig.create({
          data: {
            aspProviderId,
            environment: dto.environment,
            ...data,
          },
        });
  }

  private async ensureProvider(id: string) {
    const provider = await this.prisma.aspProvider.findUnique({ where: { id } });
    if (!provider) {
      throw new NotFoundException(`ASP provider ${id} was not found.`);
    }
    return provider;
  }
}
