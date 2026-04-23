import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OauthService {
  constructor(private readonly prisma: PrismaService) {}

  async connectProvider(data: {
    userId: string;
    provider: 'google' | 'github' | 'facebook' | 'linkedin';
    providerAccountId: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    return (this.prisma as any).oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        },
      },
      create: data,
      update: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      },
    });
  }

  async getUserByProvider(provider: string, providerAccountId: string) {
    const account = await (this.prisma as any).oAuthAccount.findFirst({
      where: { provider, providerAccountId },
      include: { user: true },
    });

    if (!account?.user) {
      throw new UnauthorizedException('OAuth account not linked');
    }

    return account.user;
  }
}
