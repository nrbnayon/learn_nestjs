import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.module';
import { PrismaService } from '../../database/prisma.service';
import { SendNotificationJobData } from '../queue.service';

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<SendNotificationJobData>): Promise<void> {
    this.logger.log(`Processing notification job [${job.id}] → user:${job.data.userId}`);

    try {
      await this.prisma.notification.create({
        data: {
          userId: job.data.userId,
          type: job.data.type as any,
          title: job.data.title,
          body: job.data.body,
          data: job.data.data ?? {},
        },
      });

      this.logger.log(`✅ Notification persisted for user ${job.data.userId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to process notification for user ${job.data.userId}`, error.stack);
      throw error;
    }
  }
}
