import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsCryptoService,
  ) {}

  async create(tenantId: string, dto: CreateIntegrationDto) {
    await this.assertTenantExists(tenantId);

    const apiKey = `key_${randomBytes(24).toString('hex')}`;
    const apiSecretPlain = `secret_${randomBytes(32).toString('hex')}`;

    try {
      const created = await this.prisma.integration.create({
        data: {
          tenantId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          authType: dto.authType ?? 'API_KEY_HMAC',
          apiKey,
          apiSecret: this.secrets.encrypt(apiSecretPlain)!,
          webhookUrl: dto.webhookUrl,
          webhookSecret: this.secrets.encrypt(dto.webhookSecret) ?? null,
          allowedIpRanges: dto.allowedIpRanges,
        },
      });

      // Return plaintext secret once (not stored that way in DB)
      return {
        ...created,
        apiSecret: apiSecretPlain,
        webhookSecret: dto.webhookSecret ?? null,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Integration ${dto.code.toUpperCase()} already exists for this tenant.`,
        );
      }
      throw error;
    }
  }

  async findAllByTenant(tenantId: string) {
    await this.assertTenantExists(tenantId);

    const rows = await this.prisma.integration.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.maskSecrets(row));
  }

  async findOne(tenantId: string, integrationId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, tenantId },
      include: { _count: { select: { invoices: true } } },
    });

    if (!integration) {
      throw new NotFoundException(
        `Integration ${integrationId} was not found for this tenant.`,
      );
    }

    return this.maskSecrets(integration);
  }

  async update(
    tenantId: string,
    integrationId: string,
    dto: UpdateIntegrationDto,
  ) {
    await this.findOne(tenantId, integrationId);

    const updated = await this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        name: dto.name,
        webhookUrl: dto.webhookUrl,
        webhookSecret:
          dto.webhookSecret !== undefined
            ? this.secrets.encrypt(dto.webhookSecret)
            : undefined,
        allowedIpRanges: dto.allowedIpRanges,
        isActive: dto.isActive,
      },
    });

    return this.maskSecrets(updated);
  }

  async regenerateKeys(tenantId: string, integrationId: string) {
    await this.findOne(tenantId, integrationId);

    const apiKey = `key_${randomBytes(24).toString('hex')}`;
    const apiSecretPlain = `secret_${randomBytes(32).toString('hex')}`;

    const updated = await this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        apiKey,
        apiSecret: this.secrets.encrypt(apiSecretPlain)!,
      },
    });

    return {
      ...updated,
      apiSecret: apiSecretPlain,
    };
  }

  private maskSecrets<
    T extends { apiKey: string; apiSecret: string; webhookSecret?: string | null },
  >(row: T) {
    return {
      ...row,
      apiKey: this.secrets.mask(row.apiKey, 12) ?? row.apiKey,
      apiSecret: this.secrets.mask(row.apiSecret, 8) ?? '****',
      webhookSecret: row.webhookSecret
        ? this.secrets.mask(row.webhookSecret, 8)
        : null,
    };
  }

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found.`);
    }
  }
}
