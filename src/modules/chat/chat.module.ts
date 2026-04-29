import { Module } from '@nestjs/common';
import { SocketModule } from '../../socket/socket.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MessageModule } from '../message/message.module';
import { ConversationModule } from '../conversation/conversation.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [SocketModule, MessageModule, ConversationModule, UserModule],
  providers: [ChatGateway, ChatService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
