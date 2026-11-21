import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto';

@Injectable()
export class LegalEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateLegalEntityDto) {
    await this.ensureTenant(tenantId);
    try {
      return await this.prisma.legalEntity.create({
        data: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          trn: dto.trn,
          email: dto.email,
          isActive: dto.isActive ?? true,
        },
        include: {
          aspConnections: {
            include: { aspProvider: true },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Legal entity code ${dto.code.toUpperCase()} already exists for this tenant.`,
        );
      }
      throw error;
    }
  }

  async findAll(tenantId: string) {
    await this.ensureTenant(tenantId);
    return this.prisma.legalEntity.findMany({
      where: { tenantId },
      include: {
        aspConnections: {
          include: { aspProvider: true },
        },
        _count: { select: { invoices: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const entity = await this.prisma.legalEntity.findFirst({
      where: { id, tenantId },
      include: {
        aspConnections: {
          include: { aspProvider: true },
        },
        _count: { select: { invoices: true } },
      },
    });
    if (!entity) {
      throw new NotFoundException(
        `Legal entity ${id} was not found for tenant ${tenantId}.`,
      );
    }
    return entity;
  }

  async update(tenantId: string, id: string, dto: UpdateLegalEntityDto) {
    await this.findOne(tenantId, id);
    return this.prisma.legalEntity.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        trn: dto.trn,
        email: dto.email,
        isActive: dto.isActive,
      },
      include: {
        aspConnections: {
          include: { aspProvider: true },
        },
      },
    });
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found.`);
    }
    return tenant;
  }
}
