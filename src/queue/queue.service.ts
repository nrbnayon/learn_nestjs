import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';

export interface SendEmailJobData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

export interface SendNotificationJobData {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
  ) {}

  // ── Email Queue ───────────────────────────────────────────────────────────

  async sendEmail(data: SendEmailJobData, delayMs = 0): Promise<void> {
    await this.emailQueue.add('send-email', data, {
      delay: delayMs,
    });
    this.logger.debug(`Email job queued for: ${data.to}`);
  }

  async sendWelcomeEmail(user: { email: string; displayName: string }): Promise<void> {
    await this.sendEmail({
      to: user.email,
      subject: 'Welcome to NestJS Chat! 🎉',
      template: 'welcome',
      context: { displayName: user.displayName },
    });
  }

  async sendVerificationEmail(
    user: { email: string; displayName: string },
    token: string,
    baseUrl: string,
  ): Promise<void> {
    await this.sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      template: 'verify-email',
      context: {
        displayName: user.displayName,
        verificationUrl: `${baseUrl}/auth/verify-email?token=${token}`,
      },
    });
  }

  async sendPasswordResetEmail(
    user: { email: string; displayName: string },
    token: string,
    baseUrl: string,
  ): Promise<void> {
    await this.sendEmail({
      to: user.email,
      subject: 'Reset your password',
      template: 'password-reset',
      context: {
        displayName: user.displayName,
        resetUrl: `${baseUrl}/auth/reset-password?token=${token}`,
        expiresIn: '1 hour',
      },
    });
  }

  // ── Notification Queue ────────────────────────────────────────────────────

  async sendNotification(data: SendNotificationJobData): Promise<void> {
    await this.notificationQueue.add('send-notification', data);
    this.logger.debug(`Notification job queued for user: ${data.userId}`);
  }

  async sendBulkNotifications(notifications: SendNotificationJobData[]): Promise<void> {
    const jobs = notifications.map((data) => ({
      name: 'send-notification',
      data,
    }));
    await this.notificationQueue.addBulk(jobs);
    this.logger.debug(`${notifications.length} notification jobs queued`);
  }

  // ── Queue Health ──────────────────────────────────────────────────────────

  async getQueueStats(): Promise<Record<string, any>> {
    const [emailCounts, notifCounts] = await Promise.all([
      this.emailQueue.getJobCounts(),
      this.notificationQueue.getJobCounts(),
    ]);
    return {
      email: emailCounts,
      notification: notifCounts,
    };
  }
}
