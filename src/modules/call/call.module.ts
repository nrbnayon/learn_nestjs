import { Module } from '@nestjs/common';
import { SocketModule } from '../../socket/socket.module';
import { CallGateway } from './call.gateway';
import { CallService } from './call.service';

@Module({
  imports: [SocketModule],
  providers: [CallGateway, CallService],
  exports: [CallService],
})
export class CallModule {}