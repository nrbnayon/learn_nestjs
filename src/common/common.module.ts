import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../database/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthGuard } from './guards/auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { WsAuthGuard } from './guards/ws-auth.guard';

@Global()
@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule, RedisModule],
  providers: [AuthGuard, RolesGuard, PermissionsGuard, WsAuthGuard],
  exports: [
    AuthGuard,
    RolesGuard,
    PermissionsGuard,
    WsAuthGuard,
    JwtModule,
    RedisModule,
  ],
})
export class CommonModule {}
