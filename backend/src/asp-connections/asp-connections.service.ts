import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import { AspConnectionResolverService } from '../asp/asp-connection-resolver.service';
import { AspProviderResolverService } from '../asp/asp-provider-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAspConnectionDto } from './dto/create-asp-connection.dto';
import { UpdateAspConnectionDto } from './dto/update-asp-connection.dto';

@Injectable()
export class AspConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsCryptoService,
    private readonly connectionResolver: AspConnectionResolverService,
    private readonly providerResolver: AspProviderResolverService,
  ) {}

  async create(tenantId: string, dto: CreateAspConnectionDto) {
    await this.ensureTenant(tenantId);
    const legalEntity = await this.prisma.legalEntity.findFirst({
      where: { id: dto.legalEntityId, tenantId },
    });
    if (!legalEntity) {
      throw new NotFoundException(
        `Legal entity ${dto.legalEntityId} was not found for this tenant.`,
      );
    }

    const provider = await this.prisma.aspProvider.findUnique({
      where: { id: dto.aspProviderId },
    });
    if (!provider) {
      throw new NotFoundException(`ASP provider ${dto.aspProviderId} was not found.`);
    }

    const status = dto.status ?? 'INACTIVE';
    if (status === 'ACTIVE') {
      if (!this.providerResolver.isRegistered(provider.code)) {
        throw new BadRequestException(
          `Cannot activate connection: provider ${provider.code} has no registered backend adapter.`,
        );
      }
      await this.deactivateOtherActive(
        tenantId,
        dto.legalEntityId,
        dto.environment,
      );
    }

    const connection = await this.prisma.aspConnection.create({
      data: {
        tenantId,
        legalEntityId: dto.legalEntityId,
        aspProviderId: dto.aspProviderId,
        environment: dto.environment,
        status,
        credentials: dto.credentials
          ? {
              create: Object.entries(dto.credentials)
                .filter(([, v]) => typeof v === 'string' && v.trim())
                .map(([key, value]) => ({
                  key,
                  valueEncrypted: this.secrets.encrypt(value.trim())!,
                })),
            }
          : undefined,
      },
      include: {
        aspProvider: true,
        legalEntity: true,
        credentials: true,
      },
    });

    return this.maskConnection(connection);
  }

  async findAll(tenantId: string, legalEntityId?: string) {
    await this.ensureTenant(tenantId);
    const rows = await this.prisma.aspConnection.findMany({
      where: {
        tenantId,
        ...(legalEntityId ? { legalEntityId } : {}),
      },
      include: {
        aspProvider: true,
        legalEntity: true,
        credentials: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.maskConnection(row));
  }

  async findOne(tenantId: string, id: string) {
    const connection = await this.prisma.aspConnection.findFirst({
      where: { id, tenantId },
      include: {
        aspProvider: true,
        legalEntity: true,
        credentials: true,
      },
    });
    if (!connection) {
      throw new NotFoundException(
        `ASP connection ${id} was not found for tenant ${tenantId}.`,
      );
    }
    return this.maskConnection(connection);
  }

  async update(tenantId: string, id: string, dto: UpdateAspConnectionDto) {
    const existing = await this.prisma.aspConnection.findFirst({
      where: { id, tenantId },
      include: { aspProvider: true, credentials: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `ASP connection ${id} was not found for tenant ${tenantId}.`,
      );
    }

    const nextEnvironment = dto.environment ?? existing.environment;
    const nextStatus = dto.status ?? existing.status;

    if (nextStatus === 'ACTIVE') {
      if (!this.providerResolver.isRegistered(existing.aspProvider.code)) {
        throw new BadRequestException(
          `Cannot activate connection: provider ${existing.aspProvider.code} has no registered backend adapter.`,
        );
      }
      await this.deactivateOtherActive(
        tenantId,
        existing.legalEntityId,
        nextEnvironment,
        id,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.credentials) {
        for (const [key, value] of Object.entries(dto.credentials)) {
          if (typeof value !== 'string' || !value.trim()) continue;
          const encrypted = this.secrets.encrypt(value.trim())!;
          await tx.aspCredential.upsert({
            where: {
              aspConnectionId_key: { aspConnectionId: id, key },
            },
            create: {
              aspConnectionId: id,
              key,
              valueEncrypted: encrypted,
            },
            update: { valueEncrypted: encrypted },
          });
        }
      }

      return tx.aspConnection.update({
        where: { id },
        data: {
          ...(dto.environment !== undefined
            ? { environment: dto.environment }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: {
          aspProvider: true,
          legalEntity: true,
          credentials: true,
        },
      });
    });

    return this.maskConnection(updated);
  }

  async testConnection(tenantId: string, id: string) {
    const connection = await this.prisma.aspConnection.findFirst({
      where: { id, tenantId },
      include: {
        aspProvider: true,
        credentials: true,
        legalEntity: true,
      },
    });
    if (!connection) {
      throw new NotFoundException(
        `ASP connection ${id} was not found for tenant ${tenantId}.`,
      );
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const runtime = await this.connectionResolver.toRuntimeWithApiConfig(
      connection,
      tenant,
    );
    const adapter = this.providerResolver.resolve(runtime.providerCode);
    if (!adapter.testConnection) {
      throw new BadRequestException(
        `Provider ${runtime.providerCode} does not support connection tests.`,
      );
    }

    const result = await adapter.testConnection(runtime);
    await this.prisma.aspConnection.update({
      where: { id },
      data: {
        lastTestAt: new Date(),
        lastTestStatus: result.ok ? 'OK' : 'FAILED',
      },
    });

    return {
      ok: result.ok,
      message: result.message,
      testedAt: new Date().toISOString(),
      // Never return credentials or tokens
    };
  }

  private async deactivateOtherActive(
    tenantId: string,
    legalEntityId: string,
    environment: string,
    exceptId?: string,
  ) {
    await this.prisma.aspConnection.updateMany({
      where: {
        tenantId,
        legalEntityId,
        environment,
        status: 'ACTIVE',
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      data: { status: 'INACTIVE' },
    });
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found.`);
    }
    return tenant;
  }

  private maskConnection<
    T extends {
      credentials?: Array<{ key: string; valueEncrypted: string }>;
      aspProvider?: { code: string };
    },
  >(connection: T) {
    const { credentials, ...rest } = connection;
    return {
      ...rest,
      adapterRegistered: connection.aspProvider
        ? this.providerResolver.isRegistered(connection.aspProvider.code)
        : false,
      credentialKeys: (credentials ?? []).map((c) => c.key),
      // Never expose decrypted or encrypted secret values
    };
  }
}
