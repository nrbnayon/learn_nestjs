import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../common/constants/events.constant';
import { SocketStateService } from '../../socket/socket-state.service';
import { ChatService } from './chat.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly socketState: SocketStateService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (userId) {
      await this.socketState.addSocket(userId, client);
      client.broadcast.emit('user_online', { userId });
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = await this.socketState.removeSocket(client.id);
    if (userId) {
      client.broadcast.emit('user_offline', { userId });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.SEND_MESSAGE)
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendChatMessageDto,
  ) {
    const message = this.chatService.sendMessage(client.data.userId, dto);
    client.to(dto.roomId).emit(SOCKET_EVENTS.NEW_MESSAGE, message);
    return message;
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_ROOM)
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    client.join(roomId);
    return this.chatService.joinRoom(client.data.userId, roomId);
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_ROOM)
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    client.leave(roomId);
    return this.chatService.leaveRoom(client.data.userId, roomId);
  }
}
