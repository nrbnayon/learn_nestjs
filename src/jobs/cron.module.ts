import { Module } from '@nestjs/common';
import { CleanupJob } from './cleanup.job';
import { NotificationJob } from './notification.job';

@Module({
  providers: [CleanupJob, NotificationJob],
  exports: [CleanupJob, NotificationJob],
})
export class CronModule {}