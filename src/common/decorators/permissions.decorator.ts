import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permissions';
export const RESOURCE_OWNER_PARAM_KEY = 'resourceOwnerParam';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions);

export const ResourceOwnerParam = (paramName: string) =>
  SetMetadata(RESOURCE_OWNER_PARAM_KEY, paramName);
