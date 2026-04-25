import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@Injectable()
export class ChatService {
  joinRoom(userId: string, roomId: string) {
    return { userId, roomId, joinedAt: new Date().toISOString() };
  }

  leaveRoom(userId: string, roomId: string) {
    return { userId, roomId, leftAt: new Date().toISOString() };
  }

  sendMessage(userId: string, dto: SendChatMessageDto) {
    return {
      id: uuidv4(),
      senderId: userId,
      roomId: dto.roomId,
      content: dto.content,
      type: dto.type ?? 'TEXT',
      createdAt: new Date().toISOString(),
    };
  }
}
