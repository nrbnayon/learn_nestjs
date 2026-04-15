import { Injectable, Logger } from '@nestjs/common';

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

  // ── Email Queue ───────────────────────────────────────────────────────────

  async sendEmail(data: SendEmailJobData, delayMs = 0): Promise<void> {
    this.logger.debug(
      `Email job skipped (queue disabled in local mode): ${data.to} after ${delayMs}ms`,
    );
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
    this.logger.debug(`Notification job skipped (queue disabled in local mode): ${data.userId}`);
  }

  async sendBulkNotifications(notifications: SendNotificationJobData[]): Promise<void> {
    this.logger.debug(`${notifications.length} notification jobs skipped in local mode`);
  }

  // ── Queue Health ──────────────────────────────────────────────────────────

  async getQueueStats(): Promise<Record<string, any>> {
    return {
      email: { queued: 0, active: 0, completed: 0, failed: 0 },
      notification: { queued: 0, active: 0, completed: 0, failed: 0 },
    };
  }
}
