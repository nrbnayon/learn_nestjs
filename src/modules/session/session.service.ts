import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class SessionService {
  constructor(private readonly redisService: RedisService) {}

  async findByUser(userId: string) {
    const keys = await this.redisService.keys(`session:refresh:${userId}:*`);
    const sessions: Record<string, any>[] = [];

    for (const key of keys) {
      const session = await this.redisService.getJson<Record<string, any>>(key);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async revokeAll(userId: string) {
    const keys = await this.redisService.keys(`session:refresh:${userId}:*`);
    for (const key of keys) {
      await this.redisService.del(key);
    }
    await this.redisService.del(`refresh_token:${userId}`);
    return { revoked: keys.length };
  }
}
