import { Injectable } from '@nestjs/common';
import { ReadMessageDto } from './dto/read-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessageService {
  async listMessages(roomId: string) {
    return [];
  }

  async sendMessage(dto: SendMessageDto) {
    return {
      id: `message_${Date.now()}`,
      ...dto,
      createdAt: new Date().toISOString(),
    };
  }

  async markRead(dto: ReadMessageDto) {
    return {
      ...dto,
      readAt: new Date().toISOString(),
    };
  }
}