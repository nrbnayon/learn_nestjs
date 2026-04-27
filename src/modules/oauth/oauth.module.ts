import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OauthController } from './oauth.controller';
import { OauthService } from './oauth.service';

@Module({
  imports: [AuthModule, ConfigModule, JwtModule.register({}), PrismaModule],
  controllers: [OauthController],
  providers: [OauthService, AuthGuard],
  exports: [OauthService],
})
export class OauthModule {}
