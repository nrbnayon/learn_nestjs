import { Module } from '@nestjs/common';
import { SocketModule } from '../../socket/socket.module';
import { PresenceGateway } from './presence.gateway';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [SocketModule, RedisModule],
  providers: [PresenceGateway],
  exports: [],
})
export class PresenceModule {}
