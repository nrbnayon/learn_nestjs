import { Injectable } from '@nestjs/common';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class ConversationService {
  async listConversations() {
    return [];
  }

  async getConversation(conversationId: string) {
    return { id: conversationId };
  }

  async createConversation(dto: CreateConversationDto) {
    return {
      id: `conversation_${Date.now()}`,
      ...dto,
    };
  }
}