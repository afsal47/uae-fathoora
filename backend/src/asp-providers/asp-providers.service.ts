import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AspProviderResolverService } from '../asp/asp-provider-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAspProviderDto } from './dto/create-asp-provider.dto';
import { UpdateAspProviderDto } from './dto/update-asp-provider.dto';

@Injectable()
export class AspProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: AspProviderResolverService,
  ) {}

  async create(dto: CreateAspProviderDto) {
    try {
      const provider = await this.prisma.aspProvider.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          status: dto.status ?? 'INACTIVE',
        },
        include: { apiConfigs: true },
      });
      return this.withReadiness(provider);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `ASP provider code ${dto.code.toUpperCase()} already exists.`,
        );
      }
      throw error;
    }
  }

  async findAll() {
    const rows = await this.prisma.aspProvider.findMany({
      include: { apiConfigs: true, _count: { select: { connections: true } } },
      orderBy: { code: 'asc' },
    });
    return rows.map((row) => this.withReadiness(row));
  }

  async findOne(id: string) {
    const provider = await this.prisma.aspProvider.findUnique({
      where: { id },
      include: {
        apiConfigs: true,
        _count: { select: { connections: true } },
      },
    });
    if (!provider) {
      throw new NotFoundException(`ASP provider ${id} was not found.`);
    }
    return this.withReadiness(provider);
  }

  async update(id: string, dto: UpdateAspProviderDto) {
    await this.findOne(id);
    const provider = await this.prisma.aspProvider.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        status: dto.status,
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
      },
      include: { apiConfigs: true, _count: { select: { connections: true } } },
    });
    return this.withReadiness(provider);
  }

  private withReadiness<T extends { code: string; status: string }>(provider: T) {
    const adapterRegistered = this.resolver.isRegistered(provider.code);
    return {
      ...provider,
      adapterRegistered,
      integrationReady: provider.status === 'ACTIVE' && adapterRegistered,
      integrationImplementationStatus: adapterRegistered
        ? provider.code.toUpperCase() === 'MOCK_ASP_B'
          ? 'SCAFFOLD'
          : 'IMPLEMENTED'
        : 'NOT_IMPLEMENTED',
    };
  }
}
