import {
  BadRequestException,
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

const legalEntityInclude = {
  legalEntity: {
    select: {
      id: true,
      code: true,
      name: true,
      trn: true,
      isActive: true,
    },
  },
} as const;

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsCryptoService,
  ) {}

  async create(tenantId: string, dto: CreateIntegrationDto) {
    await this.assertTenantExists(tenantId);
    const legalEntityId = await this.resolveLegalEntityId(
      tenantId,
      dto.legalEntityId,
    );

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
          legalEntityId,
        },
        include: legalEntityInclude,
      });

      // Return plaintext key + secret once (list/update responses stay masked)
      return {
        ...this.maskSecrets(created),
        apiKey,
        apiSecret: apiSecretPlain,
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
      include: legalEntityInclude,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.maskSecrets(row));
  }

  async findOne(tenantId: string, integrationId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, tenantId },
      include: {
        ...legalEntityInclude,
        _count: { select: { invoices: true } },
      },
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

    let legalEntityId: string | undefined;
    if (dto.legalEntityId !== undefined) {
      legalEntityId = await this.resolveLegalEntityId(
        tenantId,
        dto.legalEntityId,
      );
    }

    const updated = await this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        name: dto.name,
        isActive: dto.isActive,
        ...(legalEntityId !== undefined ? { legalEntityId } : {}),
      },
      include: legalEntityInclude,
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
      include: legalEntityInclude,
    });

    return {
      ...this.maskSecrets(updated),
      apiKey,
      apiSecret: apiSecretPlain,
    };
  }

  private async resolveLegalEntityId(
    tenantId: string,
    legalEntityId?: string,
  ): Promise<string> {
    if (legalEntityId?.trim()) {
      const entity = await this.prisma.legalEntity.findFirst({
        where: { id: legalEntityId.trim(), tenantId, isActive: true },
      });
      if (!entity) {
        throw new BadRequestException(
          `Legal entity ${legalEntityId} was not found or is inactive for this tenant.`,
        );
      }
      return entity.id;
    }

    const fallback = await this.prisma.legalEntity.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!fallback) {
      throw new BadRequestException(
        'Create an active legal entity for this tenant before adding a source system.',
      );
    }
    return fallback.id;
  }

  private maskSecrets<T extends { apiKey: string; apiSecret: string }>(row: T) {
    return {
      ...row,
      apiKey: this.secrets.mask(row.apiKey, 12) ?? row.apiKey,
      apiSecret: this.secrets.mask(row.apiSecret, 8) ?? '****',
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
