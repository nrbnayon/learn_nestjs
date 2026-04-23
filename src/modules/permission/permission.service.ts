import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { action: string; subject: string; description?: string }) {
    return (this.prisma as any).permission.create({ data });
  }

  findAll() {
    return (this.prisma as any).permission.findMany({
      orderBy: [{ subject: 'asc' }, { action: 'asc' }],
    });
  }
}
