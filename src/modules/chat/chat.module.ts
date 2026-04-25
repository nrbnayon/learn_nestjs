import { Module } from '@nestjs/common';
import { SocketModule } from '../../socket/socket.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [SocketModule],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
