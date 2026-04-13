import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QUEUE_NAMES } from './queue.constants';
import { EmailProcessor } from './processors/email.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { MailService } from '../shared/mail.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('queue.redis.host', 'localhost'),
          port: configService.get<number>('queue.redis.port', 6379),
          password: configService.get<string>('queue.redis.password') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 3600,
            count: 1000,
          },
          removeOnFail: {
            age: 24 * 3600,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.NOTIFICATION },
    ),
  ],
  providers: [QueueService, EmailProcessor, NotificationProcessor, MailService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
