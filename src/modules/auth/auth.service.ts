import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { JwtHelperService, TokenPair } from '../../shared/jwt.service';
import { MailService } from '../../shared/mail.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  OtpSendDto,
  OtpVerifyDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;
const OTP_TTL_SECONDS = 5 * 60;
const LOGIN_LIMIT_WINDOW_SECONDS = 60;
const LOGIN_LIMIT_MAX_ATTEMPTS = 10;

interface AuthContext {
  tenantId?: string;
  tenantDomain?: string;
  userAgent?: string;
  ipAddress?: string;
  accessToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtHelper: JwtHelperService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto, ctx: AuthContext = {}) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    const tenantId = await this.resolveTenantId(ctx.tenantId, ctx.tenantDomain);
    const username = await this.resolveUsername(dto.username, dto.fullName);

    await this.ensureNoDuplicateIdentity({
      email: dto.email,
      phone: dto.phone,
      username,
    });

    const password = dto.password
      ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
      : null;

    const emailVerifyToken = dto.email
      ? this.jwtHelper.generateSecureToken()
      : null;

    const prismaUnsafe = this.prisma as any;
    const user = await prismaUnsafe.user.create({
      data: {
        fullName: dto.fullName,
        username,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        password,
        role: 'USER',
        tenantId,
        emailVerifyToken,
        status: 'ACTIVE',
      },
    });

    await this.ensureDefaultRole(user.id, tenantId);

    if (dto.email && emailVerifyToken) {
      await this.sendEmailVerification(dto.email, dto.fullName, emailVerifyToken);
    }

    await this.audit('auth.user.created', user.id, tenantId, {
      username: user.username,
      email: user.email,
    }, ctx);

    const tokens = await this.issueTokens(user.id, tenantId, ctx);
    return { user: this.sanitizeUser(user), tokens };
  }

  async login(dto: LoginDto, ctx: AuthContext = {}) {
    await this.enforceLoginRateLimit(dto.identifier, ctx.tenantId);

    if (dto.provider) {
      return this.loginWithOAuthProvider(dto, ctx);
    }

    if (dto.otp) {
      return this.loginWithOtp(dto, ctx);
    }

    if (!dto.password) {
      throw new BadRequestException('Password is required for this login method');
    }

    const tenantId = await this.resolveTenantId(ctx.tenantId, ctx.tenantDomain);
    const user = await this.findUserByIdentifier(dto.identifier, tenantId);

    if (!user?.password) {
      throw new UnauthorizedException('Password login is not enabled for this account');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'BANNED') {
      throw new UnauthorizedException('This account is banned');
    }

    await this.touchPresence(user.id, true);
    const tokens = await this.issueTokens(user.id, tenantId, ctx);

    await this.audit('auth.user.login', user.id, tenantId, {
      method: 'password',
      identifier: dto.identifier,
    }, ctx);

    return {
      user: await this.getSafeUserById(user.id),
      tokens,
    };
  }

  async sendOtp(dto: OtpSendDto, ctx: AuthContext = {}) {
    const tenantId = await this.resolveTenantId(dto.tenantId ?? ctx.tenantId, ctx.tenantDomain);
    const identifier = dto.identifier.trim();
    const otp = dto.channel === 'phone' ? '123456' : this.jwtHelper.generateOtpCode(6);
    const key = this.otpKey(dto.channel, identifier, tenantId);

    await this.redisService.setJson(
      key,
      {
        identifier,
        channel: dto.channel,
        code: otp,
        tenantId,
        createdAt: new Date().toISOString(),
      },
      OTP_TTL_SECONDS,
    );

    if (dto.channel === 'email') {
      await this.mailService.sendMail({
        to: identifier,
        subject: 'Your OTP Code',
        html: `<p>Your OTP is <strong>${otp}</strong>. It expires in 5 minutes.</p>`,
      });
    }

    return {
      success: true,
      channel: dto.channel,
      expiresIn: OTP_TTL_SECONDS,
      ...(dto.channel === 'phone' ? { otp } : {}),
    };
  }

  async verifyOtp(dto: OtpVerifyDto, ctx: AuthContext = {}) {
    const tenantId = await this.resolveTenantId(dto.tenantId ?? ctx.tenantId, ctx.tenantDomain);

    const emailOtp = await this.redisService.getJson<{ code: string }>(
      this.otpKey('email', dto.identifier, tenantId),
    );
    const phoneOtp = await this.redisService.getJson<{ code: string }>(
      this.otpKey('phone', dto.identifier, tenantId),
    );

    const stored = emailOtp ?? phoneOtp;
    if (!stored || stored.code !== dto.otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.findUserByIdentifier(dto.identifier, tenantId);
    if (!user) {
      throw new NotFoundException('User not found for OTP identifier');
    }

    await this.redisService.del(this.otpKey('email', dto.identifier, tenantId));
    await this.redisService.del(this.otpKey('phone', dto.identifier, tenantId));
    await this.touchPresence(user.id, true);

    const tokens = await this.issueTokens(user.id, tenantId, ctx);
    await this.audit('auth.user.login', user.id, tenantId, {
      method: 'otp',
      identifier: dto.identifier,
    }, ctx);

    return {
      user: await this.getSafeUserById(user.id),
      tokens,
    };
  }

  async logout(userId: string, ctx: AuthContext = {}): Promise<void> {
    await this.revokeUserSessions(userId);

    if (ctx.accessToken) {
      await this.blacklistAccessToken(ctx.accessToken);
    }

    await this.touchPresence(userId, false);
    await this.audit('auth.user.logout', userId, ctx.tenantId, {}, ctx);
  }

  async refreshTokens(dto: RefreshTokenDto, ctx: AuthContext = {}): Promise<TokenPair> {
    let payload: any;
    try {
      payload = this.jwtHelper.verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const hashed = this.hashToken(dto.refreshToken);
    const key = this.refreshSessionKey(payload.sub, hashed);
    const exists = await this.redisService.exists(key);
    if (!exists) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    const tokens = await this.issueTokens(payload.sub, payload.tenantId, ctx);
    await this.redisService.del(key);
    return tokens;
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const user = await (this.prisma as any).user.findFirst({
      where: { emailVerifyToken: dto.token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await (this.prisma as any).user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
        status: 'ACTIVE',
      },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await (this.prisma as any).user.findFirst({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      return;
    }

    const resetToken = this.jwtHelper.generateSecureToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await (this.prisma as any).user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3001');
    await this.mailService.sendMail({
      to: user.email,
      subject: 'Reset Password',
      html: `<p>Hello ${user.fullName}, reset link: ${baseUrl}/auth/reset-password?token=${resetToken}</p>`,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await (this.prisma as any).user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await (this.prisma as any).user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await this.revokeUserSessions(user.id);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('Password is not set for this account');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await (this.prisma as any).user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });

    await this.revokeUserSessions(userId);
  }

  async getMe(userId: string) {
    return this.getSafeUserById(userId);
  }

  private async issueTokens(userId: string, tenantId: string | null, ctx: AuthContext): Promise<TokenPair> {
    const { roles, permissions } = await this.buildAuthorizationClaims(userId);

    const tokens = this.jwtHelper.generateTokenPair({
      sub: userId,
      tenantId: tenantId ?? undefined,
      roles,
      permissions,
    });

    const refreshHash = this.hashToken(tokens.refreshToken);
    const refreshTtl = this.getRefreshTtlSeconds();

    await this.redisService.setJson(
      this.refreshSessionKey(userId, refreshHash),
      {
        userId,
        tenantId,
        refreshTokenHash: refreshHash,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
      },
      refreshTtl,
    );

    await this.redisService.set(
      `refresh_token:${userId}`,
      tokens.refreshToken,
      refreshTtl,
    );

    return tokens;
  }

  private async buildAuthorizationClaims(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    const roleSet = new Set<string>();
    if (user?.role) {
      roleSet.add(String(user.role).toLowerCase());
    }

    for (const role of user?.roles ?? []) {
      if (role?.role?.name) {
        roleSet.add(String(role.role.name).toLowerCase());
      }
    }

    const permissionSet = new Set<string>();
    for (const role of user?.roles ?? []) {
      for (const permission of role?.role?.permissions ?? []) {
        if (permission?.permission?.action && permission?.permission?.subject) {
          permissionSet.add(`${permission.permission.action}:${permission.permission.subject}`);
        }
      }
    }

    for (const permission of user?.permissions ?? []) {
      if (permission?.permission?.action && permission?.permission?.subject) {
        permissionSet.add(`${permission.permission.action}:${permission.permission.subject}`);
      }
    }

    return {
      roles: [...roleSet],
      permissions: [...permissionSet],
    };
  }

  private async loginWithOtp(dto: LoginDto, ctx: AuthContext) {
    return this.verifyOtp(
      {
        identifier: dto.identifier,
        otp: dto.otp!,
        tenantId: ctx.tenantId,
      },
      ctx,
    );
  }

  private async loginWithOAuthProvider(dto: LoginDto, ctx: AuthContext) {
    const tenantId = await this.resolveTenantId(ctx.tenantId, ctx.tenantDomain);
    const account = await (this.prisma as any).oAuthAccount.findFirst({
      where: {
        provider: dto.provider,
        providerAccountId: dto.identifier,
      },
      include: { user: true },
    });

    if (!account?.user) {
      throw new UnauthorizedException('OAuth account is not connected');
    }

    const tokens = await this.issueTokens(account.user.id, tenantId, ctx);
    await this.audit('auth.user.login', account.user.id, tenantId, {
      method: 'oauth',
      provider: dto.provider,
    }, ctx);

    return {
      user: this.sanitizeUser(account.user),
      tokens,
    };
  }

  private async enforceLoginRateLimit(identifier: string, tenantId?: string) {
    const key = `auth:rate:${tenantId ?? 'global'}:${identifier.toLowerCase()}`;
    const attempts = await this.redisService.incr(key);
    if (attempts === 1) {
      await this.redisService.expire(key, LOGIN_LIMIT_WINDOW_SECONDS);
    }

    if (attempts > LOGIN_LIMIT_MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async resolveTenantId(tenantId?: string, tenantDomain?: string): Promise<string | null> {
    if (tenantId) {
      return tenantId;
    }

    if (!tenantDomain) {
      return null;
    }

    const tenant = await (this.prisma as any).tenant.findFirst({
      where: { domain: tenantDomain },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant could not be resolved');
    }

    return tenant.id;
  }

  private async resolveUsername(providedUsername: string | undefined, fullName: string): Promise<string> {
    const base = (providedUsername?.trim() || this.slugify(fullName)).toLowerCase();

    let candidate = base;
    let tries = 0;

    while (tries < 10) {
      const existing = await (this.prisma as any).user.findFirst({
        where: { username: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      tries += 1;
    }

    throw new ConflictException('Unable to generate a unique username');
  }

  private async ensureNoDuplicateIdentity(identity: {
    email?: string;
    phone?: string;
    username?: string;
  }) {
    const whereOr: Record<string, string>[] = [];

    if (identity.email) {
      whereOr.push({ email: identity.email.toLowerCase() });
    }

    if (identity.phone) {
      whereOr.push({ phone: identity.phone });
    }

    if (identity.username) {
      whereOr.push({ username: identity.username.toLowerCase() });
    }

    if (!whereOr.length) {
      return;
    }

    const existing = await (this.prisma as any).user.findFirst({
      where: { OR: whereOr },
    });

    if (existing) {
      throw new ConflictException('User identity already exists');
    }
  }

  private async ensureDefaultRole(userId: string, tenantId: string | null) {
    const prismaUnsafe = this.prisma as any;

    try {
      let role = await prismaUnsafe.appRole.findFirst({
        where: { name: 'USER', tenantId },
      });

      if (!role) {
        role = await prismaUnsafe.appRole.create({
          data: { name: 'USER', tenantId },
        });
      }

      await prismaUnsafe.userRole.create({
        data: {
          userId,
          roleId: role.id,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Default role assignment failed: ${message}`);
    }
  }

  private async getSafeUserById(userId: string) {
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        tenantId: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const claims = await this.buildAuthorizationClaims(user.id);
    return {
      ...user,
      roles: claims.roles,
      permissions: claims.permissions,
    };
  }

  private sanitizeUser(user: any) {
    if (!user) {
      return user;
    }

    const {
      password,
      refreshToken,
      emailVerifyToken,
      passwordResetToken,
      passwordResetExpires,
      ...safe
    } = user;

    return safe;
  }

  private async findUserByIdentifier(identifier: string, tenantId: string | null) {
    const normalized = identifier.trim();

    return (this.prisma as any).user.findFirst({
      where: {
        tenantId,
        OR: [
          { email: normalized.toLowerCase() },
          { username: normalized.toLowerCase() },
          { phone: normalized },
        ],
      },
    });
  }

  private async sendEmailVerification(email: string, fullName: string, token: string) {
    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3001');
    await this.mailService.sendMail({
      to: email,
      subject: 'Verify your email',
      html: `<p>Hello ${fullName}, verify here: ${baseUrl}/auth/verify-email?token=${token}</p>`,
    });
  }

  private async revokeUserSessions(userId: string) {
    await this.redisService.del(`refresh_token:${userId}`);

    const sessionKeys = await this.redisService.keys(`session:refresh:${userId}:*`);
    if (sessionKeys.length) {
      for (const key of sessionKeys) {
        await this.redisService.del(key);
      }
    }
  }

  private async blacklistAccessToken(token: string) {
    try {
      const payload = this.jwtHelper.verifyAccessToken(token);
      const ttl = Math.max((payload.exp ?? 0) - Math.floor(Date.now() / 1000), 1);
      await this.redisService.set(`blacklist:access:${this.hashToken(token)}`, '1', ttl);
    } catch {
      // Ignore invalid token blacklist attempts.
    }
  }

  private async touchPresence(userId: string, isOnline: boolean) {
    await (this.prisma as any).user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeenAt: isOnline ? undefined : new Date(),
      },
    });

    const presenceKey = `user:${userId}:online`;
    if (isOnline) {
      await this.redisService.set(presenceKey, 'true', 120);
    } else {
      await this.redisService.del(presenceKey);
    }
  }

  private async audit(
    action: string,
    userId: string | undefined,
    tenantId: string | null | undefined,
    metadata: Record<string, unknown>,
    ctx: AuthContext,
  ) {
    try {
      await (this.prisma as any).auditLog.create({
        data: {
          action,
          resource: 'auth',
          userId,
          tenantId: tenantId ?? null,
          metadata,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });
    } catch {
      // Do not fail auth flow if audit persistence fails.
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private refreshSessionKey(userId: string, refreshHash: string): string {
    return `session:refresh:${userId}:${refreshHash}`;
  }

  private otpKey(channel: 'email' | 'phone', identifier: string, tenantId: string | null): string {
    return `otp:${channel}:${tenantId ?? 'global'}:${identifier.toLowerCase()}`;
  }

  private getRefreshTtlSeconds(): number {
    return 7 * 24 * 60 * 60;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `user${Math.floor(1000 + Math.random() * 9000)}`;
  }
}
