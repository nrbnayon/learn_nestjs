import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationJob {
  async runNotificationSweep(): Promise<{ sweptAt: string }> {
    return { sweptAt: new Date().toISOString() };
  }
}