import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../common/constants/events.constant';
import { NotificationService } from './notification.service';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationGateway {
  constructor(private readonly notificationService: NotificationService) {}

  @SubscribeMessage(SOCKET_EVENTS.NOTIFICATION_NEW)
  handleNotification(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Record<string, unknown>,
  ) {
    const socketData = client as unknown as { data?: { userId?: string } };
    if (!socketData.data?.userId) {
      return;
    }

    return this.notificationService.dispatchNotification(
      socketData.data.userId,
      payload,
    );
  }
}
