import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth/auth.service';

interface GoogleTokenInfo {
  sub: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  aud?: string;
  exp?: string;
}

@Injectable()
export class OauthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async loginWithGoogle(data: {
    idToken: string;
    tenantId?: string;
    tenantDomain?: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    if (!data.idToken?.trim()) {
      throw new BadRequestException('idToken is required');
    }

    const googleProfile = await this.verifyGoogleIdToken(data.idToken.trim());
    const tenantId = await this.resolveTenantId(data.tenantId, data.tenantDomain);

    let account = await this.prisma.oAuthAccount.findFirst({
      where: {
        provider: 'google',
        providerAccountId: googleProfile.sub,
      },
      include: { user: true },
    });

    if (!account) {
      const normalizedEmail = googleProfile.email?.toLowerCase();
      const userFromEmail = normalizedEmail
        ? await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
          })
        : null;

      const user =
        userFromEmail ??
        (await this.prisma.user.create({
          data: {
            fullName: googleProfile.name?.trim() || 'Google User',
            username: await this.generateUniqueUsername(
              normalizedEmail || `google_${googleProfile.sub}`,
            ),
            email: normalizedEmail,
            avatar: googleProfile.picture,
            password: null,
            role: 'USER',
            status: 'ACTIVE',
            tenantId,
            isEmailVerified: Boolean(normalizedEmail),
          },
        }));

      await this.ensureDefaultRole(user.id, user.tenantId ?? tenantId);

      account = await this.prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerAccountId: googleProfile.sub,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
        include: { user: true },
      });
    } else {
      await this.prisma.oAuthAccount.update({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: googleProfile.sub,
          },
        },
        data: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
      });
    }

    return this.authService.login(
      {
        identifier: googleProfile.sub,
        provider: 'google',
      },
      {
        tenantId: account.user.tenantId ?? tenantId ?? undefined,
        tenantDomain: data.tenantDomain,
      },
    );
  }

  async connectProvider(
    userId: string,
    data: {
    provider: 'google' | 'github' | 'facebook' | 'linkedin';
      providerAccountId?: string;
      idToken?: string;
    accessToken?: string;
    refreshToken?: string;
    },
  ) {
    const resolvedProviderAccountId = await this.resolveProviderAccountId(data);

    const existing = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: resolvedProviderAccountId,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (existing && existing.userId !== userId) {
      throw new ConflictException(
        'This provider account is already linked to another user',
      );
    }

    if (!existing) {
      return this.prisma.oAuthAccount.create({
        data: {
          userId,
          provider: data.provider,
          providerAccountId: resolvedProviderAccountId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
      });
    }

    return this.prisma.oAuthAccount.update({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: resolvedProviderAccountId,
        },
      },
      data: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      },
    });
  }

  async getUserByProvider(provider: string, providerAccountId: string) {
    const account = await this.prisma.oAuthAccount.findFirst({
      where: { provider, providerAccountId },
      include: { user: true },
    });

    if (!account?.user) {
      throw new UnauthorizedException('OAuth account not linked');
    }

    return account.user;
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo> {
    let response: Response;

    try {
      response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
    } catch {
      throw new UnauthorizedException('Unable to verify Google token');
    }

    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const tokenInfo = (await response.json()) as GoogleTokenInfo;

    if (!tokenInfo.sub) {
      throw new UnauthorizedException('Google token is missing subject');
    }

    if (tokenInfo.exp && Number(tokenInfo.exp) * 1000 <= Date.now()) {
      throw new UnauthorizedException('Google token has expired');
    }

    const configuredClientId = this.configService.get<string>(
      'oauth.googleClientId',
    );
    if (configuredClientId && tokenInfo.aud !== configuredClientId) {
      throw new UnauthorizedException('Google token audience mismatch');
    }

    return tokenInfo;
  }

  private async resolveProviderAccountId(data: {
    provider: 'google' | 'github' | 'facebook' | 'linkedin';
    providerAccountId?: string;
    idToken?: string;
  }): Promise<string> {
    if (data.provider === 'google' && data.idToken?.trim()) {
      const tokenInfo = await this.verifyGoogleIdToken(data.idToken.trim());
      return tokenInfo.sub;
    }

    if (!data.providerAccountId?.trim()) {
      throw new BadRequestException(
        'providerAccountId is required when idToken is not provided',
      );
    }

    return data.providerAccountId.trim();
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

  private async generateUniqueUsername(seed: string): Promise<string> {
    const normalizedSeed = seed
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    const baseRaw = normalizedSeed || 'user';
    const base = (baseRaw.length >= 3 ? baseRaw : `user_${baseRaw}`).slice(
      0,
      24,
    );

    let candidate = base;
    let tries = 0;

    while (tries < 20) {
      const existing = await this.prisma.user.findFirst({
        where: { username: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      candidate = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
      tries += 1;
    }

    throw new ConflictException('Unable to generate a unique username');
  }

  private async ensureDefaultRole(userId: string, tenantId: string | null) {
    let role = await this.prisma.appRole.findFirst({
      where: { name: 'USER', tenantId },
    });

    if (!role) {
      role = await this.prisma.appRole.create({
        data: { name: 'USER', tenantId },
      });
    }

    const existingAssignment = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
      },
      select: { id: true },
    });

    if (!existingAssignment) {
      await this.prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
        },
      });
    }
  }

  /**
   * Exchange Google authorization code for tokens (backend-to-backend)
   * Call this from your frontend after receiving the auth code from Google
   */
  async exchangeGoogleAuthCode(code: string, redirectUri: string) {
    const clientId = this.configService.get<string>('oauth.googleClientId');
    const clientSecret = this.configService.get<string>(
      'oauth.googleClientSecret',
    );

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth credentials not configured on backend',
      );
    }

    if (!code?.trim()) {
      throw new BadRequestException('Authorization code is required');
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code.trim(),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new UnauthorizedException(
          `Google token exchange failed: ${error}`,
        );
      }

      const tokens = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        id_token?: string;
        expires_in: number;
        token_type: string;
      };

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        idToken: tokens.id_token ?? null,
        expiresIn: tokens.expires_in,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        'Failed to exchange Google authorization code',
      );
    }
  }
}
