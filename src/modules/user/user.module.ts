import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaModule } from '../../database/prisma.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule],
  controllers: [UserController],
  providers: [UserService, AuthGuard],
  exports: [UserService],
})
export class UserModule {}
