import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { MailService } from '../shared/mail.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [QueueService, MailService],
  exports: [QueueService],
})
export class QueueModule {}
