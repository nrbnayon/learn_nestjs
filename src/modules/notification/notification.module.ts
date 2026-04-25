import { Module } from '@nestjs/common';
import { QueueModule } from '../../queue/queue.module';
import { SocketModule } from '../../socket/socket.module';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Module({
  imports: [QueueModule, SocketModule],
  providers: [NotificationGateway, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
