import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    name: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
    tenantId?: string | null;
  }) {
    return this.prisma.appRole.create({ data });
  }

  assignPermission(roleId: string, permissionId: string) {
    return this.prisma.rolePermission.create({
      data: { roleId, permissionId },
    });
  }

  assignToUser(roleId: string, userId: string) {
    return this.prisma.userRole.create({
      data: { roleId, userId },
    });
  }

  findAll() {
    return this.prisma.appRole.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
  }
}
