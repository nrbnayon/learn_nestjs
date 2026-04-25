import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class ConversationService {
  listConversations() {
    return [];
  }

  getConversation(conversationId: string) {
    return { id: conversationId };
  }

  createConversation(dto: CreateConversationDto) {
    return {
      id: `conversation_${Date.now()}`,
      ...dto,
    };
  }
}
