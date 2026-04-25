import { Injectable } from '@nestjs/common';
import { QueueService } from '../../queue/queue.service';

@Injectable()
export class NotificationService {
  constructor(private readonly queueService: QueueService) {}

  dispatchNotification(userId: string, payload: Record<string, unknown>) {
    const toText = (value: unknown, fallback: string): string =>
      typeof value === 'string' ? value : fallback;

    this.queueService.sendNotification({
      userId,
      type: toText(payload.type, 'SYSTEM'),
      title: toText(payload.title, 'Notification'),
      body: toText(payload.body, ''),
      data: payload,
    });

    return {
      userId,
      payload,
      dispatchedAt: new Date().toISOString(),
    };
  }
}
