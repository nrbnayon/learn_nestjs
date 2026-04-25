import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  listConversations() {
    return this.conversationService.listConversations();
  }

  @Get(':id')
  getConversation(@Param('id') conversationId: string) {
    return this.conversationService.getConversation(conversationId);
  }

  @Post()
  createConversation(@Body() dto: CreateConversationDto) {
    return this.conversationService.createConversation(dto);
  }
}
