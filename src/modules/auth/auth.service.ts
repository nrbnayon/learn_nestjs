import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { JwtHelperService, TokenPair } from '../../shared/jwt.service';
import { QueueService } from '../../queue/queue.service';
import { RedisService } from '../../redis/redis.service';
import { DateUtil } from '../../common/utils/date.util';
import {
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  RefreshTokenDto,
  ChangePasswordDto,
} from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtHelper: JwtHelperService,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    // Check for duplicates
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      if (existing.email === dto.email) {
        throw new ConflictException('Email already in use');
      }
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const emailVerifyToken = this.jwtHelper.generateSecureToken();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        displayName: dto.displayName,
        passwordHash,
        emailVerifyToken,
        status: 'PENDING_VERIFICATION',
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Send welcome + verification emails via queue
    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:8080');
    await this.queueService.sendWelcomeEmail({ email: user.email, displayName: user.displayName });
    await this.queueService.sendVerificationEmail(
      { email: user.email, displayName: user.displayName },
      emailVerifyToken,
      baseUrl,
    );

    const tokens = this.jwtHelper.generateTokenPair({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`New user registered: ${user.email}`);

    return { user, tokens };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Your account has been banned');
    }

    // Update last seen
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeenAt: new Date() },
    });

    const tokens = this.jwtHelper.generateTokenPair({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash, emailVerifyToken, passwordResetToken, passwordResetExpires, refreshToken, ...safeUser } = user;
    return { user: safeUser, tokens };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(userId: string): Promise<void> {
    await this.redisService.del(`refresh_token:${userId}`);
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeenAt: new Date(), refreshToken: null },
    });
    this.logger.log(`User ${userId} logged out`);
  }

  // ── Refresh Token ─────────────────────────────────────────────────────────

  async refreshTokens(dto: RefreshTokenDto): Promise<TokenPair> {
    let payload: any;
    try {
      payload = this.jwtHelper.verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.redisService.get(`refresh_token:${payload.sub}`);
    if (!stored || stored !== dto.refreshToken) {
      throw new UnauthorizedException('Refresh token revoked or invalid');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'BANNED') {
      throw new UnauthorizedException('User not found or banned');
    }

    const tokens = this.jwtHelper.generateTokenPair({
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  // ── Verify Email ──────────────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: dto.token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Email verified for user: ${user.email}`);
  }

  // ── Forgot Password ───────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Do NOT reveal if user exists
    if (!user) return;

    const resetToken = this.jwtHelper.generateSecureToken();
    const resetExpires = DateUtil.addHours(new Date(), 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken, passwordResetExpires: resetExpires },
    });

    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:8080');
    await this.queueService.sendPasswordResetEmail(
      { email: user.email, displayName: user.displayName },
      resetToken,
      baseUrl,
    );

    this.logger.log(`Password reset email queued for: ${user.email}`);
  }

  // ── Reset Password ────────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all sessions
    await this.redisService.del(`refresh_token:${user.id}`);
    this.logger.log(`Password reset for user: ${user.email}`);
  }

  // ── Change Password ───────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate all refresh tokens
    await this.redisService.del(`refresh_token:${userId}`);
    this.logger.log(`Password changed for user: ${userId}`);
  }

  // ── Me ────────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        isOnline: true,
        emailVerified: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const ttlDays = 30;
    await this.redisService.set(`refresh_token:${userId}`, token, ttlDays * 24 * 3600);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: token },
    });
  }
}
