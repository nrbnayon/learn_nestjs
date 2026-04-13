import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import configuration from './config/configuration';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import socketConfig from './config/socket.config';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SocketModule } from './socket/socket.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { MessageModule } from './modules/message/message.module';
import { ChatModule } from './modules/chat/chat.module';
import { CallModule } from './modules/call/call.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UploadModule } from './modules/upload/upload.module';
import { HealthModule } from './modules/health/health.module';
import { CronModule } from './jobs/cron.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, databaseConfig, redisConfig, socketConfig],
      validationSchema: envValidationSchema,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn', '7d') as any,
        },
      }),
    }),
    CommonModule,
    PrismaModule,
    RedisModule,
    SocketModule,
    QueueModule,
    AuthModule,
    UserModule,
    ConversationModule,
    MessageModule,
    ChatModule,
    CallModule,
    NotificationModule,
    UploadModule,
    HealthModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
