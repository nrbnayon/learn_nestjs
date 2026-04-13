import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../database/prisma.module';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { WsAuthGuard } from './guards/ws-auth.guard';

@Global()
@Module({
  imports: [ConfigModule, JwtModule, PrismaModule],
  providers: [AuthGuard, RolesGuard, WsAuthGuard],
  exports: [AuthGuard, RolesGuard, WsAuthGuard],
})
export class CommonModule {}