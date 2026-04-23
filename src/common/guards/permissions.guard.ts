import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  PERMISSION_KEY,
  RESOURCE_OWNER_PARAM_KEY,
} from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as {
      id: string;
      roles?: string[];
      permissions?: string[];
    };

    if (!user) {
      throw new ForbiddenException('User context missing');
    }

    const userPermissions = new Set(user.permissions ?? []);
    const hasPermission = required.every((permission) =>
      userPermissions.has(permission),
    );

    if (hasPermission) {
      return true;
    }

    const ownerParam = this.reflector.getAllAndOverride<string>(
      RESOURCE_OWNER_PARAM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (ownerParam) {
      const ownerId =
        request.params?.[ownerParam] ??
        request.body?.[ownerParam] ??
        request.query?.[ownerParam];

      const roles = new Set(
        (user.roles ?? []).map((role) => role.toLowerCase()),
      );

      if (
        ownerId === user.id ||
        roles.has('admin') ||
        roles.has('super_admin')
      ) {
        return true;
      }
    }

    throw new ForbiddenException('Missing required permissions');
  }
}
