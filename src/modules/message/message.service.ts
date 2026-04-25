import { Injectable } from '@nestjs/common';
import { ReadMessageDto } from './dto/read-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessageService {
  listMessages(): unknown[] {
    return [] as unknown[];
  }

  sendMessage(dto: SendMessageDto): Record<string, unknown> {
    return {
      id: `message_${Date.now()}`,
      ...dto,
      createdAt: new Date().toISOString(),
    };
  }

  markRead(dto: ReadMessageDto): Record<string, unknown> {
    return {
      ...dto,
      readAt: new Date().toISOString(),
    };
  }
}
