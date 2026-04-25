import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationJob {
  runNotificationSweep(): { sweptAt: string } {
    return { sweptAt: new Date().toISOString() };
  }
}
