/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */
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
const PASSWORD_RESET_OTP_TTL_SECONDS = 10 * 60;
const PASSWORD_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_RESEND_ATTEMPTS = 3;
const OTP_MAX_INVALID_ATTEMPTS = 3;
const OTP_BLOCK_SECONDS = 6 * 60 * 60;
const LOGIN_LIMIT_WINDOW_SECONDS = 60;
const LOGIN_LIMIT_MAX_ATTEMPTS = 10;

interface AuthContext {
  tenantId?: string;
  tenantDomain?: string;
  userAgent?: string;
  ipAddress?: string;
  accessToken?: string;
}

type VerifyPlatform = 'web' | 'app';
type VerifyResult = 'success' | 'failure';
type OtpChannel = 'email' | 'phone';
type OtpPurpose = 'login' | 'account_verification' | 'password_reset';

interface OtpPayload {
  identifier: string;
  channel: OtpChannel;
  code: string;
  purpose: OtpPurpose;
  tenantId: string | null;
  token: string;
  userId?: string;
  createdAt: string;
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

    const shouldUseOtpVerification = Boolean(dto.otpVerification) || !dto.email;
    const requestedVerificationChannel: OtpChannel | undefined =
      dto.verificationChannel === 'phone'
        ? 'phone'
        : dto.verificationChannel === 'email'
          ? 'email'
          : undefined;
    const resolvedVerificationChannel = this.resolveVerificationChannel(
      requestedVerificationChannel,
      dto.email,
      dto.phone,
      shouldUseOtpVerification,
    );

    const prismaUnsafe = this.prisma;
    const user = await prismaUnsafe.user.create({
      data: {
        fullName: dto.fullName,
        username,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        password,
        role: 'USER',
        tenantId,
        emailVerifyToken: shouldUseOtpVerification ? null : emailVerifyToken,
        status: 'PENDING_VERIFICATION',
      },
    });

    await this.ensureDefaultRole(user.id, tenantId);

    if (!shouldUseOtpVerification && dto.email && emailVerifyToken) {
      await this.sendEmailVerification(
        dto.email,
        dto.fullName,
        emailVerifyToken,
        'web',
      );
    }

    let verificationToken: string | undefined;
    let verificationExpiresIn: number | undefined;

    if (shouldUseOtpVerification && resolvedVerificationChannel) {
      const otpResult = await this.sendOtp(
        {
          identifier:
            resolvedVerificationChannel === 'email'
              ? (dto.email ?? '')
              : (dto.phone ?? ''),
          channel: resolvedVerificationChannel,
          tenantId: tenantId ?? undefined,
          purpose: 'account_verification',
        },
        ctx,
      );

      verificationToken =
        otpResult.data && typeof otpResult.data === 'object'
          ? (otpResult.data as { verificationToken?: string }).verificationToken
          : undefined;
      verificationExpiresIn =
        otpResult.data && typeof otpResult.data === 'object'
          ? (otpResult.data as { expiresIn?: number }).expiresIn
          : undefined;
    }

    await this.audit(
      'auth.user.created',
      user.id,
      tenantId,
      {
        username: user.username,
        email: user.email,
      },
      ctx,
    );

    return {
      message: this.buildRegisterSuccessMessage({
        channel: resolvedVerificationChannel,
        identifier:
          resolvedVerificationChannel === 'email'
            ? user.email
            : resolvedVerificationChannel === 'phone'
              ? user.phone
              : user.email,
        verificationType: shouldUseOtpVerification ? 'otp' : 'link',
      }),
      data: {
        verificationRequired: true,
        verificationType: shouldUseOtpVerification ? 'otp' : 'link',
        channel: resolvedVerificationChannel,
        identifier:
          resolvedVerificationChannel === 'email'
            ? user.email
            : resolvedVerificationChannel === 'phone'
              ? user.phone
              : user.email,
        expiresIn: verificationExpiresIn,
        verificationToken,
      },
    };
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
      throw new BadRequestException(
        'Password is required for this login method',
      );
    }

    const tenantId = await this.resolveTenantId(ctx.tenantId, ctx.tenantDomain);
    const user = await this.findUserByIdentifier(dto.identifier, tenantId);

    if (!user?.password) {
      throw new UnauthorizedException(
        'Password login is not enabled for this account',
      );
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'BANNED') {
      throw new UnauthorizedException('This account is banned');
    }

    this.assertUserCanAuthenticate(user);

    await this.touchPresence(user.id, true);
    const tokens = await this.issueTokens(user.id, tenantId, ctx);

    await this.audit(
      'auth.user.login',
      user.id,
      tenantId,
      {
        method: 'password',
        identifier: dto.identifier,
      },
      ctx,
    );

    return {
      user: await this.getSafeUserById(user.id),
      tokens,
    };
  }

  async sendOtp(dto: OtpSendDto, ctx: AuthContext = {}) {
    const identifier = dto.identifier.trim();
    const userAnyTenant =
      await this.findUserByIdentifierAcrossTenants(identifier);
    const purpose: OtpPurpose = this.resolveOtpPurpose(
      dto.purpose,
      userAnyTenant,
    );
    const tenantId = await this.resolveTenantId(
      dto.tenantId ?? ctx.tenantId ?? userAnyTenant?.tenantId ?? undefined,
      ctx.tenantDomain,
    );
    const user = await this.findUserByIdentifier(identifier, tenantId);
    const channel: OtpChannel = this.resolveOtpChannel(
      dto.channel,
      identifier,
      user,
    );

    await this.assertOtpNotBlocked(purpose, identifier, tenantId);
    const otp =
      channel === 'phone' ? '123456' : this.jwtHelper.generateOtpCode(6);

    if (purpose === 'account_verification') {
      if (!user) {
        throw new NotFoundException('User not found for OTP identifier');
      }

      if (channel === 'email' && user.isEmailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      if (channel === 'phone' && user.isPhoneVerified) {
        throw new BadRequestException('Phone is already verified');
      }
    }

    if (purpose === 'password_reset' && !user) {
      // Keep password reset behavior non-enumerable.
      return {
        message:
          'If the account exists, a password reset OTP has been sent successfully.',
        data: {
          channel,
          purpose,
          expiresIn: PASSWORD_RESET_OTP_TTL_SECONDS,
        },
      };
    }

    const verificationToken = this.jwtHelper.generateSecureToken();
    const payload: OtpPayload = {
      identifier,
      channel,
      code: otp,
      purpose,
      tenantId,
      token: verificationToken,
      userId: user?.id,
      createdAt: new Date().toISOString(),
    };

    const ttl =
      purpose === 'password_reset'
        ? PASSWORD_RESET_OTP_TTL_SECONDS
        : OTP_TTL_SECONDS;
    await this.bumpOtpResendCounter(purpose, identifier, tenantId, ttl);

    await this.redisService.setJson(
      this.otpKey(purpose, channel, identifier, tenantId),
      payload,
      ttl,
    );

    await this.redisService.setJson(
      this.otpTokenKey(verificationToken),
      payload,
      ttl,
    );

    if (channel === 'email') {
      const purposeLabel =
        purpose === 'account_verification'
          ? 'account verification'
          : purpose === 'password_reset'
            ? 'password reset'
            : 'login';

      await this.mailService.sendMail({
        to: identifier,
        subject:
          purpose === 'password_reset'
            ? 'Your password reset OTP'
            : 'Your OTP Code',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:600px;margin:0 auto;">
            <h2 style="margin-bottom:12px;">One-time verification code</h2>
            <p>Use this code to complete your ${purposeLabel}:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0;">${otp}</p>
            <p>This code expires in <strong>${Math.floor(ttl / 60)} minutes</strong>.</p>
            <p>You can request a new code up to <strong>${OTP_MAX_RESEND_ATTEMPTS} times</strong>. If you exceed the limit or enter the wrong code ${OTP_MAX_INVALID_ATTEMPTS} times, OTP verification will be blocked for 6 hours.</p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
    }

    return {
      message: `OTP sent successfully via ${channel}.`,
      data: {
        channel,
        purpose,
        expiresIn: ttl,
        verificationToken,
        ...(channel === 'phone' ? { otp } : {}),
      },
    };
  }

  async verifyOtp(dto: OtpVerifyDto, ctx: AuthContext = {}) {
    const purpose: OtpPurpose = dto.purpose ?? 'login';
    const tenantId = await this.resolveTenantId(
      dto.tenantId ?? ctx.tenantId,
      ctx.tenantDomain,
    );

    const identifier = dto.identifier.trim();
    await this.assertOtpNotBlocked(purpose, identifier, tenantId);
    const stored = await this.findStoredOtp({
      identifier,
      tenantId,
      purpose,
      token: dto.token,
    });

    if (!stored || stored.code !== dto.otp) {
      await this.bumpOtpInvalidAttempts(purpose, identifier, tenantId);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.clearOtpGuardKeys(purpose, identifier, tenantId);

    const user = stored.userId
      ? await this.prisma.user.findUnique({
          where: { id: stored.userId },
        })
      : await this.findUserByIdentifier(identifier, tenantId);

    if (!user) {
      throw new NotFoundException('User not found for OTP identifier');
    }

    await this.deleteOtpPayload(stored);

    if (purpose === 'account_verification') {
      const updateData: Record<string, unknown> = {};

      if (stored.channel === 'email') {
        updateData.isEmailVerified = true;
        updateData.emailVerifyToken = null;
      }

      if (stored.channel === 'phone') {
        updateData.isPhoneVerified = true;
      }

      updateData.status = 'ACTIVE';

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      await this.audit(
        'auth.user.verified',
        user.id,
        tenantId,
        {
          channel: stored.channel,
          method: 'otp',
        },
        ctx,
      );

      return {
        message: `Account verified successfully via ${stored.channel} OTP. You can now log in.`,
        data: {
          verified: true,
          channel: stored.channel,
        },
      };
    }

    if (purpose === 'password_reset') {
      const resetToken = this.jwtHelper.generateSecureToken();
      const resetExpires = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      await this.audit(
        'auth.password.reset.otp_verified',
        user.id,
        tenantId,
        {
          channel: stored.channel,
        },
        ctx,
      );

      return {
        message:
          'OTP verified successfully. Use the reset token to set a new password.',
        data: {
          resetToken,
          expiresIn: Math.floor(PASSWORD_RESET_TOKEN_TTL_MS / 1000),
        },
      };
    }

    this.assertUserCanAuthenticate(user);
    await this.touchPresence(user.id, true);

    const tokens = await this.issueTokens(user.id, tenantId, ctx);
    await this.audit(
      'auth.user.login',
      user.id,
      tenantId,
      {
        method: 'otp',
        identifier,
      },
      ctx,
    );

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

  async refreshTokens(
    dto: RefreshTokenDto,
    ctx: AuthContext = {},
  ): Promise<TokenPair> {
    let payload: { sub: string; tenantId?: string };
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
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: dto.token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
        status: 'ACTIVE',
      },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      return { message: `No account found with the email ${dto.email}` };
    }

    const shouldUseOtp = Boolean(dto.otpVerification);

    if (shouldUseOtp) {
      await this.sendOtp({
        identifier: dto.email,
        channel: 'email',
        tenantId: user.tenantId ?? undefined,
        purpose: 'password_reset',
      });
      return { message: `A 6-digit OTP has been sent to ${user.email}` };
    } else {
      const resetToken = this.jwtHelper.generateSecureToken();
      const resetExpires = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      await this.sendPasswordResetEmail(
        user.email,
        user.fullName,
        resetToken,
        'web',
      );
      return {
        message: `A password reset link has been sent to ${user.email}`,
      };
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.prisma.user.update({
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
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

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });

    await this.revokeUserSessions(userId);
  }

  async getMe(userId: string) {
    return this.getSafeUserById(userId);
  }

  getVerifyEmailRedirectUrl(
    platform: VerifyPlatform,
    result: VerifyResult,
  ): string {
    if (platform === 'app') {
      return result === 'success'
        ? this.configService.get<string>(
            'app.appVerifyEmailSuccessUrl',
            'nestjschat://auth/verify-email/success',
          )
        : this.configService.get<string>(
            'app.appVerifyEmailFailureUrl',
            'nestjschat://auth/verify-email/failure',
          );
    }

    return result === 'success'
      ? this.configService.get<string>(
          'app.webVerifyEmailSuccessUrl',
          'http://localhost:5173/auth/verify-email/success',
        )
      : this.configService.get<string>(
          'app.webVerifyEmailFailureUrl',
          'http://localhost:5173/auth/verify-email/failure',
        );
  }

  private async issueTokens(
    userId: string,
    tenantId: string | null,
    ctx: AuthContext,
  ): Promise<TokenPair> {
    const { user_role, roles, permissions } =
      await this.buildAuthorizationClaims(userId);

    const tokens = this.jwtHelper.generateTokenPair({
      sub: userId,
      tenantId: tenantId ?? undefined,
      user_role,
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

  private async buildAuthorizationClaims(
    userId: string,
  ): Promise<{ user_role: string; roles: string[]; permissions: string[] }> {
    const user = await this.prisma.user.findUnique({
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
          permissionSet.add(
            `${permission.permission.action}:${permission.permission.subject}`,
          );
        }
      }
    }

    for (const permission of user?.permissions ?? []) {
      if (permission?.permission?.action && permission?.permission?.subject) {
        permissionSet.add(
          `${permission.permission.action}:${permission.permission.subject}`,
        );
      }
    }

    return {
      user_role: user?.role ?? 'USER',
      roles: [...roleSet],
      permissions: [...permissionSet],
    };
  }

  private async loginWithOtp(dto: LoginDto, ctx: AuthContext) {
    return this.verifyOtp(
      {
        identifier: dto.identifier,
        otp: dto.otp,
        tenantId: ctx.tenantId,
        purpose: 'login',
      },
      ctx,
    );
  }

  private async loginWithOAuthProvider(dto: LoginDto, ctx: AuthContext) {
    const tenantId = await this.resolveTenantId(ctx.tenantId, ctx.tenantDomain);
    const account = await this.prisma.oAuthAccount.findFirst({
      where: {
        provider: dto.provider,
        providerAccountId: dto.identifier,
      },
      include: { user: true },
    });

    if (!account?.user) {
      throw new UnauthorizedException('OAuth account is not connected');
    }

    this.assertUserCanAuthenticate(account.user);

    const tokens = await this.issueTokens(account.user.id, tenantId, ctx);
    await this.audit(
      'auth.user.login',
      account.user.id,
      tenantId,
      {
        method: 'oauth',
        provider: dto.provider,
      },
      ctx,
    );

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

  private async resolveTenantId(
    tenantId?: string,
    tenantDomain?: string,
  ): Promise<string | null> {
    if (tenantId) {
      return tenantId;
    }

    if (!tenantDomain) {
      return null;
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { domain: tenantDomain },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant could not be resolved');
    }

    return tenant.id;
  }

  private async resolveUsername(
    providedUsername: string | undefined,
    fullName: string,
  ): Promise<string> {
    const base = (
      providedUsername?.trim() || this.slugify(fullName)
    ).toLowerCase();

    let candidate = base;
    let tries = 0;

    while (tries < 10) {
      const existing = await this.prisma.user.findFirst({
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

    const existing = await this.prisma.user.findFirst({
      where: { OR: whereOr },
    });

    if (existing) {
      throw new ConflictException('User identity already exists');
    }
  }

  private async ensureDefaultRole(userId: string, tenantId: string | null) {
    const prismaUnsafe = this.prisma;

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
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Default role assignment failed: ${message}`);
    }
  }

  private async getSafeUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
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

  private sanitizeUser(user: Record<string, unknown>) {
    if (!user) {
      return user;
    }

    const safe: Record<string, unknown> = { ...user };
    delete safe.password;
    delete safe.refreshToken;
    delete safe.emailVerifyToken;
    delete safe.passwordResetToken;
    delete safe.passwordResetExpires;

    return safe;
  }

  private findUserByIdentifier(identifier: string, tenantId: string | null) {
    const normalized = identifier.trim();

    return this.prisma.user.findFirst({
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

  private assertUserCanAuthenticate(user: {
    status?: string;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
  }) {
    if (
      user.status === 'PENDING_VERIFICATION' &&
      !user.isEmailVerified &&
      !user.isPhoneVerified
    ) {
      throw new UnauthorizedException(
        'Account is not verified yet. Please complete verification first.',
      );
    }
  }

  private resolveVerificationChannel(
    preferredChannel: OtpChannel | undefined,
    email: string | undefined,
    phone: string | undefined,
    useOtpVerification: boolean,
  ): OtpChannel | undefined {
    if (useOtpVerification) {
      if (preferredChannel === 'email' && !email) {
        throw new BadRequestException(
          'verificationChannel=email requires an email',
        );
      }

      if (preferredChannel === 'phone' && !phone) {
        throw new BadRequestException(
          'verificationChannel=phone requires a phone number',
        );
      }

      if (preferredChannel) {
        return preferredChannel;
      }

      if (email) {
        return 'email';
      }

      if (phone) {
        return 'phone';
      }

      throw new BadRequestException(
        'A valid email or phone is required for OTP verification',
      );
    }

    if (email) {
      return 'email';
    }

    if (phone) {
      return 'phone';
    }

    return undefined;
  }

  private resolveOtpChannel(
    preferredChannel: OtpChannel | undefined,
    identifier: string,
    user: {
      email?: string | null;
      phone?: string | null;
    } | null,
  ): OtpChannel {
    if (preferredChannel) {
      return preferredChannel;
    }

    const normalized = identifier.trim();
    const normalizedLower = normalized.toLowerCase();

    if (normalized.includes('@')) {
      return 'email';
    }

    if (/^\+?\d{6,20}$/.test(normalized)) {
      return 'phone';
    }

    if (user?.email?.toLowerCase() === normalizedLower) {
      return 'email';
    }

    if (user?.phone === normalized) {
      return 'phone';
    }

    if (user?.email) {
      return 'email';
    }

    if (user?.phone) {
      return 'phone';
    }

    throw new BadRequestException(
      'Unable to auto-detect OTP channel. Provide channel=email or channel=phone.',
    );
  }

  private resolveOtpPurpose(
    requestedPurpose: OtpPurpose | undefined,
    user: {
      status?: string;
      isEmailVerified?: boolean;
      isPhoneVerified?: boolean;
    } | null,
  ): OtpPurpose {
    if (requestedPurpose) {
      return requestedPurpose;
    }

    if (
      user?.status === 'PENDING_VERIFICATION' &&
      !user.isEmailVerified &&
      !user.isPhoneVerified
    ) {
      return 'account_verification';
    }

    return 'login';
  }

  private findUserByIdentifierAcrossTenants(identifier: string) {
    const normalized = identifier.trim();

    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalized.toLowerCase() },
          { username: normalized.toLowerCase() },
          { phone: normalized },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        email: true,
        phone: true,
      },
    });
  }

  private buildRegisterSuccessMessage(params: {
    channel?: OtpChannel;
    identifier?: string | null;
    verificationType: 'otp' | 'link';
  }): string {
    const destination =
      params.identifier ??
      (params.channel === 'phone' ? 'your phone number' : 'your email');

    if (params.verificationType === 'otp') {
      return `Account created successfully. Check ${destination} for a 6-digit OTP (valid for 5 minutes).`;
    }

    return `Account created successfully. Check ${destination} for your verification link.`;
  }

  private async findStoredOtp(params: {
    identifier: string;
    tenantId: string | null;
    purpose: OtpPurpose;
    token?: string;
  }): Promise<OtpPayload | null> {
    if (params.token) {
      const byToken = await this.redisService.getJson<OtpPayload>(
        this.otpTokenKey(params.token),
      );

      if (
        byToken &&
        byToken.identifier.toLowerCase() === params.identifier.toLowerCase()
      ) {
        return byToken;
      }
    }

    const emailOtp = await this.redisService.getJson<OtpPayload>(
      this.otpKey(params.purpose, 'email', params.identifier, params.tenantId),
    );
    const phoneOtp = await this.redisService.getJson<OtpPayload>(
      this.otpKey(params.purpose, 'phone', params.identifier, params.tenantId),
    );

    return emailOtp ?? phoneOtp;
  }

  private async deleteOtpPayload(payload: OtpPayload): Promise<void> {
    await this.redisService.del(
      this.otpKey(
        payload.purpose,
        payload.channel,
        payload.identifier,
        payload.tenantId,
      ),
    );
    await this.redisService.del(this.otpTokenKey(payload.token));
  }

  private async sendEmailVerification(
    email: string,
    fullName: string,
    token: string,
    platform: VerifyPlatform = 'web',
  ) {
    const verificationUrl = this.buildApiUrl(
      `/auth/verify-email?token=${token}&platform=${platform}`,
    );
    await this.mailService.sendMail({
      to: email,
      subject: 'Verify your email',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:600px;margin:0 auto;">
          <h2 style="margin-bottom:12px;">Email Verification</h2>
          <p>Hello ${fullName},</p>
          <p>Click the button below to verify your email address:</p>
          <div style="margin:24px 0;">
            <a href="${verificationUrl}" style="background-color:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:700;">Verify Email</a>
          </div>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
  }

  private async sendPasswordResetEmail(
    email: string,
    fullName: string,
    token: string,
    platform: VerifyPlatform = 'web',
  ) {
    const baseUrl = this.configService.get<string>(
      'app.webUrl',
      'http://localhost:5173',
    );
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}&platform=${platform}`;

    await this.mailService.sendMail({
      to: email,
      subject: 'Reset your password',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:600px;margin:0 auto;">
          <h2 style="margin-bottom:12px;">Password Reset Request</h2>
          <p>Hello ${fullName},</p>
          <p>We received a request to reset your password. Click the button below to set a new password:</p>
          <div style="margin:24px 0;">
            <a href="${resetUrl}" style="background-color:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:700;">Reset Password</a>
          </div>
          <p>If you did not request this, please ignore this email.</p>
          <p>This link expires in 10 minutes.</p>
        </div>
      `,
    });
  }

  private buildApiUrl(path: string): string {
    const baseUrl = this.configService.get<string>(
      'app.baseUrl',
      'http://localhost:3001',
    );
    const apiPrefix = this.configService.get<string>('app.apiPrefix', 'api/v1');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}/${apiPrefix}${normalizedPath}`;
  }

  private async revokeUserSessions(userId: string) {
    await this.redisService.del(`refresh_token:${userId}`);

    const sessionKeys = await this.redisService.keys(
      `session:refresh:${userId}:*`,
    );
    if (sessionKeys.length) {
      for (const key of sessionKeys) {
        await this.redisService.del(key);
      }
    }
  }

  private async blacklistAccessToken(token: string) {
    try {
      const payload = this.jwtHelper.verifyAccessToken(token);
      const ttl = Math.max(
        (payload.exp ?? 0) - Math.floor(Date.now() / 1000),
        1,
      );
      await this.redisService.set(
        `blacklist:access:${this.hashToken(token)}`,
        '1',
        ttl,
      );
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

  private otpKey(
    purpose: OtpPurpose,
    channel: OtpChannel,
    identifier: string,
    tenantId: string | null,
  ): string {
    return `otp:${purpose}:${channel}:${tenantId ?? 'global'}:${identifier.toLowerCase()}`;
  }

  private otpTokenKey(token: string): string {
    return `otp:token:${token}`;
  }

  private otpResendKey(
    purpose: OtpPurpose,
    identifier: string,
    tenantId: string | null,
  ): string {
    return `otp:${purpose}:resend:${tenantId ?? 'global'}:${identifier.toLowerCase()}`;
  }

  private otpInvalidAttemptKey(
    purpose: OtpPurpose,
    identifier: string,
    tenantId: string | null,
  ): string {
    return `otp:${purpose}:invalid:${tenantId ?? 'global'}:${identifier.toLowerCase()}`;
  }

  private otpBlockKey(
    purpose: OtpPurpose,
    identifier: string,
    tenantId: string | null,
  ): string {
    return `otp:${purpose}:blocked:${tenantId ?? 'global'}:${identifier.toLowerCase()}`;
  }

  private async assertOtpNotBlocked(
    purpose: OtpPurpose,
    identifier: string,
    tenantId: string | null,
  ): Promise<void> {
    const blockKey = this.otpBlockKey(purpose, identifier, tenantId);
    const isBlocked = await this.redisService.exists(blockKey);

    if (!isBlocked) {
      return;
    }

    throw new HttpException(
      'Too many OTP attempts. OTP is blocked for 6 hours.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async bumpOtpResendCounter(
    purpose: OtpPurpose,
    identifier: string,
    tenantId: string | null,
    ttl: number,
  ): Promise<void> {
    const key = this.otpResendKey(purpose, identifier, tenantId);
    const attempts = await this.redisService.incr(key);

    if (attempts === 1) {
      await this.redisService.expire(key, ttl);
    }

    if (attempts > OTP_MAX_RESEND_ATTEMPTS) {
      await this.redisService.set(
        this.otpBlockKey(purpose, identifier, tenantId),
        'resend_limit',
        OTP_BLOCK_SECONDS,
      );
      await this.redisService.del(key);

      throw new HttpException(
        'OTP resend limit exceeded. OTP is blocked for 6 hours.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async bumpOtpInvalidAttempts(
    purpose: OtpPurpose,
    identifier: string,
    tenantId: string | null,
  ): Promise<void> {
    const key = this.otpInvalidAttemptKey(purpose, identifier, tenantId);
    const attempts = await this.redisService.incr(key);

    if (attempts === 1) {
      await this.redisService.expire(key, OTP_TTL_SECONDS);
    }

    if (attempts >= OTP_MAX_INVALID_ATTEMPTS) {
      await this.redisService.set(
        this.otpBlockKey(purpose, identifier, tenantId),
        'invalid_attempt_limit',
        OTP_BLOCK_SECONDS,
      );
      await this.redisService.del(key);
    }
  }

  private async clearOtpGuardKeys(
    purpose: OtpPurpose,
    identifier: string,
    tenantId: string | null,
  ): Promise<void> {
    await this.redisService.del(
      this.otpResendKey(purpose, identifier, tenantId),
    );
    await this.redisService.del(
      this.otpInvalidAttemptKey(purpose, identifier, tenantId),
    );
  }

  private getRefreshTtlSeconds(): number {
    return 7 * 24 * 60 * 60;
  }

  private slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') ||
      `user${Math.floor(1000 + Math.random() * 9000)}`
    );
  }
}
