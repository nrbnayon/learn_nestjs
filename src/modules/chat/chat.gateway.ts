import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../common/constants/events.constant';
import { ChatService } from './chat.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage(SOCKET_EVENTS.SEND_MESSAGE)
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendChatMessageDto,
  ) {
    const socketData = client as unknown as { data?: { userId?: string } };
    const message = this.chatService.sendMessage(
      socketData.data?.userId ?? '',
      dto,
    );
    client.to(dto.roomId).emit(SOCKET_EVENTS.NEW_MESSAGE, message);
    return message;
  }

  @SubscribeMessage(SOCKET_EVENTS.JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    const socketData = client as unknown as { data?: { userId?: string } };
    await client.join(roomId);
    return this.chatService.joinRoom(socketData.data?.userId ?? '', roomId);
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_ROOM)
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    const socketData = client as unknown as { data?: { userId?: string } };
    await client.leave(roomId);
    return this.chatService.leaveRoom(socketData.data?.userId ?? '', roomId);
  }
}
