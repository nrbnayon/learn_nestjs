import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<AuthenticatedUser & { roles: string[]; permissions: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        username: true,
        avatar: true,
        role: true,
        status: true,
        tenantId: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Your account has been banned');
    }

    return {
      ...user,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  }
}
