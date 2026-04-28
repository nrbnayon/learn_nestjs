import { Module } from '@nestjs/common';
import { SocketModule } from '../../socket/socket.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MessageModule } from '../message/message.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [SocketModule, MessageModule, ConversationModule],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
