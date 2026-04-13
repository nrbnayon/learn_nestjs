import { Global, Module } from '@nestjs/common';
import { SocketStateService } from './socket-state.service';

@Global()
@Module({
  providers: [SocketStateService],
  exports: [SocketStateService],
})
export class SocketModule {}
