import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleService } from './role.service';

@ApiTags('roles')
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  create(@Body() dto: { name: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER'; tenantId?: string | null }) {
    return this.roleService.create(dto);
  }

  @Post(':roleId/permissions/:permissionId')
  assignPermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    return this.roleService.assignPermission(roleId, permissionId);
  }

  @Post(':roleId/users/:userId')
  assignToUser(@Param('roleId') roleId: string, @Param('userId') userId: string) {
    return this.roleService.assignToUser(roleId, userId);
  }

  @Get()
  findAll() {
    return this.roleService.findAll();
  }
}
