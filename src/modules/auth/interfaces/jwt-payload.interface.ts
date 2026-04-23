export interface JwtPayload {
  /** User's database ID (subject) */
  sub: string;
  tenantId?: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}
