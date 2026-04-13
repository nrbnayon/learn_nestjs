import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      // Load fresh user from DB to ensure they still exist and are active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatar: true,
          role: true,
          status: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.status === 'BANNED') {
        throw new UnauthorizedException('Your account has been banned');
      }

      request['user'] = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`JWT verification failed: ${message}`);
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    // Also support cookie-based auth
    return request.cookies?.['access_token'];
  }
}
