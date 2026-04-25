import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService, type JwtSignOptions } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';

export interface JwtPayload {
  sub: string;
  tenantId?: string;
  user_role?: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user_role: string;
}

@Injectable()
export class JwtHelperService {
  private readonly logger = new Logger(JwtHelperService.name);

  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const expiresIn = this.configService.get<string>('jwt.expiresIn', '15m');
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: expiresIn as JwtSignOptions['expiresIn'],
    });
  }

  generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const expiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
      '7d',
    );
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: expiresIn as JwtSignOptions['expiresIn'],
    });
  }

  generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      user_role: payload.user_role ?? 'USER',
    };
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: this.configService.get<string>('jwt.secret'),
    });
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
    });
  }

  decodeToken(token: string): JwtPayload | null {
    return this.jwtService.decode<JwtPayload>(token);
  }

  generateSecureToken(): string {
    return uuidv4().replace(/-/g, '');
  }

  generateOtpCode(length = 6): string {
    const max = Math.pow(10, length);
    const min = Math.pow(10, length - 1);
    return String(Math.floor(Math.random() * (max - min) + min));
  }
}
