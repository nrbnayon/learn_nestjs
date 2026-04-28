import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '../../common/constants/events.constant';
import { MessageService } from '../message/message.service';
import { ConversationService } from '../conversation/conversation.service';
import { SendMessageDto } from '../message/dto/send-message.dto';

interface ChatSocket extends Socket {
  data: {
    userId: string;
  };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
  ) {}

  // ── Connection Handling ───────────────────────────────────────────────────

  handleConnection(client: ChatSocket) {
    const userId = client.data.userId;
    this.logger.log(
      `[DEBUG] Client connected to /chat: ${client.id} (User: ${userId})`,
    );
  }

  handleDisconnect(client: ChatSocket) {
    const userId = client.data.userId;
    this.logger.log(
      `[DEBUG] Client disconnected from /chat: ${client.id} (User: ${userId})`,
    );
  }

  // ── Room Management ───────────────────────────────────────────────────────

  @SubscribeMessage(SOCKET_EVENTS.JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: string | { id: string },
  ) {
    const roomId = typeof body === 'string' ? body : body.id;
    const userId = client.data.userId;
    this.logger.log(`[DEBUG] User ${userId} joining room: ${roomId}`);

    // Verify membership
    const isMember = await this.conversationService.isMember(roomId, userId);
    if (!isMember) {
      this.logger.warn(
        `[DEBUG] User ${userId} tried to join room ${roomId} without membership`,
      );
      return { event: SOCKET_EVENTS.ERROR, data: 'Not a member of this room' };
    }

    await client.join(roomId);
    this.logger.log(
      `[DEBUG] User ${userId} successfully joined room: ${roomId}`,
    );

    return { event: SOCKET_EVENTS.ROOM_JOINED, data: roomId };
  }

  @SubscribeMessage(SOCKET_EVENTS.LEAVE_ROOM)
  async handleLeaveRoom(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: string | { id: string },
  ) {
    const roomId = typeof body === 'string' ? body : body.id;
    const userId = client.data.userId;
    this.logger.log(`[DEBUG] User ${userId} leaving room: ${roomId}`);
    await client.leave(roomId);
    return { event: SOCKET_EVENTS.ROOM_LEFT, data: roomId };
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  @SubscribeMessage(SOCKET_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const userId = client.data.userId;
    this.logger.log(
      `[DEBUG] User ${userId} sending message to room: ${dto.roomId}`,
    );

    try {
      const message = await this.messageService.sendMessage(userId, dto);

      // Emit to everyone in the room EXCEPT the sender (sender gets it via return)
      client.to(dto.roomId).emit(SOCKET_EVENTS.NEW_MESSAGE, message);

      this.logger.log(
        `[DEBUG] Message ${message.id} broadcasted to room ${dto.roomId}`,
      );
      return message;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[DEBUG] Error sending message: ${errorMessage}`);
      return { event: SOCKET_EVENTS.ERROR, data: errorMessage };
    }
  }

  // ── WhatsApp Features (Typing, Presence) ──────────────────────────────────

  @SubscribeMessage(SOCKET_EVENTS.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: string | { id: string },
  ) {
    const roomId = typeof body === 'string' ? body : body.id;
    const userId = client.data.userId;
    this.logger.debug(
      `[DEBUG] User ${userId} started typing in room ${roomId}`,
    );
    client.to(roomId).emit(SOCKET_EVENTS.TYPING_INDICATOR, {
      roomId,
      userId,
      isTyping: true,
    });
  }

  @SubscribeMessage(SOCKET_EVENTS.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: string | { id: string },
  ) {
    const roomId = typeof body === 'string' ? body : body.id;
    const userId = client.data.userId;
    this.logger.debug(
      `[DEBUG] User ${userId} stopped typing in room ${roomId}`,
    );
    client.to(roomId).emit(SOCKET_EVENTS.TYPING_INDICATOR, {
      roomId,
      userId,
      isTyping: false,
    });
  }
}
