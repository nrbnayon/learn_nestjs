export interface AuthenticatedUser {
  id: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  username?: string;
  avatar?: string | null;
  role?: string;
  status?: string;
  tenantId?: string | null;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  roles?: string[];
  permissions?: string[];
}
