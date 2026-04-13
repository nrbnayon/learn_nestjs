import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';
import { MailService } from '../../shared/mail.service';
import { SendEmailJobData } from '../queue.service';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<SendEmailJobData>): Promise<void> {
    this.logger.log(`Processing email job [${job.id}] → ${job.data.to}`);

    try {
      await this.mailService.sendMail({
        to: job.data.to,
        subject: job.data.subject,
        template: job.data.template,
        context: job.data.context,
      });
      this.logger.log(`✅ Email sent to ${job.data.to}`);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`❌ Failed to send email to ${job.data.to}`, stack);
      throw error; // Re-throw to trigger BullMQ retry
    }
  }
}
