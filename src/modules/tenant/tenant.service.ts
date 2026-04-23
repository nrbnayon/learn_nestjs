import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { name: string; domain?: string }) {
    return (this.prisma as any).tenant.create({ data });
  }

  findAll() {
    return (this.prisma as any).tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  resolveByDomain(domain: string) {
    return (this.prisma as any).tenant.findFirst({ where: { domain } });
  }
}
