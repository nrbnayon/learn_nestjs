import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { RedisSubscriber } from './redis.subscriber';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisService,
    RedisSubscriber,
  ],
  exports: [RedisService, RedisSubscriber],
})
export class RedisModule {}
