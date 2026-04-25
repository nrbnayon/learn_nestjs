import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../common/constants/events.constant';
import { NotificationService } from './notification.service';

interface NotificationSocketPayload {
  userId?: string;
}

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
    const socketData = client.data as NotificationSocketPayload;
    return this.notificationService.dispatchNotification(
      socketData.userId ?? '',
      payload,
    );
  }
}
