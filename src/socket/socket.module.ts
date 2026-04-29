import { Global, Module } from '@nestjs/common';
import { SocketStateService } from './socket-state.service';
import { SocketEmitterService } from './socket-emitter.service';

@Global()
@Module({
  providers: [SocketStateService, SocketEmitterService],
  exports: [SocketStateService, SocketEmitterService],
})
export class SocketModule {}
