import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { SecretsCryptoService } from '../auth/secrets-crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AspConnectionWithProvider,
  AspRuntimeCredentials,
  REGISTERED_ADAPTER_CODES,
} from './asp.types';

const DEFAULT_EVATRA_LOGIN = '/auth/login';
const DEFAULT_EVATRA_STATUS = '/invoice/document-status/{trackingId}';
const DEFAULT_EVATRA_RETRY = '/peppol/tdd/retry-failed';

@Injectable()
export class AspConnectionResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsCryptoService,
  ) {}

  /**
   * Resolve the active ASP connection for a tenant/legal entity.
   * Provider code comes from the stored connection — never from invoice request body.
   */
  async resolveForLegalEntity(params: {
    tenantId: string;
    legalEntityId: string;
    environment?: string;
    connectionId?: string | null;
  }): Promise<AspConnectionWithProvider> {
    const environment = (params.environment ?? 'PRODUCTION').toUpperCase();

    if (params.connectionId) {
      const byId = await this.prisma.aspConnection.findFirst({
        where: {
          id: params.connectionId,
          tenantId: params.tenantId,
          legalEntityId: params.legalEntityId,
        },
        include: {
          aspProvider: true,
          credentials: true,
          legalEntity: true,
        },
      });
      if (!byId) {
        throw new NotFoundException(
          `ASP connection ${params.connectionId} was not found for this tenant/legal entity.`,
        );
      }
      return byId;
    }

    const active = await this.prisma.aspConnection.findMany({
      where: {
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        environment,
        status: 'ACTIVE',
      },
      include: {
        aspProvider: true,
        credentials: true,
        legalEntity: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (active.length > 1) {
      throw new BadRequestException(
        `Legal entity ${params.legalEntityId} has ${active.length} ACTIVE ASP connections for ${environment}. Keep only one active connection or pass an explicit aspConnectionId.`,
      );
    }

    if (active.length === 1) {
      return active[0];
    }

    // Legacy fallback: tenant.asp* fields when no AspConnection row exists yet.
    throw new BadRequestException(
      `No ACTIVE ASP connection for legal entity ${params.legalEntityId} (${environment}). Configure one in ASP Connection Management.`,
    );
  }

  async resolveDefaultLegalEntityId(tenantId: string): Promise<string> {
    const entity = await this.prisma.legalEntity.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!entity) {
      throw new BadRequestException(
        `Tenant ${tenantId} has no active legal entity. Create one before submitting invoices.`,
      );
    }
    return entity.id;
  }

  /**
   * Resolve the legal entity for an invoice:
   * 1) explicit legalEntityCode from payload
   * 2) integration.legalEntityId
   * 3) tenant default active legal entity
   */
  async resolveLegalEntityIdForInvoice(params: {
    tenantId: string;
    legalEntityCode?: string | null;
    integrationLegalEntityId?: string | null;
  }): Promise<string> {
    const code = params.legalEntityCode?.trim();
    if (code) {
      const byCode = await this.prisma.legalEntity.findFirst({
        where: {
          tenantId: params.tenantId,
          code: code.toUpperCase(),
          isActive: true,
        },
      });
      if (!byCode) {
        throw new BadRequestException(
          `Active legal entity code ${code.toUpperCase()} was not found for this tenant.`,
        );
      }
      return byCode.id;
    }

    if (params.integrationLegalEntityId?.trim()) {
      const linked = await this.prisma.legalEntity.findFirst({
        where: {
          id: params.integrationLegalEntityId,
          tenantId: params.tenantId,
          isActive: true,
        },
      });
      if (!linked) {
        throw new BadRequestException(
          `Integration legal entity ${params.integrationLegalEntityId} is missing or inactive for this tenant.`,
        );
      }
      return linked.id;
    }

    return this.resolveDefaultLegalEntityId(params.tenantId);
  }

  toRuntime(
    connection: AspConnectionWithProvider,
    tenantFallback?: Tenant | null,
  ): AspRuntimeCredentials {
    const providerCode = connection.aspProvider.code.toUpperCase();
    if (
      !REGISTERED_ADAPTER_CODES.includes(
        providerCode as (typeof REGISTERED_ADAPTER_CODES)[number],
      )
    ) {
      throw new BadRequestException(
        `ASP provider ${providerCode} has no registered backend adapter. Activating a provider in the database does not implement its API.`,
      );
    }

    if (connection.aspProvider.status !== 'ACTIVE' && providerCode !== 'MOCK_ASP_B') {
      throw new BadRequestException(
        `ASP provider ${providerCode} is not ACTIVE.`,
      );
    }

    const credentials: Record<string, string> = {};
    for (const row of connection.credentials) {
      const plain = this.secrets.decrypt(row.valueEncrypted);
      if (plain != null && plain !== '') {
        credentials[row.key] = plain;
      }
    }

    // Legacy email/apiKey may still live on tenant during migration.
    if (!credentials.apiKey && tenantFallback?.aspApiKey) {
      credentials.apiKey = this.secrets.decrypt(tenantFallback.aspApiKey) ?? '';
    }
    if (!credentials.email && tenantFallback?.email) {
      credentials.email = tenantFallback.email;
    }

    return {
      connectionId: connection.id,
      tenantId: connection.tenantId,
      legalEntityId: connection.legalEntityId,
      providerCode,
      environment: connection.environment,
      origin: '',
      submitUrl: '',
      loginPath: DEFAULT_EVATRA_LOGIN,
      statusPathTemplate: DEFAULT_EVATRA_STATUS,
      retryTddPath: DEFAULT_EVATRA_RETRY,
      timeoutMs: 30_000,
      credentials,
    };
  }

  async toRuntimeWithApiConfig(
    connection: AspConnectionWithProvider,
    tenantFallback?: Tenant | null,
  ): Promise<AspRuntimeCredentials> {
    const runtime = this.toRuntime(connection, tenantFallback);
    const apiConfig = await this.prisma.aspProviderApiConfig.findFirst({
      where: {
        aspProviderId: connection.aspProviderId,
        environment: connection.environment,
        isActive: true,
      },
    });
    if (!apiConfig) {
      throw new BadRequestException(
        `No active ASP API config for provider ${runtime.providerCode} (${connection.environment}). Configure it under ASP Providers.`,
      );
    }

    if (apiConfig.loginPath) runtime.loginPath = apiConfig.loginPath;
    if (apiConfig.statusPath) runtime.statusPathTemplate = apiConfig.statusPath;
    if (apiConfig.timeoutMs) runtime.timeoutMs = apiConfig.timeoutMs;

    const baseUrl = apiConfig.baseUrl?.trim();
    const invoiceSubmitPath = apiConfig.invoiceSubmitPath?.trim();
    if (!baseUrl || !invoiceSubmitPath) {
      throw new BadRequestException(
        `ASP API config for ${runtime.providerCode} (${connection.environment}) needs baseUrl and invoiceSubmitPath.`,
      );
    }

    try {
      runtime.origin = new URL(baseUrl).origin;
      runtime.submitUrl = new URL(invoiceSubmitPath, baseUrl).toString();
    } catch {
      throw new BadRequestException(
        `ASP API config for ${runtime.providerCode} (${connection.environment}) has an invalid baseUrl or invoiceSubmitPath.`,
      );
    }

    return runtime;
  }

  /**
   * Build runtime from legacy tenant ASP columns when AspConnection is absent.
   * Used only as a temporary compatibility path.
   */
  legacyTenantRuntime(tenant: Tenant): AspRuntimeCredentials {
    const url = tenant.aspBaseUrl?.trim();
    if (!url) {
      throw new BadRequestException(
        `Tenant ${tenant.code} has no aspBaseUrl and no AspConnection.`,
      );
    }
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      throw new BadRequestException(`Tenant ${tenant.code} aspBaseUrl is invalid.`);
    }
    const apiKey = this.secrets.decrypt(tenant.aspApiKey)?.trim() ?? '';
    const email = tenant.email?.trim() ?? '';
    const providerCode =
      tenant.aspProvider?.toUpperCase() === 'FAKE'
        ? 'EVATRA'
        : (tenant.aspProvider?.toUpperCase() || 'EVATRA');

    return {
      connectionId: `legacy:${tenant.id}`,
      tenantId: tenant.id,
      legalEntityId: '',
      providerCode: providerCode === 'GENERIC' ? 'EVATRA' : providerCode,
      environment: 'PRODUCTION',
      origin,
      submitUrl: url,
      loginPath: DEFAULT_EVATRA_LOGIN,
      statusPathTemplate: DEFAULT_EVATRA_STATUS,
      retryTddPath: DEFAULT_EVATRA_RETRY,
      timeoutMs: 30_000,
      credentials: { apiKey, email },
    };
  }
}
