import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionService } from './permission.service';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  create(
    @Body() dto: { action: string; subject: string; description?: string },
  ) {
    return this.permissionService.create(dto);
  }

  @Get()
  findAll() {
    return this.permissionService.findAll();
  }
}
