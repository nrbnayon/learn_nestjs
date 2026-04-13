import { Injectable } from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';

@Injectable()
export class NotificationService {
  constructor(private readonly queueService: QueueService) {}

  async dispatchNotification(userId: string, payload: Record<string, any>) {
    await this.queueService.sendNotification({
      userId,
      type: String(payload.type ?? 'SYSTEM'),
      title: String(payload.title ?? 'Notification'),
      body: String(payload.body ?? ''),
      data: payload,
    });

    return {
      userId,
      payload,
      dispatchedAt: new Date().toISOString(),
    };
  }
}