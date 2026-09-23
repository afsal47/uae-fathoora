import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsCryptoService,
  ) {}

  async create(dto: CreateTenantDto) {
    try {
      const tenant = await this.prisma.tenant.create({
        data: {
          code: dto.code.toUpperCase(),
          name: dto.name,
          trn: dto.trn,
          email: dto.email,
          phone: dto.phone,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          countryCode: dto.countryCode ?? 'AE',
          aspProvider: dto.aspProvider?.toUpperCase() ?? 'FAKE',
          aspBaseUrl: dto.aspBaseUrl,
          aspApiKey: this.secrets.encrypt(dto.aspApiKey) ?? null,
          aspWebhookToken: this.secrets.encrypt(dto.aspWebhookToken) ?? null,
        },
        include: { integrations: true },
      });
      return this.maskTenant(tenant);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Tenant with code ${dto.code.toUpperCase()} already exists.`,
        );
      }
      throw error;
    }
  }

  async findAll() {
    const tenants = await this.prisma.tenant.findMany({
      include: { integrations: true },
      orderBy: { createdAt: 'desc' },
    });
    return tenants.map((t) => this.maskTenant(t));
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        integrations: true,
        _count: { select: { invoices: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} was not found.`);
    }

    return this.maskTenant(tenant);
  }

  async findByCode(code: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        integrations: true,
        _count: { select: { invoices: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with code ${code} was not found.`);
    }

    return this.maskTenant(tenant);
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        trn: dto.trn,
        email: dto.email,
        phone: dto.phone,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        countryCode: dto.countryCode,
        aspProvider: dto.aspProvider?.toUpperCase(),
        aspBaseUrl: dto.aspBaseUrl,
        aspApiKey:
          dto.aspApiKey !== undefined
            ? this.secrets.encrypt(dto.aspApiKey)
            : undefined,
        aspWebhookToken:
          dto.aspWebhookToken !== undefined
            ? this.secrets.encrypt(dto.aspWebhookToken)
            : undefined,
        isActive: dto.isActive,
      },
      include: { integrations: true },
    });

    return this.maskTenant(tenant);
  }

  private maskTenant<
    T extends {
      aspApiKey?: string | null;
      aspWebhookToken?: string | null;
      integrations?: Array<{
        apiKey: string;
        apiSecret: string;
        webhookSecret?: string | null;
      }>;
    },
  >(tenant: T) {
    return {
      ...tenant,
      aspApiKey: tenant.aspApiKey
        ? this.secrets.mask(tenant.aspApiKey, 6)
        : null,
      aspWebhookToken: tenant.aspWebhookToken
        ? this.secrets.mask(tenant.aspWebhookToken, 6)
        : null,
      integrations: tenant.integrations?.map((i) => ({
        ...i,
        apiKey: this.secrets.mask(i.apiKey, 12) ?? i.apiKey,
        apiSecret: this.secrets.mask(i.apiSecret, 8) ?? '****',
        webhookSecret: i.webhookSecret
          ? this.secrets.mask(i.webhookSecret, 8)
          : null,
      })),
    };
  }
}
