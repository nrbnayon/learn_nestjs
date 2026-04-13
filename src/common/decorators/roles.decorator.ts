import { SetMetadata } from '@nestjs/common';
import { Role, ROLES_KEY } from '../constants/roles.constant';

/**
 * Marks a route as restricted to specific roles.
 *
 * Usage: @Roles(Role.ADMIN)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Marks a route as public (bypasses JWT guard).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
