import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../database/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { JwtHelperService } from '../../shared/jwt.service';
import { MailService } from '../../shared/mail.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './auth.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn', '15m'),
        },
      }),
    }),
    PrismaModule,
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtHelperService, JwtStrategy, MailService],
  exports: [AuthService, JwtHelperService],
})
export class AuthModule {}
