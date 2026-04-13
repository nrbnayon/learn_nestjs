export interface JwtPayload {
  /** User's database ID (subject) */
  sub: string;
  email: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}
