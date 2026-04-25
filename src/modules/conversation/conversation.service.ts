import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class ConversationService {
  listConversations(): unknown[] {
    return [] as unknown[];
  }

  getConversation(conversationId: string): Record<string, string> {
    return { id: conversationId };
  }

  createConversation(dto: CreateConversationDto): Record<string, unknown> {
    return {
      id: `conversation_${Date.now()}`,
      ...dto,
    };
  }
}
